// Parse V8 native coverage-final.json and produce module-level summary
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const COV_PATH = process.env.COVERAGE_FILE || join(process.cwd(), 'coverage', 'coverage-final.json')
const JSON_OUT = process.env.COVERAGE_OUT || join(process.cwd(), 'outputs', 'coverage-summary-2026-08-06.json')

function analyze(cov) {
  const modules = {}
  let totalStmt = [0, 0], totalBranch = [0, 0], totalFunc = [0, 0]
  for (const [filePath, info] of Object.entries(cov)) {
    const norm = filePath.replace(/\\/g, '/')
    const m = norm.match(/\/src\/([^/]+)/)
    let key = 'other'
    if (m) key = 'src/' + m[1]
    else if (norm.includes('/tests/') || norm.includes('/__tests__/')) key = 'tests'
    else if (norm.includes('/scripts/')) key = 'scripts'
    else if (norm.includes('/node_modules/')) continue
    const sCounts = Object.values(info.s || {})
    const st = sCounts.length
    const sc = sCounts.filter(v => v > 0).length
    const fCounts = Object.values(info.f || {})
    const ft = fCounts.length
    const fc = fCounts.filter(v => v > 0).length
    const bEntries = Object.values(info.b || {})
    let bt = 0, bc = 0
    for (const arr of bEntries) {
      if (!Array.isArray(arr)) continue
      bt += arr.length
      bc += arr.filter(v => v > 0).length
    }
    if (!modules[key]) {
      modules[key] = { stmt:[0,0], branch:[0,0], func:[0,0], files:new Set() }
    }
    modules[key].stmt[0] += st
    modules[key].stmt[1] += sc
    modules[key].branch[0] += bt
    modules[key].branch[1] += bc
    modules[key].func[0] += ft
    modules[key].func[1] += fc
    modules[key].files.add(norm)
    totalStmt[0] += st
    totalStmt[1] += sc
    totalBranch[0] += bt
    totalBranch[1] += bc
    totalFunc[0] += ft
    totalFunc[1] += fc
  }
  const pct = (cov) => cov[0] === 0 ? 100 : (cov[1] / cov[0] * 100)
  const out = {
    generatedAt: new Date().toISOString(),
    totals: {
      statements: { total:totalStmt[0], covered:totalStmt[1], pct: pct(totalStmt) },
      branches:   { total:totalBranch[0], covered:totalBranch[1], pct: pct(totalBranch) },
      functions:  { total:totalFunc[0], covered:totalFunc[1], pct: pct(totalFunc) },
    },
    modules: {}
  }
  for (const [key, m] of Object.entries(modules)) {
    out.modules[key] = {
      fileCount: m.files.size,
      statements: { total:m.stmt[0], covered:m.stmt[1], pct: pct(m.stmt) },
      branches:   { total:m.branch[0], covered:m.branch[1], pct: pct(m.branch) },
      functions:  { total:m.func[0], covered:m.func[1], pct: pct(m.func) },
    }
  }
  return out
}

function main() {
  if (!existsSync(COV_PATH)) { console.error('NOT_FOUND: ' + COV_PATH); process.exit(2) }
  const sizeKB = Math.round(statSync(COV_PATH).size / 1024)
  console.log('Parsing coverage: ' + COV_PATH + ' (' + sizeKB + ' KB)...')
  const raw = readFileSync(COV_PATH, 'utf-8')
  const cov = JSON.parse(raw)
  console.log('Files in coverage report: ' + Object.keys(cov).length)
  const summary = analyze(cov)
  console.log('')
  console.log('=== GLOBAL TOTALS ===')
  console.log('  Statements: ' + summary.totals.statements.covered + '/' + summary.totals.statements.total + '  (' + summary.totals.statements.pct.toFixed(2) + '%)')
  console.log('  Branches:   ' + summary.totals.branches.covered + '/' + summary.totals.branches.total + '  (' + summary.totals.branches.pct.toFixed(2) + '%)')
  console.log('  Functions:  ' + summary.totals.functions.covered + '/' + summary.totals.functions.total + '  (' + summary.totals.functions.pct.toFixed(2) + '%)')
  console.log('')
  const sorted = Object.entries(summary.modules).sort((a,b) => b[1].fileCount - a[1].fileCount)
  const pad = (s, n) => String(s).padEnd(n)
  const pads = (s, n) => String(s).padStart(n)
  console.log('=== PER MODULE (sorted by file count) ===')
  console.log(pad('Module', 24) + pads('Files', 6) + pads('Stmt %', 11) + pads('Branch %', 11) + pads('Func %', 11))
  console.log('-'.repeat(62))
  for (const [k, m] of sorted) {
    console.log(pad(k, 24) + pads(m.fileCount, 6) + pads(m.statements.pct.toFixed(2)+'%', 11) + pads(m.branches.pct.toFixed(2)+'%', 11) + pads(m.functions.pct.toFixed(2)+'%', 11))
  }
  writeFileSync(JSON_OUT, JSON.stringify(summary, null, 2), 'utf-8')
  console.log('')
  console.log('Written: ' + JSON_OUT + ' (' + Math.round(statSync(JSON_OUT).size/1024) + ' KB)')
}
main()
