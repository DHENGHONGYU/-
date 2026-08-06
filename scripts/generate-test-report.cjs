/**
 * 读取 vitest JSON 输出，生成可视化 HTML 测试报告
 * 输入文件: outputs/test-results/chartTests.json (与 test:chart:industry --outputFile 严格一致)
 * 输出文件: outputs/test-results/chart-report.html
 */
const fs = require('fs')
const path = require('path')

const resultsDir = path.resolve(__dirname, '../outputs/test-results')
const jsonPath = path.join(resultsDir, 'chartTests.json')
const outPath = path.join(resultsDir, 'chart-report.html')

// 兜底创建目录（CI 中可能存在无 outputs/ 的空 checkout 场景）
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true })
  console.log(`[report:chart] Created missing directory: ${resultsDir}`)
}

// 兜底错误：JSON 不存在时给出明确的排查路径
if (!fs.existsSync(jsonPath)) {
  const expectedOldName = path.join(resultsDir, 'chart-tests.json')
  const suggestions = [
    '可能原因 1: 上游测试步骤 (test:chart:industry) 未成功执行，请先检查该步骤退出码',
    `可能原因 2: 文件名不一致 — package.json 使用 "chartTests.json" (无连字符)`,
    `可能原因 3: 仍使用旧文件名 "chart-tests.json" (有连字符) 但 CI 未更新 upload artifact 路径`,
    `当前期望路径: ${jsonPath}`,
    fs.existsSync(expectedOldName) ? `⚠ 发现旧文件名: ${expectedOldName} — 请同步改为 chartTests.json` : '未发现旧文件名',
  ]
  console.error('[report:chart] ERROR: chartTests.json not found\n' + suggestions.map(l => '  - ' + l).join('\n'))
  process.exit(1)
}

const raw = fs.readFileSync(jsonPath, 'utf-8')
let data
try {
  data = JSON.parse(raw)
} catch (err) {
  console.error(`[report:chart] ERROR: JSON 解析失败 — ${err.message}`)
  console.error(`  文件路径: ${jsonPath}`)
  console.error(`  文件内容前 200 字节: ${raw.slice(0, 200)}`)
  process.exit(1)
}

const totalTests = data.numTotalTests ?? 0
const passedTests = data.numPassedTests ?? 0
const failedTests = data.numFailedTests ?? 0
// 避免 toFixed：使用 Math.round 按精度缩放 (no-raw-tofixed 规则延伸)
const durationSecRaw = ((data.endTime ?? 0) - (data.startTime ?? 0)) / 1000
const duration = String(Math.round(durationSecRaw * 100) / 100)
const passRateRaw = totalTests > 0 ? (passedTests / totalTests) * 100 : 0
const passRate = String(Math.round(passRateRaw * 10) / 10)

// 按文件分组
const fileTestResults = Array.isArray(data.testResults) ? data.testResults : []
const files = fileTestResults.map((file) => {
  const fileName = (file.name || 'unknown').split(/[\\/]/).pop()
  const groups = {}
  const assertions = Array.isArray(file.assertionResults) ? file.assertionResults : []
  assertions.forEach((t) => {
    const group = Array.isArray(t.ancestorTitles) ? (t.ancestorTitles[0] || '默认') : '默认'
    if (!groups[group]) groups[group] = { passed: 0, failed: 0, tests: [] }
    if (t.status === 'passed') groups[group].passed++
    else groups[group].failed++
    groups[group].tests.push({
      title: t.title || '',
      status: t.status || 'unknown',
      duration: t.duration ?? 0,
      ancestors: Array.isArray(t.ancestorTitles) ? t.ancestorTitles : [],
    })
  })
  const fileDurSecRaw = ((file.endTime ?? 0) - (file.startTime ?? 0)) / 1000
  // 3 位小数 → 1000 倍取整
  return {
    fileName,
    fullName: file.name || '',
    passed: file.numPassingTests ?? 0,
    total: assertions.length,
    duration: String(Math.round(fileDurSecRaw * 1000) / 1000),
    groups,
  }
})

// 组件卡片配色
const cardColors = {
  'IndustryV4Panel.test.tsx': '#3b82f6',
  'IndustryV4Radar.test.tsx': '#8b5cf6',
  'SubIndicatorBar.test.tsx': '#ec4899',
  'TrendLineChart.test.tsx': '#10b981',
  'ValuationDistribution.test.tsx': '#f59e0b',
  'IndustryHeatmap.test.tsx': '#06b6d4',
}

function renderTest(test) {
  const statusIcon = test.status === 'passed' ? '✓' : '✗'
  const statusClass = test.status === 'passed' ? 'pass' : 'fail'
  let dur = ''
  if (test.duration != null && !Number.isNaN(Number(test.duration))) {
    const rounded = Math.round(Number(test.duration) * 10) / 10
    dur = `<span class="dur">${rounded}ms</span>`
  }
  const ancestors = Array.isArray(test.ancestors) ? test.ancestors : []
  const ancestorPath = ancestors.length > 1 ? ancestors.slice(1).join(' › ') + ' › ' : ''
  return `
    <div class="test ${statusClass}">
      <span class="icon">${statusIcon}</span>
      <span class="title"><span class="muted">${ancestorPath}</span>${escapeHtml(test.title)}</span>
      ${dur}
    </div>`
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderGroup(name, group) {
  const total = group.passed + group.failed
  const allPass = group.failed === 0
  return `
    <details class="group" open>
      <summary>
        <span class="group-name">${escapeHtml(name)}</span>
        <span class="group-stats ${allPass ? 'all-pass' : 'has-fail'}">
          ${group.passed}/${total} 通过
        </span>
      </summary>
      <div class="tests">
        ${group.tests.map(renderTest).join('')}
      </div>
    </details>`
}

function renderFile(file) {
  const color = cardColors[file.fileName] || '#6b7280'
  const allPass = file.passed === file.total
  return `
    <div class="card" style="border-top-color: ${color}">
      <div class="card-header">
        <div class="card-title">
          <span class="dot" style="background: ${color}"></span>
          ${escapeHtml(file.fileName)}
        </div>
        <div class="card-stats">
          <span class="badge ${allPass ? 'pass' : 'fail'}">${file.passed}/${file.total}</span>
          <span class="dur-badge">${file.duration}s</span>
        </div>
      </div>
      <div class="card-body">
        ${Object.entries(file.groups)
          .map(([name, g]) => renderGroup(name, g))
          .join('')}
      </div>
    </div>`
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>5 件套图表组件 · 单元测试报告</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', 'JetBrains Mono', sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: #e2e8f0;
    padding: 32px;
    min-height: 100vh;
  }
  .container { max-width: 1280px; margin: 0 auto; }
  .header {
    text-align: center;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid #334155;
  }
  .header h1 {
    font-size: 32px;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 12px;
  }
  .header .subtitle { color: #94a3b8; font-size: 14px; }
  .summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  .stat-card {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    text-align: center;
  }
  .stat-card .label { color: #94a3b8; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  .stat-card .value { font-size: 32px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
  .stat-card.pass .value { color: #10b981; }
  .stat-card.fail .value { color: #ef4444; }
  .stat-card.total .value { color: #60a5fa; }
  .stat-card.rate .value { color: #a78bfa; }
  .progress-bar {
    height: 8px;
    background: #334155;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 32px;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    width: ${passRate}%;
    transition: width 0.5s;
  }
  .files { display: grid; gap: 20px; }
  .card {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid #334155;
    border-top: 4px solid #3b82f6;
    border-radius: 12px;
    overflow: hidden;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: rgba(15, 23, 42, 0.5);
    border-bottom: 1px solid #334155;
  }
  .card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 16px;
    font-family: 'JetBrains Mono', monospace;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .card-stats { display: flex; gap: 8px; align-items: center; }
  .badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }
  .badge.pass { background: rgba(16, 185, 129, 0.15); color: #34d399; }
  .badge.fail { background: rgba(239, 68, 68, 0.15); color: #f87171; }
  .dur-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    background: rgba(148, 163, 184, 0.15);
    color: #cbd5e1;
    font-family: 'JetBrains Mono', monospace;
  }
  .card-body { padding: 12px 20px 20px; }
  .group { margin: 8px 0; border-left: 2px solid #334155; padding-left: 12px; }
  .group summary {
    cursor: pointer;
    padding: 8px 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
    list-style: none;
  }
  .group summary::-webkit-details-marker { display: none; }
  .group summary::before {
    content: '▼';
    color: #64748b;
    font-size: 10px;
    margin-right: 8px;
    transition: transform 0.2s;
  }
  .group[open] summary::before { transform: rotate(-90deg); }
  .group-name { font-weight: 600; color: #cbd5e1; font-size: 14px; }
  .group-stats { font-size: 12px; font-family: 'JetBrains Mono', monospace; }
  .group-stats.all-pass { color: #34d399; }
  .group-stats.has-fail { color: #f87171; }
  .tests { padding: 4px 0 4px 24px; }
  .test {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.6;
  }
  .test .icon {
    font-weight: 700;
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }
  .test.pass .icon { color: #34d399; }
  .test.fail .icon { color: #f87171; }
  .test.fail { background: rgba(239, 68, 68, 0.08); }
  .test .title { flex: 1; color: #cbd5e1; }
  .test .muted { color: #64748b; }
  .test .dur {
    color: #64748b;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    background: rgba(100, 116, 139, 0.1);
    padding: 1px 6px;
    border-radius: 3px;
  }
  .footer {
    text-align: center;
    color: #64748b;
    font-size: 12px;
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid #334155;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>5 件套图表组件 · 单元测试报告</h1>
      <div class="subtitle">IndustryV4Panel / IndustryV4Radar / SubIndicatorBar / TrendLineChart / ValuationDistribution</div>
    </div>

    <div class="summary">
      <div class="stat-card total">
        <div class="label">总测试数</div>
        <div class="value">${totalTests}</div>
      </div>
      <div class="stat-card pass">
        <div class="label">通过</div>
        <div class="value">${passedTests}</div>
      </div>
      <div class="stat-card fail">
        <div class="label">失败</div>
        <div class="value">${failedTests}</div>
      </div>
      <div class="stat-card rate">
        <div class="label">通过率</div>
        <div class="value">${passRate}%</div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>

    <div class="files">
      ${files.map(renderFile).join('')}
    </div>

    <div class="footer">
      生成时间: ${new Date().toLocaleString('zh-CN')} · 总耗时 ${duration}s · Vitest + React Testing Library
    </div>
  </div>
</body>
</html>`

try {
  fs.writeFileSync(outPath, html, 'utf-8')
} catch (err) {
  console.error(`[report:chart] ERROR: 写入 HTML 报告失败 — ${err.message}`)
  console.error(`  目标路径: ${outPath}`)
  process.exit(1)
}
console.log(`✅ [report:chart] HTML report generated: ${outPath}`)
console.log(`  Tests: ${totalTests} total | ${passedTests} passed | ${failedTests} failed | ${passRate}% pass rate | ${duration}s`)
