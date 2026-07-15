/**
 * 行情数据契约校验（补充校验层）
 *
 * 背景：
 * 当行情 / LLM / AKShare 全链路不可达时，系统降级到 Mock 数据。
 * 由于 Mock 数据由生成器直接产出干净结构，**绕过了真实数据源的解析器与归一化逻辑**，
 * 现有测试又只覆盖热点板块适配器，导致「真实市场数据准确性」既不被校验、也无法区分。
 *
 * 本模块提供一套**与数据来源无关的契约校验**：
 * - 对 Mock 数据与真实解析后的数据执行同一组不变量（OHLC 一致性、价格量为正、日期单调、财务字段有限等）
 * - 既可用于单元测试（强制 Mock 走同一契约），也可在写入前 warn-only 调用，作为真实数据接入后的第一道防线
 *
 * 设计原则：
 * - 仅依赖本目录类型（StockQuote / KlineItem）与 fetcherTypes（CollectFinancialData），不引入运行时依赖
 * - 纯函数、无副作用、不抛异常；调用方自行决定 warn / 抛错 / 落库
 */

import type { StockQuote, KlineItem } from './directDataAPI'
import type { CollectFinancialData } from './fetcherTypes'

/** 单条契约问题 */
export interface ContractIssue {
  /** 问题字段 / 维度 */
  field: string
  /** 触发规则 */
  rule: string
  /** 中文可读说明 */
  message: string
}

/** 契约校验结果 */
export interface ContractResult {
  ok: boolean
  issues: ContractIssue[]
}

const SOURCES = ['tencent', 'sina', 'netease', 'akshare', 'mock', 'manual', 'unknown'] as const

/** 浮点比较容差（价格类字段） */
const PRICE_EPSILON = 1e-6

/** 允许的历史最早年份 */
const MIN_YEAR = 1990

/** 允许的历史最早时间戳（MIN_YEAR-01-01） */
const MIN_TIMESTAMP = Date.UTC(MIN_YEAR, 0, 1)

/** 未来偏移容差（允许 5 分钟时钟误差） */
const FUTURE_DRIFT_MS = 5 * 60 * 1000

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function push(issues: ContractIssue[], field: string, rule: string, message: string): void {
  issues.push({ field, rule, message })
}

// ============================================================
// StockQuote 校验
// ============================================================

/**
 * 校验单条实时行情。
 * 覆盖：基础字段、价格/量非负、OHLC 内部一致性、涨跌幅合理区间、时间戳可信、来源合法。
 */
export function validateStockQuote(q: StockQuote | null | undefined): ContractResult {
  const issues: ContractIssue[] = []
  if (!q || typeof q !== 'object') {
    return { ok: false, issues: [{ field: 'quote', rule: 'shape', message: '行情对象为空或非法' }] }
  }

  if (!q.code || typeof q.code !== 'string') {
    push(issues, 'code', 'required', '股票代码缺失')
  }
  if (!q.name || typeof q.name !== 'string' || q.name.trim().length === 0) {
    push(issues, 'name', 'required', '股票名称为空')
  }

  if (!isFiniteNumber(q.price) || q.price <= 0) {
    push(issues, 'price', 'positive', `价格必须为正数，实际：${JSON.stringify(q.price)}`)
  }
  for (const f of ['open', 'high', 'low', 'prevClose'] as const) {
    const v = (q as Record<typeof f, unknown>)[f]
    if (!isFiniteNumber(v) || (v) < 0) {
      push(issues, f, 'nonnegative', `${f} 必须为非负有限数，实际：${JSON.stringify(v)}`)
    }
  }

  // OHLC 一致性（核心不变量，Mock 与真实都必须满足）
  if (isFiniteNumber(q.high) && isFiniteNumber(q.low) && q.high + PRICE_EPSILON < q.low) {
    push(issues, 'ohlc', 'high>=low', `最高价低于最低价（high=${q.high} < low=${q.low}）`)
  }
  if (isFiniteNumber(q.high) && isFiniteNumber(q.open) && q.high + PRICE_EPSILON < q.open) {
    push(issues, 'ohlc', 'high>=open', `最高价低于开盘价（high=${q.high} < open=${q.open}）`)
  }
  if (isFiniteNumber(q.high) && isFiniteNumber(q.price) && q.high + PRICE_EPSILON < q.price) {
    push(issues, 'ohlc', 'high>=price', `最高价低于当前价（high=${q.high} < price=${q.price}）`)
  }
  if (isFiniteNumber(q.low) && isFiniteNumber(q.open) && q.low - PRICE_EPSILON > q.open) {
    push(issues, 'ohlc', 'low<=open', `最低价高于开盘价（low=${q.low} > open=${q.open}）`)
  }
  if (isFiniteNumber(q.low) && isFiniteNumber(q.price) && q.low - PRICE_EPSILON > q.price) {
    push(issues, 'ohlc', 'low<=price', `最低价高于当前价（low=${q.low} > price=${q.price}）`)
  }

  if (!isFiniteNumber(q.volume) || q.volume < 0) {
    push(issues, 'volume', 'nonnegative', `成交量必须为非负有限数，实际：${JSON.stringify(q.volume)}`)
  }
  if (!isFiniteNumber(q.amount) || q.amount < 0) {
    push(issues, 'amount', 'nonnegative', `成交额必须为非负有限数，实际：${JSON.stringify(q.amount)}`)
  }

  if (isFiniteNumber(q.changePercent) && (q.changePercent < -100 || q.changePercent > 100)) {
    push(issues, 'changePercent', 'range', `涨跌幅超出合理区间 [-100,100]，实际：${q.changePercent}`)
  }

  if (!isFiniteNumber(q.timestamp)) {
    push(issues, 'timestamp', 'finite', '时间戳非法')
  } else {
    const now = Date.now()
    if (q.timestamp < MIN_TIMESTAMP) {
      push(issues, 'timestamp', 'too-old', `时间戳早于 1990 年`)
    }
    if (q.timestamp > now + FUTURE_DRIFT_MS) {
      push(issues, 'timestamp', 'future', '时间戳来自未来（超过当前时间 5 分钟）')
    }
  }

  if (!q.source || !((SOURCES as readonly string[]).includes(q.source))) {
    push(issues, 'source', 'enum', `来源标识非法：${JSON.stringify(q.source)}`)
  }

  return { ok: issues.length === 0, issues }
}

// ============================================================
// KlineItem 校验
// ============================================================

const DATE_PATTERNS = [/^\d{4}-\d{2}-\d{2}$/, /^\d{8}$/]

function isValidKlineDate(d: unknown): boolean {
  if (typeof d !== 'string' || d.length === 0) return false
  return DATE_PATTERNS.some((p) => p.test(d))
}

function compareKlineDate(a: string, b: string): number {
  const na = a.replace(/-/g, '')
  const nb = b.replace(/-/g, '')
  return na < nb ? -1 : na > nb ? 1 : 0
}

/**
 * 校验单根 K 线。
 */
export function validateKlineItem(k: KlineItem | null | undefined): ContractResult {
  const issues: ContractIssue[] = []
  if (!k || typeof k !== 'object') {
    return { ok: false, issues: [{ field: 'kline', rule: 'shape', message: 'K 线对象为空或非法' }] }
  }

  if (!isValidKlineDate(k.date)) {
    push(issues, 'date', 'format', `K 线日期格式非法，期望 YYYY-MM-DD 或 YYYYMMDD，实际：${JSON.stringify(k.date)}`)
  }

  if (![k.open, k.high, k.low, k.close].every((v) => isFiniteNumber(v))) {
    push(issues, 'ohlc', 'finite', `OHLC 含非有限数：open=${k.open} high=${k.high} low=${k.low} close=${k.close}`)
  } else {
    // 上方 if 已保证 OHLC 全为有限数；noUncheckedIndexedAccess 下 TS 无法据此收窄，
    // 此处用非空断言取回已校验值（语义等价于「已知有限」）。
    const o = k.open
    const h = k.high
    const l = k.low
    const c = k.close
    if (h + PRICE_EPSILON < l) push(issues, 'ohlc', 'high>=low', `最高价低于最低价（high=${h} < low=${l}）`)
    if (h + PRICE_EPSILON < o) push(issues, 'ohlc', 'high>=open', `最高价低于开盘价（high=${h} < open=${o}）`)
    if (h + PRICE_EPSILON < c) push(issues, 'ohlc', 'high>=close', `最高价低于收盘价（high=${h} < close=${c}）`)
    if (l - PRICE_EPSILON > o) push(issues, 'ohlc', 'low<=open', `最低价高于开盘价（low=${l} > open=${o}）`)
    if (l - PRICE_EPSILON > c) push(issues, 'ohlc', 'low<=close', `最低价高于收盘价（low=${l} > close=${c}）`)
  }

  if (!isFiniteNumber(k.volume) || k.volume < 0) {
    push(issues, 'volume', 'nonnegative', `成交量必须为非负有限数，实际：${JSON.stringify(k.volume)}`)
  }
  if (!isFiniteNumber(k.amount) || k.amount < 0) {
    push(issues, 'amount', 'nonnegative', `成交额必须为非负有限数，实际：${JSON.stringify(k.amount)}`)
  }

  return { ok: issues.length === 0, issues }
}

/**
 * 校验 K 线序列：逐项校验 + 日期单调递增（真实行情与 Mock 都必须满足）。
 */
export function validateKline(items: KlineItem[] | null | undefined): ContractResult {
  const issues: ContractIssue[] = []
  if (!Array.isArray(items)) {
    return { ok: false, issues: [{ field: 'kline[]', rule: 'shape', message: 'K 线序列为空或非数组' }] }
  }
  if (items.length === 0) {
    return { ok: false, issues: [{ field: 'kline[]', rule: 'empty', message: 'K 线序列为空' }] }
  }

  let prevDate = ''
  items.forEach((item, idx) => {
    const r = validateKlineItem(item)
    if (!r.ok) {
      for (const i of r.issues) push(issues, `kline[${idx}].${i.field}`, i.rule, i.message)
    }
    if (prevDate && isValidKlineDate(item.date) && compareKlineDate(item.date, prevDate) < 0) {
      push(issues, `kline[${idx}].date`, 'monotonic', `K 线日期非单调递增（${item.date} < 前序 ${prevDate}）`)
    }
    if (item.date) prevDate = item.date
  })

  return { ok: issues.length === 0, issues }
}

// ============================================================
// 财务数据校验
// ============================================================

const REPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 校验财务数据（CollectFinancialData）。
 * 财务字段多数可选（银行等行业无毛利率/应收），故仅对「已定义」字段做有限性与合理区间校验。
 */
export function validateFinancial(f: CollectFinancialData | null | undefined): ContractResult {
  const issues: ContractIssue[] = []
  if (!f || typeof f !== 'object') {
    return { ok: false, issues: [{ field: 'financial', rule: 'shape', message: '财务数据为空或非法' }] }
  }

  if (!f.report_date || !REPORT_DATE_RE.test(f.report_date)) {
    push(issues, 'report_date', 'format', `报告期格式非法，期望 YYYY-MM-DD，实际：${JSON.stringify(f.report_date)}`)
  }

  const finiteOrUndef = (v: unknown): v is number | undefined =>
    v === undefined || (typeof v === 'number' && Number.isFinite(v))
  // 百分比类字段（毛利率/净利率/同比/研发率/质押率）合理区间 [-200,200]
  const percentFields = [
    'gross_margin',
    'net_margin',
    'revenue_yoy',
    'net_profit_yoy',
    'rd_ratio',
    'shareholder_pledge',
  ] as const

  for (const fld of percentFields) {
    const v = (f as Record<string, unknown>)[fld]
    if (!finiteOrUndef(v)) {
      push(issues, fld, 'finite', `${fld} 必须为有限数或 undefined，实际：${JSON.stringify(v)}`)
    } else if (typeof v === 'number' && (v < -200 || v > 200)) {
      push(issues, fld, 'range', `${fld} 超出合理区间 [-200,200]，实际：${JSON.stringify(v)}`)
    }
  }

/** 存货周转天数合理上限（约 10 年） */
const MAX_INVENTORY_TURNOVER_DAYS = 3650

  // 存货周转天数（单位：天，可远大于 200），合理区间 [0, MAX_INVENTORY_TURNOVER_DAYS]
  if (!finiteOrUndef(f.inventory_turnover_days)) {
    push(issues, 'inventory_turnover_days', 'finite', `存货周转天数必须为有限数或 undefined，实际：${JSON.stringify(f.inventory_turnover_days)}`)
  } else if (typeof f.inventory_turnover_days === 'number' && (f.inventory_turnover_days < 0 || f.inventory_turnover_days > MAX_INVENTORY_TURNOVER_DAYS)) {
    push(issues, 'inventory_turnover_days', 'range', `存货周转天数超出合理区间 [0,${MAX_INVENTORY_TURNOVER_DAYS}]，实际：${f.inventory_turnover_days}`)
  }

  if (f.revenue !== undefined && (!isFiniteNumber(f.revenue) || f.revenue <= 0)) {
    push(issues, 'revenue', 'positive', `营收应为正数，实际：${JSON.stringify(f.revenue)}`)
  }
  if (f.net_profit !== undefined && !isFiniteNumber(f.net_profit)) {
    push(issues, 'net_profit', 'finite', `净利润必须为有限数，实际：${JSON.stringify(f.net_profit)}`)
  }

  return { ok: issues.length === 0, issues }
}

// ============================================================
// 聚合入口
// ============================================================

/**
 * 统一契约校验入口（写入前 warn-only 调用）。
 * 根据数据类型分发，返回 { ok, issues }，由调用方决定如何处理。
 */
export function checkMarketDataContract(payload: {
  kind: 'quote' | 'kline' | 'financial'
  data: StockQuote | KlineItem | KlineItem[] | CollectFinancialData | null | undefined
}): ContractResult {
  switch (payload.kind) {
    case 'quote':
      return validateStockQuote(payload.data as StockQuote)
    case 'kline':
      return validateKline(payload.data as KlineItem[])
    case 'financial':
      return validateFinancial(payload.data as CollectFinancialData)
    default:
      return { ok: false, issues: [{ field: 'kind', rule: 'unknown', message: '未知校验类型' }] }
  }
}
