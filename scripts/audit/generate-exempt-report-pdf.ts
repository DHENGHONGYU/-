/**
 * 生成豁免文件分析报告 PDF
 * 用于代码审查附件
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { readFileSync } from 'fs'
import { join } from 'path'

const doc = new jsPDF({ unit: 'pt', format: 'a4' })
const pageWidth = doc.internal.pageSize.getWidth()
const pageHeight = doc.internal.pageSize.getHeight()
const margin = 40
const contentWidth = pageWidth - margin * 2

let y = margin

function addTitle(text: string, level: 1 | 2 | 3 = 1): void {
  const sizes = { 1: 20, 2: 15, 3: 13 }
  const color = level === 1 ? [30, 64, 175] : level === 2 ? [59, 130, 246] : [75, 85, 99]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(sizes[level])
  doc.setTextColor(color[0], color[1], color[2])
  doc.text(text, margin, y)
  y += level === 1 ? 30 : level === 2 ? 25 : 20
  doc.setTextColor(0, 0, 0)
}

function addBody(text: string, indent = 0): void {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const lines = doc.splitTextToSize(text, contentWidth - indent)
  lines.forEach((line: string) => {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin + indent, y)
    y += 14
  })
}

function addCode(text: string): void {
  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  const lines = text.split('\n')
  lines.forEach((line: string) => {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin + 10, y)
    y += 10
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  y += 8
}

function addDivider(): void {
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 15
}

// ─── 封面 ───
y = margin + 60
doc.setFont('helvetica', 'bold')
doc.setFontSize(28)
doc.setTextColor(30, 64, 175)
doc.text('5 个命名规范豁免文件', pageWidth / 2, y, { align: 'center' })
y += 35
doc.setFontSize(24)
doc.text('详细变更对比报告', pageWidth / 2, y, { align: 'center' })
y += 50

doc.setFont('helvetica', 'normal')
doc.setFontSize(12)
doc.setTextColor(107, 114, 128)
doc.text('代码审查附件 · 2026-08-15', pageWidth / 2, y, { align: 'center' })
y += 20
doc.text('FinSightV9 组件治理', pageWidth / 2, y, { align: 'center' })

// ─── 豁免统计 ───
doc.addPage()
y = margin
addTitle('执行摘要', 1)

addBody('本报告详细说明 5 个被命名规范检查器智能豁免的文件的背景、变更对比和合规理由。这些文件均包含 export function + export const 混合导出模式，但因其特殊性质被识别为合法模式。')

addTitle('豁免统计', 2)

autoTable(doc, {
  startY: y,
  head: [['#', '文件', '豁免类型', '函数', '常量', '风险']],
  body: [
    ['1', 'candlestickChart.config.ts', '配置文件', '1', '11', '🟢 低'],
    ['2', 'kdj.ts', '指标计算', '2', '1', '🟢 低'],
    ['3', 'macd.ts', '指标计算', '2', '1', '🟢 低'],
    ['4', 'DensityContext.tsx', 'Context Provider', '4', '1', '🟢 低'],
    ['5', 'componentRegistry.ts', '注册表', '9', '1', '🟡 中'],
  ],
  theme: 'grid',
  headStyles: { fillColor: [30, 64, 175], textColor: 255 },
  styles: { fontSize: 9 },
})
y = (doc as any).lastAutoTable.finalY + 20

// ─── 文件详细分析 ───
const exemptFiles = [
  {
    name: 'candlestickChart.config.ts',
    path: 'src/components/chart/candlestickChart.config.ts',
    rule: '配置文件模式 — /.config.(ts|tsx)$/',
    nature: 'CandlestickChart 图表组件的配置常量文件，包含周期选项、复权选项、均线配置、样式常量。',
    exports: [
      ['export function', 'getToolbarButtonStyle', '动态计算工具栏按钮样式'],
      ['export const', 'PERIOD_OPTIONS', '周期选项配置（8 个周期）'],
      ['export const', 'ADJUST_OPTIONS', '复权选项配置（3 种模式）'],
      ['export const', 'MA_OPTIONS', '均线配置（周期/颜色）'],
      ['export const', 'toolbarContainerStyle', '工具栏容器样式'],
      ['export const', 'buttonGroupStyle', '按钮组样式'],
      ['export const', 'maLegendContainerStyle', 'MA 图例容器样式'],
      ['export const', 'tooltipContainerStyle', '工具提示容器样式'],
    ],
    before: '❌ mixed-export-pattern info 告警',
    after: '✅ 无告警',
    reason: [
      '文件名以 .config.ts 结尾，符合配置文件命名约定',
      '所有 export const 均为静态数据（数组、对象字面量），非 React 组件',
      '消费方按配置文件使用，无需组件命名规范约束',
    ],
  },
  {
    name: 'kdj.ts',
    path: 'src/components/chart/indicators/kdj.ts',
    rule: '指标计算文件模式 — /.indicators?.(ts|tsx)$/',
    nature: 'KDJ 随机指标计算引擎，纯数学计算模块。',
    exports: [
      ['export function', 'computeKDJ', '计算 KDJ 指标（K/D/J 三线）'],
      ['export function', 'getLatestKDJ', '获取最新 KDJ 值'],
      ['export const', 'KDJ_COLORS', 'KDJ 三线颜色配置'],
    ],
    before: '❌ mixed-export-pattern info 告警',
    after: '✅ 无告警',
    reason: [
      '位于 indicators/ 目录，明确为指标计算模块',
      '仅 KDJ_COLORS 为配置常量，非组件',
      '无任何 JSX 或 React 组件导出',
      '符合指标计算文件的标准模式',
    ],
  },
  {
    name: 'macd.ts',
    path: 'src/components/chart/indicators/macd.ts',
    rule: '指标计算文件模式 — /.indicators?.(ts|tsx)$/',
    nature: 'MACD 指数平滑异同移动平均线指标计算引擎。',
    exports: [
      ['export function', 'computeMACD', '计算 MACD 指标（DIF/DEA/柱状）'],
      ['export function', 'getLatestMACD', '获取最新 MACD 值'],
      ['export const', 'MACD_COLORS', 'MACD 线/柱颜色配置'],
    ],
    before: '❌ mixed-export-pattern info 告警',
    after: '✅ 无告警',
    reason: [
      '与 kdj.ts 同属 indicators 模块，保持一致的文件结构',
      'MACD_COLORS 为纯数据配置，非组件',
      '核心函数 computeMACD 内部包含 EMA 计算辅助函数',
    ],
  },
  {
    name: 'DensityContext.tsx',
    path: 'src/components/cockpit/DensityContext.tsx',
    rule: 'Context Provider 模式 — createContext|ContextProvider|useContext',
    nature: '全局密度 Context Provider，管理 UI 密度偏好（紧凑/正常/扩展）。',
    exports: [
      ['export function', 'DensityProvider', '密度上下文 Provider 组件'],
      ['export function', 'useDensity', '获取当前密度等级的 Hook'],
      ['export function', 'useDensityConfig', '获取完整密度配置的 Hook'],
      ['export function', 'useDensityClass', '获取 Tailwind class 的 Hook'],
      ['export const', 'DENSITY_PRESETS', '三级密度预设配置'],
    ],
    before: '❌ mixed-export-pattern info 告警',
    after: '✅ 无告警',
    reason: [
      '包含 createContext 调用，明确为 Context 文件',
      'DENSITY_PRESETS 是 Provider 内部使用的配置常量',
      'Context 文件的标准模式就是 Provider + Hooks + 配置的混合导出',
      '拆分后会增加消费方 import 复杂度',
    ],
  },
  {
    name: 'componentRegistry.ts',
    path: 'src/components/componentRegistry.ts',
    rule: '注册表文件模式 — registry|index.(ts|tsx)$',
    nature: 'V9 组件原子层级注册表统一入口，聚合 4 个层级子注册表。',
    exports: [
      ['export function', 'logRegistrySnapshot', '输出注册表快照日志'],
      ['export function', 'validateRegistry', '运行时校验注册表一致性'],
      ['export function', 'groupByLevel', '按层级分组组件'],
      ['export function', 'getNamesByLevel', '获取指定层级组件名'],
      ['export function', 'findByName', '按名称查找组件'],
      ['export function', 'getComponentStats', '获取组件统计数据'],
      ['export const', 'COMPONENT_REGISTRY', '聚合 4 层的全量注册表'],
    ],
    before: '❌ mixed-export-pattern info 告警',
    after: '✅ 无告警',
    reason: [
      '文件名包含 Registry，符合注册表命名约定',
      'COMPONENT_REGISTRY 是聚合数据，函数是配套查询工具',
      '注册表文件的标准模式就是数据 + 查询函数的混合',
      '消费方需要同时访问注册表数据和查询函数',
    ],
  },
]

for (const file of exemptFiles) {
  if (y > pageHeight - margin - 100) {
    doc.addPage()
    y = margin
  }

  addTitle(file.name, 2)
  addBody(`路径: ${file.path}`)
  addBody(`豁免规则: ${file.rule}`)
  addBody(`文件性质: ${file.nature}`)
  y += 10

  autoTable(doc, {
    startY: y,
    head: [['导出类型', '名称', '用途']],
    body: file.exports,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 8 },
  })
  y = (doc as any).lastAutoTable.finalY + 15

  addTitle('变更对比', 3)
  autoTable(doc, {
    startY: y,
    head: [['维度', '豁免前', '豁免后']],
    body: [
      ['检查结果', file.before, file.after],
      ['建议操作', '重构为单一导出模式', '保持现状'],
      ['实际影响', '无/低风险', '无变化'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [75, 85, 99], textColor: 255 },
    styles: { fontSize: 8 },
  })
  y = (doc as any).lastAutoTable.finalY + 15

  addTitle('合规理由', 3)
  file.reason.forEach((r: string, i: number) => {
    addBody(`${i + 1}. ${r}`, 10)
  })
  y += 10
  addDivider()
}

// ─── 结论 ───
if (y > pageHeight - margin - 150) {
  doc.addPage()
  y = margin
}
addTitle('结论', 1)
addBody('5 个豁免文件均具备充分的合规理由，豁免规则覆盖了以下场景：')
y += 5
const conclusions = [
  '✅ 配置文件 — 纯数据配置，无组件导出',
  '✅ 指标计算 — 纯计算模块，函数 + 可视化配置',
  '✅ Context Provider — React Context 标准模式',
  '✅ 注册表 — 数据 + 查询函数的天然组合',
]
conclusions.forEach((c: string) => {
  addBody(c, 10)
})

y += 20
addTitle('复现命令', 2)
addCode('npm run audit:naming        # 运行命名规范检查')
addCode('npm run audit:naming:json   # 生成 JSON 报告')

// ─── 附录：元数据 ───
doc.addPage()
y = margin
addTitle('附录：报告元数据', 1)
autoTable(doc, {
  startY: y,
  body: [
    ['报告 ID', 'exempt-files-analysis-2026-08-15'],
    ['生成日期', '2026-08-15'],
    ['源脚本', 'scripts/audit/check-naming-conventions.ts'],
    ['扫描文件数', '134'],
    ['豁免文件数', '5'],
    ['审计命令', 'npm run audit:naming'],
  ],
  theme: 'grid',
  styles: { fontSize: 10 },
})

const outputPath = join('outputs', 'exempt-files-analysis-report.pdf')
doc.save(outputPath)
console.log(`✅ PDF 报告已生成: ${outputPath}`)
console.log(`   文件大小: ${(readFileSync(outputPath).length / 1024).toFixed(1)} KB`)