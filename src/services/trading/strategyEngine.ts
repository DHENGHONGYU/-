import type { ThemeConfig } from '@/config/themeRegistry'
import {
  getDefaultStrategyRuleConfig,
  type StrategyRuleConfig,
} from '@/config/strategyRules'
import { dataLayer } from '@/data/dataLayer'
import type {
  Stock,
  StrategyCandidate,
  StrategyClassification,
  StrategyResult,
} from '@/data/types'
import { hotSectorQueryUseCase } from '@/services/useCase/hotSectorQuery.useCase'
import type { HotSector } from '@/services/input/hotSectorService'
import { matchesTheme } from '@/config/themeRegistry'
import { getLogger } from '@/lib/logger'
import { getCompositeScores } from './scoringAdapter'

const logger = getLogger()

export interface RunStrategyOptions {
  /** 主题配置；未指定则使用「第四次工业革命稀缺核心资源」主题 */
  theme?: ThemeConfig
  /** 策略规则配置；默认使用 DEFAULT_STRATEGY_RULE_CONFIG */
  ruleConfig?: StrategyRuleConfig
  /** 外部注入的动量快照（symbol -> priceToMA20），未提供则内部读取 dailyQuotes */
  momentumMap?: Record<string, number>
}

/**
 * 策略规则引擎。
 *
 * 依据 v6-pro-cockpit 核心稀缺策略实现：
 * 1. 对输入股票池进行分类：core-scarce / value-bargain / hot-momentum / excluded。
 * 2. 应用 20 进 13 规则筛选入选标的。
 * 3. 返回结构化 StrategyResult，供 portfolioBuilder 直接消费。
 */
export async function runStrategy(
  stocks: Stock[],
  options: RunStrategyOptions = {},
): Promise<StrategyResult> {
  logger.info('[strategyEngine] runStrategy 开始', {
    stockCount: stocks.length,
    hasTheme: !!options.theme,
    hasMomentumMap: !!options.momentumMap,
    hasRuleConfig: !!options.ruleConfig,
  })

  const ruleConfig = options.ruleConfig ?? getDefaultStrategyRuleConfig()
  const theme = options.theme

  if (stocks.length === 0) {
    logger.warn('[strategyEngine] runStrategy 输入股票池为空，返回空结果')
    return emptyResult()
  }

  logger.info('[strategyEngine] runStrategy 加载评分、动量、热门板块数据', {
    stockCount: stocks.length,
    useExternalMomentum: !!options.momentumMap,
  })

  const [scoreViews, momentumMap, topHotSectors] = await Promise.all([
    getCompositeScores(stocks),
    options.momentumMap ? Promise.resolve(options.momentumMap) : fetchMomentumMap(stocks),
    fetchTopHotSectors(ruleConfig.hotMomentumTopSectors),
  ])

  logger.info('[strategyEngine] runStrategy 数据加载完成', {
    scoreViewsCount: scoreViews.length,
    momentumMapCount: Object.keys(momentumMap).length,
    topHotSectorsCount: topHotSectors.length,
    topHotSectors: topHotSectors.map((s) => ({ name: s.name, score: s.score })),
  })

  const scoreMap = new Map(scoreViews.map((s) => [s.symbol, s]))

  logger.info('[strategyEngine] runStrategy 开始分类候选股票')

  const candidates: StrategyCandidate[] = stocks.map((stock) => {
    const score = scoreMap.get(stock.symbol)
    const composite = score?.composite ?? 0
    const valuationScore = score?.valuationScore ?? null
    const industryScore = score?.industryScore ?? null
    const momentum = momentumMap[stock.symbol] ?? null
    const sector = stock.sector ?? null

    const classification = classify(
      stock,
      composite,
      valuationScore,
      sector,
      momentum,
      theme,
      ruleConfig,
      topHotSectors,
    )

    logger.info('[strategyEngine] runStrategy 股票分类完成', {
      symbol: stock.symbol,
      name: stock.name,
      composite: composite.toFixed(2),
      valuationScore: valuationScore?.toFixed(2) ?? 'null',
      momentum: momentum !== null ? (momentum * 100).toFixed(1) + '%' : 'null',
      sector,
      classification,
    })

    return {
      symbol: stock.symbol,
      name: stock.name,
      composite,
      valuationScore,
      industryScore,
      momentum,
      sector,
      classification,
      reasons: buildReasons(classification, composite, valuationScore, sector, momentum, ruleConfig),
    }
  })

  const coreScarce = candidates.filter((c) => c.classification === 'core-scarce')
  const valueBargain = candidates.filter((c) => c.classification === 'value-bargain')
  const hotMomentum = candidates.filter((c) => c.classification === 'hot-momentum')
  const excluded = candidates.filter((c) => c.classification === 'excluded')

  logger.info('[strategyEngine] runStrategy 分类统计', {
    coreScarceCount: coreScarce.length,
    valueBargainCount: valueBargain.length,
    hotMomentumCount: hotMomentum.length,
    excludedCount: excluded.length,
    coreScarceSymbols: coreScarce.map((c) => c.symbol),
    valueBargainSymbols: valueBargain.map((c) => c.symbol),
    hotMomentumSymbols: hotMomentum.map((c) => c.symbol),
  })

  // 20 进 13：先合并可入选池，再应用 R2 低估值过滤，最后按综合分截断
  const pool = [...coreScarce, ...valueBargain, ...hotMomentum]

  logger.info('[strategyEngine] runStrategy 应用 R2 低估值过滤', {
    poolSize: pool.length,
    lowValuationThreshold: ruleConfig.lowValuationThreshold,
    lowValuationCompositeExempt: ruleConfig.lowValuationCompositeExempt,
  })

  const afterR2: StrategyCandidate[] = []
  const r2Rejected: StrategyCandidate[] = []

  for (const c of pool) {
    if (
      c.valuationScore !== null &&
      c.valuationScore < ruleConfig.lowValuationThreshold &&
      c.composite < ruleConfig.lowValuationCompositeExempt
    ) {
      logger.info('[strategyEngine] runStrategy R2 过滤触发', {
        symbol: c.symbol,
        name: c.name,
        valuationScore: c.valuationScore.toFixed(2),
        composite: c.composite.toFixed(2),
      })
      c.classification = 'excluded'
      c.reasons.push(
        `R2：估值分 ${c.valuationScore.toFixed(2)} 低于 ${ruleConfig.lowValuationThreshold} 且综合分 ${c.composite.toFixed(2)} 低于 ${ruleConfig.lowValuationCompositeExempt}`,
      )
      r2Rejected.push(c)
    } else {
      afterR2.push(c)
    }
  }

  excluded.push(...r2Rejected)

  logger.info('[strategyEngine] runStrategy R2 过滤完成', {
    beforeCount: pool.length,
    afterCount: afterR2.length,
    filteredCount: pool.length - afterR2.length,
  })

  const selected = afterR2
    .sort((a, b) => b.composite - a.composite || a.symbol.localeCompare(b.symbol))
    .slice(0, ruleConfig.selectedMaxCount)

  logger.info('[strategyEngine] runStrategy 最终入选股票', {
    selectedCount: selected.length,
    maxCount: ruleConfig.selectedMaxCount,
    selectedSymbols: selected.map((c) => ({
      symbol: c.symbol,
      name: c.name,
      composite: c.composite.toFixed(2),
      classification: c.classification,
    })),
  })

  // 未进入 Top13 的候选也移入 rejected 以便展示
  afterR2.forEach((c) => {
    if (!selected.includes(c)) {
      logger.info('[strategyEngine] runStrategy 未入选股票', {
        symbol: c.symbol,
        name: c.name,
        composite: c.composite.toFixed(2),
        classification: c.classification,
      })
      c.reasons.push(`未进入综合分前 ${ruleConfig.selectedMaxCount} 名`)
      excluded.push(c)
    }
  })

  logger.info('[strategyEngine] runStrategy 完成', {
    total: candidates.length,
    selectedCount: selected.length,
    coreScarceCount: coreScarce.length,
    valueBargainCount: valueBargain.length,
    hotMomentumCount: hotMomentum.length,
    rejectedCount: excluded.length,
  })

  return {
    selected,
    coreScarce,
    valueBargain,
    hotMomentum,
    rejected: excluded,
    summary: {
      total: candidates.length,
      selectedCount: selected.length,
      coreScarceCount: coreScarce.length,
      valueBargainCount: valueBargain.length,
      hotMomentumCount: hotMomentum.length,
    },
  }
}

function classify(
  stock: Stock,
  composite: number,
  valuationScore: number | null,
  sector: string | null,
  momentum: number | null,
  theme: ThemeConfig | undefined,
  rules: StrategyRuleConfig,
  topHotSectors: HotSector[],
): StrategyClassification {
  // core-scarce：匹配主题且综合分达到主题门槛
  if (theme && matchesTheme(stock, theme) && composite >= theme.minCompositeScore) {
    return 'core-scarce'
  }

  // value-bargain：估值分高、综合分中等
  if (
    composite >= rules.valueBargainCompositeMin &&
    valuationScore !== null &&
    valuationScore >= rules.valueBargainValuationMin
  ) {
    return 'value-bargain'
  }

  // hot-momentum：sector 属于热门板块 TOP N 且动量达标
  if (
    composite >= rules.compositeMin &&
    sector !== null &&
    momentum !== null &&
    momentum >= rules.hotMomentumMinMomentum &&
    isHotSector(sector, topHotSectors)
  ) {
    return 'hot-momentum'
  }

  return 'excluded'
}

function buildReasons(
  classification: StrategyClassification,
  composite: number,
  valuationScore: number | null,
  sector: string | null,
  momentum: number | null,
  rules: StrategyRuleConfig,
): string[] {
  switch (classification) {
    case 'core-scarce':
      return [`核心稀缺主题匹配，综合分 ${composite.toFixed(2)}`]
    case 'value-bargain':
      return [
        `价值洼地：估值分 ${valuationScore?.toFixed(2) ?? '-'}，综合分 ${composite.toFixed(2)}`,
      ]
    case 'hot-momentum': {
      const momentumValue = momentum ?? 0
      if (momentum === null) {
        logger.warn('[strategyEngine] 字段缺失，使用默认值', { field: 'momentum', context: 'hot-momentum' })
      }
      return [
        `热门追涨：板块 ${sector ?? '-'}，动量 ${(momentumValue * 100).toFixed(1)}%`,
      ]
    }
    case 'excluded':
    default: {
      const reasons: string[] = []
      if (composite < rules.compositeMin) {
        reasons.push(`综合分 ${composite.toFixed(2)} 低于门槛 ${rules.compositeMin}`)
      }
      if (valuationScore !== null && valuationScore < rules.valueBargainValuationMin) {
        reasons.push(`估值分 ${valuationScore.toFixed(2)} 未达价值洼地标准`)
      }
      if (sector === null || momentum === null || momentum < rules.hotMomentumMinMomentum) {
        reasons.push('不满足热门追涨动量/板块条件')
      }
      if (reasons.length === 0) {
        reasons.push('未匹配任何策略分类规则')
      }
      return reasons
    }
  }
}

async function fetchMomentumMap(stocks: Stock[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {}

  await Promise.all(
    stocks.map(async (stock) => {
      const quotes = await dataLayer.dailyQuotes.get(stock.symbol)
      if (!quotes || quotes.history.length < 20) return

      const closes = quotes.history.map((bar) => bar.close)
      if (closes.length === 0) return // 修复：空数组保护

      const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
      const latest = quotes.latest?.close ?? closes[closes.length - 1]
      if (latest === undefined) return // 修复：undefined 保护
      if (ma20 && ma20 !== 0) {
        map[stock.symbol] = (latest - ma20) / ma20
      }
    }),
  )

  return map
}

async function fetchTopHotSectors(topN: number): Promise<HotSector[]> {
  const result = await hotSectorQueryUseCase({ topN })
  return result.ok ? result.value.hotSectors : []
}

function isHotSector(sector: string, topHotSectors: HotSector[]): boolean {
  const normalized = sector.toLowerCase()
  return topHotSectors.some((s) =>
    normalized.includes(s.name.toLowerCase()) ||
    s.name.toLowerCase().includes(normalized),
  )
}

function emptyResult(): StrategyResult {
  return {
    selected: [],
    coreScarce: [],
    valueBargain: [],
    hotMomentum: [],
    rejected: [],
    summary: {
      total: 0,
      selectedCount: 0,
      coreScarceCount: 0,
      valueBargainCount: 0,
      hotMomentumCount: 0,
    },
  }
}
