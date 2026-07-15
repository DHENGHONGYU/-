#!/usr/bin/env tsx
/**
 * @file batch-deploy.ts
 * @description 批量部署：1) 构建产出 dist；2) 将 dist 增量复制到多个目标目录（批量）。
 *
 * 安全设计（零破坏 + 目标围栏）：
 *   - 静态托管（如 CloudStudio）的上传由宿主 agent 在构建后用 workbuddy_cloudstudio_deploy 完成；
 *     本脚本只负责「可确定执行的本地部分」：构建 + 多目标目录复制，避免依赖外部账号状态。
 *   - 复制使用增量 fs.cpSync（recursive），不删除目标已有其他文件；不执行 rm -rf。
 *   - 目标围栏：拒绝写入项目根、.git、node_modules，以及个人目录（Desktop/Downloads/Documents…）
 *     与系统目录（C:/Windows、C:/Program Files…），防止误覆盖造成不可逆损失。
 *
 * 用法:
 *   tsx batch-deploy.ts [--target <dir>]... [--build-command "npm run build"]
 *                       [--dist <path>] [--no-build]
 * 退出码: 0=成功, 1=失败
 */
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
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

/** 规范化路径为小写正斜杠，便于模式匹配 */
function norm(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

/** 目标目录围栏：命中则返回被拦截的原因，否则返回空串 */
function blockedReason(absPath: string): string {
  const n = norm(absPath)
  const rootN = norm(ROOT)
  if (n === rootN) return '目标不能等于项目根目录'
  if (n.startsWith(rootN + '/.git')) return '目标不能是 .git 目录'
  if (n.startsWith(rootN + '/node_modules')) return '目标不能是 node_modules 目录'
  if (/^c:[/\\]windows($|[/\\])/i.test(n)) return '目标不能是系统目录 C:/Windows'
  if (/^c:[/\\]program files/i.test(n)) return '目标不能是系统目录 C:/Program Files'
  if (
    /^c:[/\\]users[/\\][^/\\]+[/\\](desktop|downloads|documents|pictures|music|videos|appdata)$/i.test(
      n,
    )
  ) {
    return '目标不能是个人目录（Desktop/Downloads/Documents…）'
  }
  return ''
}

interface CliArgs {
  targets: string[]
  buildCommand: string
  dist: string
  noBuild: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { targets: [], buildCommand: 'npm run build', dist: '', noBuild: false }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--target') {
      const v = argv[++i]
      if (v) a.targets.push(v)
    } else if (t === '--build-command') a.buildCommand = argv[++i] ?? a.buildCommand
    else if (t === '--dist') a.dist = argv[++i] ?? a.dist
    else if (t === '--no-build') a.noBuild = true
  }
  return a
}

function resolveTarget(raw: string): string {
  return isAbsolute(raw) ? raw : resolve(ROOT, raw)
}

function main(): number {
  const args = parseArgs(process.argv.slice(2))
  const distPath = args.dist ? resolveTarget(args.dist) : resolve(ROOT, 'dist')

  // 1. 构建
  if (!args.noBuild) {
    console.log(`[deploy] 开始构建：${args.buildCommand}`)
    try {
      execSync(args.buildCommand, { cwd: ROOT, stdio: 'inherit' })
    } catch (e) {
      console.error('[deploy] 构建失败，终止部署：', (e as Error).message)
      return 1
    }
  } else {
    console.log('[deploy] --no-build 已指定，跳过构建。')
  }

  if (!existsSync(distPath)) {
    console.error(`[deploy] 未找到构建产物目录：${distPath}`)
    return 1
  }

  const targets = args.targets.length > 0 ? args.targets : []
  if (targets.length === 0) {
    console.log(`[deploy] 未指定 --target，仅完成构建。dist 位于：${distPath}`)
    console.log('[deploy] 提示：静态托管可由宿主 agent 调用 workbuddy_cloudstudio_deploy 上传 dist。')
    return 0
  }

  // 2. 目标围栏 + 批量复制（增量复制，不删除目标既有文件）
  for (const raw of targets) {
    const target = resolveTarget(raw)
    const reason = blockedReason(target)
    if (reason) {
      console.error(`[deploy] 已拦截危险目标「${target}」：${reason}`)
      return 1
    }
    if (norm(target).startsWith(norm(ROOT) + '/') && !norm(target).startsWith(norm(ROOT) + '/dist')) {
      console.warn(`[deploy] 警告：目标位于项目目录内（${target}），请确认意图。`)
    }
    if (!existsSync(target)) mkdirSync(target, { recursive: true })
    cpSync(distPath, target, { recursive: true })
    console.log(`[deploy] 已部署 dist → ${target}`)
  }
  console.log(`[deploy] 完成：共部署 ${targets.length} 个目标。`)
  return 0
}

try {
  process.exit(main())
} catch (e) {
  console.error('[deploy] 部署失败:', (e as Error).message)
  process.exit(1)
}
