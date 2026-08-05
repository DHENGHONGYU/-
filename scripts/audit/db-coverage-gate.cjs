/**
 * db.ts 覆盖率门禁脚本 — 防止覆盖率退化
 *
 * 用法: node scripts/audit/db-coverage-gate.cjs
 *
 * 行为：
 * 1. 运行 db.ts 相关测试（db.v6database.test.ts + db.regression.test.ts + db.test.ts）
 * 2. 生成 coverage-final.json
 * 3. 解析覆盖率数据，检查 statements/branches/functions/lines 是否全部达到 100%
 * 4. 如果任一维度低于 100%，列出未覆盖的具体位置并退出码 1
 * 5. 全部 100% 则退出码 0
 *
 * 适用场景：
 * - CI 流水线：在 PR 合并前自动检查 db.ts 覆盖率
 * - 本地开发：重构 db.ts 前后运行，确保覆盖率未下降
 * - pre-commit hook：可选集成，防止覆盖率退化代码被提交
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const COVERAGE_FILE = path.join(ROOT, 'docs', 'reports', 'coverage', 'db', 'coverage-final.json')
const TARGET_FILE = 'src/data/db.ts'

// 覆盖率阈值（100% 全覆盖）
const THRESHOLDS = {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
}

function log(msg) {
  console.log(`[db-coverage-gate] ${msg}`)
}

function logError(msg) {
  console.error(`[db-coverage-gate] ERROR: ${msg}`)
}

/**
 * 运行测试并生成覆盖率数据
 */
function runTests() {
  log('Running db.ts test suites with coverage...')
  const cmd = [
    'npx vitest run',
    'src/data/db.v6database.test.ts',
    'src/data/db.regression.test.ts',
    'src/data/db.test.ts',
    '--coverage',
    `--coverage.include='${TARGET_FILE}'`,
    '--coverage.all=false',
    '--coverage.reporter=json',
    "--coverage.reportsDirectory='docs/reports/coverage/db'",
  ].join(' ')

  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', shell: 'powershell' })
    log('Tests passed.')
    return true
  } catch (err) {
    logError('Tests failed.')
    if (err.stdout) console.log(err.stdout.toString())
    if (err.stderr) console.error(err.stderr.toString())
    return false
  }
}

/**
 * 解析 coverage-final.json 并检查覆盖率
 */
function checkCoverage() {
  if (!fs.existsSync(COVERAGE_FILE)) {
    logError(`Coverage file not found: ${COVERAGE_FILE}`)
    return { ok: false, reason: 'coverage-final.json missing' }
  }

  const cov = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'))
  const targetKey = Object.keys(cov).find((k) => k.replace(/\\/g, '/').endsWith(TARGET_FILE))

  if (!targetKey) {
    logError(`Target file not found in coverage data: ${TARGET_FILE}`)
    return { ok: false, reason: 'target file not in coverage' }
  }

  const data = cov[targetKey]
  const s = Object.values(data.s)
  const b = Object.values(data.b).flat()
  const f = Object.values(data.f)

  const stmtCovered = s.filter((x) => x > 0).length
  const brCovered = b.filter((x) => x > 0).length
  const fnCovered = f.filter((x) => x > 0).length

  const lines = new Set()
  const coveredLines = new Set()
  for (const [id, loc] of Object.entries(data.statementMap)) {
    for (let l = loc.start.line; l <= loc.end.line; l++) lines.add(l)
    if (data.s[id] > 0) for (let l = loc.start.line; l <= loc.end.line; l++) coveredLines.add(l)
  }

  const metrics = {
    statements: { covered: stmtCovered, total: s.length, pct: s.length ? (stmtCovered / s.length) * 100 : 100 },
    branches: { covered: brCovered, total: b.length, pct: b.length ? (brCovered / b.length) * 100 : 100 },
    functions: { covered: fnCovered, total: f.length, pct: f.length ? (fnCovered / f.length) * 100 : 100 },
    lines: { covered: coveredLines.size, total: lines.size, pct: lines.size ? (coveredLines.size / lines.size) * 100 : 100 },
  }

  // 收集未覆盖的具体位置
  const uncovered = { statements: [], branches: [], functions: [] }

  for (const [id, count] of Object.entries(data.s)) {
    if (count === 0) {
      const loc = data.statementMap[id]
      uncovered.statements.push(`  line ${loc.start.line}:${loc.start.column} - ${loc.end.line}:${loc.end.column}`)
    }
  }

  for (const [id, hits] of Object.entries(data.b)) {
    const loc = data.branchMap[id]
    const hitArr = Array.isArray(hits) ? hits : [hits]
    const uncoveredHits = hitArr.filter((h) => h === 0).length
    if (uncoveredHits > 0) {
      const startLine = loc.loc ? loc.loc.start.line : (loc.locations && loc.locations[0] && loc.locations[0].start ? loc.locations[0].start.line : '?')
      uncovered.branches.push(`  line ${startLine} type=${loc.type} hits=[${hitArr.join(', ')}]`)
    }
  }

  for (const [id, count] of Object.entries(data.f)) {
    if (count === 0) {
      const fn = data.fnMap[id]
      const line = fn.decl ? fn.decl.start.line : (fn.loc ? fn.loc.start.line : '?')
      uncovered.functions.push(`  line ${line} name=${fn.name || '(anonymous)'}`)
    }
  }

  // 检查阈值
  const failures = []
  for (const [metric, data] of Object.entries(metrics)) {
    if (data.pct < THRESHOLDS[metric]) {
      failures.push(`${metric}: ${data.pct.toFixed(2)}% < ${THRESHOLDS[metric]}% (${data.covered}/${data.total})`)
    }
  }

  return { ok: failures.length === 0, metrics, uncovered, failures }
}

/**
 * 主流程
 */
function main() {
  log(`Target: ${TARGET_FILE}`)
  log(`Thresholds: stmts=${THRESHOLDS.statements}%, branches=${THRESHOLDS.branches}%, funcs=${THRESHOLDS.functions}%, lines=${THRESHOLDS.lines}%`)

  const testsOk = runTests()
  if (!testsOk) {
    process.exit(1)
  }

  const result = checkCoverage()

  console.log()
  log('=== Coverage Summary ===')
  if (result.metrics) {
    console.log(`  Statements: ${result.metrics.statements.pct.toFixed(2)}% (${result.metrics.statements.covered}/${result.metrics.statements.total})`)
    console.log(`  Branches:   ${result.metrics.branches.pct.toFixed(2)}% (${result.metrics.branches.covered}/${result.metrics.branches.total})`)
    console.log(`  Functions:  ${result.metrics.functions.pct.toFixed(2)}% (${result.metrics.functions.covered}/${result.metrics.functions.total})`)
    console.log(`  Lines:      ${result.metrics.lines.pct.toFixed(2)}% (${result.metrics.lines.covered}/${result.metrics.lines.total})`)
  }
  console.log()

  if (result.ok) {
    log('PASS: All coverage thresholds met (100%). db.ts is fully covered.')
    process.exit(0)
  } else {
    logError('FAIL: Coverage thresholds not met.')
    if (result.failures) {
      console.log()
      console.log('Failed metrics:')
      result.failures.forEach((f) => console.log(`  - ${f}`))
    }
    if (result.uncovered) {
      if (result.uncovered.statements.length > 0) {
        console.log()
        console.log('Uncovered statements:')
        result.uncovered.statements.forEach((s) => console.log(s))
      }
      if (result.uncovered.branches.length > 0) {
        console.log()
        console.log('Uncovered branches:')
        result.uncovered.branches.forEach((b) => console.log(b))
      }
      if (result.uncovered.functions.length > 0) {
        console.log()
        console.log('Uncovered functions:')
        result.uncovered.functions.forEach((f) => console.log(f))
      }
    }
    console.log()
    logError('Coverage regression detected. Add tests to restore 100% coverage before merging.')
    process.exit(1)
  }
}

main()
