/**
 * 从 coverage-final.json 生成简易 HTML 覆盖率报告
 * 用法: node scripts/generate-coverage-html.cjs <coverage-final.json路径> <输出目录>
 */
const fs = require('fs')
const path = require('path')

const covFile = process.argv[2] || 'docs/reports/coverage/db/coverage-final.json'
const outDir = process.argv[3] || 'docs/reports/coverage/db'

const cov = JSON.parse(fs.readFileSync(covFile, 'utf8'))

fs.mkdirSync(outDir, { recursive: true })

// 计算 totals
const totals = { statements: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 }, functions: { total: 0, covered: 0 }, lines: { total: 0, covered: 0 } }
const files = []

for (const [filePath, data] of Object.entries(cov)) {
  const s = Object.values(data.s)
  const b = Object.values(data.b).flat()
  const f = Object.values(data.f)
  const stmtCov = s.filter((x) => x > 0).length
  const brCov = b.filter((x) => x > 0).length
  const fnCov = f.filter((x) => x > 0).length
  const lines = new Set()
  const coveredLines = new Set()
  for (const [id, loc] of Object.entries(data.statementMap)) {
    for (let l = loc.start.line; l <= loc.end.line; l++) lines.add(l)
    if (data.s[id] > 0) for (let l = loc.start.line; l <= loc.end.line; l++) coveredLines.add(l)
  }
  totals.statements.total += s.length
  totals.statements.covered += stmtCov
  totals.branches.total += b.length
  totals.branches.covered += brCov
  totals.functions.total += f.length
  totals.functions.covered += fnCov
  totals.lines.total += lines.size
  totals.lines.covered += coveredLines.size
  files.push({
    path: filePath,
    basename: path.basename(filePath),
    statements: { total: s.length, covered: stmtCov, pct: s.length ? (stmtCov / s.length) * 100 : 100 },
    branches: { total: b.length, covered: brCov, pct: b.length ? (brCov / b.length) * 100 : 100 },
    functions: { total: f.length, covered: fnCov, pct: f.length ? (fnCov / f.length) * 100 : 100 },
    lines: { total: lines.size, covered: coveredLines.size, pct: lines.size ? (coveredLines.size / lines.size) * 100 : 100 },
  })
}

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(2) : '100.00')
const colorClass = (p) => (p >= 100 ? 'green' : p >= 80 ? 'yellow' : 'red')

let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Coverage Report - db.ts</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; background: #fafafa; color: #333; }
h1 { color: #1a1a1a; border-bottom: 2px solid #4caf50; padding-bottom: 10px; }
.summary { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
.metric { background: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); min-width: 140px; text-align: center; }
.metric .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
.metric .value { font-size: 28px; font-weight: 700; margin-top: 5px; }
.metric .detail { font-size: 11px; color: #888; margin-top: 3px; }
.green { color: #4caf50; }
.yellow { color: #ff9800; }
.red { color: #f44336; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
th { background: #f5f5f5; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
td { font-size: 14px; }
tr:hover { background: #f9f9f9; }
.pct { font-weight: 600; }
a { color: #1976d2; text-decoration: none; }
a:hover { text-decoration: underline; }
.meta { color: #888; font-size: 13px; margin: 10px 0; }
</style>
</head>
<body>
<h1>Coverage Report</h1>
<div class="meta">Generated from <code>${covFile}</code> on ${new Date().toISOString()}</div>

<div class="summary">
  <div class="metric"><div class="label">Statements</div><div class="value ${colorClass(parseFloat(pct(totals.statements.covered, totals.statements.total)))}">${pct(totals.statements.covered, totals.statements.total)}%</div><div class="detail">${totals.statements.covered}/${totals.statements.total}</div></div>
  <div class="metric"><div class="label">Branches</div><div class="value ${colorClass(parseFloat(pct(totals.branches.covered, totals.branches.total)))}">${pct(totals.branches.covered, totals.branches.total)}%</div><div class="detail">${totals.branches.covered}/${totals.branches.total}</div></div>
  <div class="metric"><div class="label">Functions</div><div class="value ${colorClass(parseFloat(pct(totals.functions.covered, totals.functions.total)))}">${pct(totals.functions.covered, totals.functions.total)}%</div><div class="detail">${totals.functions.covered}/${totals.functions.total}</div></div>
  <div class="metric"><div class="label">Lines</div><div class="value ${colorClass(parseFloat(pct(totals.lines.covered, totals.lines.total)))}">${pct(totals.lines.covered, totals.lines.total)}%</div><div class="detail">${totals.lines.covered}/${totals.lines.total}</div></div>
</div>

<table>
<thead>
<tr><th>File</th><th>Statements</th><th>Branches</th><th>Functions</th><th>Lines</th></tr>
</thead>
<tbody>
`

for (const f of files) {
  html += `<tr>
<td><a href="${f.basename}.html">${f.basename}</a></td>
<td class="pct ${colorClass(f.statements.pct)}">${f.statements.pct.toFixed(2)}% <span style="color:#888;font-size:11px">(${f.statements.covered}/${f.statements.total})</span></td>
<td class="pct ${colorClass(f.branches.pct)}">${f.branches.pct.toFixed(2)}% <span style="color:#888;font-size:11px">(${f.branches.covered}/${f.branches.total})</span></td>
<td class="pct ${colorClass(f.functions.pct)}">${f.functions.pct.toFixed(2)}% <span style="color:#888;font-size:11px">(${f.functions.covered}/${f.functions.total})</span></td>
<td class="pct ${colorClass(f.lines.pct)}">${f.lines.pct.toFixed(2)}% <span style="color:#888;font-size:11px">(${f.lines.covered}/${f.lines.total})</span></td>
</tr>`
}

html += `</tbody></table>
</body></html>`

fs.writeFileSync(path.join(outDir, 'index.html'), html)
console.log(`HTML report generated at: ${path.resolve(outDir, 'index.html')}`)
console.log(`Totals: ${pct(totals.statements.covered, totals.statements.total)}% stmts, ${pct(totals.branches.covered, totals.branches.total)}% branches, ${pct(totals.functions.covered, totals.functions.total)}% funcs, ${pct(totals.lines.covered, totals.lines.total)}% lines`)

// 同时为每个源文件生成详情页
for (const [filePath, data] of Object.entries(cov)) {
  const basename = path.basename(filePath)
  const srcContent = fs.readFileSync(filePath, 'utf8').split('\n')
  const stmtCovByLine = {}
  for (const [id, loc] of Object.entries(data.statementMap)) {
    for (let l = loc.start.line; l <= loc.end.line; l++) {
      if (!stmtCovByLine[l] || data.s[id] > 0) stmtCovByLine[l] = data.s[id] > 0
    }
  }
  const brCovByLine = {}
  for (const [id, loc] of Object.entries(data.branchMap)) {
    const locations = loc.locations || []
    const hits = data.b[id] || []
    const allCovered = hits.length > 0 && hits.every((h) => h > 0)
    const partialCovered = hits.some((h) => h > 0)
    const startLine = loc.loc ? loc.loc.start.line : (locations[0] && locations[0].start && locations[0].start.line)
    if (startLine) {
      brCovByLine[startLine] = { allCovered, partialCovered, hits, type: loc.type }
    }
  }

  let detail = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${basename} - Coverage</title>
<style>
body { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; margin: 0; background: #fff; color: #333; }
.header { background: #f5f5f5; padding: 15px 20px; border-bottom: 1px solid #ddd; position: sticky; top: 0; }
.header h1 { margin: 0; font-size: 18px; }
.header a { color: #1976d2; text-decoration: none; font-size: 13px; }
pre { margin: 0; font-size: 13px; line-height: 1.6; }
.line { display: flex; min-height: 20px; }
.line-no { width: 50px; padding: 0 8px; text-align: right; color: #999; user-select: none; border-right: 1px solid #eee; flex-shrink: 0; }
.line-content { padding: 0 12px; white-space: pre; overflow-x: auto; flex: 1; }
.covered { background: #e6ffe6; }
.uncovered { background: #ffe6e6; }
.partial { background: #fff4e6; }
.branch-info { color: #999; font-size: 11px; padding-left: 10px; }
</style>
</head>
<body>
<div class="header"><h1>${basename}</h1><a href="index.html">← Back to summary</a></div>
<pre>
`
  srcContent.forEach((line, i) => {
    const lineNum = i + 1
    const stmtCov = stmtCovByLine[lineNum]
    const brInfo = brCovByLine[lineNum]
    let cls = ''
    let info = ''
    if (brInfo) {
      if (brInfo.allCovered) { cls = 'covered' }
      else if (brInfo.partialCovered) { cls = 'partial'; info = ` // branch: [${brInfo.hits.join(', ')}]` }
      else { cls = 'uncovered'; info = ` // branch: [${brInfo.hits.join(', ')}]` }
    } else if (stmtCov === true) { cls = 'covered' }
    else if (stmtCov === false) { cls = 'uncovered' }
    detail += `<div class="line ${cls}"><span class="line-no">${lineNum}</span><span class="line-content">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}<span class="branch-info">${info}</span></span></div>\n`
  })
  detail += `</pre></body></html>`
  fs.writeFileSync(path.join(outDir, `${basename}.html`), detail)
  console.log(`Detail page generated: ${basename}.html`)
}
