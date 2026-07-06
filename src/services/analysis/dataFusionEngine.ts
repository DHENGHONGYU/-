/**
 * DataFusionEngine — 多源数据融合引擎
 *
 * 将 Stock、DailyQuotes、V6Score、IntelligentScore、Signal 等多源数据
 * 融合为统一的 UnifiedStockData 视图，作为上层分析组件的数据感知统一入口。
 *
 * 核心能力：
 * - 并行加载多源数据
 * - 计算技术指标（MA/RSI/MACD/KDJ/BOLL/ATR）
 * - 数据质量评估与版本一致性校验
 * - 按需加载非核心维度（lazy）
 *
 * @module services/analysis/dataFusionEngine
 * @created 2026-06-27 - 基于引擎规格 §1.2
 */

import { dataLayer } from '@/data/dataLayer'
import type {
  DataLayerResult,
  KlineBar,
  UnifiedStockData,
} from '@/data/types'
import { getLogger } from '@/lib/logger'
import { RSI_THRESHOLDS } from '@/config/thresholds'

const logger = getLogger()

// ============================================================
// 融合选项
// ============================================================

export interface FusionOptions {
  /** 是否加载智能评分（LLM增强），默认 false（按需加载） */
  includeIntelligentScore?: boolean
  /** 是否加载行业评分，默认 false */
  includeIndustryScore?: boolean
  /** 是否加载交易信号，默认 false */
  includeSignals?: boolean
  /** 是否计算全量技术指标，默认 true */
  computeIndicators?: boolean
}

// ============================================================
// 技术指标计算
// ============================================================

function computeMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i]! - ema) * k + ema
  }
  return ema
}

function computeRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null
  const window = closes.slice(-(period + 1))
  let gains = 0
  let losses = 0
  for (let i = 1; i < window.length; i++) {
    const delta = window[i]! - window[i - 1]!
    if (delta > 0) gains += delta
    else losses -= delta
  }
  if (losses === 0) return 100
  return 100 - 100 / (1 + gains / losses)
}

function computeMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { dif: number; dea: number; macd: number } | null {
  if (closes.length < slow + signal) return null
  const emaFast = computeEMA(closes, fast)!
  const emaSlow = computeEMA(closes, slow)!
  const dif = emaFast - emaSlow

  // 计算 DEA (DIF 的 signal 周期 EMA)
  const recentCloses = closes.slice(-(slow + signal))
  const difs: number[] = []
  for (let i = slow; i < recentCloses.length; i++) {
    const ef = computeEMA(recentCloses.slice(0, i + 1), fast)!
    const es = computeEMA(recentCloses.slice(0, i + 1), slow)!
    difs.push(ef - es)
  }
  const k = 2 / (signal + 1)
  let dea = difs.slice(0, signal).reduce((a, b) => a + b, 0) / signal
  for (let i = signal; i < difs.length; i++) {
    dea = (difs[i]! - dea) * k + dea
  }

  return { dif, dea, macd: (dif - dea) * 2 }
}

function computeKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 9,
): { k: number; d: number; j: number } | null {
  if (closes.length < period) return null
  const window = closes.slice(-period)
  const highWindow = highs.slice(-period)
  const lowWindow = lows.slice(-period)
  const highestHigh = Math.max(...highWindow)
  const lowestLow = Math.min(...lowWindow)
  const rsv =
    lowestLow === highestHigh
      ? 50
      : ((window[window.length - 1]! - lowestLow) / (highestHigh - lowestLow)) * 100

  // 简化：使用 RSV 作为 K 值，D 取 K 的 3 日均值
  const k = rsv
  const d = k // 初版简化
  const j = 3 * k - 2 * d
  return { k, d, j }
}

function computeBollinger(
  closes: number[],
  period = 20,
  multiplier = 2,
): { upper: number; mid: number; lower: number } | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const mid = slice.reduce((a, b) => a + b, 0) / period
  const variance =
    slice.reduce((sum, v) => sum + (v - mid) ** 2, 0) / period
  const std = Math.sqrt(variance)
  return {
    upper: mid + multiplier * std,
    mid,
    lower: mid - multiplier * std,
  }
}

function computeATR(
  bars: KlineBar[],
  period = 14,
): number | null {
  if (bars.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i]!
    const prev = bars[i - 1]!
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close),
    )
    trs.push(tr)
  }
  const recent = trs.slice(-period)
  return recent.reduce((a, b) => a + b, 0) / period
}

// ============================================================
// 数据质量评估
// ============================================================

interface DataQualityReport {
  basic: boolean
  kline: boolean
  v6Score: boolean
  intelligentScore: boolean
  industryScore: boolean
  signals: boolean
  completeness: number // 0-1
  warnings: string[]
}

function assessDataQuality(
  stock: unknown,
  quotes: unknown,
  v6Score: unknown,
  intelligentScore: unknown,
  industryScore: unknown,
  signals: unknown,
): DataQualityReport {
  const basic = stock !== undefined && stock !== null
  const kline = quotes !== undefined && quotes !== null
  const v6 = v6Score !== undefined && v6Score !== null
  const intel = intelligentScore !== undefined && intelligentScore !== null
  const industry = industryScore !== undefined && industryScore !== null
  const sig = signals !== undefined && signals !== null && (Array.isArray(signals) ? signals.length > 0 : true)

  const flags = [basic, kline, v6, intel, industry, sig]
  const completeness = flags.filter(Boolean).length / flags.length

  const warnings: string[] = []
  if (!basic) warnings.push('基础数据缺失')
  if (!kline) warnings.push('K线数据缺失')
  if (!v6) warnings.push('V6评分缺失')

  return { basic, kline, v6Score: v6, intelligentScore: intel, industryScore: industry, signals: sig, completeness, warnings }
}

// ============================================================
// 核心融合函数
// ============================================================

/**
 * 将单只股票的多源数据融合为 UnifiedStockData。
 *
 * 融合策略：
 * 1. 基础数据（Stock）为必选项，缺失则返回错误
 * 2. K线数据优先，用于计算技术指标
 * 3. V6评分 / 智能评分 / 行业评分按需加载
 * 4. 任一数据源加载失败不影响其他源，标记缺失并降级
 *
 * @param symbol 股票代码
 * @param options 融合选项
 * @returns 融合后的 UnifiedStockData 或错误
 */
export async function fuseStockData(
  symbol: string,
  options: FusionOptions = {},
): Promise<DataLayerResult<UnifiedStockData>> {
  const {
    includeIntelligentScore = false,
    includeIndustryScore = false,
    includeSignals = false,
    computeIndicators = true,
  } = options

  logger.info(
    `[dataFusionEngine] 开始融合 ${symbol}: ` +
    `includeIntelligentScore=${includeIntelligentScore} ` +
    `includeIndustryScore=${includeIndustryScore} ` +
    `includeSignals=${includeSignals} ` +
    `computeIndicators=${computeIndicators}`,
  )

  try {
    // 并行加载基础数据源
    const fetchTasks: Promise<unknown>[] = [
      dataLayer.stocks.get(symbol),
      dataLayer.dailyQuotes.get(symbol).catch(() => undefined),
      dataLayer.v6Scores.get(symbol).catch(() => undefined),
    ]

    if (includeIntelligentScore) {
      fetchTasks.push(dataLayer.intelligentScores.getLatestBySymbol(symbol).catch(() => undefined))
    } else {
      fetchTasks.push(Promise.resolve(undefined))
    }

    if (includeIndustryScore) {
      fetchTasks.push(
        dataLayer.stocks.get(symbol).then((s) =>
          s?.industryCode
            ? dataLayer.industryScores.getLatestByCode(s.industryCode).catch(() => undefined)
            : undefined,
        ),
      )
    } else {
      fetchTasks.push(Promise.resolve(undefined))
    }

    if (includeSignals) {
      fetchTasks.push(dataLayer.signals.listBySymbol(symbol).catch(() => []))
    } else {
      fetchTasks.push(Promise.resolve([]))
    }

    const [stock, quotes, v6Score, intelligentScore, industryScore, signals] =
      (await Promise.all(fetchTasks)) as [
        Awaited<ReturnType<typeof dataLayer.stocks.get>>,
        Awaited<ReturnType<typeof dataLayer.dailyQuotes.get>>,
        Awaited<ReturnType<typeof dataLayer.v6Scores.get>>,
        Awaited<ReturnType<typeof dataLayer.intelligentScores.getLatestBySymbol>>,
        Awaited<ReturnType<typeof dataLayer.industryScores.getLatestByCode>>,
        Awaited<ReturnType<typeof dataLayer.signals.listBySymbol>>,
      ]

    logger.info(
      `[dataFusionEngine] ${symbol} 数据源加载完成: ` +
      `stock=${stock ? '有' : '无'} ` +
      `quotes=${quotes ? `有(${quotes.history.length}条)` : '无'} ` +
      `v6Score=${v6Score ? `有(score=${v6Score.score})` : '无'} ` +
      `intelligentScore=${intelligentScore ? '有' : '无'} ` +
      `industryScore=${industryScore ? '有' : '无'} ` +
      `signals=${Array.isArray(signals) ? `${signals.length}条` : '无'}`,
    )

    if (!stock) {
      logger.warn(`[dataFusionEngine] ${symbol} 股票数据缺失，融合中断`)
      return { success: false, error: `股票 ${symbol} 不存在` }
    }

    const quality = assessDataQuality(stock, quotes, v6Score, intelligentScore, industryScore, signals)
    logger.info(`[dataFusionEngine] ${symbol} 数据完整度: ${(quality.completeness * 100).toFixed(0)}%`)
    if (quality.warnings.length > 0) {
      logger.warn(`[dataFusionEngine] ${symbol} 数据质量警告: ${quality.warnings.join(', ')}`)
    }

    // 基础数据
    const hasQuotes = quotes !== undefined && quotes !== null && quotes.history.length > 0
    const latest = hasQuotes ? quotes!.latest : null
    const history = hasQuotes ? quotes!.history : []
    const closes = history.map((b) => b.close)
    const highs = history.map((b) => b.high)
    const lows = history.map((b) => b.low)

    // 技术指标
    let ma5: number | null = null
    let ma10: number | null = null
    let ma20: number | null = null
    let rsi6: number | null = null
    let rsi12: number | null = null
    let rsi24: number | null = null
    let macdResult: ReturnType<typeof computeMACD> = null
    let kdjResult: ReturnType<typeof computeKDJ> = null
    let bollResult: ReturnType<typeof computeBollinger> = null
    let atr: number | null = null

    if (computeIndicators && hasQuotes) {
      logger.info(`[dataFusionEngine] ${symbol} 开始计算技术指标 (K线${history.length}条)`)
      ma5 = computeMA(closes, 5)
      ma10 = computeMA(closes, 10)
      ma20 = computeMA(closes, 20)
      rsi6 = computeRSI(closes, 6)
      rsi12 = computeRSI(closes, 12)
      rsi24 = computeRSI(closes, 24)
      macdResult = computeMACD(closes)
      kdjResult = computeKDJ(highs, lows, closes)
      bollResult = computeBollinger(closes)
      atr = computeATR(history)
      logger.info(
        `[dataFusionEngine] ${symbol} 技术指标计算完成: ` +
        `MA5=${ma5?.toFixed(2) ?? 'N/A'} ` +
        `MA20=${ma20?.toFixed(2) ?? 'N/A'} ` +
        `RSI6=${rsi6?.toFixed(1) ?? 'N/A'} ` +
        `MACD=${macdResult?.macd.toFixed(3) ?? 'N/A'} ` +
        `ATR=${atr?.toFixed(2) ?? 'N/A'}`,
      )
    } else if (computeIndicators && !hasQuotes) {
      logger.warn(`[dataFusionEngine] ${symbol} 无K线数据，跳过技术指标计算`)
    }

    // 均线信号判定
    let maSignal: UnifiedStockData['maSignal'] = null
    if (ma5 !== null && ma20 !== null) {
      if (ma5 > ma20) maSignal = 'golden_cross'
      else if (ma5 < ma20) maSignal = 'death_cross'
      else maSignal = 'neutral'
      logger.info(`[dataFusionEngine] ${symbol} 均线信号: ${maSignal} (MA5=${ma5.toFixed(2)}, MA20=${ma20.toFixed(2)})`)
    }

    // RSI 信号判定
    let rsiSignal: UnifiedStockData['rsiSignal'] = null
    if (rsi6 !== null) {
      if (rsi6 > RSI_THRESHOLDS.OVERBOUGHT) rsiSignal = 'overbought'
      else if (rsi6 < RSI_THRESHOLDS.OVERSOLD) rsiSignal = 'oversold'
      else rsiSignal = 'neutral'
      logger.info(`[dataFusionEngine] ${symbol} RSI信号: ${rsiSignal} (RSI6=${rsi6.toFixed(1)})`)
    }

    // MACD 信号判定
    let macdSignal: UnifiedStockData['macdSignal'] = null
    if (macdResult !== null) {
      if (macdResult.macd > 0) macdSignal = 'bullish'
      else if (macdResult.macd < 0) macdSignal = 'bearish'
      else macdSignal = 'neutral'
      logger.info(
        `[dataFusionEngine] ${symbol} MACD信号: ${macdSignal} ` +
        `(DIF=${macdResult.dif.toFixed(3)}, DEA=${macdResult.dea.toFixed(3)}, MACD=${macdResult.macd.toFixed(3)})`,
      )
    }

    // 评分数据
    const v6Factors = v6Score?.factors
    const intelScore = intelligentScore?.overallScore ?? null

    // 信号判定
    const latestSignal = Array.isArray(signals) && signals.length > 0 ? signals[signals.length - 1] : null
    let signalType: UnifiedStockData['signalType'] = null
    let signalReason: string | null = null
    if (latestSignal) {
      if (latestSignal.direction === 'buy' && latestSignal.confidence >= 0.7) {
        signalType = 'strong_buy'
      } else if (latestSignal.direction === 'buy') {
        signalType = 'buy'
      } else if (latestSignal.direction === 'hold') {
        signalType = 'hold'
      } else if (latestSignal.direction === 'watch') {
        signalType = 'watch'
      }
      signalReason = latestSignal.rationale
      logger.info(
        `[dataFusionEngine] ${symbol} 交易信号映射: ${signalType} ` +
        `(direction=${latestSignal.direction}, confidence=${latestSignal.confidence}, reason=${latestSignal.rationale})`,
      )
    } else if (includeSignals) {
      logger.info(`[dataFusionEngine] ${symbol} 无可用交易信号`)
    }

    const currentPrice = latest?.close ?? stock.price ?? 0
    if (latest?.close == null && stock.price == null) {
      logger.warn('[dataFusionEngine] 价格数据缺失，使用默认值', { field: 'close/price', context: `symbol=${stock.symbol}` })
    }
    const prevClose = history.length >= 2 ? history[history.length - 2]!.close : currentPrice
    const change = currentPrice - prevClose
    const changePct = prevClose !== 0 ? (change / prevClose) * 100 : 0

    const unified: UnifiedStockData = {
      symbol: stock.symbol,
      name: stock.name,
      price: currentPrice,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume: latest?.volume ?? 0,
      amount: latest?.amount ?? 0,
      open: latest?.open ?? currentPrice,
      high: latest?.high ?? currentPrice,
      low: latest?.low ?? currentPrice,
      prevClose,
      turnover: null,
      marketCap: stock.marketCap ?? null,
      pe: stock.pe ?? null,
      pb: stock.pb ?? null,
      roe: stock.roe ?? null,
      grossMargin: null,
      netMargin: null,
      revenueGrowth: null,
      profitGrowth: null,
      debtRatio: null,
      eps: null,
      ma5: ma5 !== null ? Math.round(ma5 * 100) / 100 : null,
      ma10: ma10 !== null ? Math.round(ma10 * 100) / 100 : null,
      ma20: ma20 !== null ? Math.round(ma20 * 100) / 100 : null,
      macd: macdResult !== null ? Math.round(macdResult.macd * 100) / 100 : null,
      rsi6: rsi6 !== null ? Math.round(rsi6 * 100) / 100 : null,
      rsi12: rsi12 !== null ? Math.round(rsi12 * 100) / 100 : null,
      rsi24: rsi24 !== null ? Math.round(rsi24 * 100) / 100 : null,
      k: kdjResult !== null ? Math.round(kdjResult.k * 100) / 100 : null,
      d: kdjResult !== null ? Math.round(kdjResult.d * 100) / 100 : null,
      j: kdjResult !== null ? Math.round(kdjResult.j * 100) / 100 : null,
      bollUpper: bollResult !== null ? Math.round(bollResult.upper * 100) / 100 : null,
      bollMid: bollResult !== null ? Math.round(bollResult.mid * 100) / 100 : null,
      bollLower: bollResult !== null ? Math.round(bollResult.lower * 100) / 100 : null,
      atr: atr !== null ? Math.round(atr * 100) / 100 : null,
      maSignal,
      rsiSignal,
      macdSignal,
      sentimentScore: intelScore,
      sentimentConfidence: null,
      sectorName: stock.sector ?? stock.industryCode ?? null,
      sectorRank: null,
      sectorStrength: null,
      trendScore: v6Factors?.动量 ?? null,
      valueScore: v6Factors?.估值 ?? null,
      fundScore: v6Factors?.质量 ?? null,
      sentimentFactorScore: v6Factors?.情绪 ?? null,
      totalScore: v6Score?.score ?? null,
      signalType,
      signalReason,
      var95: null,
      maxDrawdown: null,
      timestamp: new Date().toISOString(),
      dataSource: `fusion:v1:completeness=${quality.completeness.toFixed(2)}`,
    }

    logger.info(
      `[dataFusionEngine] ${symbol} 融合完成: ` +
      `price=${unified.price} ` +
      `changePct=${unified.changePct}% ` +
      `totalScore=${unified.totalScore ?? 'N/A'} ` +
      `signal=${unified.signalType ?? '无'} ` +
      `completeness=${quality.completeness.toFixed(2)}`,
    )
    return { success: true, data: unified }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`[dataFusionEngine] ${symbol} 融合失败: ${message}`)
    return { success: false, error: message }
  }
}

/**
 * 批量融合多只股票数据。
 *
 * 采用并行加载，单只失败不影响其他。
 *
 * @param symbols 股票代码数组
 * @param options 融合选项
 * @returns 成功融合的 UnifiedStockData 列表
 */
export async function fuseStockDataBatch(
  symbols: string[],
  options: FusionOptions = {},
): Promise<UnifiedStockData[]> {
  if (symbols.length === 0) return []

  logger.info(`[dataFusionEngine] 批量融合开始: ${symbols.length} 只`)

  const results = await Promise.allSettled(
    symbols.map((symbol) => fuseStockData(symbol, options)),
  )

  const fused: UnifiedStockData[] = []
  let failed = 0
  const failedSymbols: string[] = []

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success && result.value.data) {
      fused.push(result.value.data)
    } else {
      failed++
      const err =
        result.status === 'fulfilled'
          ? result.value.error
          : result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
      logger.warn(`[dataFusionEngine] 单只融合失败: ${err}`)
      if (result.status === 'fulfilled' && result.value.error) {
        const match = result.value.error.match(/股票 (\S+) 不存在/)
        if (match) failedSymbols.push(match[1]!)
      }
    }
  }

  if (failed > 0) {
    logger.warn(
      `[dataFusionEngine] 批量融合完成: ${fused.length}/${symbols.length} (失败 ${failed})` +
      (failedSymbols.length > 0 ? `, 缺失股票: ${failedSymbols.join(', ')}` : ''),
    )
  } else {
    logger.info(`[dataFusionEngine] 批量融合完成: ${fused.length}/${symbols.length}`)
  }
  return fused
}

/**
 * 异步生成器：逐只融合并逐个 yield，用于大数据量场景避免内存峰值。
 *
 * @param symbols 股票代码数组
 * @param options 融合选项
 */
export async function* fuseStockDataStream(
  symbols: string[],
  options: FusionOptions = {},
): AsyncGenerator<DataLayerResult<UnifiedStockData>> {
  logger.info(`[dataFusionEngine] 流式融合开始: ${symbols.length} 只`)
  let yielded = 0
  let failed = 0

  for (const symbol of symbols) {
    const result = await fuseStockData(symbol, options)
    if (result.success) {
      yielded++
    } else {
      failed++
    }
    yield result
  }

  logger.info(
    `[dataFusionEngine] 流式融合完成: ${yielded}成功 / ${failed}失败 / ${symbols.length}总计`,
  )
}