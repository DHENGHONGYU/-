#!/usr/bin/env node
/**
 * 将 Markdown 预警报告转为 PDF（附带 Grafana 截图）
 *
 * 流程：
 *   1. 读取 Markdown 报告
 *   2. 转换为带样式的 HTML（嵌入 Grafana 截图 base64）
 *   3. 用 Edge headless 打印为 PDF
 *
 * 用法：
 *   node scripts/generate-forecast-pdf.mjs <report.md> <screenshot.png> <output.pdf>
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ── 参数解析 ──
const [, , mdPathArg, pngPathArg, pdfPathArg] = process.argv
if (!mdPathArg || !pngPathArg || !pdfPathArg) {
  console.error('用法: node scripts/generate-forecast-pdf.mjs <report.md> <screenshot.png> <output.pdf>')
  process.exit(1)
}

const mdPath = resolve(projectRoot, mdPathArg)
const pngPath = resolve(projectRoot, pngPathArg)
const pdfPath = resolve(projectRoot, pdfPathArg)
const htmlPath = pdfPath.replace(/\.pdf$/, '.html')

if (!existsSync(mdPath)) { console.error(`Markdown 文件不存在: ${mdPath}`); process.exit(1) }
if (!existsSync(pngPath)) { console.error(`截图文件不存在: ${pngPath}`); process.exit(1) }

// ============================================================
// 1. Markdown → HTML 转换（轻量级，针对报告内容）
// ============================================================

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineFormat(s) {
  // 行内格式：**bold**、`code`、[link](url)
  let r = escapeHtml(s)
  r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  r = r.replace(/`([^`]+?)`/g, '<code>$1</code>')
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return r
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/)
  const html = []
  let i = 0
  let inTable = false
  let tableHeader = null
  let inCodeBlock = false
  let codeLines = []
  let inList = false
  let listType = null // 'ul' | 'ol'

  const flushList = () => {
    if (inList) { html.push(`</${listType}>`); inList = false; listType = null }
  }
  const flushTable = () => {
    if (inTable) { html.push('</tbody></table>'); inTable = false; tableHeader = null }
  }

  while (i < lines.length) {
    let line = lines[i]

    // 代码块
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
        codeLines = []
        inCodeBlock = false
      } else {
        flushList(); flushTable()
        inCodeBlock = true
      }
      i++; continue
    }
    if (inCodeBlock) { codeLines.push(line); i++; continue }

    // 空行
    if (line.trim() === '') {
      flushList(); flushTable()
      i++; continue
    }

    // 标题
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (hMatch) {
      flushList(); flushTable()
      const level = hMatch[1].length
      html.push(`<h${level}>${inlineFormat(hMatch[2])}</h${level}>`)
      i++; continue
    }

    // 分隔线
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      flushList(); flushTable()
      html.push('<hr/>')
      i++; continue
    }

    // 表格行
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList()
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim())
      // 分隔行（|---|---|）
      if (cells.every((c) => /^:?-+:?$/.test(c) || c === '')) {
        i++; continue
      }
      if (!inTable) {
        // 第一行是表头
        tableHeader = cells
        html.push('<table><thead><tr>')
        cells.forEach((c) => html.push(`<th>${inlineFormat(c)}</th>`))
        html.push('</tr></thead><tbody>')
        inTable = true
        i++; continue
      } else {
        html.push('<tr>')
        cells.forEach((c) => html.push(`<td>${inlineFormat(c)}</td>`))
        html.push('</tr>')
        i++; continue
      }
    } else {
      flushTable()
    }

    // 引用
    if (line.trim().startsWith('>')) {
      flushList()
      const content = line.replace(/^\s*>\s?/, '')
      html.push(`<blockquote>${inlineFormat(content)}</blockquote>`)
      i++; continue
    }

    // 有序列表
    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/)
    if (olMatch) {
      if (!inList || listType !== 'ol') { flushList(); html.push('<ol>'); inList = true; listType = 'ol' }
      html.push(`<li>${inlineFormat(olMatch[2])}</li>`)
      i++; continue
    }

    // 无序列表
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/)
    if (ulMatch) {
      if (!inList || listType !== 'ul') { flushList(); html.push('<ul>'); inList = true; listType = 'ul' }
      html.push(`<li>${inlineFormat(ulMatch[1])}</li>`)
      i++; continue
    }

    // 普通段落
    flushList()
    html.push(`<p>${inlineFormat(line)}</p>`)
    i++
  }

  flushList(); flushTable()
  if (inCodeBlock) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)

  return html.join('\n')
}

// ============================================================
// 2. 读取截图转 base64
// ============================================================

const pngBuffer = readFileSync(pngPath)
const pngBase64 = pngBuffer.toString('base64')
const pngDataUri = `data:image/png;base64,${pngBase64}`

// ============================================================
// 3. 组装完整 HTML（带打印样式）
// ============================================================

const mdContent = readFileSync(mdPath, 'utf-8')
const reportHtml = mdToHtml(mdContent)

const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>低流动性拦截模拟预警报告 v4.5.4</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 20mm 16mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 18pt;
    color: #0b5394;
    border-bottom: 3px solid #0b5394;
    padding-bottom: 6px;
    margin-top: 0;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 14pt;
    color: #0b5394;
    border-left: 5px solid #0b5394;
    padding-left: 10px;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    color: #333;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h4 {
    font-size: 11pt;
    color: #555;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th {
    background: #0b5394;
    color: #fff;
    padding: 6px 8px;
    text-align: left;
    border: 1px solid #0b5394;
    font-weight: 600;
  }
  td {
    padding: 5px 8px;
    border: 1px solid #d0d7de;
    vertical-align: top;
  }
  tbody tr:nth-child(even) { background: #f6f8fa; }
  tbody tr:hover { background: #fff8e1; }
  code {
    background: #f0f0f0;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 9pt;
    color: #d6336c;
  }
  pre {
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    padding: 10px 12px;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code {
    background: transparent;
    padding: 0;
    color: #1a1a1a;
  }
  blockquote {
    border-left: 4px solid #ffc107;
    background: #fffde7;
    padding: 8px 12px;
    margin: 10px 0;
    color: #555;
    page-break-inside: avoid;
  }
  hr {
    border: none;
    border-top: 1px solid #d0d7de;
    margin: 20px 0;
  }
  ul, ol {
    margin: 8px 0;
    padding-left: 24px;
  }
  li { margin: 3px 0; }
  a { color: #0b5394; text-decoration: none; }
  strong { color: #0b5394; }
  .screenshot-section {
    page-break-before: always;
    page-break-inside: avoid;
  }
  .screenshot-section h2 {
    page-break-after: avoid;
  }
  .screenshot-container {
    border: 2px solid #0b5394;
    border-radius: 6px;
    padding: 8px;
    background: #fff;
    page-break-inside: avoid;
  }
  .screenshot-container img {
    width: 100%;
    height: auto;
    display: block;
  }
  .screenshot-caption {
    text-align: center;
    font-size: 9pt;
    color: #666;
    margin-top: 6px;
    font-style: italic;
  }
  .report-footer {
    margin-top: 30px;
    padding-top: 12px;
    border-top: 1px solid #d0d7de;
    font-size: 9pt;
    color: #888;
    text-align: center;
    font-style: italic;
  }
</style>
</head>
<body>
${reportHtml}

<div class="screenshot-section">
  <h2>附录 A：Grafana 监控面板截图（基准日 2026-08-10）</h2>
  <p>下图来自本地 Grafana 仪表盘（UID: <code>chip-flow-low-liq-v454</code>），展示 v4.5.4 拦截规则的实时监控状态，包括日成交金额分布、混淆矩阵、准确率指标等面板。</p>
  <div class="screenshot-container">
    <img src="${pngDataUri}" alt="Grafana Chip-Flow Dashboard Screenshot"/>
    <div class="screenshot-caption">图 A-1：Grafana 仪表盘全屏截图 — 低流动性拦截监控面板 v4.5.4</div>
  </div>
  <p style="font-size:9pt;color:#666;margin-top:8px;">
    访问地址：<code>http://localhost:3000/d/chip-flow-low-liq-v454/chip-flow-dashboard</code><br/>
    数据源：Prometheus（采集间隔 5s）｜ 容器：chip-flow-grafana / chip-flow-prometheus / chip-flow-node-exporter
  </p>
</div>

<div class="report-footer">
  本报告由 FinSightV9 监控栈自动生成 ｜ 规则版本 v4.5.4 ｜ 生成时间 2026-08-10
</div>
</body>
</html>`

writeFileSync(htmlPath, fullHtml, 'utf-8')
console.log(`[1/2] HTML 已生成: ${htmlPath} (${(fullHtml.length / 1024).toFixed(1)} KB)`)

// ============================================================
// 4. Edge headless 打印 PDF
// ============================================================

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`

console.log('[2/2] 调用 Edge headless 打印 PDF...')

try {
  execFileSync(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ], { timeout: 30000, stdio: 'ignore' })

  if (existsSync(pdfPath)) {
    const stats = readFileSync(pdfPath)
    const sizeKB = (stats.length / 1024).toFixed(1)
    console.log(`✓ PDF 生成成功: ${pdfPath} (${sizeKB} KB)`)
  } else {
    console.error('✗ PDF 文件未生成')
    process.exit(1)
  }
} catch (err) {
  console.error('✗ Edge 打印 PDF 失败:', err.message)
  console.error(`  HTML 文件已保留: ${htmlPath}（可手动在浏览器中打印为 PDF）`)
  process.exit(1)
}
