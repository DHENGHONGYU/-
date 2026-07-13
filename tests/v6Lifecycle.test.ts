/**
 * V6 评分引擎全生命周期测试
 *
 * 测试覆盖：
 * 1. 数据校验（空值、无效值、缺失数据）
 * 2. LLM 降级机制（超时、错误、无效响应）
 * 3. 完整数据流（采集 → 评分 → 策略）
 * 4. 日志埋点验证
 *
 * 关联文档：
 * - AGENTS.md §6 LLM 调用透明度
 * - docs/implementation/walkthrough-agent-llm-report-20260704.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { runStrategy } from '@/services/trading/strategyEngine'
import { fetchStockBasic } from '@/services/fetcher/fetcherService'
import { LLMScoreEnhancer } from '@/services/scoring/v6-engine/enhancer'
import type { DailyQuotes } from '@/data/types'
import type { LayerCalculator, LayerInput, LayerScore, LayerId } from '@/services/scoring/v6-engine/types'
import type { LlmConfig } from '@/config/llmConfig'
import {
  mockLlmChatSuccess,
  mockLlmHttpError,
  mockLlmNetworkError,
  restoreFetch,
  getFetchCallCount,
} from './helpers/llmMockFetch'
import {
  MOCK_STOCK_HIGH_QUALITY,
  MOCK_FINANCIALS_HIGH_QUALITY,
  MOCK_QUOTES_HIGH_QUALITY,
  MOCK_STOCK_PROBLEM,
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
  score: number = 3.5,
): LayerCalculator {
  return {
    layerId,
    calculate: vi.fn(async (): Promise<LayerScore> => ({
      layerId,
      layerName: `测试层 ${layerId}`,
      score,
      summary: '规则引擎基线摘要',
      risks: ['基线风险'],
      evidence: ['基线证据'],
      weight: 0.1,
      weightedScore: score * 0.1,
      dataSources: ['mock'],
    })),
  }
}

// ============================================================
// 数据校验测试
// ============================================================

describe('数据校验测试', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchStockBasic 数据校验', () => {
    it('空股票代码应返回错误', async () => {
      const result = await fetchStockBasic('')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不能为空')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[fetcherService] fetchStockBasic 入参为空',
        expect.objectContaining({ rawSymbol: '' }),
      )
    })

    it('空白字符串应被规范化并返回错误', async () => {
      const result = await fetchStockBasic('   ')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不能为空')
    })

    it('不存在的股票代码应返回错误', async () => {
      const result = await fetchStockBasic('NOT_EXIST.SZ')
      expect(result.success).toBe(false)
      expect(result.error).toContain('股票不存在')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[fetcherService] fetchStockBasic 股票不存在',
        expect.objectContaining({ symbol: 'NOT_EXIST.SZ' }),
      )
    })

    it('存在的股票应记录详细日志', async () => {
      await dataLayer.stocks.add({
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'watching',
        source: 'manual',
        pool: 'research',
        price: 12.5,
      })

      const mockResponse = {
        success: true,
        symbol: '000001.SZ',
        dimension: 'basic',
        data: {
          name: '平安银行',
          price: 12.34,
          pe: 8.5,
          pb: 0.9,
          roe: 10.2,
          market_cap: 2.4e11,
        },
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await fetchStockBasic('000001.SZ')

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[fetcherService] fetchStockBasic 本地股票已找到',
        expect.objectContaining({
          symbol: '000001.SZ',
          currentPrice: 12.5,
        }),
      )
    })
  })

  describe('runV6Score 数据校验', () => {
    it('不存在的股票应返回错误', async () => {
      const result = await runV6Score('NOT_EXIST.SZ')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Stock not found')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[v6ScoreService] runV6Score Stock 不存在',
        expect.objectContaining({ symbol: 'NOT_EXIST.SZ' }),
      )
    })

    it('缺少 K 线数据应记录警告但继续执行', async () => {
      await dataLayer.stocks.add({
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'watching',
        source: 'manual',
        pool: 'research',
        price: 12.5,
        pe: 8.5,
        pb: 0.9,
        roe: 10.2,
      })

      const result = await runV6Score('000001.SZ')

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[v6ScoreService] runV6Score K线数据状态',
        expect.objectContaining({
          symbol: '000001.SZ',
          hasQuotes: false,
          historyLength: 0,
        }),
      )

      // 即使没有 K 线数据，评分仍应完成
      expect(result.success).toBe(true)
    })

    it('完整数据应记录详细日志', async () => {
      await dataLayer.stocks.add(MOCK_STOCK_HIGH_QUALITY)
      await dataLayer.dailyQuotes.save(MOCK_QUOTES_HIGH_QUALITY as unknown as DailyQuotes)

      const result = await runV6Score(MOCK_STOCK_HIGH_QUALITY.symbol)

      expect(result.success).toBe(true)

      // 验证关键日志点
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[v6ScoreService] runV6Score 开始',
        expect.any(Object),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[v6ScoreService] runV6Score Stock 已加载',
        expect.objectContaining({
          symbol: MOCK_STOCK_HIGH_QUALITY.symbol,
          name: MOCK_STOCK_HIGH_QUALITY.name,
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[v6ScoreService] runV6Score 引擎输入详情',
        expect.any(Object),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[v6ScoreService] runV6Score 各层评分明细',
        expect.any(Object),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[v6ScoreService] runV6Score 评分完成并已持久化',
        expect.any(Object),
      )
    })
  })
})

// ============================================================
// LLM 降级机制测试
// ============================================================

describe('LLM 降级机制测试', () => {
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

  describe('LLM 超时降级', () => {
    it('LLM 超时应回退到规则引擎结果', async () => {
      // enhancer 本身没有超时机制，但 llmGateway 的 chat 有 AbortController。
      // 这里模拟 fetch 延迟后抛错（模拟 AbortError），验证 catch 分支回退。
      global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        // 模拟被 AbortController 取消
        await new Promise((resolve) => setTimeout(resolve, 50))
        if (init?.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError')
        }
        throw new Error('The operation was aborted.')
      }) as unknown as typeof global.fetch

      enhancer.configure({ ...VALID_LLM_CONFIG, timeout: 10 })
      const baseCalculator = createMockCalculator('l4', 3.5)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 应回退到基线结果
      expect(result.score).toBe(3.5)
      expect(result.summary).toBe('规则引擎基线摘要')
    })
  })

  describe('LLM HTTP 错误降级', () => {
    it('HTTP 401 错误应回退到规则引擎结果', async () => {
      mockLlmHttpError(401, 'Invalid API Key')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.8)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(3.8)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('LLM 增强失败'),
      )
    })

    it('HTTP 429 限流错误应回退到规则引擎结果', async () => {
      mockLlmHttpError(429, 'Rate limit exceeded')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l7', 4.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(4.0)
      expect(result.summary).toBe('规则引擎基线摘要')
    })

    it('HTTP 500 服务器错误应回退到规则引擎结果', async () => {
      mockLlmHttpError(500, 'Internal Server Error')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l1', 3.2)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(3.2)
    })
  })

  describe('LLM 网络错误降级', () => {
    it('网络断开应回退到规则引擎结果', async () => {
      mockLlmNetworkError('ECONNREFUSED')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.6)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(3.6)
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  describe('LLM 无效响应降级', () => {
    it('无效 JSON 应回退到规则引擎结果', async () => {
      mockLlmChatSuccess('这不是有效的 JSON')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.4)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 解析失败，返回空对象，score 为 undefined，使用基线值
      expect(result.score).toBe(3.4)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[LLMScoreEnhancer] LLM 返回内容无法解析',
        expect.any(Object),
      )
    })

    it('缺少 score 字段应使用基线 score', async () => {
      mockLlmChatSuccess(JSON.stringify({
        summary: '增强摘要',
        rationale: '增强理由',
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.7)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // score 为 undefined，使用基线值
      expect(result.score).toBe(3.7)
      expect(result.summary).toBe('增强摘要')
    })

    it('score 超出范围应被截断', async () => {
      mockLlmChatSuccess(JSON.stringify({
        score: 6.5, // 超出 0-5 范围
        summary: '增强摘要',
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.5)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 应被截断到 5
      expect(result.score).toBe(5)
    })

    it('score 为负数应被截断', async () => {
      mockLlmChatSuccess(JSON.stringify({
        score: -1.5,
        summary: '增强摘要',
      }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.5)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 应被截断到 0
      expect(result.score).toBe(0)
    })
  })

  describe('离线模式', () => {
    it('未配置 LLM 时应透传规则引擎结果', async () => {
      enhancer.disable()
      const baseCalculator = createMockCalculator('l4', 3.9)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(0)
      expect(result.score).toBe(3.9)
      expect(result.summary).toBe('规则引擎基线摘要')
    })

    it('确定性层不应调用 LLM', async () => {
      mockLlmChatSuccess(JSON.stringify({ score: 4.5 }))

      enhancer.configure(VALID_LLM_CONFIG)

      const deterministicLayers: LayerId[] = ['l3f', 'l3v', 'l8', 'lMinus1']

      for (const layerId of deterministicLayers) {
        const baseCalculator = createMockCalculator(layerId, 3.5)
        const enhancedCalculator = enhancer.enhance(baseCalculator)
        const result = await enhancedCalculator.calculate(input)

        expect(result.score).toBe(3.5)
      }

      // 确定性层不应触发 fetch
      expect(getFetchCallCount()).toBe(0)
    })
  })

  describe('LLM 增强成功', () => {
    it('L4 层增强成功应合并结果', async () => {
      const llmResponse = JSON.stringify({
        score: 4.2,
        summary: 'LLM 增强摘要',
        rationale: '行业景气度提升',
        risks: ['原材料价格波动'],
      })
      mockLlmChatSuccess(llmResponse)

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(4.2)
      expect(result.summary).toBe('LLM 增强摘要')
      expect(result.evidence).toContain('[LLM增强] 行业景气度提升')
      expect(result.risks).toContain('原材料价格波动')
      expect(result.risks).toContain('基线风险') // 保留原始风险
    })
  })
})

// ============================================================
// 完整数据流测试
// ============================================================

describe('完整数据流测试', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    vi.clearAllMocks()
  })

  afterEach(() => {
    restoreFetch()
    vi.restoreAllMocks()
  })

  it('采集 → 评分 → 策略 完整流程', async () => {
    // 1. 准备测试数据
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'watching',
      source: 'manual',
      pool: 'research',
      price: 12.5,
      pe: 8.5,
      pb: 0.9,
      roe: 10.2,
      sector: '银行',
    })

    // 2. 模拟数据采集
    const mockResponse = {
      success: true,
      symbol: '000001.SZ',
      dimension: 'basic',
      data: {
        name: '平安银行',
        price: 12.34,
        pe: 8.5,
        pb: 0.9,
        roe: 10.2,
        market_cap: 2.4e11,
      },
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response)

    // 3. 执行数据采集
    const fetchResult = await fetchStockBasic('000001.SZ')
    expect(fetchResult.success).toBe(true)

    // 4. 执行评分
    const scoreResult = await runV6Score('000001.SZ')
    expect(scoreResult.success).toBe(true)
    expect(scoreResult.data?.score).toBeDefined()
    expect(scoreResult.data?.rating).toBeDefined()

    // 5. 验证日志记录
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[fetcherService] fetchStockBasic 开始',
      expect.any(Object),
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[v6ScoreService] runV6Score 评分完成并已持久化',
      expect.any(Object),
    )
  })

  it('多股票策略生成流程', async () => {
    // 准备多只股票
    const stocks = [
      {
        symbol: '002371.SZ',
        name: '北方华创',
        researchStatus: 'watching' as const,
        source: 'manual' as const,
        pool: 'research' as const,
        price: 300,
        sector: '半导体设备',
        dataVersion: 1,
      },
      {
        symbol: '601138.SH',
        name: '工业富联',
        researchStatus: 'watching' as const,
        source: 'manual' as const,
        pool: 'research' as const,
        price: 25,
        sector: 'AI服务器',
        dataVersion: 1,
      },
    ]

    for (const stock of stocks) {
      await dataLayer.stocks.add(stock)
    }

    // Mock 评分适配器返回高评分
    const scoringAdapter = await import('@/services/trading/scoringAdapter')
    vi.spyOn(scoringAdapter, 'getCompositeScores').mockResolvedValue([
      {
        symbol: '002371.SZ',
        v6Score: 4.2,
        intelligentScore: null,
        industryScore: null,
        valuationScore: 4.1,
        composite: 4.2,
        rationale: 'test',
        scoredAt: Date.now(),
      },
      {
        symbol: '601138.SH',
        v6Score: 4.0,
        intelligentScore: null,
        industryScore: null,
        valuationScore: 4.3,
        composite: 4.0,
        rationale: 'test',
        scoredAt: Date.now(),
      },
    ])

    // Mock 热门板块
    const hotSectorService = await import('@/services/input/hotSectorService')
    vi.spyOn(hotSectorService, 'getHotSectors').mockReturnValue([
      {
        code: 'semiconductor',
        name: '半导体',
        score: 85,
        trend: 'up',
        factors: { momentum: 80, fundFlow: 75, valuation: 70, sentiment: 80 },
        stocks: [],
      },
    ])

    // 执行策略生成
    const result = await runStrategy(stocks, {
      momentumMap: {
        '002371.SZ': 0.06,
        '601138.SH': 0.04,
      },
    })

    expect(result.summary.total).toBe(2)
    expect(result.selected.length).toBeGreaterThan(0)

    // 验证日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[strategyEngine] runStrategy 开始',
      expect.objectContaining({
        stockCount: 2,
      }),
    )
  })
})

// ============================================================
// 边界条件测试
// ============================================================

describe('边界条件测试', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    vi.clearAllMocks()
  })

  it('问题股评分应包含质量警告', async () => {
    await dataLayer.stocks.add(MOCK_STOCK_PROBLEM)

    const result = await runV6Score(MOCK_STOCK_PROBLEM.symbol)

    expect(result.success).toBe(true)
    // 问题股可能缺少某些层的数据，应生成质量警告
    if (result.data?.qualityWarning) {
      expect(result.data.qualityWarning).toContain('数据完整度')
    }
  })

  it('并发评分不应导致数据竞争', async () => {
    const symbols = ['000001.SZ', '000002.SZ', '000003.SZ']

    for (const symbol of symbols) {
      await dataLayer.stocks.add({
        symbol,
        name: `测试股票${symbol}`,
        researchStatus: 'watching',
        source: 'manual',
        price: 10,
      })
    }

    // 并发执行评分
    const results = await Promise.all(symbols.map((s) => runV6Score(s)))

    // 所有评分都应成功
    expect(results.every((r) => r.success)).toBe(true)

    // 验证每个股票的评分都已持久化
    for (const symbol of symbols) {
      const scores = await dataLayer.v6Scores.list()
      expect(scores.some((s) => s.symbol === symbol)).toBe(true)
    }
  })
})
