/**
 * @test_id V9-TEST-UT-066
 * V6 评分引擎异常处理单元测试
 * 
 * 覆盖边界条件：
 * - NaN/undefined/Infinity 评分处理
 * - 超出 [0, 5] 范围的评分截断
 * - 计算器返回无效结果
 * - aggregate 中 NaN 防护
 * - LLM 增强器防御性校验
 * - 输入数据校验
  * @covers_docs [V9-DOC-PROJ-053, V9-DOC-ARCH-008, V9-DOC-PROJ-114, V9-DOC-FRONT-012]
*/

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { V6ScoreEngine } from '@/services/scoring/v6-engine/engine'
import { LLMScoreEnhancer } from '@/services/scoring/v6-engine/enhancer'
import type { LayerCalculator, LayerInput, LayerScore, LayerId } from '@/services/scoring/v6-engine/types'
import type { LlmConfig } from '@/config/llmConfig'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import {
  mockLlmChatSuccess,
  restoreFetch,
} from './helpers/llmMockFetch'
import {
  MOCK_STOCK_HIGH_QUALITY,
  MOCK_FINANCIALS_HIGH_QUALITY,
  MOCK_QUOTES_HIGH_QUALITY,
  buildLayerInput,
} from './mockStockData'

// ============================================================
// Mock 设置
// ============================================================

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('@/config/llmConfig', async () => {
  const actual = await vi.importActual<typeof import('@/config/llmConfig')>('@/config/llmConfig')
  return {
    ...actual,
    getLlmApiKeyAsync: vi.fn().mockResolvedValue('mock-api-key'),
    getDefaultLlmConfig: vi.fn().mockReturnValue({
      baseURL: 'https://api.deepseek.com',
      apiKey: 'mock-key',
      model: 'deepseek-v4-flash',
    }),
  }
})

// ============================================================
// 测试夹具
// ============================================================

const VALID_LLM_CONFIG: LlmConfig = {
  baseURL: 'https://api.deepseek.com',
  apiKey: 'test-api-key',
  model: 'deepseek-v4-flash',
  maxTokens: 1024,
  temperature: 0.2,
  timeout: 5000,
}

function createMockCalculator(
  layerId: LayerId,
  score: number,
  summary: string = '测试摘要',
): LayerCalculator {
  return {
    layerId,
    calculate: vi.fn(async (): Promise<LayerScore> => ({
      layerId,
      layerName: `测试层 ${layerId}`,
      score,
      summary,
      risks: ['测试风险'],
      evidence: ['测试证据'],
      weight: 0.1,
      weightedScore: score * 0.1,
      dataSources: ['mock'],
    })),
  }
}

// ============================================================
// engine.ts 异常处理测试
// ============================================================

describe('engine.ts 异常处理', () => {
  let engine: V6ScoreEngine
  let input: LayerInput

  beforeEach(() => {
    engine = new V6ScoreEngine()
    input = buildLayerInput(
      MOCK_STOCK_HIGH_QUALITY,
      MOCK_FINANCIALS_HIGH_QUALITY,
      MOCK_QUOTES_HIGH_QUALITY,
    )
    vi.clearAllMocks()
  })

  describe('calculateLayer 结果校验', () => {
    it('NaN 评分应被截断为 0', async () => {
      const calculator = createMockCalculator('l4', NaN)
      engine.registerCalculator(calculator)

      const result = await engine.calculateLayer('l4', input)

      expect(result.score).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('无效评分 NaN'),
      )
    })

    it('Infinity 评分应被截断为 5', async () => {
      const calculator = createMockCalculator('l4', Infinity)
      engine.registerCalculator(calculator)

      const result = await engine.calculateLayer('l4', input)

      expect(result.score).toBe(5)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('正无穷评分'),
      )
    })

    it('负数评分应被截断为 0', async () => {
      const calculator = createMockCalculator('l4', -2.5)
      engine.registerCalculator(calculator)

      const result = await engine.calculateLayer('l4', input)

      expect(result.score).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('负数评分 -2.5'),
      )
    })

    it('超范围评分应被截断为 5', async () => {
      const calculator = createMockCalculator('l4', 7.5)
      engine.registerCalculator(calculator)

      const result = await engine.calculateLayer('l4', input)

      expect(result.score).toBe(5)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('超范围评分 7.5'),
      )
    })

    it('计算器抛错应返回 placeholder 层', async () => {
      const calculator: LayerCalculator = {
        layerId: 'l4',
        calculate: vi.fn(async () => {
          throw new Error('计算器崩溃')
        }),
      }
      engine.registerCalculator(calculator)

      const result = await engine.calculateLayer('l4', input)

      expect(result.score).toBe(0)
      expect(result.summary).toContain('[计算失败]')
      expect(result.summary).toContain('计算器崩溃')
      expect(result.risks).toContain('计算器崩溃')
    })
  })

  describe('aggregate NaN 防护', () => {
    it('单层 NaN 评分应被跳过', async () => {
      const layers = {
        lMinus1: createMockLayerScore('lMinus1', 3.5),
        l0: createMockLayerScore('l0', NaN),
        l1: createMockLayerScore('l1', 4.0),
      } as Record<LayerId, LayerScore>

      const result = engine.aggregate(layers, [])

      // NaN 层应被跳过，不影响其他层
      expect(Number.isFinite(result.score)).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('l0 层评分无效'),
      )
    })

    it('所有层 NaN 应返回 0 分', async () => {
      const layers = {
        lMinus1: createMockLayerScore('lMinus1', NaN),
        l0: createMockLayerScore('l0', NaN),
        l1: createMockLayerScore('l1', NaN),
      } as Record<LayerId, LayerScore>

      const result = engine.aggregate(layers, [])

      expect(result.score).toBe(0)
    })

    it('混合有效和无效评分应正确计算', async () => {
      const layers = {
        lMinus1: createMockLayerScore('lMinus1', 4.0),
        l0: createMockLayerScore('l0', NaN),
        l1: createMockLayerScore('l1', 3.0),
        l2: createMockLayerScore('l2', Infinity),
        l3f: createMockLayerScore('l3f', 3.5),
      } as Record<LayerId, LayerScore>

      const result = engine.aggregate(layers, [])

      // 只有 lMinus1, l1, l3f 有效
      expect(Number.isFinite(result.score)).toBe(true)
      expect(result.score).toBeGreaterThan(0)
    })
  })
})

// ============================================================
// enhancer.ts 异常处理测试
// ============================================================

describe('enhancer.ts 异常处理', () => {
  let enhancer: LLMScoreEnhancer
  let input: LayerInput

  beforeEach(() => {
    enhancer = new LLMScoreEnhancer()
    input = buildLayerInput(
      MOCK_STOCK_HIGH_QUALITY,
      MOCK_FINANCIALS_HIGH_QUALITY,
      MOCK_QUOTES_HIGH_QUALITY,
    )
    vi.clearAllMocks()
  })

  afterEach(() => {
    restoreFetch()
  })

  describe('baseResult 防御性校验', () => {
    it('baseResult 为 null 应跳过增强', async () => {
      const calculator: LayerCalculator = {
        layerId: 'l4',
        calculate: vi.fn(async () => null as unknown as LayerScore),
      }

      enhancer.configure(VALID_LLM_CONFIG)
      const enhanced = enhancer.enhance(calculator)
      const result = await enhanced.calculate(input)

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('baseResult 无效'),
        expect.any(Object),
      )
    })

    it('baseResult.score 为非数字应跳过增强', async () => {
      const calculator: LayerCalculator = {
        layerId: 'l4',
        calculate: vi.fn(async (_input: LayerInput) => ({
          layerId: 'l4' as LayerId,
          layerName: '测试层',
          score: 'invalid' as unknown as number,
          summary: '测试',
          risks: [],
          evidence: [],
          weight: 0.1,
          weightedScore: 0,
          dataSources: [],
        })),
      }

      enhancer.configure(VALID_LLM_CONFIG)
      const enhanced = enhancer.enhance(calculator)
      const result = await enhanced.calculate(input)

      expect(result.score).toBe('invalid')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('baseResult 无效'),
        expect.any(Object),
      )
    })
  })

  describe('[LLM增强] undefined 修复', () => {
    it('rationale 为 undefined 时不应追加 [LLM增强] undefined', async () => {
      mockLlmChatSuccess(JSON.stringify({
        score: 4.5,
        summary: '增强摘要',
        // rationale 缺失
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.5)
      const enhanced = enhancer.enhance(baseCalculator)
      const result = await enhanced.calculate(input)

      expect(result.score).toBe(4.5)
      expect(result.summary).toBe('增强摘要')
      // 不应包含 [LLM增强] undefined
      expect(result.evidence.some(e => e.includes('[LLM增强] undefined'))).toBe(false)
    })

    it('rationale 为空字符串时不应追加 [LLM增强]', async () => {
      mockLlmChatSuccess(JSON.stringify({
        score: 4.5,
        summary: '增强摘要',
        rationale: '',
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.5)
      const enhanced = enhancer.enhance(baseCalculator)
      const result = await enhanced.calculate(input)

      // 空字符串不应追加
      const hasEmptyEnhancement = result.evidence.some(e => e === '[LLM增强] ')
      expect(hasEmptyEnhancement).toBe(false)
    })

    it('rationale 有值时应正确追加', async () => {
      mockLlmChatSuccess(JSON.stringify({
        score: 4.5,
        summary: '增强摘要',
        rationale: '行业景气度提升',
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.5)
      const enhanced = enhancer.enhance(baseCalculator)
      const result = await enhanced.calculate(input)

      expect(result.evidence).toContain('[LLM增强] 行业景气度提升')
    })
  })

  describe('callLLM 输入防护', () => {
    it('baseResult.score 为 NaN 时应使用 0', async () => {
      mockLlmChatSuccess(JSON.stringify({
        score: 4.0,
        summary: '增强摘要',
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const calculator: LayerCalculator = {
        layerId: 'l4',
        calculate: vi.fn(async (_input: LayerInput) => ({
          layerId: 'l4' as LayerId,
          layerName: '测试层',
          score: NaN,
          summary: '测试摘要',
          risks: [],
          evidence: ['证据1'],
          weight: 0.1,
          weightedScore: 0,
          dataSources: [],
        })),
      }

      const enhanced = enhancer.enhance(calculator)
      const result = await enhanced.calculate(input)

      // 不应抛出 toFixed 错误
      expect(result.score).toBe(4.0)
    })

    it('baseResult.summary 为 undefined 时应使用默认值', async () => {
      mockLlmChatSuccess(JSON.stringify({
        score: 4.0,
        summary: '增强摘要',
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const calculator: LayerCalculator = {
        layerId: 'l4',
        calculate: vi.fn(async (_input: LayerInput) => ({
          layerId: 'l4' as LayerId,
          layerName: '测试层',
          score: 3.5,
          summary: undefined as unknown as string,
          risks: [],
          evidence: [],
          weight: 0.1,
          weightedScore: 0.35,
          dataSources: [],
        })),
      }

      const enhanced = enhancer.enhance(calculator)
      const result = await enhanced.calculate(input)

      // 不应抛出错误
      expect(result.score).toBe(4.0)
    })
  })
})

// ============================================================
// v6ScoreService.ts 异常处理测试
// ============================================================

describe('v6ScoreService.ts 异常处理', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    vi.clearAllMocks()
  })

  describe('buildEngineInput 输入校验', () => {
    it('stock.price 为 NaN 应记录警告', async () => {
      const stock = {
        ...MOCK_STOCK_HIGH_QUALITY,
        price: NaN,
      }
      await dataLayer.stocks.add(stock)

      await runV6Score(stock.symbol)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('stock.price 无效'),
      )
    })

    it('stock.price 为 undefined 应记录警告', async () => {
      const stock = {
        ...MOCK_STOCK_HIGH_QUALITY,
        price: undefined,
      }
      await dataLayer.stocks.add(stock)

      await runV6Score(stock.symbol)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('stock.price 无效'),
      )
    })
  })

  describe('compositeToV6Score 分数校验', () => {
    it('composite.score 为 NaN 应降级为 0', async () => {
      const stock = {
        ...MOCK_STOCK_HIGH_QUALITY,
      }
      await dataLayer.stocks.add(stock)

      // Mock 引擎返回 NaN 分数
      vi.mock('@/services/scoring/v6-engine', async () => {
        const actual = await vi.importActual('@/services/scoring/v6-engine')
        return {
          ...actual,
          createV6Engine: () => ({
            calculateAll: async () => ({
              score: NaN,
              rating: 'hold' as const,
              layers: {},
              allRisks: [],
              recommendation: '测试',
              timestamp: Date.now(),
              engineVersion: 'v6-test',
            }),
          }),
        }
      })

      const result = await runV6Score(stock.symbol)

      if (result.success) {
        expect(result.data!.score).toBe(0)
      }
    })
  })
})

// ============================================================
// 辅助函数
// ============================================================

function createMockLayerScore(layerId: LayerId, score: number): LayerScore {
  return {
    layerId,
    layerName: `测试层 ${layerId}`,
    score,
    summary: '测试摘要',
    risks: [],
    evidence: [],
    weight: 0.1,
    weightedScore: score * 0.1,
    dataSources: [],
  }
}
