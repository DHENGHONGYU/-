/**
 * @test_id V9-TEST-ST-097
 * intelligentScoreService 单元测试
 *
 * 针对 2026-08-13 修复的回归覆盖：
 * 1. 数据缺失降级：detectMissingBasicFields 仅以 price 为必需字段，
 *    pe/pb/marketCap 缺失时 V6 引擎应照常执行（内置降级），不再整体跳过。
 * 2. V6 引擎计算：数据完备时走 v6 真实因子路径，产出 data-driven 评分。
 * 3. LLM 开关：enableLlm=false 时跳过 LLM；enableLlm=true 时作为文本增强。
 *
 * @covers_docs [V9-DOC-PROJ-114, V9-DOC-PROJ-054, V9-DOC-BACK-005, V9-DOC-BACK-010]
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { runIntelligentScore } from './intelligentScoreService'
import type { Stock, DailyQuotes, KlineBar } from '@/data/types'

// ============================================================
// Mocks（全部经 vi.hoisted，规避 TDZ）
// ============================================================

const hoisted = vi.hoisted(() => {
  const mockQuery = vi.fn()
  const mockForward = vi.fn().mockResolvedValue(undefined)
  const mockSendWriteEnvelope = vi.fn().mockResolvedValue({ success: true })
  const mockChat = vi.fn()
  const mockBuildFinancialData = vi.fn().mockResolvedValue({ dataStatus: 'missing' } as const)
  const mockValidate = vi.fn().mockReturnValue({
    passed: true,
    severity: 'info' as const,
    issues: [],
    score: 0,
    blockCount: 0,
    warnCount: 0,
  })
  const mockEmit = vi.fn()
  const mockBuildPrompt = vi.fn().mockReturnValue([])

  const mockComposite = {
    score: 3.75,
    rating: 'buy' as const,
    layers: {
      lMinus1: { layerId: 'lMinus1', layerName: '行业评分估值', score: 4.0, summary: '行业估值合理', risks: [], evidence: [], weight: 0.10, weightedScore: 0.4, dataSources: [] },
      l0: { layerId: 'l0', layerName: 'STEEP 宏观', score: 3.5, summary: '宏观环境中性', risks: [], evidence: [], weight: 0.08, weightedScore: 0.28, dataSources: [] },
      l1: { layerId: 'l1', layerName: '护城河', score: 4.5, summary: '品牌护城河强', risks: [], evidence: [], weight: 0.15, weightedScore: 0.675, dataSources: [] },
      l2: { layerId: 'l2', layerName: '竞品格局', score: 3.0, summary: '竞争中等', risks: ['竞品增多'], evidence: [], weight: 0.10, weightedScore: 0.3, dataSources: [] },
      l3f: { layerId: 'l3f', layerName: '财务健康', score: 4.0, summary: '财务稳健', risks: [], evidence: [], weight: 0.10, weightedScore: 0.4, dataSources: [] },
      l3v: { layerId: 'l3v', layerName: '估值水平', score: 3.5, summary: '估值中等', risks: [], evidence: [], weight: 0.08, weightedScore: 0.28, dataSources: [] },
      l4: { layerId: 'l4', layerName: '情景推演', score: 3.0, summary: '基准情景', risks: [], evidence: [], weight: 0.08, weightedScore: 0.24, dataSources: [] },
      l5: { layerId: 'l5', layerName: 'T-M矩阵', score: 4.0, summary: '时机适中', risks: [], evidence: [], weight: 0.05, weightedScore: 0.2, dataSources: [] },
      l6: { layerId: 'l6', layerName: 'Hype周期', score: 3.5, summary: '稳步爬升', risks: [], evidence: [], weight: 0.07, weightedScore: 0.245, dataSources: [] },
      l7: { layerId: 'l7', layerName: '第二曲线', score: 4.0, summary: '新业务增长', risks: [], evidence: [], weight: 0.15, weightedScore: 0.6, dataSources: [] },
      l8: { layerId: 'l8', layerName: '技术筹码', score: 3.5, summary: '筹码集中', risks: [], evidence: [], weight: 0.04, weightedScore: 0.14, dataSources: [] },
    },
    allRisks: ['竞品增多'],
    recommendation: '建议买入',
    timestamp: 1700000000000,
    engineVersion: 'v6-engine-1.0',
  }

  // 引擎行为可变：测试可替换 calculateAll 以模拟异常
  const engineState = {
    calculateAll: async () => mockComposite,
  }

  return {
    mockQuery,
    mockForward,
    mockSendWriteEnvelope,
    mockChat,
    mockBuildFinancialData,
    mockValidate,
    mockEmit,
    mockBuildPrompt,
    mockComposite,
    engineState,
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { query: hoisted.mockQuery, forward: hoisted.mockForward },
}))

vi.mock('@/core/databridgeQueries', () => ({
  sendWriteEnvelope: hoisted.mockSendWriteEnvelope,
}))

vi.mock('@/services/llm/llmGateway', () => ({
  chat: hoisted.mockChat,
  LlmApiError: class LlmApiError extends Error {},
}))

vi.mock('@/services/scoring/v6ScoreService', () => ({
  buildFinancialData: hoisted.mockBuildFinancialData,
}))

vi.mock('@/services/scoring/aiOutputValidator', () => ({
  validateScoreBeforeSave: hoisted.mockValidate,
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { emit: hoisted.mockEmit },
}))

vi.mock('./intelligentScorePrompt', () => ({
  buildIntelligentScorePrompt: hoisted.mockBuildPrompt,
}))

// Mock v6-engine：隔离 11 层真实计算器，行为由 engineState.calculateAll 控制
vi.mock('@/services/scoring/v6-engine', () => ({
  createV6Engine: vi.fn(() => ({
    calculateAll: hoisted.engineState.calculateAll,
    audit: vi.fn().mockReturnValue(null),
  })),
  stockToBasicData: vi.fn((stock: Stock) => ({
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
    sector: stock.industryCode,
  })),
  quotesToQuoteData: vi.fn((quotes: DailyQuotes) => ({
    latestClose: quotes.latest?.close,
    history: quotes.history.map((b) => b.close),
    volumeHistory: quotes.history.map((b) => b.volume),
  })),
}))

// ============================================================
// Test data factories
// ============================================================

function createMockStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '600519.SH',
    name: '贵州茅台',
    price: 1800,
    pe: 30,
    pb: 8,
    roe: 0.25,
    marketCap: 2.2e12,
    dataVersion: 1,
    source: 'akshare',
    updatedAt: Date.now(),
    researchStatus: 'active',
    ...overrides,
  } as Stock
}

function createMockBar(i: number): KlineBar {
  return {
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 1000000,
    amount: 1e8,
  }
}

function createMockQuotes(historyLength = 60): DailyQuotes {
  const history = Array.from({ length: historyLength }, (_, i) => createMockBar(i))
  return {
    symbol: '600519.SH',
    latest: history[historyLength - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
}

const baseInput = {
  symbol: '600519.SH',
  files: [] as File[],
  reportText: '',
}

const noLlmInput = {
  ...baseInput,
  transparencyConfig: { enableLlm: false, showTransparencyPanel: false, baseURL: '', apiKey: '', model: '' },
}

// ============================================================
// 数据缺失降级
// ============================================================

describe('数据缺失降级', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.engineState.calculateAll = async () => hoisted.mockComposite
    // 恢复默认 mock 返回（clearAllMocks 会清掉 resolvedValue 队列，重建基础 mock）
    hoisted.mockSendWriteEnvelope.mockResolvedValue({ success: true })
    hoisted.mockBuildFinancialData.mockResolvedValue({ dataStatus: 'missing' } as const)
    hoisted.mockValidate.mockReturnValue({
      passed: true,
      severity: 'info' as const,
      issues: [],
      score: 0,
      blockCount: 0,
      warnCount: 0,
    })
  })

  test('stock 不存在 → 无 LLM 时报错（禁止黑箱评分）', async () => {
    hoisted.mockQuery.mockResolvedValueOnce({ success: true, data: null })

    const result = await runIntelligentScore(noLlmInput)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('无采集数据支撑')
    }
    // 未调用 LLM
    expect(hoisted.mockChat).not.toHaveBeenCalled()
  })

  test('stock 存在但 price 缺失 → 判定基础数据不完整，跳过 V6 引擎', async () => {
    const stockWithoutPrice = createMockStock({ price: undefined } as unknown as Partial<Stock>)
    hoisted.mockQuery.mockResolvedValueOnce({ success: true, data: stockWithoutPrice })

    const result = await runIntelligentScore(noLlmInput)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('无采集数据支撑')
    }
    // 引擎被跳过：仅 stocks 查询被调用（未走 dailyQuotes）
    expect(hoisted.mockQuery).toHaveBeenCalledTimes(1)
  })

  test('【回归】pe/pb/marketCap 缺失但有 price → 不跳过 V6 引擎，产出 data-driven 评分', async () => {
    const stockMinimal = createMockStock({
      price: 1355.29,
      pe: undefined,
      pb: undefined,
      marketCap: undefined,
      roe: undefined,
      industryCode: undefined,
    } as unknown as Partial<Stock>)

    // dataBridge.query 调用顺序：stocks → dailyQuotes（buildFinancialData 已被 mock）
    hoisted.mockQuery
      .mockResolvedValueOnce({ success: true, data: stockMinimal })
      .mockResolvedValueOnce({ success: true, data: createMockQuotes() })

    const result = await runIntelligentScore(noLlmInput)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data!.overallScore).toBe(3.75)
      expect(result.data!.scoreProvenance).toBe('data-driven')
      expect(result.data!.missingFields).toEqual([])
      expect(result.data!.configSnapshot.v6Score).toBe(3.75)
      expect(result.data!.configSnapshot.v6EngineVersion).toBe('v6-engine-1.0')
    }
    // buildFinancialData 被调用
    expect(hoisted.mockBuildFinancialData).toHaveBeenCalledWith('600519.SH')
    // 评分结果已入库并广播事件
    expect(hoisted.mockSendWriteEnvelope).toHaveBeenCalledWith('saveIntelligentScores', expect.anything(), 'analyzer')
    expect(hoisted.mockEmit).toHaveBeenCalled()
  })
})

// ============================================================
// V6 引擎计算逻辑
// ============================================================

describe('V6 引擎计算逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.engineState.calculateAll = async () => hoisted.mockComposite
    hoisted.mockSendWriteEnvelope.mockResolvedValue({ success: true })
    hoisted.mockBuildFinancialData.mockResolvedValue({ dataStatus: 'missing' } as const)
    hoisted.mockValidate.mockReturnValue({
      passed: true,
      severity: 'info' as const,
      issues: [],
      score: 0,
      blockCount: 0,
      warnCount: 0,
    })
  })

  test('数据完备 + LLM 未启用 → v6 真实因子评分，LLM 不调用', async () => {
    hoisted.mockQuery
      .mockResolvedValueOnce({ success: true, data: createMockStock() })
      .mockResolvedValueOnce({ success: true, data: createMockQuotes() })

    const result = await runIntelligentScore(noLlmInput)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data!.overallScore).toBe(3.75)
      expect(result.data!.scoreProvenance).toBe('data-driven')
      expect(result.data!.summary).toContain('V6 引擎数据驱动评分')
      expect(result.data!.dimensionScores.length).toBeGreaterThan(0)
      expect(result.data!.basis).toContain('V6 实时因子引擎')
    }
    expect(hoisted.mockChat).not.toHaveBeenCalled()
  })

  test('V6 引擎抛异常 + LLM 未启用 → 无法生成可信评分', async () => {
    hoisted.engineState.calculateAll = async () => {
      throw new Error('engine crash')
    }
    hoisted.mockQuery
      .mockResolvedValueOnce({ success: true, data: createMockStock() })
      .mockResolvedValueOnce({ success: true, data: createMockQuotes() })

    const result = await runIntelligentScore(noLlmInput)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('无采集数据支撑')
    }
    expect(hoisted.mockSendWriteEnvelope).not.toHaveBeenCalled()
  })

  test('V6 可用 + LLM 启用成功 → v6 分数优先，LLM 提供 summary 增强', async () => {
    hoisted.mockQuery
      .mockResolvedValueOnce({ success: true, data: createMockStock() })
      .mockResolvedValueOnce({ success: true, data: createMockQuotes() })
    hoisted.mockChat.mockResolvedValueOnce({ content: 'LLM 分析摘要', model: 'deepseek-chat' })

    const result = await runIntelligentScore({
      ...baseInput,
      llmConfig: { model: 'deepseek-chat', baseURL: 'http://x', apiKey: 'k' },
      transparencyConfig: { enableLlm: true, showTransparencyPanel: false, baseURL: '', apiKey: '', model: '' },
    })

    expect(hoisted.mockChat).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data!.overallScore).toBe(3.75)
      expect(result.data!.scoreProvenance).toBe('data-driven')
      expect(result.data!.summary).toBe('LLM 分析摘要')
    }
  })
})

// ============================================================
// GLM5.3 弱模型（混元类）输出容错 — 数值分仍由 V6 数据驱动
// ============================================================
// 用户约束：混元/GLM5.3 等弱模型能力偏弱，可能返回 Markdown 围栏包裹的非标准 JSON。
// 本组验证：即便 LLM 返回 ```json 围栏 + 越界 score，数值综合分必须保持 V6 数据驱动（3.75），
// LLM 仅做 rationale 文本增强，绝不覆盖数据驱动评分（P1-3：降低高确定性计算的 LLM 依赖）。

describe('GLM5.3 弱模型输出容错（数值分数据驱动不被覆盖）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.engineState.calculateAll = async () => hoisted.mockComposite
    hoisted.mockSendWriteEnvelope.mockResolvedValue({ success: true })
    hoisted.mockBuildFinancialData.mockResolvedValue({ dataStatus: 'missing' } as const)
    hoisted.mockValidate.mockReturnValue({
      passed: true,
      severity: 'info' as const,
      issues: [],
      score: 0,
      blockCount: 0,
      warnCount: 0,
    })
  })

  test('GLM5.3 返回 ```json 围栏 + 越界 score → 综合分仍为 V6 数据驱动 3.75', async () => {
    // 模拟 GLM5.3/混元弱模型：用 Markdown 代码围栏包裹 JSON，且给出越界 overall=9.9
    // rawDim.name 使用真实因子名「质量」（对应 V6 l1 护城河层），确保与维度匹配触发 rationale 增强
    const fenced = [
      '```json',
      JSON.stringify({
        dimensions: [
          { name: '质量', score: 9.9, rationale: 'GLM5.3 生成的关于质量维度的详细分析理由，长度足以触发 rationale 增强替换条件。' },
        ],
        overall: 9.9,
      }),
      '```',
    ].join('\n')

    hoisted.mockQuery
      .mockResolvedValueOnce({ success: true, data: createMockStock() })
      .mockResolvedValueOnce({ success: true, data: createMockQuotes() })
    hoisted.mockChat.mockResolvedValueOnce({ content: fenced, model: 'glm-5.3' })

    const result = await runIntelligentScore({
      ...baseInput,
      llmConfig: { model: 'glm-5.3', baseURL: 'http://x', apiKey: 'k' },
      transparencyConfig: { enableLlm: true, showTransparencyPanel: false, baseURL: '', apiKey: '', model: '' },
    })

    // ① LLM 被调用（弱模型参与增强）
    expect(hoisted.mockChat).toHaveBeenCalledTimes(1)
    // ② 模型回显为 glm-5.3
    expect(result.success).toBe(true)
    if (result.success) {
      // ③ 核心：综合分必须保持 V6 数据驱动，绝不被 LLM 的越界 9.9 覆盖
      expect(result.data!.overallScore).toBe(3.75)
      expect(result.data!.scoreProvenance).toBe('data-driven')
      expect(result.data!.summary).toBe(fenced)
      // ④ LLM 越界 score 被忽略，未污染任一维度数值
      const moat = result.data!.dimensionScores.find((d) => d.name === '质量')
      expect(moat).toBeDefined()
      if (moat) {
        expect(moat.score).not.toBe(9.9)
        // ⑤ rationale 被 GLM5.3 长文本增强替换
        expect(moat.rationale).toContain('GLM5.3 生成的关于质量维度的详细分析理由')
      }
    }
  })

  test('GLM5.3 返回非法 JSON → 解析失败仅静默跳过增强，评分仍数据驱动', async () => {
    hoisted.mockQuery
      .mockResolvedValueOnce({ success: true, data: createMockStock() })
      .mockResolvedValueOnce({ success: true, data: createMockQuotes() })
    // 弱模型返回完全不可解析的文本
    hoisted.mockChat.mockResolvedValueOnce({ content: '抱歉，我无法生成评分。', model: 'glm-5.3' })

    const result = await runIntelligentScore({
      ...baseInput,
      llmConfig: { model: 'glm-5.3', baseURL: 'http://x', apiKey: 'k' },
      transparencyConfig: { enableLlm: true, showTransparencyPanel: false, baseURL: '', apiKey: '', model: '' },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // 解析失败不影响 V6 因子分数（不崩溃、不黑箱）
      expect(result.data!.overallScore).toBe(3.75)
      expect(result.data!.scoreProvenance).toBe('data-driven')
    }
  })
})