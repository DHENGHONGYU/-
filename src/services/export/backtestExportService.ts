/**
 * @module backtestExportService
 * @description DA-006 回测报告导出服务。
 * 数据仅读取 backtestStore（BacktestResult + BacktestConfig），禁止重复计算回测结果。
 * PDF / Excel 第三方库采用动态导入（import()），仅在导出触发时加载，减少主包体积。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import type {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  BacktestDailyValue,
  BacktestExcelSheets,
  BacktestExportConfig,
  BacktestExportResult,
  BacktestPosition,
  BacktestReportMeta,
} from '@/types/modules/backtest.types'
import {
  BACKTEST_STRATEGY_LABELS,
  BACKTEST_EXCEL_SHEETS,
  BACKTEST_EXPORT_FILENAME,
  PDF_TITLE_FONT_SIZE,
  PDF_SUMMARY_FONT_SIZE,
  PDF_SECTION_FONT_SIZE,
  PDF_TABLE_FONT_SIZE,
  PDF_MARGIN_LEFT,
  PDF_TITLE_START_Y,
  PDF_SUMMARY_START_Y,
  PDF_SUMMARY_LINE_HEIGHT,
  PDF_TABLE_HEADER_COLOR,
  PDF_SECTION_SPACING,
  PDF_MAX_TRADE_ROWS,
} from '@/constants/backtest.constants'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 百分比转换基数 */
const PERCENT_BASE = 100

/** 百分比显示小数位 */
const PERCENT_DECIMAL_PLACES = 2

/** Excel MIME 类型 */
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// ============================================================
// 元数据构建
// ============================================================

/** 构建报告元数据 */
export function buildReportMeta(config: BacktestConfig): BacktestReportMeta {
  return {
    strategy: BACKTEST_STRATEGY_LABELS[config.strategy],
    startDate: config.startDate,
    endDate: config.endDate,
    initialCapital: config.initialCapital,
    generatedAt: new Date().toISOString(),
  }
}

// ============================================================
// 格式化辅助
// ============================================================

/** 格式化百分比（入参为 0-1 小数，输出带 % 的字符串） */
function formatPercent(value: number): string {
  return `${(value * PERCENT_BASE).toFixed(PERCENT_DECIMAL_PLACES)}%`
}

// ============================================================
// Excel 多 Sheet 数据构建
// ============================================================

/** 构建 Excel 多 Sheet 数据 */
export function buildExcelSheets(
  result: BacktestResult,
  meta: BacktestReportMeta,
): BacktestExcelSheets {
  const positions: BacktestPosition[] = result.positions ?? []
  const dailyValues: BacktestDailyValue[] = result.dailyValues ?? []

  const summary: Array<Record<string, string | number>> = [
    { 项目: '策略', 值: meta.strategy },
    { 项目: '回测区间', 值: `${meta.startDate} ~ ${meta.endDate}` },
    { 项目: '初始资金', 值: meta.initialCapital },
    { 项目: '总收益', 值: formatPercent(result.totalReturn / PERCENT_BASE) },
    { 项目: '年化收益', 值: formatPercent(result.annualizedReturn / PERCENT_BASE) },
    { 项目: '最大回撤', 值: formatPercent(result.maxDrawdown / PERCENT_BASE) },
    { 项目: '夏普比率', 值: result.sharpeRatio },
    { 项目: '胜率', 值: formatPercent(result.winRate / PERCENT_BASE) },
    { 项目: '交易次数', 值: result.tradeCount },
    { 项目: '盈利笔数', 值: result.profitTrades },
    { 项目: '亏损笔数', 值: result.lossTrades },
    { 项目: '平均盈利', 值: formatPercent(result.avgProfit / PERCENT_BASE) },
    { 项目: '平均亏损', 值: formatPercent(result.avgLoss / PERCENT_BASE) },
    { 项目: '生成时间', 值: meta.generatedAt },
  ]

  const positionsSheet: Array<Record<string, string | number>> = positions.map(
    (p: BacktestPosition) => ({
      标的: p.symbol,
      持仓数量: p.quantity,
      平均成本: p.avgCost,
      当前价格: p.currentPrice,
      市值: p.marketValue,
      浮动盈亏: p.unrealizedPnL,
    }),
  )

  const tradesSheet: Array<Record<string, string | number>> = result.trades.map(
    (t: BacktestTrade) => ({
      日期: t.date,
      标的: t.symbol,
      方向: t.direction === 'buy' ? '买入' : '卖出',
      价格: t.price,
      数量: t.quantity,
      盈亏: t.pnl,
      盈亏比例: formatPercent(t.pnlPct / PERCENT_BASE),
      原因: t.reason,
    }),
  )

  const dailyValuesSheet: Array<Record<string, string | number>> = dailyValues.map(
    (d: BacktestDailyValue, index: number) => ({
      日期: d.date,
      总资产: d.totalValue,
      现金: d.cash,
      净值: result.pnlCurve[index] ?? 1,
    }),
  )

  return {
    summary,
    positions: positionsSheet,
    trades: tradesSheet,
    dailyValues: dailyValuesSheet,
  }
}

// ============================================================
// 文件名构建
// ============================================================

/** 生成带日期的文件名 */
function buildFilename(format: 'pdf' | 'excel', meta: BacktestReportMeta): string {
  const dateStr = meta.generatedAt.slice(0, 10).replace(/-/g, '')
  const ext = format === 'pdf' ? '.pdf' : '.xlsx'
  return `${BACKTEST_EXPORT_FILENAME}_${dateStr}${ext}`
}

// ============================================================
// Excel 导出
// ============================================================

/** 导出 Excel 文件 */
async function exportExcel(
  sheets: BacktestExcelSheets,
  meta: BacktestReportMeta,
): Promise<BacktestExportResult> {
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(sheets.summary),
      BACKTEST_EXCEL_SHEETS.summary,
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(sheets.positions),
      BACKTEST_EXCEL_SHEETS.positions,
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(sheets.trades),
      BACKTEST_EXCEL_SHEETS.trades,
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(sheets.dailyValues),
      BACKTEST_EXCEL_SHEETS.dailyValues,
    )

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE })
    const filename = buildFilename('excel', meta)

    logger.info('[backtestExportService] Excel 导出成功', { filename })
    return { success: true, filename, blob }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('[backtestExportService] Excel 导出失败', { error: msg })
    return { success: false, filename: '', error: msg }
  }
}

// ============================================================
// PDF 导出
// ============================================================

/** 导出 PDF 文件 */
async function exportPdf(
  sheets: BacktestExcelSheets,
  meta: BacktestReportMeta,
): Promise<BacktestExportResult> {
  try {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF()

    // 标题
    doc.setFontSize(PDF_TITLE_FONT_SIZE)
    doc.text(BACKTEST_EXPORT_FILENAME, PDF_MARGIN_LEFT, PDF_TITLE_START_Y)

    // 摘要文本
    doc.setFontSize(PDF_SUMMARY_FONT_SIZE)
    let y = PDF_SUMMARY_START_Y
    for (const row of sheets.summary) {
      doc.text(`${row['项目']}: ${row['值']}`, PDF_MARGIN_LEFT, y)
      y += PDF_SUMMARY_LINE_HEIGHT
    }

    // 持仓表
    y += PDF_SECTION_SPACING
    doc.setFontSize(PDF_SECTION_FONT_SIZE)
    doc.text(BACKTEST_EXCEL_SHEETS.positions, PDF_MARGIN_LEFT, y)
    autoTable(doc, {
      startY: y + PDF_SECTION_SPACING,
      head: [['标的', '持仓数量', '平均成本', '当前价格', '市值', '浮动盈亏']],
      body: sheets.positions.map((p) => [
        String(p['标的'] ?? ''),
        Number(p['持仓数量'] ?? 0),
        Number(p['平均成本'] ?? 0),
        Number(p['当前价格'] ?? 0),
        Number(p['市值'] ?? 0),
        Number(p['浮动盈亏'] ?? 0),
      ]),
      styles: { fontSize: PDF_TABLE_FONT_SIZE },
      headStyles: { fillColor: [...PDF_TABLE_HEADER_COLOR] },
    })

    // 交易明细表（限制行数避免 PDF 溢出）
    y += PDF_SECTION_SPACING + 60
    doc.setFontSize(PDF_SECTION_FONT_SIZE)
    doc.text(BACKTEST_EXCEL_SHEETS.trades, PDF_MARGIN_LEFT, y)
    const tradesRows = sheets.trades.slice(0, PDF_MAX_TRADE_ROWS)
    autoTable(doc, {
      startY: y + PDF_SECTION_SPACING,
      head: [['日期', '标的', '方向', '价格', '数量', '盈亏', '盈亏比例', '原因']],
      body: tradesRows.map((t) => [
        String(t['日期'] ?? ''),
        String(t['标的'] ?? ''),
        String(t['方向'] ?? ''),
        Number(t['价格'] ?? 0),
        Number(t['数量'] ?? 0),
        Number(t['盈亏'] ?? 0),
        String(t['盈亏比例'] ?? ''),
        String(t['原因'] ?? ''),
      ]),
      styles: { fontSize: PDF_TABLE_FONT_SIZE },
      headStyles: { fillColor: [...PDF_TABLE_HEADER_COLOR] },
    })

    // 净值序列表
    y += PDF_SECTION_SPACING + 100
    doc.setFontSize(PDF_SECTION_FONT_SIZE)
    doc.text(BACKTEST_EXCEL_SHEETS.dailyValues, PDF_MARGIN_LEFT, y)
    autoTable(doc, {
      startY: y + PDF_SECTION_SPACING,
      head: [['日期', '总资产', '现金', '净值']],
      body: sheets.dailyValues.map((d) => [
        String(d['日期'] ?? ''),
        Number(d['总资产'] ?? 0),
        Number(d['现金'] ?? 0),
        Number(d['净值'] ?? 0),
      ]),
      styles: { fontSize: PDF_TABLE_FONT_SIZE },
      headStyles: { fillColor: [...PDF_TABLE_HEADER_COLOR] },
    })

    const blob = doc.output('blob')
    const filename = buildFilename('pdf', meta)

    logger.info('[backtestExportService] PDF 导出成功', { filename })
    return { success: true, filename, blob }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('[backtestExportService] PDF 导出失败', { error: msg })
    return { success: false, filename: '', error: msg }
  }
}

// ============================================================
// 统一导出入口
// ============================================================

/** 导出回测报告（支持 PDF / Excel） */
export async function exportBacktestReport(
  result: BacktestResult,
  config: BacktestConfig,
  options: BacktestExportConfig,
): Promise<BacktestExportResult> {
  try {
    const meta = buildReportMeta(config)
    const sheets = buildExcelSheets(result, meta)

    if (options.format === 'excel') {
      return await exportExcel(sheets, meta)
    }
    return await exportPdf(sheets, meta)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('[backtestExportService] 导出失败', { error: msg })
    return { success: false, filename: '', error: msg }
  }
}
