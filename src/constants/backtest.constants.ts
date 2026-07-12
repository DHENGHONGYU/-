/**
 * @module backtest.constants
 * @description 策略回测模块常量（DA-006）。
 * 集中管理策略标签、导出 Sheet 名称、文件命名模板等，
 * 供 Store、页面、导出服务统一引用，禁止在组件中硬编码。
 */

import type { BacktestStrategy } from '@/types/modules/backtest.types'

/** 策略类型到展示标签的映射 */
export const BACKTEST_STRATEGY_LABELS: Record<BacktestStrategy, string> = {
  hot_sector: '热门板块',
  value_pit: '价值洼地',
  composite: '复合策略',
}

/** Excel 导出 Sheet 名称 */
export const BACKTEST_EXCEL_SHEETS = {
  summary: '摘要',
  positions: '持仓',
  trades: '交易记录',
  dailyValues: '净值序列',
} as const

/** 导出文件默认命名模板 */
export const BACKTEST_EXPORT_FILENAME = '回测报告'

/** 导出日期格式（用于文件名） */
export const BACKTEST_EXPORT_DATE_FORMAT = 'YYYY-MM-DD'

// ============================================================
// PDF 报告布局常量（DA-006）
// ============================================================

/** PDF 标题字体大小 */
export const PDF_TITLE_FONT_SIZE = 18

/** PDF 摘要字体大小 */
export const PDF_SUMMARY_FONT_SIZE = 11

/** PDF 分节标题字体大小 */
export const PDF_SECTION_FONT_SIZE = 12

/** PDF 表格字体大小 */
export const PDF_TABLE_FONT_SIZE = 9

/** PDF 左边距 */
export const PDF_MARGIN_LEFT = 14

/** PDF 标题起始 Y 坐标 */
export const PDF_TITLE_START_Y = 20

/** PDF 摘要起始 Y 坐标 */
export const PDF_SUMMARY_START_Y = 35

/** PDF 摘要行高 */
export const PDF_SUMMARY_LINE_HEIGHT = 7

/** PDF 表格表头颜色 - R */
const PDF_TABLE_HEADER_RED = 59

/** PDF 表格表头颜色 - G */
const PDF_TABLE_HEADER_GREEN = 130

/** PDF 表格表头颜色 - B */
const PDF_TABLE_HEADER_BLUE = 246

/** PDF 表格表头颜色（RGB） */
export const PDF_TABLE_HEADER_COLOR: readonly [number, number, number] = [
  PDF_TABLE_HEADER_RED,
  PDF_TABLE_HEADER_GREEN,
  PDF_TABLE_HEADER_BLUE,
]

/** PDF 节间距 */
export const PDF_SECTION_SPACING = 5

/** PDF 交易明细最大行数 */
export const PDF_MAX_TRADE_ROWS = 50
