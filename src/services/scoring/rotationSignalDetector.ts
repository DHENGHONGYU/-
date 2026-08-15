/**
 * RotationSignalDetector — 轮动信号检测器
 *
 * 对价值洼地候选板块检测轮动信号，三项条件全满足时触发：
 * 1. 成交量突破 20% 历史分位
 * 2. 资金连续 N 日净流入
 * 3. 技术指标出现金叉
 *
 * 输出：RotationSignal { triggered: boolean, strength: 'weak'|'medium'|'strong' }
 *
 * @module services/scoring/rotationSignalDetector
 * @created 2026-06-27 - 基于双策略体系修正
  * @doc [V9-DOC-BACK-012, V9-DOC-ARCH-007, V9-DOC-BACK-015, V9-DOC-BACK-023, V9-DOC-BACK-033]
*/

import { getDefaultDualStrategyRuleConfig, type DualStrategyRuleConfig } from '@/config/dualStrategyRules'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import type { DataLayerResult, DailyQuotes, KlineBar, RotationSectorScore, Signal, Stock, ValuePitScore } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { ROTATION_SIGNAL_THRESHOLDS } from '@/config/thresholds'

import { nanoid } from 'nanoid'
const logger = getLogger()

// ============================================================
// 常量（P0-09: 提取魔法数字）
// ============================================================

/** 板块聚合时取近 N 日数据窗口 */
const RECENT_DATA_WINDOW_DAYS = 60

/** 个股参与聚合的最小历史天数门槛 */
const MIN_HISTORY_DAYS = 20

/** 板块聚合时最多取前 N 只股票（避免过重计算） */
const MAX_SECTOR_STOCKS_FOR_AGGREGATION = 10

// ============================================================
// 输入类型
// ============================================================

export interface VolumeData {
  /** 历史成交量序列（按时间升序） */
  history: number[]
}

export interface CapitalFlowData {
  /** 每日资金净流入序列（正值=流入，按时间升序） */
  dailyNetFlow: number[]
}

export interface GoldenCrossData {
  /** 收盘价序列（按时间升序） */
  closes: number[]
  /** 短期均线周期，默认 5 */
  shortPeriod?: number
  /** 长期均线周期，默认 20 */
  longPeriod?: number
}

/** 轮动信号检测聚合输入 */
export interface RotationSignalInput {
  sectorId: string
  volume: VolumeData
  capitalFlow: CapitalFlowData
  goldenCross: GoldenCrossData
}

// ============================================================
// 输出类型
// ============================================================

export interface RotationSignal {
  sectorId: string
  triggered: boolean
  conditions: {
    volumeBreakthrough: boolean
    capitalInflow: boolean
    goldenCross: boolean
  }
  strength: 'weak' | 'medium' | 'strong'
  detectedAt: number
}

// ============================================================
// 检测函数
// ============================================================

/**
 * 检测成交量是否突破指定历史分位。
 *
 * @param data 成交量数据
 * @param percentile 目标分位阈值（默认 20，即突破 20% 历史分位）
 * @returns 是否突破
 */
export function checkVolumeBreakthrough(
  data: VolumeData,
  percentile: number = 20,
): boolean {
  if (data.history.length < 5) {
    return false
  }

  // 取最近 5 日平均成交量
  const recent = data.history.slice(-5)
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length

  // 计算历史成交量的分位值
  const sorted = [...data.history].sort((a, b) => a - b)
  const idx = Math.ceil((percentile / 100) * sorted.length) - 1
  const threshold = sorted[Math.max(0, idx)]!

  // 近期均量超过分位阈值即为突破
  return recentAvg > threshold
}

/**
 * 检测资金是否连续 N 日净流入。
 *
 * @param data 资金流数据
 * @param days 连续流入天数阈值（默认 3）
 * @returns 是否满足
 */
export function checkCapitalInflow(
  data: CapitalFlowData,
  days: number = 3,
): boolean {
  if (data.dailyNetFlow.length < days) {
    return false
  }

  // 检查最近 N 天是否全部为正
  const recent = data.dailyNetFlow.slice(-days)
  return recent.every((flow) => flow > 0)
}

/**
 * 检测是否出现技术金叉。
 *
 * 金叉定义：短期均线上穿长期均线，且当前价格在短期均线之上。
 *
 * @param data 金叉检测数据
 * @returns 是否出现金叉
 */
export function checkGoldenCross(data: GoldenCrossData): boolean {
  const shortPeriod = data.shortPeriod ?? ROTATION_SIGNAL_THRESHOLDS.GOLDEN_CROSS_SHORT_PERIOD_DEFAULT
  const longPeriod = data.longPeriod ?? ROTATION_SIGNAL_THRESHOLDS.GOLDEN_CROSS_LONG_PERIOD_DEFAULT

  if (data.closes.length < longPeriod + 1) {
    return false
  }

  // 今日短期均线
  const todayShort = data.closes
    .slice(-shortPeriod)
    .reduce((a, b) => a + b, 0) / shortPeriod

  // 今日长期均线
  const todayLong = data.closes
    .slice(-longPeriod)
    .reduce((a, b) => a + b, 0) / longPeriod

  // 昨日短期均线
  const yesterdayShort = data.closes
    .slice(-(shortPeriod + 1), -1)
    .reduce((a, b) => a + b, 0) / shortPeriod

  // 昨日长期均线
  const yesterdayLong = data.closes
    .slice(-(longPeriod + 1), -1)
    .reduce((a, b) => a + b, 0) / longPeriod

  // 金叉：昨日短期 ≤ 长期，今日短期 > 长期，且当前价格 > 短期均线
  const currentPrice = data.closes[data.closes.length - 1]!
  const crossed = yesterdayShort <= yesterdayLong && todayShort > todayLong

  return crossed && currentPrice > todayShort
}

// ============================================================
// 信号强度判定
// ============================================================

/**
 * 根据成交量突破幅度判定信号强度。
 */
function getVolumeStrength(volume: VolumeData): 'weak' | 'medium' | 'strong' {
  if (volume.history.length < 5) return 'weak'

  const recent = volume.history.slice(-5)
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const sorted = [...volume.history].sort((a, b) => a - b)

  const p50Idx = Math.ceil(0.5 * sorted.length) - 1
  const p80Idx = Math.ceil(0.8 * sorted.length) - 1
  const median = sorted[Math.max(0, p50Idx)]!
  const p80 = sorted[Math.max(0, p80Idx)]!

  if (recentAvg > p80) return 'strong'
  if (recentAvg > median) return 'medium'
  return 'weak'
}

// ============================================================
// 综合检测
// ============================================================

/**
 * 综合检测三个轮动触发条件，输出 RotationSignal。
 */
export function detect(input: RotationSignalInput): RotationSignal {
  const volumeBreakthrough = checkVolumeBreakthrough(input.volume)
  const capitalInflow = checkCapitalInflow(input.capitalFlow)
  const goldenCross = checkGoldenCross(input.goldenCross)

  const triggered = volumeBreakthrough && capitalInflow && goldenCross

  // 信号强度由成交量突破幅度主导
  let strength: RotationSignal['strength'] = 'weak'
  if (triggered) {
    strength = getVolumeStrength(input.volume)
  }

  return {
    sectorId: input.sectorId,
    triggered,
    conditions: {
      volumeBreakthrough,
      capitalInflow,
      goldenCross,
    },
    strength,
    detectedAt: Date.now(),
  }
}

// ============================================================
// 数据获取与编排
// ============================================================

async function aggregateSectorBars(
  sectorStocks: Array<{ symbol: string }>,
): Promise<{
  sortedDates: string[]
  sectorVolumes: number[]
  sectorFlows: number[]
  closes: number[]
  count: number
} | null> {
  const stockBarMaps = new Map<string, Map<string, KlineBar>>()
  const allDates = new Set<string>()
  let count = 0

  for (const stock of sectorStocks.slice(0, MAX_SECTOR_STOCKS_FOR_AGGREGATION)) {
    const quotesResult = await dataBridge.query<DailyQuotes>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.dailyQuotes, key: stock.symbol }).catch(() => ({ success: false as const, error: 'query failed' }))
    const quotes = quotesResult.success ? quotesResult.data : undefined
    if (!quotes || quotes.history.length < MIN_HISTORY_DAYS) {
      logger.warn(`[rotationSignalDetector] 股票历史数据不足，跳过`, {
        symbol: stock.symbol,
        historyLength: quotes?.history.length ?? 0,
        minLength: MIN_HISTORY_DAYS,
      })
      continue
    }

    const barMap = new Map<string, KlineBar>()
    for (const bar of quotes.history.slice(-RECENT_DATA_WINDOW_DAYS)) {
      barMap.set(bar.date, bar)
      allDates.add(bar.date)
    }
    stockBarMaps.set(stock.symbol, barMap)
    count++
  }

  if (count === 0) return null

  const sortedDates = Array.from(allDates).sort()
  const sectorVolumes: number[] = Array.from({ length: sortedDates.length }, () => 0)
  const sectorFlows: number[] = Array.from({ length: sortedDates.length }, () => 0)
  const closes: number[] = Array.from({ length: sortedDates.length }, () => 0)

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i]!
    for (const [, barMap] of stockBarMaps) {
      const bar = barMap.get(date)
      if (!bar) continue
      sectorVolumes[i]! += bar.volume
      sectorFlows[i]! += (bar.close - bar.open) * bar.volume
      closes[i]! += bar.close
    }
  }

  return { sortedDates, sectorVolumes, sectorFlows, closes, count }
}

/**
 * 根据 sectorId 从 dataLayer 获取板块数据并执行轮动信号检测。
 *
 * sectorId 匹配逻辑：
 * 1. 从 stocks 表查找属于该板块的股票
 * 2. 聚合板块内股票的成交量/资金流数据
 * 3. 执行三项检测
 */
export async function detectBySector(sectorId: string): Promise<RotationSignal | null> {
  try {
    logger.info(`[rotationSignalDetector] 开始检测板块 ${sectorId}`)

    // 获取板块内所有股票
    const allStocksResult = await dataBridge.query<Stock[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.stocks })
    const allStocks = allStocksResult.success ? (allStocksResult.data ?? []) : []
    const sectorStocks = allStocks.filter(
      (s) =>
        s.sector === sectorId ||
        s.industryCode === sectorId ||
        (s.sector !== undefined && s.sector === sectorId),
    )

    if (sectorStocks.length === 0) {
      logger.warn(`[rotationSignalDetector] 板块 ${sectorId} 无股票数据`)
      return null
    }

    const aggregated = await aggregateSectorBars(sectorStocks)
    if (!aggregated) {
      logger.warn(`[rotationSignalDetector] 板块 ${sectorId} 数据不足`)
      return null
    }

    const { sectorVolumes, sectorFlows, closes, count } = aggregated

    if (sectorVolumes.length < MIN_HISTORY_DAYS) {
      logger.warn(`[rotationSignalDetector] 板块 ${sectorId} 数据不足`)
      return null
    }

    const result = detect({
      sectorId,
      volume: { history: sectorVolumes },
      capitalFlow: { dailyNetFlow: sectorFlows },
      goldenCross: {
        closes: count > 0 ? closes.map((c) => c / count) : [],
      },
    })

    logger.info(
      `[rotationSignalDetector] 板块 ${sectorId} 检测完成: triggered=${result.triggered}, strength=${result.strength}`,
    )
    return result
  } catch (error) {
    logger.error(`[rotationSignalDetector] 检测板块 ${sectorId} 失败`, { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

export interface RotationSignalDetectorOptions {
  ruleConfig?: DualStrategyRuleConfig
}

export interface RotationSignalResult {
  signals: Signal[]
  watchlistCandidates: Array<{ symbol: string; reason: string }>
}

/**
 * 对价值洼地候选列表检测轮动信号。
 *
 * 只处理 action 为 wait/probe 的候选；immediate/ignore 被跳过。
 * 对每只候选股票检测：成交量放大、价格站稳 MA20、板块资金流入。
 * 全部满足则生成 buy_rotation 信号，否则加入观察清单。
 */
export async function detectRotationSignals(
  valuePitScores: ValuePitScore[],
  options: RotationSignalDetectorOptions = {},
): Promise<DataLayerResult<RotationSignalResult>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const signals: Signal[] = []
  const watchlistCandidates: Array<{ symbol: string; reason: string }> = []

  const candidates = valuePitScores.filter(
    (s) => s.action === 'wait' || s.action === 'probe',
  )

  const candidateResults = await Promise.allSettled(
    candidates.map(async (score): Promise<{ signal: Signal | undefined; watchlist: { symbol: string; reason: string } | undefined }> => {
      const stockResult = await dataBridge.query<Stock>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.stocks, key: score.symbol }).catch(() => ({ success: false as const, error: 'query failed' }))
      const stock = stockResult.success ? stockResult.data : undefined
      if (!stock) {
        return { signal: undefined, watchlist: { symbol: score.symbol, reason: '基础数据缺失，无法检测轮动信号' } }
      }

      const quotesResult = await dataBridge.query<DailyQuotes>({ action: ENVELOPE_ACTION.queryGet, store: STORE_NAME.dailyQuotes, key: score.symbol }).catch(() => ({ success: false as const, error: 'query failed' }))
      const quotes = quotesResult.success ? quotesResult.data : undefined
      if (!quotes || quotes.history.length < 25) {
        return { signal: undefined, watchlist: { symbol: score.symbol, reason: '行情数据不足，无法检测量价条件' } }
      }

      const closes = quotes.history.map((b) => b.close)
      const volumes = quotes.history.map((b) => b.volume)

      const recentVolumes = volumes.slice(-5)
      const priorVolumes = volumes.slice(-25, -5)

      const recentAvgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
      const priorAvgVolume = priorVolumes.length > 0
        ? priorVolumes.reduce((a, b) => a + b, 0) / priorVolumes.length
        : 0
      const volumeRatio = priorAvgVolume > 0 ? recentAvgVolume / priorAvgVolume : 0

      const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
      const latestPrice = closes[closes.length - 1]!
      const priceToMA20 = ma20 > 0 ? latestPrice / ma20 : 0

      const sector = stock.sector ?? stock.industryCode ?? ''
      const rotationScoresResult = await dataBridge.query<RotationSectorScore[]>({ action: ENVELOPE_ACTION.queryByIndex, store: STORE_NAME.rotationScores, indexName: 'by-sector', indexValue: sector }).catch(() => ({ success: false as const, error: 'query failed' }))
      const rotationScores = rotationScoresResult.success ? (rotationScoresResult.data ?? []) : []
      const latestRotation = rotationScores.length > 0
        ? rotationScores.sort((a, b) => b.scoreDate.localeCompare(a.scoreDate))[0]
        : undefined

      const fundFlowOk = latestRotation !== undefined && latestRotation.f2Zijin >= 20

      const volumeOk = volumeRatio >= ruleConfig.rotationVolumeSurgeRatio
      const priceOk = priceToMA20 >= ruleConfig.rotationPriceToMA20Threshold

      if (volumeOk && priceOk && fundFlowOk) {
        return {
          signal: {
            id: `rot-${score.symbol}-${nanoid(8)}`,
            symbol: score.symbol,
            direction: 'buy',
            type: 'buy_rotation',
            strategy: 'rotation',
            confidence: Math.min(1, Math.round(score.score) / 5),
            rationale: `轮动信号触发：量比 ${volumeRatio.toFixed(2)}，价格/MA20 ${priceToMA20.toFixed(3)}，板块资金因子 ${latestRotation?.f2Zijin ?? 0}`,
            snapshot: {
              pePercentile: score.dimensions.valuation,
              volumeRatio,
            },
            createdAt: Date.now(),
          },
          watchlist: undefined,
        }
      } else {
        const reasons: string[] = []
        if (!volumeOk) reasons.push(`量比 ${volumeRatio.toFixed(2)} 低于阈值 ${ruleConfig.rotationVolumeSurgeRatio}`)
        if (!priceOk) reasons.push(`价格/MA20 ${priceToMA20.toFixed(3)} 低于阈值 ${ruleConfig.rotationPriceToMA20Threshold}`)
        if (!fundFlowOk) reasons.push('板块资金流入不足')
        return { signal: undefined, watchlist: { symbol: score.symbol, reason: reasons.join('；') } }
      }
    }),
  )

  for (const r of candidateResults) {
    if (r.status === 'fulfilled' && r.value) {
      if (r.value.signal) signals.push(r.value.signal)
      if (r.value.watchlist) watchlistCandidates.push(r.value.watchlist)
    }
  }

  return { success: true, data: { signals, watchlistCandidates } }
}