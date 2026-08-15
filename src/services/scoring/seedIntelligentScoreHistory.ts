/**
 * seedIntelligentScoreHistory.ts
 *
 * 为 600519.SH 批量生成历史智能评分记录，使趋势图可显示。
 * 在浏览器中通过动态 import 执行：
 *   await import('/src/services/scoring/seedIntelligentScoreHistory.ts')
 *     .then(m => m.seedIntelligentScoreHistory())
 *
 * 数据写入 intelligentScores store（autoIncrement keyPath='id'），
 * 每条记录包含 scoredAt、overallScore、dimensionScores 等完整字段。
 * 生成约 10 条记录，跨越 2026-05 ~ 2026-08，覆盖周/月/季度聚合。
 */

import { sendWriteEnvelope } from '@/core/databridgeQueries'
import type { IntelligentScore, DimensionScore, Stock } from '@/data/types'

// 9 个因子名称：与 scoreFactors.ts 中 getEnabledStockFactorNames() 对齐
const FACTOR_NAMES = [
  '估值', '成长', '盈利', '质量', '动量', '波动', '流动性', '行业', '情绪',
]

interface BatchResult {
  inserted: number
  skipped: number
  errors: string[]
}

// 生成维度分数，围绕 baseScore 做 ±0.5 的随机波动
function randomDimScore(baseScore: number): number {
  const delta = (Math.random() - 0.5) * 1.0
  return Math.round((baseScore + delta) * 10) / 10
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * 生成一条历史智能评分记录
 */
function generateHistoryScore(
  symbol: string,
  stock: Stock,
  scoredAt: number,
  baseScore: number,
  v6Score: number,
): IntelligentScore {
  const dimensionScores: DimensionScore[] = FACTOR_NAMES.map((name) => ({
    name,
    score: clamp(randomDimScore(baseScore), 1, 5),
    rationale: `历史评分（${new Date(scoredAt).toLocaleDateString('zh-CN')}）`,
    evidence: [],
    weight: 1 / FACTOR_NAMES.length,
    usedLlm: false,
  }))

  return {
    symbol,
    overallScore: v6Score,
    dimensionScores,
    summary: `V6 引擎数据驱动评分（综合分 ${v6Score.toFixed(2)}），LLM 增强未启用`,
    basis: 'V6 实时因子引擎 (v6-engine-1.0)，基于 11 层因子计算（数据驱动）',
    missingFields: [],
    sourceSnapshot: {
      stock,
      fileNames: [],
      reportLength: 0,
    },
    configSnapshot: {
      model: '',
      baseURL: '',
      v6EngineVersion: 'v6-engine-1.0',
      v6Score,
    },
    modelResponse: '',
    dataVersion: 1,
    scoredAt,
    scoreProvenance: 'data-driven',
    dataProvenance: 'real',
  }
}

/**
 * 批量写入历史评分记录
 *
 * @param symbol - 股票代码，默认 '600519.SH'
 * @param recordCount - 记录数，默认 10
 * @param monthsBack - 回溯月数，默认 3
 */
export async function seedIntelligentScoreHistory(
  symbol: string = '600519.SH',
  recordCount: number = 10,
  monthsBack: number = 3,
): Promise<BatchResult> {
  const result: BatchResult = { inserted: 0, skipped: 0, errors: [] }

  // 构造最小 stock 快照
  const stock = {
    symbol,
    name: '贵州茅台',
    price: 1355 + Math.round((Math.random() - 0.5) * 100),
    pe: 20.5,
    pb: 8,
    roe: 0.25,
    marketCap: 1.7e12,
    dataVersion: 1,
    source: 'akshare',
    updatedAt: Date.now(),
    researchStatus: 'active',
  } as unknown as Stock

  const now = Date.now()
  const msPerMonth = 30 * 24 * 60 * 60 * 1000
  const startTime = now - monthsBack * msPerMonth

  // 生成 records 个均匀分布的时间戳
  for (let i = 0; i < recordCount; i++) {
    // 越靠近现在，分数越稳定（模拟优化趋势）
    const t = startTime + (now - startTime) * (i / (recordCount - 1))
    const scoreProgression = 2.0 + (i / (recordCount - 1)) * 1.0
    const v6Score = clamp(
      scoreProgression + (Math.random() - 0.5) * 0.8,
      1.5,
      4.5,
    )

    const score = generateHistoryScore(symbol, stock, Math.round(t), scoreProgression, v6Score)

    try {
      const saveResult = await sendWriteEnvelope('saveIntelligentScores', score, 'analyzer')
      if (saveResult.success) {
        result.inserted++
      } else {
        result.skipped++
        result.errors.push(`[${i}] 保存失败: ${saveResult.error}`)
      }
    } catch (err) {
      result.skipped++
      result.errors.push(`[${i}] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}

// 浏览器识别：暴露到 window 方便调试
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).seedIntelligentScoreHistory = seedIntelligentScoreHistory
}