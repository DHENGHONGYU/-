/**
 * 验证 V6 引擎「跳过原因」和「数据完整度」日志
 * - Case A: 正常输入（11 层全参与）
 * - Case B: 故意把 l3f/l7 层 score 置为 NaN（触发跳过日志）
 */
import { it } from 'vitest'
import { db } from '@/data/db'
import { createV6Engine, stockToBasicData, quotesToQuoteData } from '@/services/scoring/v6-engine'
import { klinesToDailyQuotes } from '@/services/data-collector/directDataAPI'
import { compositeToV6Score } from '@/services/scoring/v6ScoreService'
import type { Stock, KlineBar, LayerId, LayerScore, CompositeScore } from '@/data/types'

function makeKlines(seed: number): KlineBar[] {
  const bars: KlineBar[] = []
  const base = 50 + seed * 10
  for (let i = 0; i < 60; i++) {
    const open = base + i * 0.2
    const close = open * (1 + Math.sin(i / 4 + seed) * 0.005)
    bars.push({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      open: Number(open.toFixed(2)),
      high: Number(Math.max(open, close).toFixed(2)) * 1.005,
      low: Number(Math.min(open, close).toFixed(2)) * 0.995,
      close: Number(close.toFixed(2)),
      volume: 1_000_000 + ((i * 7919) % 500_000),
      amount: (1_000_000 + ((i * 7919) % 500_000)) * Number(close.toFixed(2)),
    })
  }
  return bars
}

function mockStock(symbol: string, name: string): Stock {
  return {
    symbol,
    name,
    pool: 'intention',
    researchStatus: 'screening',
    price: 50,
    pe: 20,
    pb: 2.5,
    roe: 0.15,
    marketCap: 1e11,
    source: 'manual',
    dataVersion: 1,
    ingestedAt: 0,
    updatedAt: 0,
  } as Stock
}

/**
 * 构造「脏数据」：把指定层的 score 改为 NaN，summary 变空
 * 目的：触发 aggregate 里的 层跳过 日志
 */
function injectBadScores(
  composite: CompositeScore,
  badLayers: LayerId[],
): CompositeScore {
  const newLayers: Record<LayerId, LayerScore> = { ...composite.layers }
  for (const id of badLayers) {
    if (newLayers[id]) {
      newLayers[id] = { ...newLayers[id], score: NaN, summary: '脏数据测试：NaN' }
    }
  }
  return { ...composite, layers: newLayers }
}

it('Case A: 正常输入 → 11层全参与 + 数据完整度 100%', async () => {
  await db.init()
  const engine = createV6Engine()
  const stock = mockStock('TEST-A.SH', 'Case-A 全数据完整') as Stock
  const dq = klinesToDailyQuotes('TEST-A.SH', makeKlines(1))
  const financials = { dataStatus: 'missing' as const }

  const composite = await engine.calculateAll({
    symbol: stock.symbol,
    stock: stockToBasicData(stock),
    quotes: quotesToQuoteData(dq),
    financials,
  })
  const v6 = compositeToV6Score(stock, composite, financials)
  console.log(`\n[Case-A 结果] 综合分=${v6.score} | 评级=${v6.rating} | 完整度=${v6.qualityWarning ?? '100%'}\n`)
}, 60_000)

it('Case B: 脏数据 → 触发层跳过 + 数据完整度下降', async () => {
  await db.init()
  const engine = createV6Engine()
  const stock = mockStock('TEST-B.SH', 'Case-B 层跳过模拟') as Stock
  const dq = klinesToDailyQuotes('TEST-B.SH', makeKlines(2))
  const financials = { dataStatus: 'missing' as const }

  const clean = await engine.calculateAll({
    symbol: stock.symbol,
    stock: stockToBasicData(stock),
    quotes: quotesToQuoteData(dq),
    financials,
  })
  // 手动污染 2 层：财务健康(l3f)、第二曲线(l7)
  const composite = injectBadScores(clean, ['l3f', 'l7'])
  // 用污染后的 composite 再次聚合 → 触发 aggregate 跳过判断
  const reAggregated = engine.aggregate(composite.layers, clean.allRisks ?? [])

  const v6 = compositeToV6Score(stock, reAggregated, financials)
  console.log(`\n[Case-B 结果] 综合分=${v6.score} | 评级=${v6.rating} | 完整度=${v6.qualityWarning ?? '100%'}\n`)
}, 60_000)
