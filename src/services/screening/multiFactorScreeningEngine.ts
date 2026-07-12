/**
 * @module multiFactorScreeningEngine
 * @description 多因子选股筛选引擎（DA-007 四步集成合约：第 3 步 Builder）。
 * 负责从 dataLayer + unifiedStockService 加载股票、执行条件组筛选、生成 CSV。
 */

import { dataLayer } from '@/data/dataLayer'
import { getUnifiedStockViews } from '@/services/unifiedStockService'
import { getLogger } from '@/lib/logger'
import type {
  ScreenableStockData,
  ScreeningConditionGroup,
  ScreeningCriterion,
  ScreeningFactor,
  ScreeningOperator,
  ScreeningResultItem,
  ScreeningRunResult,
  ScreeningTemplate,
} from '@/types/modules/screening.types'

const logger = getLogger()

function getFactorValue(stock: ScreenableStockData, factor: ScreeningFactor): number | null {
  return stock[factor]
}

function compareValue(
  actual: number | null,
  operator: ScreeningOperator,
  value: number,
  value2?: number,
): boolean {
  if (actual === null) {
    return false
  }

  switch (operator) {
    case 'gt':
      return actual > value
    case 'gte':
      return actual >= value
    case 'lt':
      return actual < value
    case 'lte':
      return actual <= value
    case 'eq':
      return actual === value
    case 'between': {
      const upper = value2 ?? value
      const lower = Math.min(value, upper)
      const high = Math.max(value, upper)
      return actual >= lower && actual <= high
    }
    default:
      return false
  }
}

function evaluateCriterion(
  stock: ScreenableStockData,
  criterion: ScreeningCriterion,
): boolean {
  const actual = getFactorValue(stock, criterion.factor)
  return compareValue(actual, criterion.operator, criterion.value, criterion.value2)
}

function evaluateGroup(stock: ScreenableStockData, group: ScreeningConditionGroup): boolean {
  if (group.criteria.length === 0) {
    return true
  }

  if (group.logic === 'or') {
    return group.criteria.some((criterion) => evaluateCriterion(stock, criterion))
  }

  return group.criteria.every((criterion) => evaluateCriterion(stock, criterion))
}

/**
 * loadScreenableStocks
 * @returns Promise<ScreenableStockData[]>
 */
export async function loadScreenableStocks(): Promise<ScreenableStockData[]> {
  logger.info('[multiFactorScreeningEngine] 开始加载可筛选股票池')

  const stocks = await dataLayer.stocks.list()
  if (stocks.length === 0) {
    logger.info('[multiFactorScreeningEngine] 股票池为空')
    return []
  }

  const symbols = stocks.map((stock) => stock.symbol)
  const { data = [] } = await getUnifiedStockViews(symbols, {
    includeQuotes: false,
    includeV6Score: false,
    includeIntelligentScore: false,
    includeIndustryScore: false,
    includeRotationScore: false,
    includeSignal: false,
    includeHolding: false,
  })

  const views = data
  logger.info(`[multiFactorScreeningEngine] 加载股票池完成: ${views.length}/${symbols.length}`)

  return views.map((view) => ({
    symbol: view.stock.symbol,
    name: view.stock.name,
    sector: view.stock.sector ?? view.stock.industryCode ?? null,
    pe: view.stock.pe ?? null,
    pb: view.stock.pb ?? null,
    roe: view.stock.roe ?? null,
    marketCap: view.stock.marketCap ?? null,
    revenueGrowth: null, // 当前 Stock 类型不包含此字段，保留 null 占位
    profitGrowth: null, // 当前 Stock 类型不包含此字段，保留 null 占位
  }))
}

/**
 * runMultiFactorScreening
 */
export function runMultiFactorScreening(
  stocks: ScreenableStockData[],
  groups: ScreeningConditionGroup[],
): ScreeningRunResult {
  const start = performance.now()

  logger.info('[multiFactorScreeningEngine] runMultiFactorScreening() 开始', {
    stockCount: stocks.length,
    groupCount: groups.length,
    groupIds: groups.map(g => g.id),
    groupLogics: groups.map(g => ({ id: g.id, logic: g.logic, criteriaCount: g.criteria.length })),
  })

  const items: ScreeningResultItem[] = []
  const rejectedStocks: { symbol: string; matchedGroupCount: number; totalGroupCount: number }[] = []

  for (const stock of stocks) {
    const matchedGroups: string[] = []

    for (const group of groups) {
      const groupResult = evaluateGroup(stock, group)
      if (groupResult) matchedGroups.push(group.id)
    }

    // 多条件组之间是 AND 逻辑：必须匹配所有条件组才入选
    const shouldInclude = groups.length === 0 || matchedGroups.length === groups.length

    if (shouldInclude) {
      logger.info('[multiFactorScreeningEngine] 股票入选', {
        symbol: stock.symbol,
        name: stock.name,
        matchedGroups: matchedGroups.length,
        totalGroups: groups.length,
        matchedGroupIds: matchedGroups,
      })
      items.push({ ...stock, matchedGroups })
    } else {
      rejectedStocks.push({
        symbol: stock.symbol,
        matchedGroupCount: matchedGroups.length,
        totalGroupCount: groups.length,
      })
    }
  }

  const elapsedMs = Math.round(performance.now() - start)

  logger.info('[multiFactorScreeningEngine] runMultiFactorScreening() 完成', {
    totalStocks: stocks.length,
    selectedCount: items.length,
    rejectedCount: rejectedStocks.length,
    selectionRate: stocks.length > 0 ? ((items.length / stocks.length) * 100).toFixed(2) + '%' : '0%',
    elapsedMs,
    rejectedStocksSample: rejectedStocks.slice(0, 5), // 只记录前 5 个被拒绝的股票，避免日志过大
  })

  return { items, total: items.length, elapsedMs }
}

/**
 * generateScreeningCsv
 * @param items
 * @returns string
 */
export function generateScreeningCsv(items: ScreeningResultItem[]): string {
  const BOM = '\uFEFF'
  const headers = ['代码', '名称', '行业', 'PE', 'PB', 'ROE', '总市值(亿)', '营收增速(%)', '净利润增速(%)']
  const rows = items.map((item) => [
    item.symbol,
    item.name,
    item.sector ?? '',
    item.pe?.toString() ?? '',
    item.pb?.toString() ?? '',
    item.roe?.toString() ?? '',
    item.marketCap?.toString() ?? '',
    item.revenueGrowth?.toString() ?? '',
    item.profitGrowth?.toString() ?? '',
  ])

  const escape = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  return BOM + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
}

/**
 * exportScreeningResults
 * @param items
 * @param filenamePrefix
 * @returns void
 */
export function exportScreeningResults(items: ScreeningResultItem[], filenamePrefix: string): void {
  if (items.length === 0) return

  const csv = generateScreeningCsv(items)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filenamePrefix}_${Date.now()}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * createTemplateFromGroups
 */
export function createTemplateFromGroups(
  name: string,
  groups: ScreeningConditionGroup[],
  description?: string,
): ScreeningTemplate {
  const now = Date.now()
  // 修复：添加随机后缀避免高频调用时的 ID 碰撞
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return {
    id: `template_${now}_${randomSuffix}`,
    name,
    description,
    groups,
    createdAt: now,
    updatedAt: now,
  }
}
