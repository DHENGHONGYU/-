#!/usr/bin/env tsx
/**
 * 清理工作文档自动生成器（v2 — 含真实验证数据）
 *
 * 用途：为未来的清理工作（令牌清理、依赖清理、死代码清理等）按标准模板生成：
 *   1. 总结报告（SUMMARY-<task-name>.md）—— 含真实构建/测试/覆盖率数据
 *   2. Commit 记录归档（COMMIT-LOG-<task-name>.md）
 *
 * 用法：
 *   tsx scripts/generate-cleanup-report.ts \
 *     --name design-token-cleanup \
 *     --title "设计令牌清理工作" \
 *     --commits 508c84f,75b2d61,801395d,87ae340 \
 *     --description "清除旧版双套令牌系统，确立 V5 单一真相源" \
 *     [--output-dir docs/release-notes] \
 *     [--test-target src/lib/designTokenVerifier.test.ts] \
 *     [--coverage-file src/lib/designTokenVerifier.ts] \
 *     [--skip-verify] [--skip-build] [--skip-test] [--skip-tsc]
 *
 * 验证项（默认全部执行，可用 --skip-* 跳过）：
 *   - npm run build        生产构建（含 prebuild 的 tsc:prod）
 *   - npm run tsc:prod     TypeScript 生产配置类型检查
 *   - npx vitest run <target> --coverage  单元测试 + Istanbul 覆盖率
 *
 * 输出：
 *   docs/release-notes/SUMMARY-<name>.md
 *   docs/release-notes/COMMIT-LOG-<name>.md
 */

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// ===== 类型定义 =====

interface CLIArgs {
  name: string
  title: string
  commits: string[]
  description: string
  outputDir: string
  testTarget?: string
  coverageFile?: string
  skipVerify: boolean
  skipBuild: boolean
  skipTest: boolean
  skipTsc: boolean
}

interface CommitFileInfo {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  insertions?: number
  deletions?: number
  newPath?: string
}

interface CommitInfo {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
  files: CommitFileInfo[]
  insertions: number
  deletions: number
}

interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
  durationMs: number
  exitCode: number | null
}

interface CoverageMetric {
  total: number
  covered: number
  pct: number
}

interface CoverageSummary {
  totals: {
    lines: CoverageMetric
    statements: CoverageMetric
    functions: CoverageMetric
    branches: CoverageMetric
  }
  perFile: Array<{
    path: string
    lines: CoverageMetric
    statements: CoverageMetric
    functions: CoverageMetric
    branches: CoverageMetric
  }>
}

interface VerifyResult {
  build: { pass: boolean; durationMs: number; errorSnippet: string } | null
  tsc: { pass: boolean; durationMs: number; errorSnippet: string } | null
  test: {
    pass: boolean
    durationMs: number
    totalTests: number | null
    passedTests: number | null
    coverage: CoverageSummary | null
    uncoveredLines: { file: string; lines: number[] } | null
    errorSnippet: string
  } | null
}

// ===== CLI 解析 =====

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2)
  const parsed: Partial<CLIArgs> = {
    commits: [],
    outputDir: 'docs/release-notes',
    skipVerify: false,
    skipBuild: false,
    skipTest: false,
    skipTsc: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name':
        parsed.name = args[++i]
        break
      case '--title':
        parsed.title = args[++i]
        break
      case '--commits':
        parsed.commits = args[++i].split(',').map((c) => c.trim())
        break
      case '--description':
        parsed.description = args[++i]
        break
      case '--output-dir':
        parsed.outputDir = args[++i]
        break
      case '--test-target':
        parsed.testTarget = args[++i]
        break
      case '--coverage-file':
        parsed.coverageFile = args[++i]
        break
      case '--skip-verify':
        parsed.skipVerify = true
        break
      case '--skip-build':
        parsed.skipBuild = true
        break
      case '--skip-test':
        parsed.skipTest = true
        break
      case '--skip-tsc':
        parsed.skipTsc = true
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break
    }
  }

  if (!parsed.name || !parsed.title || !parsed.commits?.length || !parsed.description) {
    console.error('错误：缺少必要参数。使用 --help 查看用法。')
    process.exit(1)
  }

  return parsed as CLIArgs
}

function printUsage(): void {
  console.log(`
清理工作文档自动生成器（v2 — 含真实验证数据）

用法：
  tsx scripts/generate-cleanup-report.ts \\
    --name <task-name> \\
    --title <task-title> \\
    --commits <hash1,hash2,...> \\
    --description <description> \\
    [--output-dir <dir>] \\
    [--test-target <test-file-or-dir>] \\
    [--coverage-file <source-file>] \\
    [--skip-verify] [--skip-build] [--skip-test] [--skip-tsc]

参数：
  --name           任务名称（kebab-case，用于文件名）
  --title          任务标题（中文，用于文档标题）
  --commits        提交 hash 列表（逗号分隔，按时间正序）
  --description    任务描述（一句话总结）
  --output-dir     输出目录（默认：docs/release-notes）
  --test-target    指定测试文件/目录运行覆盖率（不指定则跑全量 test:ci）
  --coverage-file  指定源文件提取未覆盖行号（默认仅汇总总覆盖率）
  --skip-verify    跳过所有验证（build/tsc/test 全部跳过）
  --skip-build     跳过 npm run build
  --skip-tsc       跳过 npm run tsc:prod
  --skip-test      跳过 vitest 覆盖率

示例：
  tsx scripts/generate-cleanup-report.ts \\
    --name dead-code-cleanup \\
    --title "死代码清理工作" \\
    --commits abc1234,def5678 \\
    --description "清除项目中 15 个未使用的组件和 8 个废弃服务" \\
    --test-target src/components/atoms \\
    --coverage-file src/components/atoms/Card.tsx
`)
}

// ===== 通用命令执行 =====

function runCommand(command: string, timeoutMs = 600000): CommandResult {
  const start = Date.now()
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return {
      success: true,
      stdout: stdout.toString(),
      stderr: '',
      durationMs: Date.now() - start,
      exitCode: 0,
    }
  } catch (error) {
    const e = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
    return {
      success: false,
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : '',
      durationMs: Date.now() - start,
      exitCode: e.status ?? null,
    }
  }
}

function runGit(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', cwd: process.cwd() }).trim()
  } catch (error) {
    console.error(`git 命令失败: ${command}`)
    throw error
  }
}

function extractErrorSnippet(stdout: string, stderr: string, maxLines = 15): string {
  const text = (stderr + '\n' + stdout).trim()
  if (!text) return ''
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length <= maxLines) return text
  return lines.slice(0, 5).join('\n') + '\n...\n' + lines.slice(-maxLines + 5).join('\n')
}

// ===== Git 提交信息收集 =====

function getCommitInfo(hash: string): CommitInfo {
  const format = '--format=%H%n%an%n%ad%n%s%n%b'
  const log = runGit(`git log -1 ${format} --date=format:"%Y-%m-%d %H:%M:%S" ${hash}`)
  const lines = log.split('\n')

  const fullHash = lines[0]
  const author = lines[1]
  const date = lines[2]
  const subject = lines[3]
  const body = lines.slice(4).join('\n').trim()
  const message = body ? `${subject}\n\n${body}` : subject

  const nameStatus = runGit(`git show --name-status --format="" ${hash}`)
  const numstat = runGit(`git show --numstat --format="" ${hash}`)

  const statusMap = new Map<string, { status: string; newPath?: string }>()
  for (const line of nameStatus.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    const code = parts[0]
    const filePath = parts[1]
    if (code.startsWith('R')) {
      const oldPath = parts[1]
      const newPath = parts[2]
      statusMap.set(newPath, { status: 'renamed', newPath })
      statusMap.set(oldPath, { status: 'renamed', newPath })
    } else if (code === 'A') {
      statusMap.set(filePath, { status: 'added' })
    } else if (code === 'D') {
      statusMap.set(filePath, { status: 'deleted' })
    } else {
      statusMap.set(filePath, { status: 'modified' })
    }
  }

  const files: CommitFileInfo[] = []
  let insertions = 0
  let deletions = 0
  const processedPaths = new Set<string>()

  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue
    const parts = line.split('\t')
    if (parts.length >= 3) {
      const ins = parts[0] === '-' ? 0 : parseInt(parts[0], 10)
      const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10)
      const rawPath = parts[2]

      let actualPath = rawPath
      let newPath: string | undefined
      if (rawPath.includes('=>')) {
        const match = rawPath.match(/^{?([^}]+)}?\s*=>\s*{?([^}]+)}?/)
        if (match) {
          actualPath = match[2].trim()
          newPath = match[2].trim()
        }
      }

      const statusInfo = statusMap.get(actualPath) || statusMap.get(rawPath)
      const status: CommitFileInfo['status'] = statusInfo
        ? (statusInfo.status as CommitFileInfo['status'])
        : ins > 0 && del === 0
          ? 'added'
          : ins === 0 && del > 0
            ? 'deleted'
            : 'modified'

      const dedupKey = newPath || actualPath
      if (processedPaths.has(dedupKey)) continue
      processedPaths.add(dedupKey)

      files.push({ path: actualPath, status, insertions: ins, deletions: del, newPath })
      insertions += ins
      deletions += del
    }
  }

  return {
    hash: fullHash,
    shortHash: fullHash.substring(0, 7),
    author,
    date,
    message,
    files,
    insertions,
    deletions,
  }
}

function categorizeFiles(commits: CommitInfo[]): {
  added: { path: string; commit: string; insertions?: number }[]
  modified: { path: string; commit: string; insertions?: number; deletions?: number }[]
  deleted: { path: string; commit: string; deletions?: number }[]
  renamed: { path: string; newPath?: string; commit: string }[]
} {
  const added: { path: string; commit: string; insertions?: number }[] = []
  const modified: { path: string; commit: string; insertions?: number; deletions?: number }[] = []
  const deleted: { path: string; commit: string; deletions?: number }[] = []
  const renamed: { path: string; newPath?: string; commit: string }[] = []
  const seen = new Set<string>()

  for (const commit of commits) {
    for (const file of commit.files) {
      if (seen.has(file.path)) continue
      seen.add(file.path)

      switch (file.status) {
        case 'added':
          added.push({ path: file.path, commit: commit.shortHash, insertions: file.insertions })
          break
        case 'modified':
          modified.push({
            path: file.path,
            commit: commit.shortHash,
            insertions: file.insertions,
            deletions: file.deletions,
          })
          break
        case 'deleted':
          deleted.push({ path: file.path, commit: commit.shortHash, deletions: file.deletions })
          break
        case 'renamed':
          renamed.push({ path: file.path, newPath: file.newPath, commit: commit.shortHash })
          break
      }
    }
  }

  return { added, modified, deleted, renamed }
}

// ===== 验证：构建 / 类型检查 / 测试覆盖率 =====

function verifyBuild(): VerifyResult['build'] {
  console.log('   🔨 运行 npm run build ...')
  const res = runCommand('npm run build', 600000)
  const snippet = res.success ? '' : extractErrorSnippet(res.stdout, res.stderr)
  console.log(`   ${res.success ? '✅' : '❌'} build (${(res.durationMs / 1000).toFixed(1)}s)`)
  return { pass: res.success, durationMs: res.durationMs, errorSnippet: snippet }
}

function verifyTsc(): VerifyResult['tsc'] {
  console.log('   🔬 运行 npm run tsc:prod ...')
  const res = runCommand('npm run tsc:prod', 300000)
  const snippet = res.success ? '' : extractErrorSnippet(res.stdout, res.stderr)
  console.log(`   ${res.success ? '✅' : '❌'} tsc:prod (${(res.durationMs / 1000).toFixed(1)}s)`)
  return { pass: res.success, durationMs: res.durationMs, errorSnippet: snippet }
}

function parseCoverageSummary(filePath: string): CoverageSummary | null {
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    const total = raw.total
    if (!total) return null
    const perFile: CoverageSummary['perFile'] = []
    for (const [fileKey, metrics] of Object.entries(raw)) {
      if (fileKey === 'total') continue
      const m = metrics as {
        lines: CoverageMetric
        statements: CoverageMetric
        functions: CoverageMetric
        branches: CoverageMetric
      }
      perFile.push({
        path: fileKey,
        lines: m.lines,
        statements: m.statements,
        functions: m.functions,
        branches: m.branches,
      })
    }
    return {
      totals: {
        lines: total.lines,
        statements: total.statements,
        functions: total.functions,
        branches: total.branches,
      },
      perFile,
    }
  } catch {
    return null
  }
}

function parseUncoveredLines(finalJsonPath: string, targetFile: string): { file: string; lines: number[] } | null {
  if (!fs.existsSync(finalJsonPath)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(finalJsonPath, 'utf-8'))
    const absTarget = path.resolve(targetFile)
    const entry =
      raw[absTarget] ||
      raw[targetFile] ||
      Object.entries(raw).find(([k]) => k.replace(/\\/g, '/').endsWith(targetFile.replace(/\\/g, '/')))?.[1]
    if (!entry) return null
    const statementMap = entry.statementMap as Record<string, { start: { line: number } }>
    const s = entry.s as Record<string, number>
    const uncovered: number[] = []
    for (const [id, count] of Object.entries(s)) {
      if (count === 0 && statementMap[id]) {
        const line = statementMap[id].start.line
        if (!uncovered.includes(line)) uncovered.push(line)
      }
    }
    uncovered.sort((a, b) => a - b)
    return { file: targetFile, lines: uncovered }
  } catch {
    return null
  }
}

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\u001b\][^\u0007]*\u0007/g, '')
}

function countTestsFromOutput(stdout: string): { total: number; passed: number; failed: number } | null {
  // vitest 汇总行形如： "Tests  17 passed (17)" 或 "Tests  17 passed | 1 failed (18)"
  // 注意必须锁定 "Tests" 行，避免误匹配 "Test Files  1 passed (1)" 的总数
  const clean = stripAnsi(stdout)
  const lineMatch = clean.match(/^[\s]*Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?(?:\s*\((\d+)\))?/m)
  if (lineMatch) {
    const passed = parseInt(lineMatch[1], 10)
    const failed = lineMatch[2] ? parseInt(lineMatch[2], 10) : 0
    const total = lineMatch[3] ? parseInt(lineMatch[3], 10) : passed + failed
    return { total, passed, failed }
  }
  return null
}

function verifyTest(testTarget?: string, coverageFile?: string): VerifyResult['test'] {
  const tmpDir = path.join(os.tmpdir(), `cleanup-report-coverage-${Date.now()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  const targetPart = testTarget ? testTarget : ''
  // 当指定 --coverage-file 时，收窄 coverage.include 到该文件，
  // 避免对无关 src 文件插桩触发 rollup/acorn 解析错误
  const includePart = coverageFile ? `--coverage.include="${coverageFile}"` : ''
  const cmd = `npx vitest run ${targetPart} --coverage --coverage.reporter=json-summary --coverage.reporter=json --coverage.reportsDirectory="${tmpDir}" ${includePart}`.trim()

  console.log(`   🧪 运行 vitest ${testTarget ? testTarget : '(全量)'} ...`)
  const res = runCommand(cmd, 600000)
  const snippet = res.success ? '' : extractErrorSnippet(res.stdout, res.stderr)

  const testCounts = countTestsFromOutput(res.stdout + res.stderr)
  const summaryPath = path.join(tmpDir, 'coverage-summary.json')
  const finalPath = path.join(tmpDir, 'coverage-final.json')
  const coverage = parseCoverageSummary(summaryPath)
  const uncoveredLines = coverageFile ? parseUncoveredLines(finalPath, coverageFile) : null

  const pass = res.success
  console.log(
    `   ${pass ? '✅' : '❌'} test (${(res.durationMs / 1000).toFixed(1)}s)` +
      (testCounts ? ` — ${testCounts.passed}/${testCounts.total} 用例` : '') +
      (coverage ? ` — 行覆盖 ${coverage.totals.lines.pct}%` : ''),
  )

  return {
    pass,
    durationMs: res.durationMs,
    totalTests: testCounts?.total ?? null,
    passedTests: testCounts?.passed ?? null,
    coverage,
    uncoveredLines,
    errorSnippet: snippet,
  }
}

function runVerifications(args: CLIArgs): VerifyResult {
  if (args.skipVerify) {
    console.log('   ⏭️  --skip-verify 已指定，跳过所有验证。')
    return { build: null, tsc: null, test: null }
  }
  console.log('\n🔧 开始运行验证（build / tsc / test）...\n')
  const result: VerifyResult = {
    build: args.skipBuild ? null : verifyBuild(),
    tsc: args.skipTsc ? null : verifyTsc(),
    test: args.skipTest ? null : verifyTest(args.testTarget, args.coverageFile),
  }
  console.log('')
  return result
}

// ===== 派生内容：文档影响 / 关键变更点脚手架 =====

function collectDocImpact(commits: CommitInfo[]): { path: string; commit: string; status: string }[] {
  const docs: { path: string; commit: string; status: string }[] = []
  const seen = new Set<string>()
  for (const commit of commits) {
    for (const file of commit.files) {
      if (!file.path.endsWith('.md') && !file.path.endsWith('.mdx')) continue
      if (seen.has(file.path)) continue
      seen.add(file.path)
      docs.push({ path: file.path, commit: commit.shortHash, status: file.status })
    }
  }
  return docs.sort((a, b) => a.path.localeCompare(b.path))
}

function generateKeyChangesScaffold(commits: CommitInfo[]): string {
  // 从 commit subject + 显著文件路径派生脚手架，标记为"可人工修订"
  const bullets: string[] = []
  for (const c of commits) {
    const subject = c.message.split('\n')[0]
    const typeMatch = subject.match(/^(\w+)\(([^)]+)\):\s*(.+)$/)
    if (typeMatch) {
      const [, type, scope, desc] = typeMatch
      const filesByType = new Map<string, number>()
      for (const f of c.files) {
        const top = f.path.split('/')[0]
        filesByType.set(top, (filesByType.get(top) ?? 0) + 1)
      }
      const topDirs = [...filesByType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      const dirHint = topDirs.map(([d, n]) => `${d}(${n})`).join(' / ')
      bullets.push(`- [可人工修订] \`${c.shortHash}\` **${type}(${scope})**：${desc}（影响 ${dirHint}）`)
    }
  }
  return bullets.join('\n')
}

// ===== 文档生成 =====

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

function generateSummary(args: CLIArgs, commits: CommitInfo[], verify: VerifyResult): string {
  const today = new Date().toISOString().split('T')[0]
  const { added, modified, deleted, renamed } = categorizeFiles(commits)
  const totalIns = commits.reduce((sum, c) => sum + c.insertions, 0)
  const totalDel = commits.reduce((sum, c) => sum + c.deletions, 0)
  const totalFiles = new Set(commits.flatMap((c) => c.files.map((f) => f.path))).size
  const docImpact = collectDocImpact(commits)
  const changesScaffold = generateKeyChangesScaffold(commits)

  // ===== 第五节：验证结果 =====
  const buildRow = verify.build
    ? `| \`npm run build\` | ${verify.build.pass ? '✅ 通过' : '❌ 失败'} | 耗时 ${formatDuration(verify.build.durationMs)}${
        verify.build.errorSnippet ? `\n\n<details><summary>错误摘要</summary>\n\n\`\`\`\n${verify.build.errorSnippet}\n\`\`\`\n\n</details>` : ''
      } |`
    : `| \`npm run build\` | ⏭️ 跳过 | 未执行（--skip-build 或 --skip-verify） |`

  const tscRow = verify.tsc
    ? `| TypeScript 类型检查 | ${verify.tsc.pass ? '✅ 通过' : '❌ 失败'} | \`npm run tsc:prod\`，耗时 ${formatDuration(verify.tsc.durationMs)}${
        verify.tsc.errorSnippet ? `\n\n<details><summary>错误摘要</summary>\n\n\`\`\`\n${verify.tsc.errorSnippet}\n\`\`\`\n\n</details>` : ''
      } |`
    : `| TypeScript 类型检查 | ⏭️ 跳过 | 未执行（--skip-tsc 或 --skip-verify） |`

  let testRow: string
  let coverageSection: string
  if (verify.test) {
    const t = verify.test
    testRow = `| 单元测试 | ${t.pass ? '✅ 通过' : '❌ 失败'} | ${
      t.totalTests ? `${t.passedTests}/${t.totalTests} 用例通过` : ''
    }，耗时 ${formatDuration(t.durationMs)}${t.errorSnippet ? `\n\n<details><summary>错误摘要</summary>\n\n\`\`\`\n${t.errorSnippet}\n\`\`\`\n\n</details>` : ''} |`
    if (t.coverage) {
      const c = t.coverage.totals
      coverageSection = `### 测试覆盖率（实测）

> 由 \`npx vitest run ${args.testTarget ?? '(全量)'} --coverage\` 自动生成，**非占位符**。

| 指标 | 总数 | 已覆盖 | 覆盖率 |
|------|------|--------|--------|
| 语句（Statements） | ${c.statements.total} | ${c.statements.covered} | **${c.statements.pct}%** |
| 分支（Branches） | ${c.branches.total} | ${c.branches.covered} | **${c.branches.pct}%** |
| 函数（Functions） | ${c.functions.total} | ${c.functions.covered} | **${c.functions.pct}%** |
| 行（Lines） | ${c.lines.total} | ${c.lines.covered} | **${c.lines.pct}%** |`
      if (t.uncoveredLines && t.uncoveredLines.lines.length > 0) {
        const linesStr = t.uncoveredLines.lines.join(', ')
        coverageSection += `\n\n### 未覆盖行（\`${t.uncoveredLines.file}\`）\n\n\`${linesStr}\` — 建议补充对应测试用例。`
      } else if (t.uncoveredLines) {
        coverageSection += `\n\n### 未覆盖行（\`${t.uncoveredLines.file}\`）\n\n无 — 该文件已 100% 覆盖。`
      }
    } else {
      coverageSection = `### 测试覆盖率\n\n> ⚠️ 未生成覆盖率报告（vitest 执行失败或无 \`coverage-summary.json\`）。`
    }
  } else {
    testRow = `| 单元测试 | ⏭️ 跳过 | 未执行（--skip-test 或 --skip-verify） |`
    coverageSection = `### 测试覆盖率\n\n> ⏭️ 未执行测试，无覆盖率数据。`
  }

  const e2eRow = `| E2E 测试 | ⚠️ 需人工补充 | 脚本未自动运行 Playwright（耗时过长），请人工填入 \`npm run test:e2e\` 结果 |`

  // ===== 第六节：影响范围 =====
  const docImpactTable =
    docImpact.length === 0
      ? '_本次提交链未涉及 .md 文档变更。_'
      : `| 文档 | 变更类型 | 来源提交 |\n|------|----------|----------|\n${docImpact
          .map((d) => `| \`${d.path}\` | ${d.status} | \`${d.commit}\` |`)
          .join('\n')}`

  return `# ${args.title}总结报告

> **报告日期**：${today}  
> **报告类型**：技术重构总结  
> **涉及提交**：${commits.length} 个（${commits.map((c) => c.shortHash).join(' → ')}）  
> **总体状态**：✅ 已完成  
> **验证模式**：${verify.build || verify.tsc || verify.test ? '真实执行（build/tsc/test）' : '跳过（--skip-verify）'}

---

## 一、工作背景

### 问题描述

${args.description}

### 清理目标

1. 彻底移除旧版系统/文件
2. 确立新的唯一真相源
3. 补全文档与测试覆盖

---

## 二、提交链

| # | Commit Hash | 时间 | 类型 | 说明 |
|---|-------------|------|------|------|
${commits.map((c, i) => `| ${i + 1} | \`${c.shortHash}\` | ${c.date.split(' ')[1]} | ${c.message.split('\n')[0].split(':')[0]} | ${c.message.split('\n')[0].split(':').slice(1).join(':').trim()} |`).join('\n')}

---

## 三、涉及的文件列表

### 按变更类型分类

#### 删除的文件（${deleted.length} 个）

${deleted.length === 0 ? '无' : deleted.map((f) => `| \`${f.path}\` | \`${f.commit}\` | ${f.deletions ? `${f.deletions} 行` : ''} |`).join('\n')}

#### 新增的文件（${added.length} 个）

${added.length === 0 ? '无' : added.map((f) => `| \`${f.path}\` | \`${f.commit}\` | ${f.insertions ? `${f.insertions} 行` : ''} |`).join('\n')}

#### 修改的文件（${modified.length} 个）

${modified.length === 0 ? '无' : modified.map((f) => `| \`${f.path}\` | \`${f.commit}\` | ${f.insertions ? `+${f.insertions}` : ''}${f.deletions ? `/-${f.deletions}` : ''} |`).join('\n')}

${renamed.length > 0 ? `#### 重命名的文件（${renamed.length} 个）\n\n${renamed.map((f) => `| \`${f.path}\` → \`${f.newPath}\` | \`${f.commit}\` |`).join('\n')}` : ''}

---

## 四、关键变更点

> 以下内容由脚本从 commit 元数据自动派生，**建议人工修订补充**技术决策与架构影响。

${changesScaffold || '_（无可用 commit 元数据）_'}

---

## 五、验证结果

### 构建与测试

| 检查项 | 结果 | 证据 |
|--------|------|------|
${buildRow}
${testRow}
${tscRow}
${e2eRow}

${coverageSection}

---

## 六、影响范围

### 运行时影响

> ⚠️ **需人工补充**：描述对生产环境、开发环境、性能等方面的影响。脚本无法自动推断语义影响。

### 文档影响

${docImpactTable}

---

## 七、经验教训

> ⚠️ **需人工补充**：总结本次清理工作中的经验教训，避免未来重复同样的问题。脚本无法自动推断 retrospectives。

---

## 八、脚本能力边界说明

\`scripts/generate-cleanup-report.ts\`（v2）当前能力：

- ✅ 自动收集提交链、文件变更（\`--name-status\` + \`--numstat\`）、行数统计、按变更类型分类。
- ✅ **自动运行 build / tsc:prod / vitest --coverage**，真实数据填入第五节（非占位符）。
- ✅ 自动解析 \`coverage-summary.json\` 提取总覆盖率 + 解析 \`coverage-final.json\` 提取未覆盖行号。
- ✅ 自动派生第四节（关键变更点脚手架）与第六节文档影响表。
- ⚠️ 不自动运行 Playwright E2E（耗时过长），需人工填入。
- ⚠️ 运行时影响 / 经验教训为语义内容，需人工补充。
`
}

function generateCommitLog(args: CLIArgs, commits: CommitInfo[]): string {
  const today = new Date().toISOString().split('T')[0]
  const { added, modified, deleted, renamed } = categorizeFiles(commits)
  const totalIns = commits.reduce((sum, c) => sum + c.insertions, 0)
  const totalDel = commits.reduce((sum, c) => sum + c.deletions, 0)
  const totalFiles = new Set(commits.flatMap((c) => c.files.map((f) => f.path))).size

  return `# ${args.title} Commit 记录归档

> **归档日期**：${today}  
> **归档目的**：供项目 Wiki 参考，记录${args.title}的完整提交链  
> **涉及提交数**：${commits.length} 个

---

## 提交链总览

\`\`\`
${commits
  .map((c, i) => {
    const arrow = i < commits.length - 1 ? '\n         ↓' : ''
    return `${c.shortHash}  ${c.message.split('\n')[0]}${arrow}`
  })
  .join('\n')}
\`\`\`

---

${commits
  .map(
    (commit, i) => `## 提交 ${i + 1}：${commit.shortHash}

\`\`\`
commit ${commit.hash}
Author: ${commit.author}
Date:   ${commit.date}

    ${commit.message.split('\n').join('\n    ')}
\`\`\`

### 文件变更（${commit.files.length} 个文件，+${commit.insertions}/-${commit.deletions}）

${
  commit.files.length === 0
    ? '空提交（\`--allow-empty\`），无文件变更。'
    : `| 文件 | 变更类型 | 说明 |\n|------|----------|------|\n${commit.files
        .map((f) => {
          const statusLabel =
            f.status === 'added'
              ? '新增'
              : f.status === 'deleted'
                ? '删除'
                : f.status === 'renamed'
                  ? '重命名'
                  : '修改'
          const lines = []
          if (f.insertions) lines.push(`+${f.insertions}`)
          if (f.deletions) lines.push(`-${f.deletions}`)
          return `| \`${f.path}\` | ${statusLabel} | ${lines.join(' / ') || ''} |`
        })
        .join('\n')}`
}

---
`,
  )
  .join('\n')}

## 统计汇总

| 指标 | 数值 |
|------|------|
| 提交数 | ${commits.length} |
| 涉及文件数（去重） | ${totalFiles} |
| 删除文件数 | ${deleted.length} |
| 新增文件数 | ${added.length} |
| 修改文件数 | ${modified.length} |
${renamed.length > 0 ? `| 重命名文件数 | ${renamed.length} |\n` : ''}| 代码行数变化 | +${totalIns} / -${totalDel} |

---

## 相关文档

- [${args.title}总结报告](./SUMMARY-${args.name}.md)
`
}

// ===== 主入口 =====

function main(): void {
  const args = parseArgs()
  console.log(`\n📦 正在为 "${args.title}" 生成文档...`)
  console.log(`   提交数：${args.commits.length}`)
  console.log(`   提交链：${args.commits.join(' → ')}\n`)

  const commits = args.commits.map((hash) => getCommitInfo(hash))

  console.log('📋 收集到的提交信息：')
  commits.forEach((c) => {
    console.log(`   ${c.shortHash} | ${c.date} | ${c.files.length} 文件 | +${c.insertions}/-${c.deletions}`)
  })

  const verify = runVerifications(args)

  const outputDir = path.resolve(args.outputDir)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const summaryPath = path.join(outputDir, `SUMMARY-${args.name}.md`)
  const commitLogPath = path.join(outputDir, `COMMIT-LOG-${args.name}.md`)

  const summaryContent = generateSummary(args, commits, verify)
  const commitLogContent = generateCommitLog(args, commits)

  fs.writeFileSync(summaryPath, summaryContent, 'utf-8')
  fs.writeFileSync(commitLogPath, commitLogContent, 'utf-8')

  console.log('✅ 文档生成完成：')
  console.log(`   📄 总结报告：${summaryPath}`)
  console.log(`   📄 Commit 归档：${commitLogPath}`)

  const skipped: string[] = []
  if (args.skipBuild) skipped.push('build')
  if (args.skipTsc) skipped.push('tsc')
  if (args.skipTest) skipped.push('test')
  if (args.skipVerify) skipped.push('verify(全部)')
  if (skipped.length > 0) {
    console.log(`\n⚠️  跳过的验证项：${skipped.join(', ')}（对应章节标注为"跳过"）`)
  }
  console.log('\n⚠️  第五节验证结果为真实数据；第四节关键变更点/第六节运行时影响/第七节经验教训仍需人工补全。')
}

main()
