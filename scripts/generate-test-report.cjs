/**
 * 读取 vitest JSON 输出，生成可视化 HTML 测试报告
 */
const fs = require('fs')
const path = require('path')

const jsonPath = path.resolve(__dirname, '../outputs/test-results/chart-tests.json')
const outPath = path.resolve(__dirname, '../outputs/test-results/chart-report.html')

const raw = fs.readFileSync(jsonPath, 'utf-8')
const data = JSON.parse(raw)

const totalTests = data.numTotalTests
const passedTests = data.numPassedTests
const failedTests = data.numFailedTests
const duration = ((data.endTime - data.startTime) / 1000).toFixed(2)
const passRate = ((passedTests / totalTests) * 100).toFixed(1)

// 按文件分组
const files = data.testResults.map((file) => {
  const fileName = file.name.split(/[\\/]/).pop()
  const groups = {}
  file.assertionResults.forEach((t) => {
    const group = t.ancestorTitles[0] || '默认'
    if (!groups[group]) groups[group] = { passed: 0, failed: 0, tests: [] }
    if (t.status === 'passed') groups[group].passed++
    else groups[group].failed++
    groups[group].tests.push({
      title: t.title,
      status: t.status,
      duration: t.duration,
      ancestors: t.ancestorTitles,
    })
  })
  return {
    fileName,
    fullName: file.name,
    passed: file.numPassingTests,
    total: file.assertionResults.length,
    duration: ((file.endTime - file.startTime) / 1000).toFixed(3),
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
  const dur = test.duration ? `<span class="dur">${test.duration.toFixed(1)}ms</span>` : ''
  const ancestorPath = test.ancestors.length > 1 ? test.ancestors.slice(1).join(' › ') + ' › ' : ''
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

fs.writeFileSync(outPath, html, 'utf-8')
console.log(`HTML report generated: ${outPath}`)
console.log(`Tests: ${totalTests} total | ${passedTests} passed | ${failedTests} failed | ${passRate}% pass rate`)
