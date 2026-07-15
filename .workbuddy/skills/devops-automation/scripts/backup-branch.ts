#!/usr/bin/env tsx
/**
 * @file backup-branch.ts
 * @description 定时备份：将工作区改动生成快照提交到备份分支（默认 backup/auto），不污染当前分支。
 *
 * 安全设计（零破坏 + 防泄露 + 不污染主分支）：
 *   - 使用底层 plumbing（git add → write-tree → commit-tree → branch -f）创建快照，
 *     直接把 backup/auto 分支指向当前工作树，**绝不改动当前分支（如 main）的提交历史**，
 *     也不切换分支、不 reset --hard、不碰个人目录。
 *   - 因走 plumbing 而非 `git commit`，预提交钩子不会运行——快照不被临时门禁阻断，
 *     同时也不存在「绕过钩子」的争议；主分支开发仍走 `npm run commit` 强制全部门禁。
 *   - 敏感文件防护：staged 阶段若发现 .env / 密钥 / token 等模式，自动从快照中排除并告警，避免泄露。
 *   - 推送失败（无凭证/网络）仅告警，本地快照保留；备份分支为自动化独占，用 --force-with-lease 安全更新。
 *
 * 用法:
 *   tsx backup-branch.ts [--branch <name>] [--remote <name>] [--no-push] [--message <msg>]
 * 退出码: 0=已备份或无需备份, 1=备份失败
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function findProjectRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, '.git'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const ROOT = findProjectRoot(__dirname)

/** 敏感文件名模式（小写匹配 basename），命中则从快照中排除 */
const SECRET_BASE: RegExp[] = [
  /^\.env$/,
  /^\.env\./,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /\.keystore$/,
  /\.jks$/,
  /\.token$/,
  /\.secret$/,
  /^credentials/i,
  /^id_rsa$/,
  /^id_dsa$/,
  /^id_ecdsa$/,
  /^id_ed25519$/,
  /private[-_]?key/i,
]

function isSecret(relPath: string): boolean {
  const base = relPath.split('/').pop() ?? relPath
  const lower = base.toLowerCase()
  return SECRET_BASE.some((re) => re.test(lower))
}

interface CliArgs {
  branch: string
  remote: string
  noPush: boolean
  message: string
}

function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { branch: 'backup/auto', remote: 'origin', noPush: false, message: '' }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--branch') a.branch = argv[++i] ?? a.branch
    else if (t === '--remote') a.remote = argv[++i] ?? a.remote
    else if (t === '--no-push') a.noPush = true
    else if (t === '--message') a.message = argv[++i] ?? a.message
  }
  return a
}

interface GitOpts {
  allowFail?: boolean
}

function git(args: string[], opts: GitOpts = {}): string {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (e) {
    if (opts.allowFail) return ''
    const err = e as { stderr?: string; stdout?: string; message?: string }
    throw new Error(`git ${args.join(' ')} 失败: ${err.stderr || err.stdout || err.message}`)
  }
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function main(): number {
  const args = parseArgs(process.argv.slice(2))

  // 1. 是否有改动（含未跟踪文件）
  const status = git(['status', '--porcelain'])
  if (!status) {
    console.log(`[backup] 工作区无改动，跳过备份（${new Date().toISOString()}）`)
    return 0
  }

  // 2. 暂存全部改动
  git(['add', '-A'])

  // 3. 排除敏感文件，避免泄露
  const staged = git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean)
  const secrets = staged.filter(isSecret)
  if (secrets.length > 0) {
    git(['reset', '--', ...secrets])
    console.warn(
      `[backup] 已排除 ${secrets.length} 个敏感文件，不纳入备份（防泄露）：${secrets.join(', ')}`,
    )
  }
  const stagedAfter = git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean)
  if (stagedAfter.length === 0) {
    console.log('[backup] 仅有敏感文件改动，无备份价值，跳过（敏感文件已排除）')
    return 0
  }

  // 4. 用底层 plumbing 创建快照：直接把 backup/auto 指向当前工作树，不污染当前分支
  const tree = git(['write-tree'])
  const parent = git(['rev-parse', args.branch], { allowFail: true }) || git(['rev-parse', 'HEAD'])
  const msg = args.message || `backup: auto-snapshot ${nowStamp()}`
  const newSha = git(['commit-tree', tree, '-p', parent, '-m', msg])
  git(['branch', '-f', args.branch, newSha])
  console.log(
    `[backup] 已在分支 ${args.branch} 创建快照 ${newSha.slice(0, 10)}（${stagedAfter.length} 项改动，当前分支未受影响）`,
  )

  if (args.noPush) {
    console.log('[backup] --no-push 已指定，跳过推送。本地快照已保存。')
    return 0
  }

  // 5. 推送备份分支（force-with-lease 安全更新自动化独占分支）
  const remotes = git(['remote'], { allowFail: true })
  if (!remotes.includes(args.remote)) {
    console.warn(
      `[backup] 未找到远程 "${args.remote}"，跳过推送；本地快照已保存于分支 ${args.branch}`,
    )
    return 0
  }
  try {
    git(['push', '--force-with-lease', args.remote, args.branch])
    console.log(`[backup] 已推送至 ${args.remote}/${args.branch}`)
  } catch (e) {
    console.warn(
      `[backup] 推送失败（可能无凭证或网络不可达），本地快照已保留：${(e as Error).message}`,
    )
  }
  return 0
}

try {
  process.exit(main())
} catch (e) {
  console.error('[backup] 备份失败:', (e as Error).message)
  process.exit(1)
}
