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
import { getHotSectors, type HotSector } from '@/services/input/hotSectorService'
import { matchesTheme } from '@/config/themeRegistry'
import { getCompositeScores } from './scoringAdapter'

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
  const ruleConfig = options.ruleConfig ?? getDefaultStrategyRuleConfig()
  const theme = options.theme

  if (stocks.length === 0) {
    return emptyResult()
  }

  const [scoreViews, momentumMap, topHotSectors] = await Promise.all([
    getCompositeScores(stocks),
    options.momentumMap ? Promise.resolve(options.momentumMap) : fetchMomentumMap(stocks),
    fetchTopHotSectors(ruleConfig.hotMomentumTopSectors),
  ])

  const scoreMap = new Map(scoreViews.map((s) => [s.symbol, s]))

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

  // 20 进 13：先合并可入选池，再应用 R2 低估值过滤，最后按综合分截断
  const pool = [...coreScarce, ...valueBargain, ...hotMomentum]
  const afterR2 = pool.filter((c) => {
    if (
      c.valuationScore !== null &&
      c.valuationScore < ruleConfig.lowValuationThreshold &&
      c.composite < ruleConfig.lowValuationCompositeExempt
    ) {
      c.classification = 'excluded'
      c.reasons.push(
        `R2：估值分 ${c.valuationScore.toFixed(2)} 低于 ${ruleConfig.lowValuationThreshold} 且综合分 ${c.composite.toFixed(2)} 低于 ${ruleConfig.lowValuationCompositeExempt}`,
      )
      excluded.push(c)
      return false
    }
    return true
  })

  const selected = afterR2
    .sort((a, b) => b.composite - a.composite || a.symbol.localeCompare(b.symbol))
    .slice(0, ruleConfig.selectedMaxCount)

  // 未进入 Top13 的候选也移入 rejected 以便展示
  afterR2.forEach((c) => {
    if (!selected.includes(c)) {
      c.reasons.push(`未进入综合分前 ${ruleConfig.selectedMaxCount} 名`)
      excluded.push(c)
    }
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
    case 'hot-momentum':
      return [
        `热门追涨：板块 ${sector ?? '-'}，动量 ${((momentum ?? 0) * 100).toFixed(1)}%`,
      ]
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
      const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
      const latest = quotes.latest?.close ?? closes[closes.length - 1]
      if (ma20 && ma20 !== 0 && latest !== undefined) {
        map[stock.symbol] = (latest - ma20) / ma20
      }
    }),
  )

  return map
}

async function fetchTopHotSectors(topN: number): Promise<HotSector[]> {
  try {
    return getHotSectors()
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
  } catch {
    return []
  }
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
