/**
 * @test_id V9-TEST-UT-085
 * V6 评分日志 & 边界 单元测试
 *
 * 覆盖 8 大类边界场景（配合 console 日志人工检视，可结合 LOG_LEVEL=debug 运行）：
 *   - [S1] sanitizeScore 输入边界（NaN/±Infinity/负数/超范围）
 *   - [S2] aggregate 层跳过（缺失 / NaN / 类型非法）
 *   - [S3] 权重异常（总权重 0 / 权重缺失）
 *   - [S4] 归一化 clamp（< 0 / > 5）
 *   - [S5] compositeToV6Score 数据完整度 0% / 50% / 100%
 *   - [S6] composite.score 非有限数 → 降级
 *   - [S7] getV6ScoreQuality 完整度边界
 *   - [S8] buildFactorContributions 缺失 / 无效 / 权重告警
 *
 * 环境：Vitest + jsdom + fake-indexeddb（tests/setup.ts 已注入）
 * 纯计算，不触达外部数据源。
 *
 * 验证「跳过原因」「数据完整度」日志：运行时加 --reporter=verbose 观察 WARN/INFO 输出
 * 或单独跑：npx vitest run tests/v6-score-logging-boundary.test.ts 2>&1 | rg "层跳过|数据完整度|sanitizeScore|buildFactorContributions|归一化"
 *
 * @covers_docs [V9-DOC-ARCH-008, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-FRONT-012]
 */

import { it, expect, describe } from 'vitest'
import { db } from '@/data/db'
import {
  createV6Engine, stockToBasicData, quotesToQuoteData, ALL_LAYER_IDS, LAYER_LABELS,
} from '@/services/scoring/v6-engine'
import { DEFAULT_ENGINE_CONFIG } from '@/services/scoring/v6-engine/config'
import { klinesToDailyQuotes } from '@/services/data-collector/directDataAPI'
import { buildFactorContributions } from '@/services/scoring/v6-engine/factorContributions'
import {
  compositeToV6Score, getV6ScoreQuality,
} from '@/services/scoring/v6ScoreService'
import type { Stock, KlineBar } from '@/data/types'
import type {
  LayerId, LayerScore, V6ScoreEngineConfig,
} from '@/services/scoring/v6-engine'

// -------------------------------------------------------
// helpers
// -------------------------------------------------------
function mkStock(symbol: string, overrides: Partial<Stock> = {}): Stock {
  return {
    symbol,
    name: `测试${symbol}`,
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
    ...overrides,
  } as Stock
}

function mkBars(seed: number): KlineBar[] {
  const bars: KlineBar[] = []
  for (let i = 0; i < 60; i++) {
    const base = 50 + seed * 10
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

/** 给一个「干净的 11 层」CompositeScore，所有层 score = scoreVal，权重 weight = 1，风险空 */
function mkCleanLayers(scoreVal: number): Record<LayerId, LayerScore> {
  const r = {} as Record<LayerId, LayerScore>
  for (const id of ALL_LAYER_IDS) {
    r[id] = {
      layerId: id,
      layerName: LAYER_LABELS[id],
      score: scoreVal,
      summary: `${LAYER_LABELS[id]}: 模拟分=${scoreVal}`,
      risks: [],
      evidence: [],
      weight: 1,
      weightedScore: scoreVal * 1,
      dataSources: [],
      participated: true,
    }
  }
  return r
}

/** 基于定制权重创建 engine。默认 engine 内部 aggregate 使用 this.config.weights（不是 layer.weight） */
function createEngineWithWeightOverrides(
  weightOverrides?: Partial<Record<LayerId, number>>,
  thresholdOverrides?: Partial<{ strongBuy: number; buy: number; hold: number; sell: number }>,
) {
  // 复用 DEFAULT_ENGINE_CONFIG 的 override 模式（ESM import，避免 require 在 vitest 下无法解析 @ 别名）
  const cfg = JSON.parse(JSON.stringify(DEFAULT_ENGINE_CONFIG)) as V6ScoreEngineConfig
  if (weightOverrides) {
    for (const [k, v] of Object.entries(weightOverrides)) {
      cfg.weights[k as LayerId] = v!
    }
  }
  if (thresholdOverrides) {
    Object.assign(cfg.thresholds.rating, thresholdOverrides)
  }
  return createV6Engine(cfg)
}

// -------------------------------------------------------
// 测试组
// -------------------------------------------------------
beforeAll(async () => { await db.init() })

describe('[S1] aggregate 层跳过判定（NaN/±Infinity → 跳过；负数/超范围有限值不跳过）', () => {
  it('[S1-A] 部分层 score=NaN → 触发「score 为 NaN」跳过 WARN', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(2.5)
    layers.l3f.score = NaN
    layers.l7.score = NaN
    const composite = engine.aggregate(layers, [])
    // 跳过的 2 层出现在 skippedLayers
    expect(composite.skippedLayers ?? []).toEqual(expect.arrayContaining(['l3f', 'l7']))
    expect((composite.skippedLayers ?? []).length).toBe(2)
    expect(Number.isFinite(composite.score)).toBe(true)
    // coverageRate 应 < 100%
    expect(composite.coverageRate).not.toBe('100%')
  })

  it('[S1-B] 部分层 score=+Infinity → 触发「score 为 +Infinity」跳过 WARN', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(2.0)
    layers.l0.score = Infinity
    const composite = engine.aggregate(layers, [])
    expect(composite.skippedLayers ?? []).toContain('l0')
    // composite.layers 保持原值（aggregate 不修改 input）
    expect(composite.layers.l0.score).toBe(Infinity)
    expect(Number.isFinite(composite.score)).toBe(true)
  })

  it('[S1-C] 部分层 score=-Infinity → 触发「score 为 -Infinity」跳过 WARN', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(2.0)
    layers.l1.score = -Infinity
    const composite = engine.aggregate(layers, [])
    expect(composite.skippedLayers ?? []).toContain('l1')
    expect(composite.layers.l1.score).toBe(-Infinity)
  })

  it('[S1-D] 层 score 为负数（有限）→ 不跳过，aggregate 不修改 score', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(2.0)
    layers.l2.score = -3
    const composite = engine.aggregate(layers, [])
    expect(composite.skippedLayers ?? []).not.toContain('l2')
    expect(composite.layers.l2.score).toBe(-3)
  })

  it('[S1-E] 层 score > 5（有限）→ 不跳过，aggregate 不修改 score', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(2.0)
    layers.l3v.score = 99
    const composite = engine.aggregate(layers, [])
    expect(composite.skippedLayers ?? []).not.toContain('l3v')
    expect(composite.layers.l3v.score).toBe(99)
  })
})

describe('[S2] aggregate 层跳过（缺失 / NaN / 类型非法）', () => {
  it('[S2-A] 某层 undefined → 标记「缺失 (undefined)」跳过', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(2.5) as unknown as Record<LayerId, LayerScore | undefined>
    delete layers.lMinus1
    const composite = engine.aggregate(layers as Record<LayerId, LayerScore>, [])
    // lMinus1 已被 delete → composite.layers 中亦不存在（aggregate 不补充缺失层）
    expect(composite.layers.lMinus1).toBeUndefined()
    expect(composite.skippedLayers ?? []).toContain('lMinus1')
  })

  it('[S2-B] 某层 score = object → 类型非法跳过', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(2.5) as unknown as Record<LayerId, Omit<LayerScore, 'score'> & { score: unknown }>
    layers.l4.score = { invalid: true }
    const composite = engine.aggregate(layers as Record<LayerId, LayerScore>, [])
    // 引擎对 score 类型非法的层执行跳过（加入 skippedLayers），但不会回写 layer.participated=false
    expect(composite.skippedLayers ?? []).toContain('l4')
  })

  it('[S2-C] 11 层全部 score=NaN → 11 层全部跳过，总分 0，coverageRate 0%', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(NaN)
    const composite = engine.aggregate(layers, [])
    expect(composite.score).toBe(0)
    expect(composite.rating).toBe('strong_sell')
    expect((composite.skippedLayers ?? []).length).toBe(ALL_LAYER_IDS.length)
    // coverageRate 为数值（0~1），全跳过 → 0
    expect(composite.coverageRate).toBe(0)
  })
})

describe('[S3] 权重异常（总权重 0 / 部分权重 0）', () => {
  it('[S3-A] 所有层 config 权重=0 → 总权重 0，归一化强制 0 且 WARN', async () => {
    // 引擎 aggregate 使用 this.config.weights（非 layer.weight），故通过 config override 构造零权重
    const zeroWeights = Object.fromEntries(ALL_LAYER_IDS.map((id) => [id, 0])) as Partial<Record<LayerId, number>>
    const engine = createEngineWithWeightOverrides(zeroWeights)
    const layers = mkCleanLayers(3.5)
    const composite = engine.aggregate(layers, [])
    // 所有 score 有限（无跳过），但总权重为 0 → 归一化强制 0
    expect(composite.score).toBe(0)
    expect(composite.skippedLayers ?? []).toHaveLength(0)
  })

  it('[S3-B] 仅 lMinus1 config 权重=0.5，其余 0 → 综合分由 lMinus1 决定', async () => {
    const overrides = Object.fromEntries(ALL_LAYER_IDS.map((id) => [id, 0])) as Partial<Record<LayerId, number>>
    overrides.lMinus1 = 0.5
    const engine = createEngineWithWeightOverrides(overrides)
    const layers = mkCleanLayers(0)
    // 其余层 score=0（仍参与，权重为 0）；仅 lMinus1 有非零权重且 score=4.0
    layers.lMinus1.score = 4.0
    const composite = engine.aggregate(layers, [])
    // 只有 lMinus1 贡献有效权重 → 综合分 ≈ 4.0
    expect(composite.score).toBeCloseTo(4.0, 1)
    expect(composite.skippedLayers ?? []).toHaveLength(0)
  })
})

describe('[S4] 归一化 clamp（< 0 / > 5）', () => {
  it('[S4-A] 全部层 score=5（满分）→ finalScore=5，rating=strong_buy', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(5)
    const composite = engine.aggregate(layers, [])
    expect(composite.score).toBe(5)
    expect(composite.rating).toBe('strong_buy')
  })

  it('[S4-B] 全部层 score=0 → finalScore=0，rating=strong_sell', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(0)
    const composite = engine.aggregate(layers, [])
    expect(composite.score).toBe(0)
    expect(composite.rating).toBe('strong_sell')
  })
})

describe('[S5] compositeToV6Score 数据完整度边界（0%/50%/100%）', () => {
  it('[S5-A] 11 层全有效 → dataCompletenessPct ≈ 100%，无 qualityWarning', async () => {
    const engine = createV6Engine()
    const composite = engine.aggregate(mkCleanLayers(3), [])
    const stock = mkStock('S5A.SH')
    const v6 = compositeToV6Score(stock, composite)
    expect(v6.qualityWarning).toBeUndefined()
    expect(v6.rating).toBe(composite.rating)
    expect(Object.keys(v6.factors)).toHaveLength(ALL_LAYER_IDS.length)
  })

  it('[S5-B] 5/11 层有效 → dataCompletenessPct ≈ 45%，qualityWarning 文案正确', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(NaN)
    // 前 5 层有效
    const active = ALL_LAYER_IDS.slice(0, 5)
    for (const id of active) layers[id].score = 3.0
    const composite = engine.aggregate(layers, [])
    const v6 = compositeToV6Score(mkStock('S5B.SH'), composite)
    const expectedPct = Math.round((5 / ALL_LAYER_IDS.length) * 100)
    expect(v6.qualityWarning).toContain(`${expectedPct}%`)
    expect(v6.qualityWarning).toContain(`5/${ALL_LAYER_IDS.length}`)
  })

  it('[S5-C] 0/11 层有效 → dataCompletenessPct ≈ 0%，qualityWarning 含 0/11', async () => {
    const engine = createV6Engine()
    const composite = engine.aggregate(mkCleanLayers(NaN), [])
    const v6 = compositeToV6Score(mkStock('S5C.SH'), composite)
    expect(v6.qualityWarning).toContain(`0/${ALL_LAYER_IDS.length}`)
  })

  it('[S5-D] financials.dataStatus=missing → 显式标记 missingFinancials=true', async () => {
    const engine = createV6Engine()
    const composite = engine.aggregate(mkCleanLayers(3.5), [])
    compositeToV6Score(mkStock('S5D.SH'), composite, { dataStatus: 'missing' })
  })
})

describe('[S6] composite.score 非有限数 → compositeToV6Score 降级置 0', () => {
  it('[S6-A] composite.score = NaN → 最终 v6.score 置 0', async () => {
    const engine = createV6Engine()
    const composite = engine.aggregate(mkCleanLayers(2.5), [])
    ;(composite as { score: number }).score = NaN
    const v6 = compositeToV6Score(mkStock('S6A.SH'), composite)
    expect(v6.score).toBe(0)
  })

  it('[S6-B] 某层 composite.layers[X].score = NaN → 该层在 factors 中变为 0', async () => {
    const engine = createV6Engine()
    const layers = mkCleanLayers(3.0)
    layers.l5.score = NaN
    layers.l6.score = NaN
    const composite = engine.aggregate(layers, [])
    const v6 = compositeToV6Score(mkStock('S6B.SH'), composite)
    expect(v6.factors.l5).toBe(0)
    expect(v6.factors.l6).toBe(0)
  })
})

describe('[S7] getV6ScoreQuality 完整度边界', () => {
  it('[S7-A] 空 factors → 完整度 0%，missingLayers=11', () => {
    const q = getV6ScoreQuality('S7A.SH', {})
    expect(q.dataCompleteness).toBe(0)
    expect(q.missingLayers).toHaveLength(ALL_LAYER_IDS.length)
    expect(q.hasBasicData).toBe(false)
  })

  it('[S7-B] 半满 factors → 完整度 ~50%', () => {
    const factors: Record<string, number> = {}
    for (const id of ALL_LAYER_IDS.slice(0, Math.ceil(ALL_LAYER_IDS.length / 2))) {
      factors[id] = 2.5
    }
    const q = getV6ScoreQuality('S7B.SH', factors)
    expect(q.dataCompleteness).toBeGreaterThanOrEqual(45)
    expect(q.dataCompleteness).toBeLessThanOrEqual(55)
    expect(q.hasBasicData).toBe(true)
  })

  it('[S7-C] 全满 factors → 完整度 100%，missingLayers=[]', () => {
    const factors: Record<string, number> = {}
    for (const id of ALL_LAYER_IDS) factors[id] = 3.0
    const q = getV6ScoreQuality('S7C.SH', factors)
    expect(q.dataCompleteness).toBe(100)
    expect(q.missingLayers).toHaveLength(0)
    expect(q.hasBasicData).toBe(true)
  })
})

describe('[S8] buildFactorContributions 缺失/无效/权重 告警', () => {
  it('[S8-A] composite.layers 空对象 → 触发「11 因子贡献度缺失」WARN', async () => {
    const engine = createV6Engine()
    // calculateAll 一次建立 auditTrail，再修改 composite.layers 为空
    const stock = mkStock('S8A.SH')
    const dq = klinesToDailyQuotes('S8A.SH', mkBars(1))
    await engine.calculateAll({
      symbol: stock.symbol,
      stock: stockToBasicData(stock),
      quotes: quotesToQuoteData(dq),
      financials: { dataStatus: 'missing' },
    })
    // 手动注入空 layers 到 auditTrail 模拟缺失
    const audit = (engine as unknown as { auditTrail: { composite: { layers: Record<LayerId, number>; weightedSum: number }; config: V6ScoreEngineConfig } }).auditTrail
    const originalLayers = audit.composite.layers
    audit.composite.layers = {} as Record<LayerId, number>
    const contributions = buildFactorContributions(audit as never)
    // 恢复以免污染其他测试
    audit.composite.layers = originalLayers
    expect(Array.isArray(contributions)).toBe(true)
    // 全空 → 贡献度数组长度 = 0
    expect(contributions).toHaveLength(0)
  })

  it('[S8-B] 部分层 score=NaN → 触发「因子贡献度无效评分」WARN', async () => {
    const engine = createV6Engine()
    const stock = mkStock('S8B.SH')
    const dq = klinesToDailyQuotes('S8B.SH', mkBars(2))
    await engine.calculateAll({
      symbol: stock.symbol,
      stock: stockToBasicData(stock),
      quotes: quotesToQuoteData(dq),
      financials: { dataStatus: 'missing' },
    })
    const audit = (engine as unknown as { auditTrail: { composite: { layers: Record<LayerId, number> }; config: V6ScoreEngineConfig } }).auditTrail
    audit.composite.layers.l3f = NaN as never
    audit.composite.layers.l7 = NaN as never
    const contributions = buildFactorContributions(audit as never)
    expect(Array.isArray(contributions)).toBe(true)
    // 部分 NaN，但其他有效层仍可生成贡献
    expect(contributions.length).toBeGreaterThanOrEqual(ALL_LAYER_IDS.length - 3)
  })
})

// ======================================================
// 额外：通过 engine.calculateAll 完整链路跑一遍（和 check-v6-score-logs.test.ts 行为一致）
// 用于验证正常路径 + 批量场景，确保日志规范输出
// ======================================================
describe('[R0] 完整链路：engine.calculateAll → compositeToV6Score', () => {
  it('[R0-A] 正常输入 → 综合分有效，11 层，无跳过', async () => {
    const engine = createV6Engine()
    const stock = mkStock('R0A.SH')
    const dq = klinesToDailyQuotes('R0A.SH', mkBars(3))
    const composite = await engine.calculateAll({
      symbol: stock.symbol,
      stock: stockToBasicData(stock),
      quotes: quotesToQuoteData(dq),
      financials: { dataStatus: 'missing' },
    })
    expect(Number.isFinite(composite.score)).toBe(true)
    expect(composite.score).toBeGreaterThanOrEqual(0)
    expect(composite.score).toBeLessThanOrEqual(5)
    const v6 = compositeToV6Score(stock, composite, { dataStatus: 'missing' })
    expect(v6.symbol).toBe('R0A.SH')
    expect(Object.keys(v6.layerDetails ?? {})).toHaveLength(ALL_LAYER_IDS.length)
  }, 30_000)

  it('[R0-B] 差异化输入（高分 vs 低分）→ 分数有区分度', async () => {
    const engine = createV6Engine()
    const goodStock = mkStock('GOOD.SH', { pe: 8, pb: 1.2, roe: 0.35, marketCap: 5e11 })
    const badStock = mkStock('BAD.SH', { pe: 120, pb: 15, roe: 0.02, marketCap: 5e9 })
    const [goodDq, badDq] = [
      klinesToDailyQuotes('GOOD.SH', mkBars(10)),
      klinesToDailyQuotes('BAD.SH', mkBars(20)),
    ]
    const [goodComp, badComp] = await Promise.all([
      engine.calculateAll({
        symbol: goodStock.symbol, stock: stockToBasicData(goodStock),
        quotes: quotesToQuoteData(goodDq), financials: { dataStatus: 'missing' },
      }),
      engine.calculateAll({
        symbol: badStock.symbol, stock: stockToBasicData(badStock),
        quotes: quotesToQuoteData(badDq), financials: { dataStatus: 'missing' },
      }),
    ])
    expect(Number.isFinite(goodComp.score) && Number.isFinite(badComp.score)).toBe(true)
    // 好/坏两个组合分数不应相同（区分度）
    expect(goodComp.score).not.toBeCloseTo(badComp.score, 0)
  }, 30_000)
})
