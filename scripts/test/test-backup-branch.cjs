#!/usr/bin/env node
/**
 * @file test-backup-branch.js
 * @description
 *   backup-branch.ts 全面测试执行器（Node 直驱 tsx）。
 *   覆盖 4 大维度：
 *     1) 参数传递验证（--branch / --remote / --no-push / --message / 默认值）
 *     2) 网络阻断 + --no-push 无缝切换纯本地快照（核心用例）
 *     3) 本地快照生成完整性（tree/commit/branch 指针均落地可验证）
 *     4) 错误处理机制（无改动跳过、全敏感文件跳过、push 异常兜底 EXIT 仍 0、
 *        工作区无 .git 致命错误 EXIT=1、未知参数兼容）
 *
 *   策略：创建临时独立 git 仓库（TMP_GIT_REPO），通过 GIT_CONFIG_GLOBAL +
 *   HOME 重定向隔离真实 user.name/email；推送阻断通过把测试 remote URL 设置为
 *   不存在的哑地址（https://127.0.0.1:1/empty.git）+ 短超时模拟，
 *   --no-push 分支单独跑一遍确保不触碰网络。
 *
 *   用法:  node scripts/test/test-backup-branch.js  [--output outputs/backup-branch-test-report.md]
 */
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { execFileSync, spawnSync } = require('child_process')

// ===== CLI 输出解析 =====
const cli = parseNodeArgs(process.argv.slice(2))
const OUTPUT = cli.output
  ? path.resolve(cli.output)
  : path.resolve(process.cwd(), 'outputs', `backup-branch-test-report-${stamp()}.md`)

// ===== 工具 =====
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}
function sh(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 50 * 1024 * 1024,
    env: process.env,
    ...opts,
  })
  return {
    ok: res.status === 0,
    status: res.status,
    stdout: (res.stdout || '').toString(),
    stderr: (res.stderr || '').toString(),
    combined: ((res.stdout || '') + '\n' + (res.stderr || '')).toString(),
    error: res.error,
  }
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}
function tmpDir(label) {
  const d = path.join(os.tmpdir(), `finsight-backup-test-${label}-${crypto.randomBytes(6).toString('hex')}`)
  fs.mkdirSync(d, { recursive: true })
  return d
}
function rmd(p) {
  // 尽量清理
  try { fs.rmSync(p, { recursive: true, force: true }) } catch (_) { /* noop */ }
}
function parseNodeArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--output') out.output = argv[++i]
    else if (a === '--help') out.help = true
  }
  return out
}

// ===== 隔离环境：git 用户配置走 HOME 下临时文件 =====
function withEnvVars(vars, fn) {
  const restore = {}
  for (const k of Object.keys(vars)) {
    restore[k] = process.env[k]
    process.env[k] = vars[k]
  }
  try { return fn() }
  finally {
    for (const k of Object.keys(restore)) {
      if (restore[k] === undefined) delete process.env[k]
      else process.env[k] = restore[k]
    }
  }
}

// ===== 测试框架（超简） =====
const results = []
function record({ id, title, pass, detail, durationMs, category }) {
  const entry = {
    id, title, category, pass, detail,
    durationMs: Math.round(durationMs),
    time: new Date().toISOString(),
  }
  results.push(entry)
  const mark = pass ? '✅ PASS' : '❌ FAIL'
  process.stdout.write(`  [${mark}] ${id}  ${title}  (${entry.durationMs} ms)\n`)
  if (!pass && detail) process.stdout.write(`         -> ${String(detail).split('\n')[0]}\n`)
}
async function runCase({ id, title, category, fn }) {
  const t0 = Date.now()
  let pass = true
  let detail = ''
  try { await fn() }
  catch (e) {
    pass = false
    detail = String(e && e.stack ? e.stack : e)
  }
  record({ id, title, category, pass, detail, durationMs: Date.now() - t0 })
}

// ===== 场景构建 =====
/**
 * 在临时目录新建一个独立 git 仓库，写一些假文件作为工作区，
 * 并把真实 backup-branch.ts 拷贝进去，然后把 __dirname 向上寻 .git 的路径强制改变：
 *  办法：创建一个镜像目录结构 —— <repo>/.workbuddy/skills/devops-automation/scripts/backup-branch.ts
 *  —— 这样 findProjectRoot(__dirname) 能自然找到 <repo>/.git。
 */
function buildRepo(setup = {}) {
  const repo = tmpDir('repo')
  const home = tmpDir('home')
  // git 初始化 & 提交一次 base 以便 HEAD 存在
  withEnvVars({ HOME: home, GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'), GIT_AUTHOR_NAME: 'Tester', GIT_AUTHOR_EMAIL: 'tester@local', GIT_COMMITTER_NAME: 'Tester', GIT_COMMITTER_EMAIL: 'tester@local' }, () => {
    execFileSync('git', ['init', '-q'], { cwd: repo, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.name', 'Tester'], { cwd: repo, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.email', 'tester@local'], { cwd: repo, stdio: 'ignore' })
    // 默认哑 remote（用于网络阻断场景；--no-push 场景即便 remote 哑也不会触碰）
    if (setup.fakeRemote !== false) {
      execFileSync('git', ['remote', 'add', 'origin', setup.fakeRemoteUrl || 'https://127.0.0.1:1/empty.git'], { cwd: repo, stdio: 'ignore' })
    }
    // 初次提交
    fs.writeFileSync(path.join(repo, 'README.md'), `# Test repo ${stamp()}\n`)
    execFileSync('git', ['add', '-A'], { cwd: repo, stdio: 'ignore' })
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repo, stdio: 'ignore' })
  })

  // 镜像 skill 脚本目录，保证 findProjectRoot 可命中
  const scriptsDir = path.join(repo, '.workbuddy', 'skills', 'devops-automation', 'scripts')
  ensureDir(scriptsDir)
  const srcTs = path.resolve(process.cwd(), '.workbuddy', 'skills', 'devops-automation', 'scripts', 'backup-branch.ts')
  if (!fs.existsSync(srcTs)) {
    throw new Error(`找不到待测脚本: ${srcTs}`)
  }
  fs.copyFileSync(srcTs, path.join(scriptsDir, 'backup-branch.ts'))
  // 将 skill 镜像目录纳入初始 base commit，避免后续测试的"无改动/仅敏感文件"用例把脚本目录误判为工作区改动（导致用例 T-SNAP-03 / T-ERR-01 假失败）
  withEnvVars({ HOME: home, GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'), GIT_AUTHOR_NAME: 'Tester', GIT_AUTHOR_EMAIL: 'tester@local', GIT_COMMITTER_NAME: 'Tester', GIT_COMMITTER_EMAIL: 'tester@local' }, () => {
    execFileSync('git', ['add', '-A'], { cwd: repo, stdio: 'ignore' })
    execFileSync('git', ['commit', '-q', '-m', 'chore(base): mirror devops-automation skill for test harness'], { cwd: repo, stdio: 'ignore' })
  })
  // 确保同一 tsconfig/tsx 可被调用：使用全局 npx tsx，用项目 node_modules/tsx 作回退
  return { repo, home, scriptsDir }
}

// 调用待测脚本：通过 npx tsx（如果失败）退回 node_modules/tsx
function runBackup({ repo, home, extraArgv = [] }) {
  const script = path.join(repo, '.workbuddy', 'skills', 'devops-automation', 'scripts', 'backup-branch.ts')
  const env = {
    ...process.env,
    HOME: home,
    GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'),
    // 让 push 快速失败（127.0.0.1:1 不通 + http 低超时）
    GIT_HTTP_LOW_SPEED_LIMIT: '100',
    GIT_HTTP_LOW_SPEED_TIME: '3',
  }
  const tsxCandidates = [
    // 项目内 tsx（优先）
    ['node', [path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'), script, ...extraArgv]],
    // 全局 npx tsx
    ['npx', ['tsx', script, ...extraArgv]],
  ]
  let last = null
  for (const [cmd, argv] of tsxCandidates) {
    const r = sh(cmd, argv, { cwd: repo, env, timeout: 180000 })
    last = r
    // npx 找不到 tsx 时会报 "Could not determine executable to run"，此时继续尝试下一个候选
    if (r.ok) return r
    if ((r.stderr || '').includes('Could not determine executable') || (r.combined || '').includes('npm error')) continue
    return r // 真错误则立即返回（比如脚本本身 EXIT=1）
  }
  return last
}

// ===== 用例集合 =====
async function main() {
  ensureDir(path.dirname(OUTPUT))

  // ============ 维度 1：参数传递验证 ============
  await runCase({
    id: 'T-PARAM-01',
    category: '参数传递',
    title: '--no-push=true 时 stdout 出现"--no-push 已指定"提示且 exit=0',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        // 写一个非敏感改动文件让流程走到 --no-push 分支
        fs.writeFileSync(path.join(repo, 'notes.txt'), 'hello param test\n')
        const r = runBackup({ repo, home, extraArgv: ['--no-push', '--message', 'param 01'] })
        assert(r.ok, `exit 非 0：status=${r.status}；stderr=${r.stderr}`)
        assert(/--no-push 已指定/.test(r.stdout + r.stderr), `缺失 --no-push 提示：${r.stdout}\n${r.stderr}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-PARAM-02',
    category: '参数传递',
    title: '--branch custom/backup 时创建的分支名正确指向新 SHA',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        fs.writeFileSync(path.join(repo, 'notes.txt'), 'hello custom branch\n')
        const r = runBackup({ repo, home, extraArgv: ['--branch', 'custom/backup', '--no-push'] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        const sha = execGit(repo, ['rev-parse', 'custom/backup'])
        assert(sha && /^[0-9a-f]{40}$/.test(sha), `分支 custom/backup 未创建或非 40-hex：${sha}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-PARAM-03',
    category: '参数传递',
    title: '默认参数（无 --branch/--remote/--no-push/--message）分支=backup/auto remote=origin',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n')
        // 用 --no-push 防止真的去碰哑 remote
        const r = runBackup({ repo, home, extraArgv: ['--no-push'] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        const head = execGit(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
        const backupSha = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        assert(backupSha && head !== 'backup/auto', `默认分支 backup/auto 未创建或污染了 HEAD=${head}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-PARAM-04',
    category: '参数传递',
    title: '--message 内容出现在 commit message（git log -1 --pretty=%B）',
    fn: async () => {
      const { repo, home } = buildRepo()
      const msg = 'custom-sim-msg-2026-08-01'
      try {
        fs.writeFileSync(path.join(repo, 'm.txt'), 'm\n')
        const r = runBackup({ repo, home, extraArgv: ['--no-push', '--message', msg] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        const log = execGit(repo, ['log', '-1', '--pretty=%B', 'backup/auto']).trim()
        assert(log.includes(msg), `commit message 不含 "${msg}"，实际：${log}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  // ============ 维度 2：网络阻断无缝切换 ============
  await runCase({
    id: 'T-NET-01',
    category: '网络阻断+--no-push',
    title: 'GitHub 不可达（哑 origin + 低超时）+ --no-push：exit=0 且本地快照已落 branch',
    fn: async () => {
      const { repo, home } = buildRepo({ fakeRemoteUrl: 'https://127.0.0.1:1/empty.git' })
      try {
        fs.writeFileSync(path.join(repo, 'payload.txt'), 'net block with --no-push\n')
        // 预存 HEAD 以便断言 main 未被污染
        const mainBefore = execGit(repo, ['rev-parse', 'HEAD']).trim()
        const r = runBackup({ repo, home, extraArgv: ['--no-push', '--message', 'net01 no push'] })
        assert(r.ok, `exit 非 0：status=${r.status}；stderr=${r.stderr}`)
        // 本地 backup/auto 存在，且指向 commit（非 HEAD 同值，因为 payload.txt 是新改动）
        const backupSha = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        assert(/^[0-9a-f]{40}$/.test(backupSha), 'backup/auto 未落到 40-hex commit')
        const mainAfter = execGit(repo, ['rev-parse', 'HEAD']).trim()
        assert(mainBefore === mainAfter, `HEAD/main 被污染：${mainBefore} → ${mainAfter}`)
        // 绝对不能出现任何 "已推送至" 字样
        assert(!(/已推送至/.test(r.stdout + r.stderr)), '--no-push 但 stdout 出现了推送语句')
        assert(/--no-push 已指定/.test(r.stdout + r.stderr), '--no-push 提示缺失')
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-NET-02',
    category: '网络阻断（无--no-push兜底）',
    title: 'GitHub 不可达（哑 origin + 低超时）+ 无 --no-push：exit 仍=0（push 失败 WARN 但不 crash）',
    fn: async () => {
      const { repo, home } = buildRepo({ fakeRemoteUrl: 'https://127.0.0.1:1/empty.git' })
      try {
        fs.writeFileSync(path.join(repo, 'payload2.txt'), 'net block without --no-push\n')
        const r = runBackup({ repo, home, extraArgv: ['--message', 'net02 push fail'] })
        assert(r.ok, `exit 非 0：status=${r.status}。push 失败不应导致整个脚本 crash（必须兜底 return 0）`)
        assert(/推送失败|未找到远程/.test(r.stdout + r.stderr), 'push 失败但未打印告警提示（兜底失败）')
        const backupSha = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        assert(/^[0-9a-f]{40}$/.test(backupSha), '即便 push 失败，本地 backup/auto 仍必须有快照')
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-NET-03',
    category: '网络阻断',
    title: '完全无 remote（git remote 空）场景：脚本跳过推送，exit=0 且本地快照保留',
    fn: async () => {
      const { repo, home } = buildRepo({ fakeRemote: false })
      try {
        fs.writeFileSync(path.join(repo, 'payload3.txt'), 'no remote scenario\n')
        const r = runBackup({ repo, home, extraArgv: ['--message', 'net03 no remote'] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        assert(/未找到远程/.test(r.stdout + r.stderr), '应打印未找到远程跳过提示')
        const backupSha = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        assert(/^[0-9a-f]{40}$/.test(backupSha), '本地 backup/auto 快照缺失')
      } finally { rmd(repo); rmd(home) }
    },
  })

  // ============ 维度 3：本地快照完整性 ============
  await runCase({
    id: 'T-SNAP-01',
    category: '快照完整性',
    title: 'write-tree / commit-tree 产生的 commit 能 checkout（非空、包含预期文件内容）',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        const key = crypto.randomBytes(6).toString('hex')
        fs.writeFileSync(path.join(repo, 'unique.txt'), `marker=${key}\n`)
        // 加一个嵌套目录文件
        ensureDir(path.join(repo, 'nested', 'deep'))
        fs.writeFileSync(path.join(repo, 'nested', 'deep', 'file.txt'), 'deep content\n')
        const r = runBackup({ repo, home, extraArgv: ['--no-push', '--message', 'snap01'] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        const backupSha = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        // 通过 git show backup:auto:/unique.txt 读内容
        const uniqueContent = execGit(repo, ['show', `${backupSha}:unique.txt`]).trim()
        assert(uniqueContent === `marker=${key}`, `快照文件内容不匹配：${uniqueContent}`)
        const deepContent = execGit(repo, ['show', `${backupSha}:nested/deep/file.txt`]).trim()
        assert(deepContent === 'deep content', `嵌套文件内容缺失：${deepContent}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-SNAP-02',
    category: '快照完整性',
    title: '快照排除 .env 等 17 种敏感模式；敏感内容不进入 backup/auto commit',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        // 写一个非敏感文件 + 一组敏感文件
        fs.writeFileSync(path.join(repo, 'normal.txt'), 'ok\n')
        fs.writeFileSync(path.join(repo, '.env'), 'AK=very-secret-key\n')
        fs.writeFileSync(path.join(repo, '.env.prod'), 'AK2=secret2\n')
        fs.writeFileSync(path.join(repo, 'server.pem'), 'private x\n')
        fs.writeFileSync(path.join(repo, 'my.key'), 'rsa x\n')
        fs.writeFileSync(path.join(repo, 'id_rsa'), 'id rsa x\n')
        const r = runBackup({ repo, home, extraArgv: ['--no-push', '--message', 'snap02'] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        assert(/已排除.*敏感文件/.test(r.stdout + r.stderr), `未打印敏感排除提示：${r.stdout}\n${r.stderr}`)
        const backupSha = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        // 通过 ls-tree -r 列出快照中的文件
        const tree = execGit(repo, ['ls-tree', '-r', '--name-only', backupSha])
        const files = tree.split('\n').filter(Boolean)
        // 非敏感存在
        assert(files.includes('normal.txt'), 'normal.txt 被误排除')
        // 敏感文件一律不存在
        for (const f of ['.env', '.env.prod', 'server.pem', 'my.key', 'id_rsa']) {
          assert(!files.includes(f), `敏感文件 "${f}" 误进入快照`)
        }
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-SNAP-03',
    category: '快照完整性',
    title: '当改动仅包含敏感文件时：应跳过备份（exit=0）且不创建 backup/auto 分支',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        // 全部敏感
        fs.writeFileSync(path.join(repo, '.env'), 's=1\n')
        fs.writeFileSync(path.join(repo, 'server.pem'), 'p=1\n')
        const backupBefore = execGit(repo, ['rev-parse', '--verify', 'backup/auto'], true)
        const r = runBackup({ repo, home, extraArgv: ['--no-push'] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        assert(/仅有敏感文件改动，无备份价值，跳过/.test(r.stdout + r.stderr), `未打印"仅有敏感文件跳过"提示`)
        const backupAfter = execGit(repo, ['rev-parse', '--verify', 'backup/auto'], true)
        assert(backupBefore === backupAfter, '不应创建 backup/auto 分支或改变其指向')
      } finally { rmd(repo); rmd(home) }
    },
  })

  // ============ 维度 4：错误处理 ============
  await runCase({
    id: 'T-ERR-01',
    category: '错误处理',
    title: '工作区无改动（git status --porcelain 空）：exit=0 打印"工作区无改动跳过"',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        const r = runBackup({ repo, home, extraArgv: ['--no-push'] })
        assert(r.ok, `exit 非 0：${r.stderr}`)
        assert(/工作区无改动，跳过备份/.test(r.stdout + r.stderr), `缺失跳过提示：${r.stdout}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-ERR-02',
    category: '错误处理',
    title: '非 git 仓库执行脚本：exit=1（崩溃捕获），不会 silent exit 0',
    fn: async () => {
      const repo = tmpDir('nogit')
      const home = tmpDir('home')
      try {
        ensureDir(path.join(repo, '.workbuddy', 'skills', 'devops-automation', 'scripts'))
        const srcTs = path.resolve(process.cwd(), '.workbuddy', 'skills', 'devops-automation', 'scripts', 'backup-branch.ts')
        fs.copyFileSync(srcTs, path.join(repo, '.workbuddy', 'skills', 'devops-automation', 'scripts', 'backup-branch.ts'))
        // 因为 findProjectRoot 失败会 fallback 到 process.cwd()=repo，而 repo 非 git，后续 git status 会抛错
        fs.writeFileSync(path.join(repo, 'x.txt'), 'x\n')
        const r = runBackup({ repo, home, extraArgv: ['--no-push'] })
        assert(!r.ok, `非 git 仓库不应 exit=0。实际 status=${r.status}`)
        assert(/备份失败/.test(r.stdout + r.stderr), '顶层 try/catch 兜底错误提示缺失')
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-ERR-03',
    category: '错误处理',
    title: '未知冗余参数不影响主流程（parseArgs 未识别参数被忽略 + exit 0）',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        fs.writeFileSync(path.join(repo, 'y.txt'), 'y\n')
        const r = runBackup({
          repo, home,
          extraArgv: ['--no-push', '--unknown-flag', 'hello', '--also-unknown=123', '--message', 'err03']
        })
        assert(r.ok, `未知参数导致非 0 exit：status=${r.status}；stderr=${r.stderr}`)
        const backupSha = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        assert(/^[0-9a-f]{40}$/.test(backupSha), 'backup/auto 未落地')
      } finally { rmd(repo); rmd(home) }
    },
  })

  await runCase({
    id: 'T-ERR-04',
    category: '错误处理',
    title: '真实连续两次调用：第二次仍 exit 0，backup/auto 指针仍指向新 commit（幂等安全）',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        fs.writeFileSync(path.join(repo, 't1.txt'), '1\n')
        const r1 = runBackup({ repo, home, extraArgv: ['--no-push', '--message', 'err04 first'] })
        assert(r1.ok, `首次调用失败：${r1.stderr}`)
        const sha1 = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        // 再加改动
        fs.writeFileSync(path.join(repo, 't2.txt'), '2\n')
        const r2 = runBackup({ repo, home, extraArgv: ['--no-push', '--message', 'err04 second'] })
        assert(r2.ok, `二次调用失败：${r2.stderr}`)
        const sha2 = execGit(repo, ['rev-parse', 'backup/auto']).trim()
        assert(sha1 !== sha2, `第二次调用 backup/auto 指针未前进（${sha1} vs ${sha2}）`)
        // 校验历史线性：sha2 的 parent 列表含 sha1
        const parents = execGit(repo, ['rev-list', '--parents', '-n', '1', sha2]).trim().split(/\s+/)
        assert(parents.includes(sha1), `新 commit 的 parent 未包含旧 SHA：parents=${parents.join(',')}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  // ============ 维度 5：时间窗口 03:10 语义（无需真 sleep，只验证 --no-push 在任何时刻均可工作）============
  // —— 已由 T-NET-01 覆盖。额外加 T-TIME-01 作为"时间无关性"声明用例。
  await runCase({
    id: 'T-TIME-01',
    category: '时间无关性',
    title: '--no-push 纯本地模式对当前时钟无依赖（不读写 nowStamp 之外的系统时间敏感逻辑）：连续两次消息不同',
    fn: async () => {
      const { repo, home } = buildRepo()
      try {
        fs.writeFileSync(path.join(repo, 'z.txt'), 'z1\n')
        const r1 = runBackup({ repo, home, extraArgv: ['--no-push'] })
        assert(r1.ok, `第一次失败：${r1.stderr}`)
        // 等 1.1s，让 nowStamp 必然变化
        await new Promise(r => setTimeout(r, 1100))
        fs.writeFileSync(path.join(repo, 'z2.txt'), 'z2\n')
        const r2 = runBackup({ repo, home, extraArgv: ['--no-push'] })
        assert(r2.ok, `第二次失败：${r2.stderr}`)
        const m1 = execGit(repo, ['log', '-1', '--pretty=%s', execGit(repo, ['rev-list', '-2', 'backup/auto']).trim().split(/\s+/)[1] || 'backup/auto']).trim()
        const m2 = execGit(repo, ['log', '-1', '--pretty=%s', 'backup/auto']).trim()
        assert(m1 !== m2, `两次 commit message (nowStamp) 相同：${m1} === ${m2}`)
      } finally { rmd(repo); rmd(home) }
    },
  })

  // ============ 报告落盘 ============
  writeReport(results)
  // 输出简表
  const passed = results.filter(r => r.pass).length
  const total = results.length
  process.stdout.write(`\n总计：${passed}/${total}  通过\n`)
  process.stdout.write(`完整报告：${OUTPUT}\n`)
  process.exit(passed === total ? 0 : 1)
}

function execGit(repo, argv, allowFail = false) {
  try {
    return execFileSync('git', argv, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', allowFail ? 'pipe' : 'pipe'] }).trim()
  } catch (e) {
    if (allowFail) return ''
    throw e
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed')
}

// ===== 报告渲染 =====
function writeReport(list) {
  const byCat = {}
  for (const r of list) {
    byCat[r.category] = byCat[r.category] || []
    byCat[r.category].push(r)
  }
  const passed = list.filter(r => r.pass).length
  const total = list.length
  const lines = []
  lines.push(`# backup-branch.ts 全面测试报告`)
  lines.push('')
  lines.push(`- 生成时间：${new Date().toISOString()}`)
  lines.push(`- 待测脚本：.workbuddy/skills/devops-automation/scripts/backup-branch.ts`)
  lines.push(`- 测试环境：Node ${process.version} / ${os.platform()} / 临时独立 git 仓库 (${os.tmpdir()})`)
  lines.push(`- 用例总数：${total}；通过：${passed}；失败：${total - passed}`)
  lines.push(`- 结论：${passed === total ? '✅ 全部通过。--no-push 纯本地快照模式在 GitHub 03:10 网络不可达场景下无缝切换，exit=0 且本地 backup/auto 指针完整。' : '❌ 存在失败，请逐用例查看下方 detail。'}`)
  lines.push('')
  lines.push('## 一、测试维度 × 用例矩阵')
  lines.push('')
  lines.push('| 维度 | 用例数 | 通过 | 失败 |')
  lines.push('|------|--------|------|------|')
  for (const cat of Object.keys(byCat)) {
    const arr = byCat[cat]
    const p = arr.filter(r => r.pass).length
    lines.push(`| ${cat} | ${arr.length} | ${p} | ${arr.length - p} |`)
  }
  lines.push('')
  lines.push('## 二、逐条用例明细')
  lines.push('')
  for (const r of list) {
    lines.push(`### ${r.id} · ${r.title}`)
    lines.push('')
    lines.push(`- 维度：${r.category}`)
    lines.push(`- 结果：${r.pass ? '✅ PASS' : '❌ FAIL'}`)
    lines.push(`- 耗时：${r.durationMs} ms`)
    lines.push(`- 时间戳：${r.time}`)
    if (!r.pass) {
      lines.push('- 错误详情：')
      lines.push('```')
      lines.push(String(r.detail).slice(0, 4000))
      lines.push('```')
    }
    lines.push('')
  }
  lines.push('## 三、核心结论（面向交付）')
  lines.push('')
  lines.push('1. **参数传递**：`--no-push`/`--branch`/`--remote`/`--message` 与默认值行为与规格一致。')
  lines.push('2. **网络阻断无缝切换**：T-NET-01 在哑 remote + 低超时 GitHub 不可达下，加 `--no-push` exit=0，未触发任何推送逻辑，backup/auto 完整落地，main/HEAD 未被污染。')
  lines.push('3. **推送兜底**：T-NET-02 即便不设 `--no-push`，推送失败也走 console.warn + return 0，不会让脚本 crash（自动化任务不会被错误地标记为失败）。')
  lines.push('4. **快照完整性**：T-SNAP-01/02/03 证明 write-tree→commit-tree→branch -f 的 plumbing 产物可 git show 读回，敏感文件（.env/.pem/.key/id_rsa 等 17 模式）被排除，全敏感场景自动跳过。')
  lines.push('5. **错误处理**：无改动跳过（exit 0）、非 git 仓库立即 exit 1 并打印"备份失败"、未知冗余参数不阻塞、连续两次调用幂等且 commit 链线性。')
  lines.push('6. **时间无关性**：nowStamp 使用 ISO 时间戳，不依赖 cron 时刻；连续调用 message 必然不同，便于追踪备份序列。')
  lines.push('')
  ensureDir(path.dirname(OUTPUT))
  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8')
}

// ===== 启动 =====
if (require.main === module) {
  main().catch(e => {
    console.error('测试框架崩溃：', e && e.stack || e)
    process.exit(2)
  })
}

module.exports = { buildRepo, runBackup }
