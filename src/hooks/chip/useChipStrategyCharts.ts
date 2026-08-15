/**
 * @fileoverview 筹码策略复盘页 — K线图 + 筹码分布图数据 Hook
 *
 * 根据 symbol 变化自动加载：
 * 1. K 线数据（通过 collectKline 调用 /api/collect/kline）
 * 2. 筹码分布数据（通过 /api/collect/chip，后端不可用时基于用户输入生成模拟数据）
 *
 * 图表随选中股票变动而变动。
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { collectKline } from '@/services/fetcher/fetcherClient'
import { API_COLLECT_CHIP } from '@/config/apiPaths'
import { getLogger } from '@/lib/logger'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import { sendWriteEnvelope } from '@/data/dataLayerHelpers'
import type { ResearchLog } from '@/data/types/types.signal'
// 内联常量定义（原 @/constants/defaults 模块不存在）
const DEFAULT_NUMERIC = 0
const EMPTY_STRING = ''
import type {
  CollectResponse,
  CollectChipData,
  CollectChipRequest,
} from '@/services/fetcher/fetcherTypes'
import type { CandlestickChartData, ChipTradePoint } from '@/components/chart'
import type { ChartMarker } from '@/types/modules/buySellPoint.types'

const logger = getLogger()

// ============================================================
// 日志前缀（便于控制台筛选）
// ============================================================

const LOG_TAG = '[ChipStrategyCharts]'

/** Deterministic random constants for mock kline generation */
const LCG_SEED_MULTIPLIER_1 = 9301
const LCG_SEED_INCREMENT_1 = 49297
const LCG_SEED_MULTIPLIER_2 = 3591
const LCG_SEED_INCREMENT_2 = 12917
const LCG_SEED_MODULUS = 233280
const PRICE_DRIFT_FACTOR = 0.04
const MOCK_BASE_VOLUME = 500000
const MOCK_VOLUME_RANGE = 2000000
const LOW_POSITION_PEAK_OFFSET = -0.15

// ============================================================
// 兜底事件后端日志上报（持久化到 IndexedDB research_logs store）
// ============================================================

/**
 * 将兜底触发/降级事件写入后端审计日志（research_logs store）。
 *
 * 与控制台日志（logger.*）的区别：
 * - logger.*：仅控制台打印，刷新后丢失
 * - reportFallbackEvent()：持久化到 IndexedDB，可通过 debug 工具或报告导出复盘
 *
 * 本函数 fire-and-forget，若写入失败静默降级（不影响主流程）。
 */
function reportFallbackEvent(
  context: {
    symbol: string
    eventType: 'kline_fallback' | 'chip_fallback' | 'chip_price_sanitize' | 'kline_price_sanitize'
    fallbackFrom: string | number
    fallbackTo: string | number
    reason: string
    extra?: Record<string, unknown>
  },
): void {
  try {
    const log: ResearchLog = {
      traceId: `chip-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      actor: 'ChipStrategyCharts',
      action: `fallback:${context.eventType}`,
      targetType: 'stock',
      targetCode: context.symbol,
      payload: JSON.stringify({
        module: 'useChipStrategyCharts',
        eventType: context.eventType,
        fallbackFrom: context.fallbackFrom,
        fallbackTo: context.fallbackTo,
        reason: context.reason,
        ...(context.extra ?? {}),
      } satisfies Record<string, unknown>),
    }
    // 异步 fire-and-forget，捕获写失败避免影响主流程
    void sendWriteEnvelope('saveResearchLog', log, 'analyzer').catch((err) => {
      logger.debug(`${LOG_TAG} [research_logs] 写入失败（忽略）`, {
        error: err instanceof Error ? err.message : String(err),
        event: context.eventType,
        symbol: context.symbol,
      })
    })
  } catch (err) {
    // 任何异常都不影响主流程
    logger.debug(`${LOG_TAG} [research_logs] 报告函数异常（忽略）`, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ============================================================
// K线响应适配
// ============================================================

function adaptKlineResponseToChartData(history: unknown[]): CandlestickChartData[] {
  return history.map((bar) => {
    const b = bar as {
      date: string
      open: number
      high: number
      low: number
      close: number
      volume: number
      amount: number
    }
    return {
      time: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }
  })
}

// ============================================================
// 模拟 K线数据生成（后端不可用时兜底）
// ============================================================

/**
 * 生成模拟 K 线数据（后端不可用时的兜底）。
 *
 * 单元不变量（由 `useChipStrategyCharts.test.ts` 固化）：
 * - 所有 K 线字段为有限正数（无 NaN/Infinity）
 * - close ≥ safeBase * 0.5（兜底后 safeBase ≥ 0.5）
 * - low ≥ safeBase * 0.3
 * - 时间序列长度 = days + 1（含今日）
 * - 同一 (symbol, basePrice) 输入确定性输出（同种子）
 *
 * @param symbol 股票代码（用于生成确定性种子）
 * @param basePrice 基准价格，非法值（≤0/NaN）会被兜底为 0.5
 * @param days 生成天数（不含今日），默认 60
 */
export function generateDemoKlineData(
  symbol: string,
  basePrice: number,
  days = 60,
): CandlestickChartData[] {
  // === 兜底：basePrice 必须 > 0，否则所有计算为 0 ===
  // 注意：`??` 无法捕获 NaN，这里显式 Number.isFinite 校验
  const normalizedBase = Number.isFinite(basePrice) ? (basePrice) : DEFAULT_NUMERIC
  const safeBase = Math.max(0.5, normalizedBase)

  // 兜底触发日志（控制台 + IndexedDB 研究日志双写）
  if (basePrice !== safeBase) {
    logger.warn(`${LOG_TAG} [兜底] generateDemoKlineData 触发兜底`, {
      originalBasePrice: basePrice,
      safeBasePrice: safeBase,
      symbol,
      reason: `basePrice 非法(${basePrice}→${safeBase})`,
    })
    reportFallbackEvent({
      symbol,
      eventType: 'kline_price_sanitize',
      fallbackFrom: basePrice,
      fallbackTo: safeBase,
      reason: `K线模拟数据生成：basePrice 非法(${basePrice}→${safeBase})`,
    })
  }

  const data: CandlestickChartData[] = []
  let prevClose = safeBase
  const today = new Date()

  for (let i = days; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)

    // 基于股票代码生成确定性随机
    const seed = hashString(symbol + dateStr)
    const rand1 = ((seed * LCG_SEED_MULTIPLIER_1 + LCG_SEED_INCREMENT_1) % LCG_SEED_MODULUS) / LCG_SEED_MODULUS
    const rand2 = ((seed * LCG_SEED_MULTIPLIER_2 + LCG_SEED_INCREMENT_2) % LCG_SEED_MODULUS) / LCG_SEED_MODULUS

    const drift = (rand1 - 0.5) * safeBase * PRICE_DRIFT_FACTOR
    const open = prevClose
    const close = Math.max(safeBase * 0.5, prevClose + drift)
    const high = Math.max(open, close) + Math.abs(drift) * 0.5 + rand2 * safeBase * 0.01
    const low = Math.min(open, close) - Math.abs(drift) * 0.5 - rand2 * safeBase * 0.01
    const volume = Math.round(MOCK_BASE_VOLUME + rand1 * MOCK_VOLUME_RANGE)

    data.push({
      time: dateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(Math.max(low, safeBase * 0.3) * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    })
    prevClose = close
  }

  return data
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// ============================================================
// 模拟筹码分布数据生成（后端不可用时兜底）
// ============================================================

/**
 * 生成模拟筹码分布数据（后端不可用时的兜底）。
 *
 * 单位契约（由 `useChipStrategyCharts.test.ts` 固化，2026-08-11 单位 Bug 教训）：
 * - `chipPercent`：**0-100 百分比**，sum ≈ 100，单个 bin 最大约 5-15%
 * - `profitRatio`：**0-100 百分比**（ChipDistributionChart L109 `loss = 100 - profit` 依赖此约定）
 * - `concentration`：**0-100 百分比**（组件 L185 +% 后缀，无 *100 转换）
 * - `coverageRatio`：**0-100 百分比**（组件 L114 阈值 80，非 0.8）
 * - `avgTurnoverRate` / `maxTurnoverRate`：**0-100 百分比**（组件 L204-205 直接 +% 后缀）
 *
 * 禁止将上述字段改成 0-1 小数。若后端真实数据是小数（如 profitRatio=0.75），
 * 应在适配层（如 useChipStrategyCharts 的 .then(real)）做 *100 转换，
 * 而非在本模拟函数中保留小数。
 *
 * 兜底逻辑：
 * - `currentPrice` ≤0/NaN → 兜底为 0.01
 * - `turnover` ≤0/NaN → 兜底为 0.001（避免能量计算为 0）
 * - `range` = max(0.02, safePrice * 0.4)，避免除零
 * - `sigma` = max(0.01, range / 6)，避免高斯分布除零
 * - `priceMax` = max(priceMin + 0.01, ...)，保证 priceMax > priceMin
 * - 归一化时 `safeSum = sum > 0 ? sum : 1`，避免除零
 *
 * @param currentPrice 当前价格（元）
 * @param turnover 换手率（百分比，0-100）
 * @param return60d 60 日收益率（百分比）
 * @param symbol 关联股票代码（可选，仅用于日志关联）
 */
export function generateDemoChipData(
  currentPrice: number,
  turnover: number,
  return60d: number,
  symbol?: string,
): CollectChipData {
  // === 兜底：防止 currentPrice=0/负数/NaN 导致除零/NaN ===
  // 注意：`??` 无法捕获 NaN，这里显式 Number.isFinite 校验
  const normalizedPrice = Number.isFinite(currentPrice) ? (currentPrice) : DEFAULT_NUMERIC
  const safePrice = Math.max(0.01, normalizedPrice)
  // === 兜底：turnover=0/NaN 时使用极小值，防止能量计算为 0 ===
  const normalizedTurnover = Number.isFinite(turnover) ? (turnover) : DEFAULT_NUMERIC
  const safeTurnover = Math.max(0.001, normalizedTurnover)
  // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
  const logSymbol = symbol ?? 'unknown'

  // 兜底触发日志（控制台 + IndexedDB 研究日志双写）
  if (currentPrice !== safePrice || turnover !== safeTurnover) {
    const reasons = [
      currentPrice !== safePrice ? `价格非法(${currentPrice}→${safePrice})` : null,
      turnover !== safeTurnover ? `换手率非法(${turnover}→${safeTurnover})` : null,
    ].filter(Boolean) as string[]
    logger.warn(`${LOG_TAG} [兜底] generateDemoChipData 触发兜底`, {
      originalPrice: currentPrice,
      safePrice,
      originalTurnover: turnover,
      safeTurnover,
      return60d,
      reasons,
    })
    if (currentPrice !== safePrice) {
      reportFallbackEvent({
        symbol: logSymbol,
        eventType: 'chip_price_sanitize',
        fallbackFrom: currentPrice,
        fallbackTo: safePrice,
        reason: `筹码模拟数据生成：${reasons.join('、')}`,
        extra: { originalTurnover: turnover, return60d },
      })
    }
  }

  const binCount = 30
  const range = Math.max(0.02, safePrice * 0.4) // 至少 0.02，避免 range=0
  const priceMin = Math.max(0.01, safePrice - range / 2)
  const priceMax = Math.max(priceMin + 0.01, safePrice + range / 2) // 保证 priceMax > priceMin
  const binSize = (priceMax - priceMin) / binCount

  const priceBins: number[] = []
  const chipPercent: number[] = []

  // 基于位置（60日收益率）生成筹码分布形态
  // 低位：筹码集中在当前价格下方（套牢盘多）
  // 高位：筹码集中在当前价格上方（获利盘多）
  const isLow = return60d < 0
  const peakOffset = isLow ? LOW_POSITION_PEAK_OFFSET : 0.15

  // === 兜底：sigma 至少 0.01，防止高斯分布除零 ===
  const sigma = Math.max(0.01, range / 6)
  const peakPrice = safePrice * (1 + peakOffset)
  const sigmaSq2 = 2 * sigma * sigma
  const sigmaSq2Current = 2 * sigma * sigma * 0.3

  for (let i = 0; i < binCount; i++) {
    const price = priceMin + i * binSize + binSize / 2
    priceBins.push(Math.round(price * 100) / 100)

    // 高斯分布（已保证 sigma > 0，不会除零）
    const gauss = Math.exp(-Math.pow(price - peakPrice, 2) / sigmaSq2)
    // 当前价格附近的筹码峰
    const currentPeak = Math.exp(-Math.pow(price - safePrice, 2) / sigmaSq2Current)
    const pct = gauss * 0.6 + currentPeak * 0.4
    chipPercent.push(Math.round(pct * 10000) / 10000)
  }

  // === 兜底：归一化时防止 sum=0 除零 ===
  // 注意：ChipDistributionChart 组件预期 chipPercent 是 0-100 的**百分比**（不是 0-1 小数）
  // L98: Math.max(...chipPercent, 1) — 说明正常 bin 百分比应该大于 1
  const sum = chipPercent.reduce((a, b) => a + b, 0)
  const safeSum = sum > 0 ? sum : 1
  for (let i = 0; i < chipPercent.length; i++) {
    // 归一化 → * 100 转换为百分比，最大 bin 约为 5-15%
    chipPercent[i] = Math.round((chipPercent[i]! / safeSum) * 100 * 100) / 100
  }

  const avgCost = Math.round(safePrice * (1 + peakOffset) * 100) / 100
  // === 兜底：profitRatio 计算时 safePrice 不会为 0 ===
  // 注意：组件预期 profitRatio、concentration、coverageRatio 都是 0-100 的百分比（不是 0-1 小数）
  // L109: loss = 100 - profit，且阈值 profit >= 60（不是 0.6）
  const profitRatioRaw = isLow
    ? Math.max(0, 1 - (safePrice - avgCost) / safePrice)
    : Math.max(0, (safePrice - avgCost) / safePrice + 0.3)
  const profitRatio = Math.min(100, Math.max(0, profitRatioRaw * 100))

  return {
    priceBins,
    chipPercent,
    costLow: Math.round((priceMin + range * 0.1) * 100) / 100,
    costHigh: Math.round((priceMin + range * 0.9) * 100) / 100,
    costCenter: avgCost,
    profitRatio: Math.round(profitRatio * 10) / 10,
    avgCost,
    concentration: 40, // 0-100 百分比
    currentPrice: safePrice,
    currentPricePosition: 0.5,
    priceMin,
    priceMax,
    floatShares: null,
    barsUsed: binCount,
    avgTurnoverRate: safeTurnover,
    maxTurnoverRate: safeTurnover * 1.5,
    coverageRatio: 75, // 0-100 百分比
  }
}

// ============================================================
// 主 Hook
// ============================================================

export interface ChipStrategyChartData {
  /** K 线数据 */
  klineData: CandlestickChartData[]
  /** K 线加载中 */
  klineLoading: boolean
  /** K 线数据源 */
  klineDataSource: 'real' | 'demo' | 'loading' | 'empty'
  /** 筹码分布数据 */
  chipData: CollectChipData | null
  /** 筹码数据加载中 */
  chipLoading: boolean
  /** 筹码数据源 */
  chipDataSource: 'real' | 'demo' | 'loading' | 'empty'
  /** K 线图买卖点 markers */
  markers: ChartMarker[]
  /** 筹码图买卖点标注 */
  chipTradePoints: ChipTradePoint[]
  /** 强制刷新 */
  refresh: () => void
}

export function useChipStrategyCharts(
  symbol: string | null,
  basePrice: number | undefined,
  turnover: number | undefined,
  return60d: number | undefined,
  tradeAction?: string,
): ChipStrategyChartData {
  const [klineData, setKlineData] = useState<CandlestickChartData[]>([])
  const [klineLoading, setKlineLoading] = useState(false)
  const [klineDataSource, setKlineDataSource] = useState<'real' | 'demo' | 'loading' | 'empty'>('loading')
  const [chipData, setChipData] = useState<CollectChipData | null>(null)
  const [chipLoading, setChipLoading] = useState(false)
  const [chipDataSource, setChipDataSource] = useState<'real' | 'demo' | 'loading' | 'empty'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // === K线数据加载 ===
  useEffect(() => {
    if (!symbol) {
      logger.info(`${LOG_TAG} [K线] symbol 为空，跳过加载`)
      setKlineData([])
      setKlineDataSource('empty')
      return
    }

    logger.info(`${LOG_TAG} [K线] 开始加载`, {
      symbol,
      period: 'daily',
      adjust: 'qfq',
      count: 120,
      basePrice,
      refreshKey,
    })

    let cancelled = false
    const startTs = Date.now()
    setKlineLoading(true)
    setKlineDataSource('loading')

    collectKline({
      symbol,
      period: 'daily',
      adjust: 'qfq',
      count: 120,
    })
      .then((response) => {
        if (cancelled) {
          logger.debug(`${LOG_TAG} [K线] 响应到达但已取消`, { symbol })
          return
        }
        const durationMs = Date.now() - startTs
        logger.info(`${LOG_TAG} [K线] 响应到达`, {
          symbol,
          success: response.success,
          durationMs,
          hasHistory: !!response.data?.history,
          historyCount: response.data?.history?.length ?? 0,
          error: response.error,
        })

        if (response.success && response.data?.history && response.data.history.length > 0) {
          const chartData = adaptKlineResponseToChartData(response.data.history)
          logger.info(`${LOG_TAG} [K线] 数据适配完成 → real`, {
            symbol,
            bars: chartData.length,
            firstDate: chartData[0]?.time,
            lastDate: chartData[chartData.length - 1]?.time,
            lastClose: chartData[chartData.length - 1]?.close,
          })
          setKlineData(chartData)
          setKlineDataSource('real')
        } else {
          // 后端无数据，生成模拟 K线
          const price = basePrice ?? 10
          logger.warn(`${LOG_TAG} [K线] 后端返回空数据，降级为模拟数据`, {
            symbol,
            success: response.success,
            hasHistory: !!response.data?.history,
            historyCount: response.data?.history?.length ?? 0,
            error: response.error,
            fallbackBasePrice: price,
          })
          reportFallbackEvent({
            symbol,
            eventType: 'kline_fallback',
            fallbackFrom: 'real_data',
            fallbackTo: 'demo_data',
            reason: `后端返回空数据（success=${response.success}，history=${response.data?.history?.length ?? 0}），error=${response.error ?? '无'}`,
          })
          setKlineData(generateDemoKlineData(symbol, price))
          setKlineDataSource('demo')
        }
      })
      .catch((err) => {
        if (cancelled) return
        const durationMs = Date.now() - startTs
        const errorMsg = err instanceof Error ? err.message : String(err)
        const errorStack = err instanceof Error ? err.stack : undefined
        logger.error(`${LOG_TAG} [K线] 加载失败，降级为模拟数据`, {
          symbol,
          durationMs,
          error: errorMsg,
          stack: errorStack,
          fallbackBasePrice: basePrice ?? 10,
        })
        reportFallbackEvent({
          symbol,
          eventType: 'kline_fallback',
          fallbackFrom: 'real_data',
          fallbackTo: 'demo_data',
          reason: `K线加载异常：${errorMsg}`,
          extra: { durationMs, stack: errorStack },
        })
        const price = basePrice ?? 10
        setKlineData(generateDemoKlineData(symbol, price))
        setKlineDataSource('demo')
      })
      .finally(() => {
        if (!cancelled) {
          setKlineLoading(false)
          logger.debug(`${LOG_TAG} [K线] 加载流程结束`, {
            symbol,
            totalDurationMs: Date.now() - startTs,
          })
        }
      })

    return () => {
      cancelled = true
      logger.debug(`${LOG_TAG} [K线] effect cleanup（symbol 变化或组件卸载）`, { symbol })
    }
  }, [symbol, basePrice, refreshKey])

  // === 筹码分布数据加载 ===
  useEffect(() => {
    if (!symbol) {
      logger.info(`${LOG_TAG} [筹码] symbol 为空，跳过加载`)
      setChipData(null)
      setChipDataSource('empty')
      return
    }

    logger.info(`${LOG_TAG} [筹码] 开始加载`, {
      symbol,
      endpoint: API_COLLECT_CHIP,
      count: 1000,
      price_bins: 30,
      basePrice,
      turnover,
      return60d,
      refreshKey,
    })

    let cancelled = false
    const startTs = Date.now()
    setChipLoading(true)
    setChipDataSource('loading')

    const reqBody: CollectChipRequest = {
      symbol,
      count: 1000,
      price_bins: 30,
    }

    fetch(API_COLLECT_CHIP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    })
      .then(async (resp) => {
        if (cancelled) {
          logger.debug(`${LOG_TAG} [筹码] 响应到达但已取消`, { symbol })
          return
        }
        const durationMs = Date.now() - startTs
        logger.info(`${LOG_TAG} [筹码] HTTP 响应到达`, {
          symbol,
          httpStatus: resp.status,
          httpOk: resp.ok,
          durationMs,
          contentType: resp.headers.get('content-type'),
        })

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
        }

        const json = (await resp.json()) as CollectResponse<CollectChipData>
        logger.info(`${LOG_TAG} [筹码] JSON 解析完成`, {
          symbol,
          success: json.success,
          hasData: !!json.data,
          error: json.error,
          binsCount: json.data?.priceBins.length ?? 0,
          coverageRatio: json.data?.coverageRatio,
          barsUsed: json.data?.barsUsed,
        })

        if (json.success && json.data) {
          // === 真实后端数据剖面日志（与模拟数据一致，便于对比单位）===
          const realChip = json.data
          const pctSum = realChip.chipPercent.reduce((a, b) => a + b, 0)
          const pctMax = realChip.chipPercent.length ? Math.max(...realChip.chipPercent) : 0
          const pctMin = realChip.chipPercent.length ? Math.min(...realChip.chipPercent) : 0
          logger.info(`${LOG_TAG} [数据剖面] 真实筹码数据 (real)`, {
            symbol,
            binsCount: realChip.priceBins.length,
            chipPercent: {
              sum: pctSum,
              max: pctMax,
              min: pctMin,
            },
            stats: {
              profitRatio: realChip.profitRatio,
              concentration: realChip.concentration,
              coverageRatio: realChip.coverageRatio,
              currentPrice: realChip.currentPrice,
              avgCost: realChip.avgCost,
            },
            interpretation: {
              chipSumCloseTo100: '如果 sum≈100，则 chipPercent 是百分比（0-100）',
              chipSumCloseTo1: '如果 sum≈1，则 chipPercent 是小数（0-1）',
              profitGt1: '如果 profitRatio>1 则是百分比，<1 则是小数',
              coverageGt1: '如果 coverageRatio>1 则是百分比，<1 则是小数',
            },
          })
          logger.info(`${LOG_TAG} [筹码] 数据校验通过 → real`, {
            symbol,
            currentPrice: realChip.currentPrice,
            avgCost: realChip.avgCost,
            profitRatio: realChip.profitRatio,
            concentration: realChip.concentration,
            coverageRatio: realChip.coverageRatio,
            barsUsed: realChip.barsUsed,
          })
          setChipData(realChip)
          setChipDataSource('real')
        } else {
          throw new Error(json.error ?? '后端返回 success=false 或无 data')
        }
      })
      .catch((err) => {
        if (cancelled) return
        const durationMs = Date.now() - startTs
        const errorMsg = err instanceof Error ? err.message : String(err)
        const errorStack = err instanceof Error ? err.stack : undefined
        logger.error(`${LOG_TAG} [筹码] 加载失败，降级为模拟数据`, {
          symbol,
          durationMs,
          error: errorMsg,
          stack: errorStack,
          fallbackParams: {
            basePrice: basePrice ?? 10,
            turnover: turnover ?? 3,
            return60d: return60d ?? DEFAULT_NUMERIC,
          },
        })
        reportFallbackEvent({
          symbol,
          eventType: 'chip_fallback',
          fallbackFrom: 'real_data',
          fallbackTo: 'demo_data',
          reason: `筹码加载异常：${errorMsg}`,
          extra: {
            durationMs,
            stack: errorStack,
            fallbackParams: {
              basePrice: basePrice ?? 10,
              turnover: turnover ?? 3,
              return60d: return60d ?? DEFAULT_NUMERIC,
            },
          },
        })
        // 后端不可用，基于用户输入生成模拟筹码数据
        const price = basePrice ?? 10
        const t = turnover ?? 3
        const r60 = return60d ?? DEFAULT_NUMERIC
        const demoChip = generateDemoChipData(price, t, r60, symbol)
        // === 数据剖面日志：排查渲染异常的关键证据 ===
        const pctSum = demoChip.chipPercent.reduce((a, b) => a + b, 0)
        const pctMax = Math.max(...demoChip.chipPercent)
        const pctMin = Math.min(...demoChip.chipPercent)
        logger.info(`${LOG_TAG} [数据剖面] 模拟筹码数据 (demo)`, {
          symbol,
          binsCount: demoChip.priceBins.length,
          priceBins_range: {
            min: demoChip.priceMin,
            max: demoChip.priceMax,
            first: demoChip.priceBins[0],
            last: demoChip.priceBins[demoChip.priceBins.length - 1],
          },
          chipPercent: {
            sum: pctSum,
            max: pctMax,
            min: pctMin,
            mean: pctSum / demoChip.chipPercent.length,
          },
          stats: {
            profitRatio: demoChip.profitRatio,
            concentration: demoChip.concentration,
            coverageRatio: demoChip.coverageRatio,
            currentPrice: demoChip.currentPrice,
            avgCost: demoChip.avgCost,
            avgTurnoverRate: demoChip.avgTurnoverRate,
            maxTurnoverRate: demoChip.maxTurnoverRate,
          },
          expectedUnit: {
            chipPercent: '0-100 百分比（sum≈100）',
            profitRatio: '0-100 百分比（组件 L109 loss=100-profit 验证）',
            concentration: '0-100 百分比（组件 L185 +% 后缀）',
            coverageRatio: '0-100 百分比（组件 L200 +% 后缀，阈值 >=80）',
            avgTurnoverRate: '百分比（组件 L204 +% 后缀）',
          },
          checks: {
            chipSumApprox100: Math.abs(pctSum - 100) < 2, // ±2% 容忍
            chipMaxGt1: pctMax > 1,                          // 保证条形有宽度
            profitRatioIn0_100: demoChip.profitRatio! >= 0 && demoChip.profitRatio! <= 100,
            coverageRatioIn0_100: demoChip.coverageRatio! >= 0 && demoChip.coverageRatio! <= 100,
          },
        })
        setChipData(demoChip)
        setChipDataSource('demo')
      })
      .finally(() => {
        if (!cancelled) {
          setChipLoading(false)
          logger.debug(`${LOG_TAG} [筹码] 加载流程结束`, {
            symbol,
            totalDurationMs: Date.now() - startTs,
          })
        }
      })

    return () => {
      cancelled = true
      logger.debug(`${LOG_TAG} [筹码] effect cleanup（symbol 变化或组件卸载）`, { symbol })
    }
  }, [symbol, basePrice, turnover, return60d, refreshKey])

  // === K线 markers（基于交易动作生成） ===
  const markers = useMemo(() => {
    if (klineData.length === 0) {
      logger.debug(`${LOG_TAG} [markers] K线数据为空，跳过生成`)
      return []
    }
    const lastBar = klineData[klineData.length - 1]!
    const today = lastBar.time

    if (!tradeAction || tradeAction === 'watch') {
      logger.debug(`${LOG_TAG} [markers] tradeAction=${tradeAction ?? EMPTY_STRING}，不生成 marker`)
      return []
    }

    if (tradeAction === 'buy') {
      logger.info(`${LOG_TAG} [markers] 生成买入标记`, {
        time: today,
        shape: 'arrowUp',
        color: STOCK_COLOR_TOKENS.up.hex,
      })
      return [{
        time: today,
        position: 'belowBar' as const,
        shape: 'arrowUp' as const,
        color: STOCK_COLOR_TOKENS.up.hex,
        text: '买',
        size: 2,
      }]
    }
    if (tradeAction === 'sell' || tradeAction === 'escape') {
      logger.info(`${LOG_TAG} [markers] 生成卖出标记`, {
        time: today,
        shape: 'arrowDown',
        action: tradeAction,
        color: STOCK_COLOR_TOKENS.down.hex,
      })
      return [{
        time: today,
        position: 'aboveBar' as const,
        shape: 'arrowDown' as const,
        color: STOCK_COLOR_TOKENS.down.hex,
        text: tradeAction === 'escape' ? '逃' : '卖',
        size: 2,
      }]
    }
    if (tradeAction === 'hold') {
      logger.info(`${LOG_TAG} [markers] 生成持有标记`, {
        time: today,
        shape: 'circle',
        color: STOCK_COLOR_TOKENS.neutral.hex,
      })
      return [{
        time: today,
        position: 'inBar' as const,
        shape: 'circle' as const,
        color: STOCK_COLOR_TOKENS.neutral.hex,
        text: '持',
        size: 1,
      }]
    }
    return []
  }, [klineData, tradeAction])

  // === 筹码图买卖点标注（基于当前价格 + 交易动作） ===
  const chipTradePoints = useMemo<ChipTradePoint[]>(() => {
    if (!chipData?.currentPrice) {
      logger.debug(`${LOG_TAG} [chipTradePoints] chipData 或 currentPrice 为空，跳过生成`)
      return []
    }
    if (!tradeAction || tradeAction === 'watch') {
      logger.debug(`${LOG_TAG} [chipTradePoints] tradeAction=${tradeAction ?? EMPTY_STRING}，不生成标注`)
      return []
    }

    const price = chipData.currentPrice
    if (tradeAction === 'buy') {
      logger.info(`${LOG_TAG} [chipTradePoints] 生成买入标注`, { price, direction: 'buy' })
      return [
        { price, direction: 'buy', label: '买点', color: STOCK_COLOR_TOKENS.up.hex },
      ]
    }
    if (tradeAction === 'sell' || tradeAction === 'escape') {
      logger.info(`${LOG_TAG} [chipTradePoints] 生成卖出标注`, {
        price,
        direction: 'sell',
        action: tradeAction,
      })
      return [
        { price, direction: 'sell', label: tradeAction === 'escape' ? '逃离' : '卖点', color: STOCK_COLOR_TOKENS.down.hex },
      ]
    }
    if (tradeAction === 'hold') {
      logger.info(`${LOG_TAG} [chipTradePoints] 生成持有标注`, { price, direction: 'buy' })
      return [
        { price, direction: 'buy', label: '持有', color: STOCK_COLOR_TOKENS.neutral.hex },
      ]
    }
    return []
  }, [chipData, tradeAction])

  return {
    klineData,
    klineLoading,
    klineDataSource,
    chipData,
    chipLoading,
    chipDataSource,
    markers,
    chipTradePoints,
    refresh,
  }
}
