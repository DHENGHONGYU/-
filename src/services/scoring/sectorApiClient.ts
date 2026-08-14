/**
 * @fileoverview Sector API Client — 调用后端 /api/collect/sectors 获取板块轮动评分
 * @module services/scoring/sectorApiClient
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

const API_BASE = 'http://127.0.0.1:8000'

export interface SectorApiItem {
  id: string
  sectorCode: string
  sectorName: string
  swLevel1: string | null
  swLevel2: string | null
  scoreDate: string
  f1Jingqi: number
  f2Zijin: number
  f3Guzhi: number
  f4Beta: number
  f5Nengliang: number
  total: number
  signal: string
  alertLevel: string
  poolStocks: Array<{ symbol: string; name: string }>
}

export interface SectorApiResponse {
  success: boolean
  symbol: string
  dimension: string
  data: {
    sectors: SectorApiItem[]
    scoreDate: string
  }
  records: number
  error?: string
}

/**
 * fetchSectorRotationScores - 调用后端接口获取板块轮动评分
 * @param topN 获取前N个板块
 */
export async function fetchSectorRotationScores(topN: number = 10): Promise<SectorApiItem[]> {
  logger.info('[sectorApiClient] fetchSectorRotationScores', { topN })

  try {
    const resp = await fetch(`${API_BASE}/api/collect/sectors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topN }),
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }

    const body: SectorApiResponse = await resp.json()

    if (!body.success) {
      logger.warn('[sectorApiClient] API returned failure', { error: body.error ?? 'unknown' })
      return []
    }

    const sectors = body.data?.sectors ?? []
    logger.info('[sectorApiClient] 获取板块轮动评分成功', { count: sectors.length })
    return sectors
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[sectorApiClient] 获取板块轮动评分失败', { error: msg })
    return []
  }
}

/**
 * mapSectorToAnalyzerInput - 将 SectorApiItem 映射为 HotSectorAnalyzerInput
 * 按 hotSectorDimensions.ts 的输入格式转换
 */
export function mapSectorToAnalyzerInput(sector: SectorApiItem) {
  const total = sector.total ?? 50
  const momentumBase = sector.f1Jingqi ?? 50
  const sentimentBase = sector.f1Jingqi ?? 50
  const breakoutBase = sector.f4Beta ?? 0
  const rsiSignal: 'bullish' | 'bearish' | 'neutral' = breakoutBase > 5 ? 'bullish' : breakoutBase < -3 ? 'bearish' : 'neutral'
  const valuationBase = sector.f3Guzhi ?? 50

  // 大盘环境推导
  let marketTrend: 'bull' | 'bear' | 'sideways' = 'sideways'
  let systemicRisk: 'low' | 'medium' | 'high' = 'medium'
  if (total >= 70) { marketTrend = 'bull'; systemicRisk = 'low' }
  else if (total <= 30) { marketTrend = 'bear'; systemicRisk = 'high' }

  return {
    symbol: sector.sectorCode,
    sectorName: sector.sectorName,
    momentum: {
      sectorStrengthScore: momentumBase / 20, // 0-100 → 0-5
      priceChangeRank: Math.max(1, Math.round(11 - (total / 10))), // 推断排名
      volumeExpansion: (sector.f5Nengliang ?? 50) / 50, // 归一化
      consecutiveInflow: sector.f2Zijin > 60 ? 3 : sector.f2Zijin > 40 ? 2 : 1,
      relativeStrength: 50 + (sector.f4Beta ?? 0),
    },
    sentiment: {
      sentimentRank: Math.max(1, Math.round(11 - (sentimentBase / 10))),
      retailSentiment: sentimentBase / 100,
      institutionBuyCount: sector.f2Zijin > 70 ? 5 : sector.f2Zijin > 50 ? 3 : 1,
      limitUpCount: sector.f1Jingqi > 80 ? 10 : sector.f1Jingqi > 60 ? 5 : 2,
    },
    breakout: {
      hasBreakoutPattern: sector.signal?.includes('上攻') || sector.signal?.includes('突破') || false,
      rsiSignal,
      rsi: 50 + breakoutBase,
      priceAboveMA20: breakoutBase > 0,
      priceAboveMA60: breakoutBase > 3,
    },
    valuationRisk: {
      pe: Math.max(0, 30 - valuationBase / 2), // 估值分越高PE越低
      pbPercentile: 100 - valuationBase,
      marketCap: 5000, // 板块级给默认值
      dividendYield: 2.0 + (valuationBase / 50),
    },
    marketEnv: {
      marketTrend,
      systemicRisk,
    },
  }
}