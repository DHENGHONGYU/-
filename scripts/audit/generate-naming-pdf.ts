#!/usr/bin/env tsx
/**
 * generate-naming-pdf.ts
 * 将命名规范违规优先级报告导出为 PDF 格式
 *
 * 用法:
 *   npx tsx scripts/audit/generate-naming-pdf.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..')

const mdPath = join(rootDir, 'outputs', 'naming-priority-report.md')
const pdfPath = join(rootDir, 'outputs', 'naming-priority-report.pdf')

async function generatePdf() {
  const md = readFileSync(mdPath, 'utf-8')

  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = 210
    const marginLeft = 15
    const marginTop = 20
    const contentWidth = pageWidth - marginLeft * 2
    let y = marginTop

    // ── 封面标题 ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('命名规范违规修复', marginLeft, y)
    y += 10
    doc.setFontSize(18)
    doc.text('优先级建议报告', marginLeft, y)
    y += 12

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, marginLeft, y)
    y += 6
    doc.text('关联检查器: scripts/audit/check-naming-conventions.ts', marginLeft, y)
    y += 10

    // ── 执行摘要 ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('执行摘要', marginLeft, y)
    y += 8

    const summaryData = [
      ['初始检查', '33', '包含误报（export default / class / memo / 复合组件）'],
      ['检查器优化后', '4', '消除 29 个误报'],
      ['豁免白名单后', '3', '仅剩 3 个需实际重命名的组件文件'],
    ]

    autoTable(doc, {
      startY: y,
      head: [['阶段', 'error 级数量', '说明']],
      body: summaryData,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [66, 133, 244], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30 },
        2: { cellWidth: contentWidth - 80 },
      },
    })

    y = doc.lastAutoTable.finalY + 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(34, 139, 34)
    doc.text('优化效果: 从 33 → 3 个 error 级违规，误报率从 82% 降至 0%。', marginLeft, y)
    doc.setTextColor(0, 0, 0)
    y += 12

    // ── P0 必须立即修复 ──
    if (y > 200) {
      doc.addPage()
      y = marginTop
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(234, 67, 53)
    doc.text('P0 · 必须立即修复（3 个文件）', marginLeft, y)
    doc.setTextColor(0, 0, 0)
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const p0Desc = doc.splitTextToSize(
      '这 3 个文件的组件名与文件名不一致，且为真实组件文件（非工具/注册表/常量），需要通过重命名文件或重命名导出的方式修复。',
      contentWidth
    )
    doc.text(p0Desc, marginLeft, y)
    y += p0Desc.length * 4 + 6

    const p0Data = [
      ['StockPriceChange.tsx', 'StockPriceChangeBadge', '重命名为 StockPriceChangeBadge.tsx', '4 个', 'MEDIUM'],
      ['Toast.tsx', 'Toaster', '重命名为 Toaster.tsx', '8 个', 'MEDIUM'],
      ['Error.tsx', 'ErrorState', '重命名为 ErrorState.tsx', '12 个', 'HIGH'],
    ]

    autoTable(doc, {
      startY: y,
      head: [['文件', '当前导出', '建议操作', '消费方', '风险']],
      body: p0Data,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [234, 67, 53], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 55 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
      },
      didParseCell: (data: { section: string; column: number; row: number }) => {
        if (data.section === 'body' && data.column === 4) {
          const val = (data.cell.raw as string) || ''
          if (val === 'HIGH') {
            data.cell.styles!.textColor = [234, 67, 53]
            data.cell.styles!.fontStyle = 'bold'
          } else if (val === 'MEDIUM') {
            data.cell.styles!.textColor = [251, 188, 4]
          }
        }
      },
    })

    y = doc.lastAutoTable.finalY + 10

    // ── 每个 P0 文件详情 ──
    const details = [
      {
        title: 'StockPriceChangeBadge（Atom 层）',
        currentFile: 'src/components/atoms/StockPriceChange.tsx',
        export: 'StockPriceChangeBadge',
        action: '重命名文件为 StockPriceChangeBadge.tsx',
        consumers: '4',
        risk: 'MEDIUM',
        reason: '组件名 StockPriceChangeBadge 明确表达了"股价涨跌徽章"的完整语义，文件名 StockPriceChange 过于简化。重命名后组件-文件名一致，且更易搜索。',
        steps: [
          '将文件 src/components/atoms/StockPriceChange.tsx 重命名为 StockPriceChangeBadge.tsx',
          '全局搜索并更新所有 import 路径（约 4 处）',
          '更新文件内 @fileoverview 中的 @module 路径',
          '运行 npm run audit:naming 验证修复',
          '运行 npm run tsc:prod 确认类型正确',
        ],
      },
      {
        title: 'Toaster（Atom 层）',
        currentFile: 'src/components/atoms/Toast.tsx',
        export: 'Toaster',
        action: '重命名文件为 Toaster.tsx',
        consumers: '8',
        risk: 'MEDIUM',
        reason: '组件名 Toaster 是 React 社区对 Toast 容器的标准命名（参考 react-hot-toast）。文件名 Toast 容易与 Hook 中的 Toast 类型混淆。',
        steps: [
          '将文件 src/components/atoms/Toast.tsx 重命名为 Toaster.tsx',
          '全局搜索并更新所有 import 路径（约 8 处）',
          '更新文件内 @fileoverview 中的 @module 路径',
          '运行 npm run audit:naming 验证修复',
          '运行 npm run tsc:prod 确认类型正确',
        ],
      },
      {
        title: 'ErrorState（Molecule 层）',
        currentFile: 'src/components/molecules/states/Error.tsx',
        export: 'ErrorState',
        action: '重命名文件为 ErrorState.tsx',
        consumers: '12',
        risk: 'HIGH',
        reason: '组件名 ErrorState 清晰表达了"错误交互状态"的语义。文件名 Error 过于泛化，且与 React ErrorBoundary 的 Error 概念混淆。该文件有 12 个消费方，需谨慎重命名。',
        steps: [
          '将文件 src/components/molecules/states/Error.tsx 重命名为 ErrorState.tsx',
          '全局搜索并更新所有 import 路径（约 12 处）',
          '更新文件内 @fileoverview 中的 @module 路径',
          '运行 npm run audit:naming 验证修复',
          '运行 npm run tsc:prod 确认类型正确',
        ],
      },
    ]

    for (const d of details) {
      if (y > 195) {
        doc.addPage()
        y = marginTop
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(51, 51, 51)
      doc.text(d.title, marginLeft, y)
      y += 7

      const riskColor = d.risk === 'HIGH' ? [234, 67, 53] : [251, 188, 4]
      const detailRows = [
        ['当前文件', d.currentFile],
        ['当前导出', d.export],
        ['建议操作', d.action],
        ['消费方数', d.consumers],
        ['风险等级', d.risk],
      ]

      autoTable(doc, {
        startY: y,
        body: detailRows,
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold', fillColor: [245, 245, 245] },
          1: { cellWidth: contentWidth - 30 },
        },
      })

      y = doc.lastAutoTable.finalY + 4

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('理由:', marginLeft, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      const reasonLines = doc.splitTextToSize(d.reason, contentWidth - 5)
      doc.text(reasonLines, marginLeft + 5, y)
      y += reasonLines.length * 4 + 5

      doc.setFont('helvetica', 'bold')
      doc.text('修复步骤:', marginLeft, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      for (let i = 0; i < d.steps.length; i++) {
        if (y > 270) {
          doc.addPage()
          y = marginTop
        }
        doc.text(`${i + 1}. ${d.steps[i]}`, marginLeft + 5, y)
        y += 5
      }
      y += 6
      doc.setTextColor(0, 0, 0)
    }

    // ── 检查器优化（P0） ──
    if (y > 200) {
      doc.addPage()
      y = marginTop
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('P0 · 检查器优化', marginLeft, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('已完成，共消除 29 个误报', marginLeft, y)
    y += 8

    const optimizations = [
      ['export default 检测', '消除 22 个误报', '22 个使用 export default 的组件文件被误报为 no-export'],
      ['export class 检测', '消除 3 个误报', 'ErrorBoundary / WidgetErrorBoundary 使用 export class 继承 React.Component'],
      ['HOC 包装名过滤', '消除 3 个误报', 'export default memo(Component) 模式下，memo/forwardRef 被误识别为组件名'],
      ['复合组件豁免', '消除 9 个误报', 'Breadcrumb/Card/Table 等复合组件文件导出多个子组件'],
      ['最长命名策略', '消除 3 个误报', '多导出文件取最长名以匹配主组件'],
    ]

    autoTable(doc, {
      startY: y,
      head: [['优化项', '效果', '说明']],
      body: optimizations,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [52, 168, 83], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 30 },
        2: { cellWidth: contentWidth - 75 },
      },
    })

    y = doc.lastAutoTable.finalY + 10

    // ── P2 豁免白名单 ──
    if (y > 220) {
      doc.addPage()
      y = marginTop
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('P2 · 豁免白名单（4 个文件）', marginLeft, y)
    y += 8

    const exemptData = [
      ['statusColors.ts', 'SUGGESTION_STATUS_BADGE 等', '常量映射文件，非组件文件'],
      ['agentComponentRegistry.ts', 'getAgentDetailComponent 等', '注册表文件，导出查询函数'],
      ['reviewArtifact.ts', 'downloadReviewArtifactHtml 等', 'HTML 构建工具文件'],
      ['migrationUtils.ts', 'buildV9Overview 等', '迁移工具函数文件'],
    ]

    autoTable(doc, {
      startY: y,
      head: [['文件', '导出', '豁免理由']],
      body: exemptData,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [251, 188, 4], textColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 55 },
        2: { cellWidth: contentWidth - 110 },
      },
    })

    y = doc.lastAutoTable.finalY + 12

    // ── 修复操作清单 ──
    if (y > 220) {
      doc.addPage()
      y = marginTop
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('修复操作清单', marginLeft, y)
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('第一轮：检查器优化（已完成 ✅）', marginLeft, y)
    y += 6

    const round1 = [
      ['☑', '增加 export default 检测 → 消除 22 个 no-export 误报'],
      ['☑', '增加 export class 检测 → 消除 3 个 no-export 误报'],
      ['☑', '过滤 memo/forwardRef HOC 包装名 → 消除 3 个 name-mismatch 误报'],
      ['☑', '复合组件文件豁免 → 消除 9 个 name-mismatch 误报'],
      ['☑', '最长命名策略 → 消除 3 个 name-mismatch 误报'],
      ['☑', '豁免白名单 → 豁免 4 个文件'],
    ]

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    autoTable(doc, {
      startY: y,
      body: round1,
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: contentWidth - 8 },
      },
    })

    y = doc.lastAutoTable.finalY + 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('第二轮：组件文件重命名', marginLeft, y)
    y += 6

    const round2 = [
      ['☐', 'StockPriceChange.tsx → StockPriceChangeBadge.tsx（4 消费方，MEDIUM 风险）'],
      ['☐', 'Toast.tsx → Toaster.tsx（8 消费方，MEDIUM 风险）'],
      ['☐', 'Error.tsx → ErrorState.tsx（12 消费方，HIGH 风险）'],
    ]

    doc.setFont('helvetica', 'normal')
    autoTable(doc, {
      startY: y,
      body: round2,
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: contentWidth - 8 },
      },
    })

    y = doc.lastAutoTable.finalY + 12

    // ── 验证命令 ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('验证命令', marginLeft, y)
    y += 6

    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    const commands = [
      '# 运行检查',
      'npm run audit:naming',
      '',
      '# 生成 JSON 报告',
      'npm run audit:naming:json',
      '',
      '# 生成豁免对比报告',
      'npm run audit:exemption-report',
    ]

    for (const cmd of commands) {
      doc.text(cmd, marginLeft + 5, y)
      y += 5
    }

    y += 15

    // ── 页脚 ──
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('V9 FinSight · 组件命名规范审计 · 优先级修复报告', marginLeft, y)
    y += 4
    doc.text(`Generated by generate-naming-pdf.ts · ${new Date().toLocaleDateString('zh-CN')}`, marginLeft, y)

    // 保存 PDF
    const pdfBuffer = doc.output('arraybuffer')
    writeFileSync(pdfPath, Buffer.from(pdfBuffer))

    console.log(`✅ PDF 报告已生成: ${pdfPath}`)
    console.log(`   文件大小: ${(pdfBuffer.byteLength / 1024).toFixed(1)} KB`)
  } catch (e) {
    console.error('❌ PDF 生成失败:', e)
    process.exit(1)
  }
}

generatePdf()