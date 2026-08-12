/**
 * 评分输入数据契约校验（Scoring Input Contract Validation）
 *
 * 在评分计算前对输入数据做质量校验，确保：
 * - 财务数据字段类型与区间合理
 * - 行情数据形态合法
 * - 基础数据关键字段存在
 *
 * 设计原则：
 * - warn-only：校验不通过仅记日志，不阻断评分（降级处理由各层计算器负责）
 * - 纯函数、零副作用
 * - 与 services/scoring 同层，可直接引用 v6-engine 类型
 *
 * @module services/scoring/scoringInputValidation
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033, V9-DOC-BACK-027]
*/

import type { FinancialData, StockBasicData, QuoteData } from './v6-engine'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 百分比类字段合理上限（%） */
const PCT_FIELD_MAX = 200
/** 百分比类字段合理下限（%） */
const PCT_FIELD_MIN = -200
/** 存货周转天数合理上限（约 10 年） */
const MAX_INVENTORY_TURNOVER_DAYS = 3650
/** 客户集中度合理上限（%） */
const MAX_CUSTOMER_CONCENTRATION = 100

/** 单条校验问题 */
export interface ValidationIssue {
  field: string
  rule: string
  message: string
  severity: 'warn' | 'error'
}

/** 校验结果 */
export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

function pushIssue(
  issues: ValidationIssue[],
  field: string,
  rule: string,
  message: string,
  severity: 'warn' | 'error' = 'warn',
): void {
  issues.push({ field, rule, message, severity })
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isFiniteOrUndef(v: unknown): v is number | undefined {
  return v === undefined || isFiniteNumber(v)
}

// ============================================================
// 财务数据校验
// ============================================================

/**
 * validateFinancialData
 * @param f
 * @returns ValidationResult
 */
export function validateFinancialData(f: FinancialData): ValidationResult {
  const issues: ValidationIssue[] = []

  const pctFields = [
    'revenueYoY',
    'netProfitYoY',
    'grossMargin',
    'netMargin',
    'rdRatio',
    'shareholderPledge',
  ] as const

  for (const fld of pctFields) {
    const v = f[fld]
    if (!isFiniteOrUndef(v)) {
      pushIssue(issues, fld, 'finite', `${fld} 必须为有限数或 undefined，实际：${JSON.stringify(v)}`)
    } else if (typeof v === 'number' && (v < PCT_FIELD_MIN || v > PCT_FIELD_MAX)) {
      pushIssue(
        issues,
        fld,
        'range',
        `${fld} 超出合理区间 [${PCT_FIELD_MIN}, ${PCT_FIELD_MAX}]，实际：${v}`,
      )
    }
  }

  if (!isFiniteOrUndef(f.inventoryTurnoverDays)) {
    pushIssue(
      issues,
      'inventoryTurnoverDays',
      'finite',
      `存货周转天数必须为有限数或 undefined，实际：${JSON.stringify(f.inventoryTurnoverDays)}`,
    )
  } else if (
    typeof f.inventoryTurnoverDays === 'number' &&
    (f.inventoryTurnoverDays < 0 || f.inventoryTurnoverDays > MAX_INVENTORY_TURNOVER_DAYS)
  ) {
    pushIssue(
      issues,
      'inventoryTurnoverDays',
      'range',
      `存货周转天数超出合理区间 [0, ${MAX_INVENTORY_TURNOVER_DAYS}]，实际：${f.inventoryTurnoverDays}`,
    )
  }

  if (f.revenue !== undefined) {
    if (!isFiniteNumber(f.revenue) || f.revenue <= 0) {
      pushIssue(issues, 'revenue', 'positive', `营收应为正数，实际：${JSON.stringify(f.revenue)}`)
    }
  }

  if (f.netProfit !== undefined && !isFiniteNumber(f.netProfit)) {
    pushIssue(
      issues,
      'netProfit',
      'finite',
      `净利润必须为有限数，实际：${JSON.stringify(f.netProfit)}`,
    )
  }

  const positiveAmountFields = [
    'operatingCF',
    'receivables',
    'interestBearingDebt',
    'goodwill',
    'netAssets',
    'ordersInHand',
    'newOrders',
  ] as const

  for (const fld of positiveAmountFields) {
    const v = f[fld]
    if (v !== undefined && !isFiniteNumber(v)) {
      pushIssue(issues, fld, 'finite', `${fld} 必须为有限数，实际：${JSON.stringify(v)}`)
    }
  }

  if (f.customerConcentration !== undefined) {
    if (!isFiniteNumber(f.customerConcentration)) {
      pushIssue(
        issues,
        'customerConcentration',
        'finite',
        `客户集中度必须为有限数，实际：${JSON.stringify(f.customerConcentration)}`,
      )
    } else if (f.customerConcentration < 0 || f.customerConcentration > MAX_CUSTOMER_CONCENTRATION) {
      pushIssue(
        issues,
        'customerConcentration',
        'range',
        `客户集中度超出合理区间 [0, ${MAX_CUSTOMER_CONCENTRATION}]，实际：${f.customerConcentration}`,
      )
    }
  }

  return {
    ok: issues.every((i) => i.severity !== 'error'),
    issues,
  }
}

// ============================================================
// 基础数据校验
// ============================================================

/**
 * validateStockBasicData
 * @param s
 * @returns ValidationResult
 */
export function validateStockBasicData(s: StockBasicData): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!s.symbol || typeof s.symbol !== 'string') {
    pushIssue(issues, 'symbol', 'required', '股票代码缺失', 'error')
  }
  if (!s.name || typeof s.name !== 'string') {
    pushIssue(issues, 'name', 'required', '股票名称缺失')
  }

  const positiveFields = ['price', 'marketCap', 'pe', 'pb'] as const
  for (const fld of positiveFields) {
    const v = s[fld]
    if (v !== undefined && (!isFiniteNumber(v) || v < 0)) {
      pushIssue(issues, fld, 'nonnegative', `${fld} 必须为非负有限数，实际：${JSON.stringify(v)}`)
    }
  }

  if (s.roe !== undefined && !isFiniteNumber(s.roe)) {
    pushIssue(issues, 'roe', 'finite', `ROE 必须为有限数，实际：${JSON.stringify(s.roe)}`)
  }

  return {
    ok: issues.every((i) => i.severity !== 'error'),
    issues,
  }
}

// ============================================================
// 行情数据校验
// ============================================================

/**
 * validateQuoteData
 * @param q
 * @returns ValidationResult
 */
export function validateQuoteData(q: QuoteData): ValidationResult {
  const issues: ValidationIssue[] = []

  if (q.latestClose !== undefined && (!isFiniteNumber(q.latestClose) || q.latestClose <= 0)) {
    pushIssue(
      issues,
      'latestClose',
      'positive',
      `最新收盘价应为正数，实际：${JSON.stringify(q.latestClose)}`,
    )
  }

  const ratioFields = ['return20d', 'return60d', 'volatility20d', 'avgTurnover20d'] as const
  for (const fld of ratioFields) {
    const v = q[fld]
    if (v !== undefined && !isFiniteNumber(v)) {
      pushIssue(issues, fld, 'finite', `${fld} 必须为有限数，实际：${JSON.stringify(v)}`)
    }
  }

  if (Array.isArray(q.history) && q.history.length > 0) {
    const invalidPrices = q.history.filter((p) => !isFiniteNumber(p) || p <= 0)
    if (invalidPrices.length > 0) {
      pushIssue(
        issues,
        'history',
        'positive',
        `历史价格含 ${invalidPrices.length} 个非法值`,
      )
    }
  }

  return {
    ok: issues.every((i) => i.severity !== 'error'),
    issues,
  }
}

// ============================================================
// 组合校验入口
// ============================================================

export interface ScoringInputValidationResult {
  stock: ValidationResult
  financials: ValidationResult
  quotes: ValidationResult
  allOk: boolean
  totalIssues: number
}

/**
 * 评分输入数据组合校验（warn-only，记日志不阻断）
 */
export function validateScoringInput(input: {
  stock: StockBasicData
  financials: FinancialData
  quotes: QuoteData
}): ScoringInputValidationResult {
  const stock = validateStockBasicData(input.stock)
  const financials = validateFinancialData(input.financials)
  const quotes = validateQuoteData(input.quotes)

  const allIssues = [...stock.issues, ...financials.issues, ...quotes.issues]

  if (allIssues.length > 0) {
    logger.warn('[scoringInputValidation] 评分输入数据校验告警', {
      symbol: input.stock.symbol,
      totalIssues: allIssues.length,
      stockIssues: stock.issues.length,
      financialIssues: financials.issues.length,
      quoteIssues: quotes.issues.length,
      issues: allIssues.slice(0, 10),
    })
  }

  return {
    stock,
    financials,
    quotes,
    allOk: stock.ok && financials.ok && quotes.ok,
    totalIssues: allIssues.length,
  }
}
