/**
 * 行情数据契约校验（Market Data Contract Validation）
 *
 * 与数据来源无关的**结构不变量**校验：OHLC 一致性、价格/量为正、
 * 日期单调递增、财务字段有限且 report_date 合法、涨跌幅区间、
 * 时间戳可信、source 合法。
 *
 * 设计目标：Mock 与真实数据走**同一套契约**，使强制 Mock 环境下
 * 仍可发现数据形态缺陷（如 OHLC 不自洽），避免 Mock 掩盖真实源解析器 bug。
 *
 * 纯函数、零服务层依赖（仅使用结构化 duck-type，不引入 services 依赖，
 * 保持 lib 层合规，可被 fetcher / data-collector 等所有 services 引用）。
 *
 * 使用方式：写入路径以 warn-only 调用（仅记日志/统计，不阻断写入）。
 *
 * @module lib/validation/marketDataContract
 */

// ── 结构化入参（duck-type，兼容 fetcher.StockQuote / data-collector.RealtimeQuote 等）──

/** 行情结构（开放字段，兼容多种 Quote 类型） */
export interface QuoteLike {
  price?: number
  open?: number
  high?: number
  low?: number
  /** 收盘价（行情通常无此字段，缺省时以 price 作为收盘等价） */
  close?: number
  volume?: number
  amount?: number
  timestamp?: number
  changePercent?: number
  source?: string
}

/** 单根 K 线结构 */
export interface KlineBarLike {
  date?: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount?: number
}

/** 财务结构（开放索引，兼容多种 Financial 类型） */
export interface FinancialLike {
  report_date?: string
  revenue?: number
  net_profit?: number
  gross_margin?: number
  net_margin?: number
  revenue_yoy?: number
  net_profit_yoy?: number
  rd_ratio?: number
  inventory_turnover_days?: number
  shareholder_pledge?: number
  [key: string]: unknown
}

/** 校验问题 */
export interface ValidationIssue {
  field: string
  rule: string
  severity: 'error' | 'warn'
  message: string
}

/** 校验结果 */
export interface ContractCheckResult {
  ok: boolean
  issues: ValidationIssue[]
}

// ── 常量（零硬编码）──

/** 价格比较容差 */
const PRICE_EPSILON = 1e-6
/** 合法数据源标识 */
const VALID_SOURCES = ['tencent', 'sina', 'netease', 'akshare', 'mock', 'unknown']
/** 涨跌幅合理区间（%） */
const CHANGE_PERCENT_MIN = -20
const CHANGE_PERCENT_MAX = 20
/** 时间戳偏差：未来超过 7 天即异常 */
const MAX_FUTURE_SKEW_MS = 7 * 24 * 60 * 60 * 1000
/** 时间戳过旧阈值：超过 1 年视为异常 */
const MAX_PAST_AGE_MS = 365 * 24 * 60 * 60 * 1000

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v)

function pushIssue(
  issues: ValidationIssue[],
  field: string,
  rule: string,
  message: string,
  severity: ValidationIssue['severity'] = 'error',
): void {
  issues.push({ field, rule, severity, message })
}

/**
 * 校验单条行情。
 * 覆盖：价格为正、量/额非负、OHLC 一致性、涨跌幅区间、时间戳可信、source 合法。
 */
export function validateQuote(q: QuoteLike): ContractCheckResult {
  const issues: ValidationIssue[] = []

  if (!isFiniteNumber(q.price) || q.price <= 0) {
    pushIssue(issues, 'price', 'positive', `价格必须为正数，实际：${JSON.stringify(q.price)}`)
  }
  if (q.volume !== undefined && (!isFiniteNumber(q.volume) || q.volume < 0)) {
    pushIssue(issues, 'volume', 'nonnegative', `成交量必须非负，实际：${JSON.stringify(q.volume)}`)
  }
  if (q.amount !== undefined && (!isFiniteNumber(q.amount) || q.amount < 0)) {
    pushIssue(issues, 'amount', 'nonnegative', `成交额必须非负，实际：${JSON.stringify(q.amount)}`)
  }

  // OHLC 一致性（行情无 close 字段，以 price 作为收盘等价）
  const o = q.open
  const h = q.high
  const l = q.low
  const c = q.close ?? q.price
  if ([o, h, l, c].some((v) => !isFiniteNumber(v))) {
    pushIssue(issues, 'ohlc', 'finite', `OHLC 含非有限数：open=${o} high=${h} low=${l} close=${c}`)
  } else {
    const open = o as number
    const high = h as number
    const low = l as number
    const close = c as number
    if (high + PRICE_EPSILON < low) pushIssue(issues, 'ohlc', 'high>=low', `最高价低于最低价（high=${high} < low=${low}）`)
    if (high + PRICE_EPSILON < open) pushIssue(issues, 'ohlc', 'high>=open', `最高价低于开盘价（high=${high} < open=${open}）`)
    if (high + PRICE_EPSILON < close) pushIssue(issues, 'ohlc', 'high>=close', `最高价低于收盘价（high=${high} < close=${close}）`)
    if (low - PRICE_EPSILON > open) pushIssue(issues, 'ohlc', 'low<=open', `最低价高于开盘价（low=${low} > open=${open}）`)
    if (low - PRICE_EPSILON > close) pushIssue(issues, 'ohlc', 'low<=close', `最低价高于收盘价（low=${low} > close=${close}）`)
  }

  if (q.changePercent !== undefined && isFiniteNumber(q.changePercent)) {
    if (q.changePercent < CHANGE_PERCENT_MIN || q.changePercent > CHANGE_PERCENT_MAX) {
      pushIssue(issues, 'changePercent', 'range', `涨跌幅超出合理区间 [${CHANGE_PERCENT_MIN},${CHANGE_PERCENT_MAX}]%，实际：${q.changePercent}`)
    }
  }

  if (q.timestamp !== undefined && isFiniteNumber(q.timestamp)) {
    const now = Date.now()
    if (q.timestamp > now + MAX_FUTURE_SKEW_MS) {
      pushIssue(issues, 'timestamp', 'future', `行情时间戳在未来（${new Date(q.timestamp).toISOString()}）`)
    }
    if (q.timestamp < now - MAX_PAST_AGE_MS) {
      pushIssue(issues, 'timestamp', 'too_old', `行情时间戳超过 1 年（${new Date(q.timestamp).toISOString()}）`)
    }
  }

  if (q.source !== undefined && !VALID_SOURCES.includes(q.source)) {
    pushIssue(issues, 'source', 'valid', `未知数据源标识：${JSON.stringify(q.source)}`, 'warn')
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues }
}

/**
 * 校验单根 K 线。
 * 覆盖：OHLC 一致性、成交量非负、日期格式。
 */
export function validateKline(k: KlineBarLike): ContractCheckResult {
  const issues: ValidationIssue[] = []
  const finiteAll = [k.open, k.high, k.low, k.close].every(isFiniteNumber)
  if (!finiteAll) {
    pushIssue(issues, 'ohlc', 'finite', `K 线 OHLC 含非有限数：open=${k.open} high=${k.high} low=${k.low} close=${k.close}`)
    return { ok: false, issues }
  }
  if (k.high + PRICE_EPSILON < k.low) pushIssue(issues, 'ohlc', 'high>=low', `最高价低于最低价（high=${k.high} < low=${k.low}）`)
  if (k.high + PRICE_EPSILON < k.open) pushIssue(issues, 'ohlc', 'high>=open', `最高价低于开盘价（high=${k.high} < open=${k.open}）`)
  if (k.high + PRICE_EPSILON < k.close) pushIssue(issues, 'ohlc', 'high>=close', `最高价低于收盘价（high=${k.high} < close=${k.close}）`)
  if (k.low - PRICE_EPSILON > k.open) pushIssue(issues, 'ohlc', 'low<=open', `最低价高于开盘价（low=${k.low} > open=${k.open}）`)
  if (k.low - PRICE_EPSILON > k.close) pushIssue(issues, 'ohlc', 'low<=close', `最低价高于收盘价（low=${k.low} > close=${k.close}）`)
  if (!isFiniteNumber(k.volume) || k.volume < 0) {
    pushIssue(issues, 'volume', 'nonnegative', `成交量必须非负，实际：${JSON.stringify(k.volume)}`)
  }
  if (k.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(k.date)) {
    pushIssue(issues, 'date', 'format', `K 线日期格式非法（期望 YYYY-MM-DD），实际：${k.date}`, 'warn')
  }
  return { ok: issues.every((i) => i.severity !== 'error'), issues }
}

/**
 * 校验财务数据。
 * 覆盖：百分比字段有限且区间合理、存货周转天数（单位：天）单独放宽、
 * 营收为正、净利润有限、report_date 格式与年份合法。
 */
export function validateFinancial(f: FinancialLike): ContractCheckResult {
  const issues: ValidationIssue[] = []
  const finiteOrUndef = (v: unknown): v is number | undefined =>
    v === undefined || (typeof v === 'number' && Number.isFinite(v))

  // 百分比区间字段（[-200,200]）
  const pctFields = [
    'gross_margin',
    'net_margin',
    'revenue_yoy',
    'net_profit_yoy',
    'rd_ratio',
    'shareholder_pledge',
  ] as const
  for (const fld of pctFields) {
    const v = (f as Record<string, unknown>)[fld]
    if (!finiteOrUndef(v)) {
      pushIssue(issues, fld, 'finite', `${fld} 必须为有限数或 undefined，实际：${JSON.stringify(v)}`)
    } else if (typeof v === 'number' && (v < -200 || v > 200)) {
      pushIssue(issues, fld, 'range', `${fld} 超出合理区间 [-200,200]，实际：${JSON.stringify(v)}`)
    }
  }

  // 单位：天，单独放宽到 [0,2000]
  const itd = (f as Record<string, unknown>)['inventory_turnover_days']
  if (!finiteOrUndef(itd)) {
    pushIssue(issues, 'inventory_turnover_days', 'finite', `存货周转天数必须为有限数或 undefined，实际：${JSON.stringify(itd)}`)
  } else if (typeof itd === 'number' && (itd < 0 || itd > 2000)) {
    pushIssue(issues, 'inventory_turnover_days', 'range', `存货周转天数超出合理区间 [0,2000]，实际：${JSON.stringify(itd)}`)
  }

  if (f.revenue !== undefined && (!isFiniteNumber(f.revenue) || f.revenue <= 0)) {
    pushIssue(issues, 'revenue', 'positive', `营收应为正数，实际：${JSON.stringify(f.revenue)}`)
  }
  if (f.net_profit !== undefined && !isFiniteNumber(f.net_profit)) {
    pushIssue(issues, 'net_profit', 'finite', `净利润必须为有限数，实际：${JSON.stringify(f.net_profit)}`)
  }

  if (f.report_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.report_date)) {
      pushIssue(issues, 'report_date', 'format', `报告期格式非法（期望 YYYY-MM-DD），实际：${f.report_date}`)
    } else {
      const yr = Number(f.report_date.slice(0, 4))
      const nowYear = new Date().getFullYear()
      if (yr < 1990 || yr > nowYear + 1) {
        pushIssue(issues, 'report_date', 'range', `报告期年份异常：${f.report_date}`)
      }
    }
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues }
}

/** 组合校验入参 */
export interface MarketDataContractInput {
  quote?: QuoteLike
  klines?: KlineBarLike[]
  financial?: FinancialLike
}

/**
 * 组合校验：行情 + K 线（含日期单调递增）+ 财务。
 * 任一子项失败即整体不通过（ok=false）。
 */
export function checkMarketDataContract(input: MarketDataContractInput): ContractCheckResult {
  const issues: ValidationIssue[] = []
  if (input.quote) issues.push(...validateQuote(input.quote).issues)
  if (input.financial) issues.push(...validateFinancial(input.financial).issues)
  if (input.klines && input.klines.length > 0) {
    for (let i = 0; i < input.klines.length; i++) {
      const r = validateKline(input.klines[i]!)
      for (const iss of r.issues) issues.push({ ...iss, field: `klines[${i}].${iss.field}` })
    }
    // 日期单调递增校验
    for (let i = 1; i < input.klines.length; i++) {
      const prev = input.klines[i - 1]!.date
      const cur = input.klines[i]!.date
      if (prev && cur && cur < prev) {
        pushIssue(issues, `klines[${i}].date`, 'monotonic', `K 线日期非单调递增：${prev} -> ${cur}`)
      }
    }
  }
  return { ok: issues.every((i) => i.severity !== 'error'), issues }
}
