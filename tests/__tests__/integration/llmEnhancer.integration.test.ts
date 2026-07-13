// ============================================================
// LLMScoreEnhancer 集成测试 — L4/L7 增强层在真实 LLM 调用场景下的行为验证
// ============================================================
// 测试目标（依据穿行测试报告 docs/implementation/walkthrough-agent-llm-report-20260704.md 改进建议）:
//   1. 验证 L4/L7 层启用 LLM 增强后，chat 被真实调用且结果合并到 baseResult
//   2. 验证 L3f/L3v/L8 等确定性层不调用 LLM（即使 enhancer 启用）
//   3. 验证 L4/L7 增强失败（HTTP 错误/网络错误/超时/无效 JSON）时回退到 baseResult
//   4. 验证离线模式（未配置 LLM）与禁用模式透传原始结果
//   5. 验证评分边界处理（score>5 / score<0 / 非数字）
//   6. 验证 LLM 输出中的 XSS 内容处理情况（文档化当前未消毒的限制）
//   7. 文档化 AGENTS.md §6 与 enhancer.ts 实现的冲突点
//
// 被测模块:
//   - src/services/scoring/v6-engine/enhancer.ts（LLMScoreEnhancer，使用真实实现）
//   - src/services/llm/llmClient.ts（chat 函数，使用真实实现 + mock fetch）
//
// Mock 策略:
//   - global.fetch → 由 tests/helpers/llmMockFetch.ts 提供的 mock fetch
//   - @/lib/logger → 替换为 vi.fn 占位
//   - @/config/llmConfig → getLlmApiKeyAsync/getDefaultLlmConfig 返回固定 mock 值
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LLMScoreEnhancer } from '@/services/scoring/v6-engine/enhancer'
import type { Citation } from '@/services/scoring/v6-engine/enhancer'
import type {
  LayerCalculator,
  LayerInput,
  LayerScore,
  LayerId,
} from '@/services/scoring/v6-engine/types'
import type { LlmConfig } from '@/config/llmConfig'
import {
  mockLlmChatSuccess,
  mockLlmHttpError,
  mockLlmNetworkError,
  mockLlmCustomResponse,
  restoreFetch,
  resetFetchMock,
  getFetchCallCount,
  getLastFetchCall,
  getFetchCalls,
} from '../../helpers/llmMockFetch'

// ============================================================
// vi.hoisted Mock: 隔离 logger 与 llmConfig 的副作用
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

// llmConfig 的副作用：1) getLlmApiKeyAsync 读取 localStorage；2) getDefaultLlmConfig 读取 env
// 测试中通过 configure() 显式传入完整 LlmConfig，不会触发这些副作用，但仍需 mock 以防 fallback
vi.mock('@/config/llmConfig', async () => {
  const actual = await vi.importActual<typeof import('@/config/llmConfig')>('@/config/llmConfig')
  return {
    ...actual,
    getLlmApiKeyAsync: vi.fn().mockResolvedValue('mock-api-key-from-localStorage'),
    getDefaultLlmConfig: (): LlmConfig => ({
      baseURL: 'https://api.deepseek.com',
      apiKey: 'mock-default-api-key',
      model: 'deepseek-v4-flash',
    }),
  }
})

// ============================================================
// 测试夹具：构造 mock LayerCalculator / LayerInput / LlmConfig
// ============================================================

const VALID_LLM_CONFIG: LlmConfig = {
  baseURL: 'https://api.deepseek.com',
  apiKey: 'test-api-key-12345',
  model: 'deepseek-v4-flash',
  maxTokens: 1024,
  temperature: 0.2,
  timeout: 5000,
}

function createMockLayerCalculator(
  layerId: LayerId,
  baseScore: number = 3.5,
  baseSummary: string = '规则引擎计算的基线摘要',
): LayerCalculator {
  const baseResult: LayerScore = {
    layerId,
    layerName: `测试层 ${layerId}`,
    score: baseScore,
    summary: baseSummary,
    risks: ['基线风险一'],
    evidence: ['基线证据一', '基线证据二'],
    weight: 0.1,
    weightedScore: baseScore * 0.1,
    dataSources: ['mock-source'],
  }

  return {
    layerId,
    calculate: vi.fn(async (_input: LayerInput): Promise<LayerScore> => {
      return { ...baseResult }
    }),
  }
}

function createMockLayerInput(): LayerInput {
  return {
    stock: {
      symbol: '600519',
      name: '贵州茅台',
      sector: '白酒',
      price: 1800,
      marketCap: 22600,
      pe: 30,
      pb: 10,
      roe: 30,
    },
    financials: {
      revenue: 1240,
      revenueYoY: 0.16,
      netProfit: 590,
      netProfitYoY: 0.19,
      grossMargin: 0.91,
      netMargin: 0.48,
      operatingCF: 650,
      rdRatio: 0.02,
    },
    quotes: {
      latestClose: 1800,
      return20d: 0.05,
      volatility20d: 0.02,
      avgTurnover20d: 0.008,
      return60d: 0.12,
      history: [1700, 1750, 1800],
      volumeHistory: [100000, 120000, 110000],
    },
    config: {
      // 简化的引擎配置，仅包含必要字段；测试不依赖具体阈值
      weights: { l4: 0.1, l7: 0.1 },
      thresholds: {},
    } as unknown as LayerInput['config'],
  }
}

/** 构造 LLM 增强响应 JSON 字符串 */
function buildLlmEnhanceResponse(options: {
  score?: number
  summary?: string
  rationale?: string
  risks?: string[]
  citations?: Citation[]
}): string {
  // M2 依据追溯闸：当 mock 调整评分但未显式提供 citations 时，自动补充默认引用，
  // 确保测试聚焦在增强合并逻辑本身，而非被引证闸回退。
  const defaultCitations: Citation[] | undefined =
    typeof options.score === 'number' ? [{ source: '测试研报', content: '测试引用内容' }] : undefined

  return JSON.stringify({
    score: options.score,
    summary: options.summary,
    rationale: options.rationale,
    risks: options.risks,
    citations: options.citations ?? defaultCitations,
  })
}

// ============================================================
// 测试套件
// ============================================================

describe('LLMScoreEnhancer 集成测试 — L4/L7 增强层 LLM 调用场景', () => {
  let enhancer: LLMScoreEnhancer
  let input: LayerInput

  beforeEach(() => {
    enhancer = new LLMScoreEnhancer()
    input = createMockLayerInput()
    vi.clearAllMocks()
  })

  afterEach(() => {
    restoreFetch()
  })

  // ------------------------------------------------------------
  // 场景 1：L4 层启用 LLM 增强，验证 chat 被真实调用且结果合并
  // ------------------------------------------------------------
  describe('L4 层 LLM 增强（真实 fetch 调用）', () => {
    it('L4 启用 LLM 增强后，应调用 fetch 且合并 score/summary/evidence/risks', async () => {
      // 准备：mock fetch 返回 LLM 增强结果
      const llmResponse = buildLlmEnhanceResponse({
        score: 4.2,
        summary: 'LLM 复核后增强摘要',
        rationale: '行业景气度提升，订单覆盖率超预期',
        risks: ['原材料价格波动', '竞争对手扩产'],
      })
      mockLlmChatSuccess(llmResponse, { model: 'deepseek-v4-flash' })

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0, '规则引擎基线')
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      // 执行
      const result = await enhancedCalculator.calculate(input)

      // 验证：fetch 被调用一次
      expect(getFetchCallCount()).toBe(1)

      // 验证：请求 URL 拼接正确
      const lastCall = getLastFetchCall()
      expect(lastCall?.url).toBe('https://api.deepseek.com/v1/chat/completions')
      expect(lastCall?.method).toBe('POST')
      expect(lastCall?.headers['Authorization']).toBe(`Bearer ${VALID_LLM_CONFIG.apiKey}`)
      expect(lastCall?.headers['Content-Type']).toBe('application/json')

      // 验证：请求体包含 model / messages
      const body = lastCall?.body as Record<string, unknown>
      expect(body['model']).toBe('deepseek-v4-flash')
      expect(Array.isArray(body['messages'])).toBe(true)
      const messages = body['messages'] as Array<{ role: string; content: string }>
      expect(messages).toHaveLength(2)
      expect(messages[0]!.role).toBe('system')
      expect(messages[1]!.role).toBe('user')

      // 验证：结果合并正确
      expect(result.layerId).toBe('l4')
      expect(result.score).toBe(4.2) // LLM 增强分数覆盖
      expect(result.summary).toBe('LLM 复核后增强摘要')
      // evidence 末尾追加 [LLM增强] 前缀的 rationale
      expect(result.evidence).toContain('[LLM增强] 行业景气度提升，订单覆盖率超预期')
      // baseResult 的原始 evidence 保留
      expect(result.evidence).toContain('基线证据一')
      expect(result.evidence).toContain('基线证据二')
      // risks 合并：原 risks + LLM risks
      expect(result.risks).toContain('基线风险一')
      expect(result.risks).toContain('原材料价格波动')
      expect(result.risks).toContain('竞争对手扩产')
    })

    it('L4 LLM 增强应透传 baseResult 的 layerId/layerName/weight/weightedScore/dataSources', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.5 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 透传字段验证
      expect(result.layerId).toBe('l4')
      expect(result.layerName).toBe('测试层 l4')
      expect(result.weight).toBe(0.1)
      expect(result.dataSources).toEqual(['mock-source'])
      // weightedScore 不会重新计算（enhancer 不重算加权值）
      // 使用 toBeCloseTo 避免浮点精度问题（3.0 * 0.1 = 0.30000000000000004）
      expect(result.weightedScore).toBeCloseTo(0.3, 10)
    })

    it('L4 LLM 请求体应包含温度与 max_tokens 参数', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4')
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      await enhancedCalculator.calculate(input)

      const lastCall = getLastFetchCall()
      const body = lastCall?.body as Record<string, unknown>
      expect(body['temperature']).toBe(0.2)
      expect(body['max_tokens']).toBe(1024)
    })

    it('L4 LLM 请求体应包含 layerId 与 baseResult 上下文（system prompt）', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0, '规则摘要内容')
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      await enhancedCalculator.calculate(input)

      const lastCall = getLastFetchCall()
      const body = lastCall?.body as Record<string, unknown>
      const messages = body['messages'] as Array<{ role: string; content: string }>
      const systemPrompt = messages[0]!.content
      // system prompt 应包含层名、规则引擎评分、规则引擎摘要
      expect(systemPrompt).toContain('测试层 l4')
      expect(systemPrompt).toContain('3.00')
      expect(systemPrompt).toContain('规则摘要内容')
    })
  })

  // ------------------------------------------------------------
  // 场景 2：L7 层启用 LLM 增强，验证 chat 被真实调用且结果合并
  // ------------------------------------------------------------
  describe('L7 层 LLM 增强（真实 fetch 调用）', () => {
    it('L7 启用 LLM 增强后，应调用 fetch 且合并结果', async () => {
      const llmResponse = buildLlmEnhanceResponse({
        score: 4.8,
        summary: '第二曲线增强摘要',
        rationale: '新业务线增长强劲，已贡献 15% 营收',
        risks: ['新业务亏损扩大'],
      })
      mockLlmChatSuccess(llmResponse)

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l7', 3.5, 'L7 基线')
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(1)
      expect(result.layerId).toBe('l7')
      expect(result.score).toBe(4.8)
      expect(result.summary).toBe('第二曲线增强摘要')
      expect(result.evidence).toContain('[LLM增强] 新业务线增长强劲，已贡献 15% 营收')
      expect(result.risks).toContain('新业务亏损扩大')
    })

    it('L7 LLM 增强应保留 baseResult 中的原始 risks', async () => {
      mockLlmChatSuccess(
        buildLlmEnhanceResponse({
          score: 4.0,
          risks: ['LLM 识别的新风险'],
        }),
      )

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l7', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 原始 risks 保留，LLM risks 追加
      expect(result.risks).toEqual(['基线风险一', 'LLM 识别的新风险'])
    })
  })

  // ------------------------------------------------------------
  // 场景 3：L3f/L3v/L8 等确定性层不调用 LLM
  // ------------------------------------------------------------
  describe('确定性层不调用 LLM（AGENTS.md §6 一致性）', () => {
    it.each([
      ['l3f' as LayerId, 'L3a 财务健康'],
      ['l3v' as LayerId, 'L3b 估值水平'],
      ['l8' as LayerId, 'L8 技术筹码'],
      ['lMinus1' as LayerId, 'L-1 行业评分'],
    ])(
      '%s 层启用 enhancer 后不应调用 fetch（确定性层）',
      async (layerId: LayerId, _label: string) => {
        // 即使配置了 LLM，确定性层也不应触发 fetch
        mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 5.0 }))

        enhancer.configure(VALID_LLM_CONFIG)
        const baseCalculator = createMockLayerCalculator(layerId, 3.5)
        const enhancedCalculator = enhancer.enhance(baseCalculator)

        const result = await enhancedCalculator.calculate(input)

        expect(getFetchCallCount()).toBe(0)
        // 透传 baseResult，未增强
        expect(result.score).toBe(3.5)
        expect(result.evidence).not.toContain(
          expect.stringContaining('[LLM增强]'),
        )
      },
    )

    it('L3f 确定性层 baseCalculator.calculate 应被调用一次（验证透传链路）', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 5.0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l3f', 3.5)
      const calculateSpy = baseCalculator.calculate as ReturnType<typeof vi.fn>
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      await enhancedCalculator.calculate(input)

      expect(calculateSpy).toHaveBeenCalledTimes(1)
      expect(calculateSpy).toHaveBeenCalledWith(input)
    })
  })

  // ------------------------------------------------------------
  // 场景 4：L4/L7 增强失败时回退到 baseResult
  // ------------------------------------------------------------
  describe('L4/L7 增强失败的回退机制', () => {
    it('LLM HTTP 401 错误时应回退到 baseResult 且不抛异常', async () => {
      mockLlmHttpError(401, 'Invalid API Key')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.2, 'L4 基线')
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // fetch 被调用但失败，回退到 baseResult
      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(3.2)
      expect(result.summary).toBe('L4 基线')
      expect(result.evidence).toEqual(['基线证据一', '基线证据二'])
      expect(result.risks).toEqual(['基线风险一'])
      // 应记录 warn 日志
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('LLM HTTP 429 限流错误时应回退到 baseResult', async () => {
      mockLlmHttpError(429, 'Rate limit exceeded')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l7', 4.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(4.0)
      expect(getFetchCallCount()).toBe(1)
    })

    it('LLM HTTP 500 服务器错误时应回退到 baseResult', async () => {
      mockLlmHttpError(500, 'Internal Server Error')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(3.0)
    })

    it('LLM 网络错误（fetch 抛出异常）时应回退到 baseResult', async () => {
      mockLlmNetworkError('ECONNREFUSED')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(3.0)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('LLM 返回非 JSON 内容时应回退到 baseResult（parseResponse 容错）', async () => {
      // LLM 返回纯文本，无法解析为 JSON
      mockLlmChatSuccess('这不是 JSON 格式的响应内容')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0, 'L4 基线')
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // fetch 成功但 parseResponse 失败，返回空对象，score/summary/rationale 均为 undefined
      // enhancer 使用 ?? 回退到 baseResult 的字段，rationale 为空时不添加 [LLM增强] 证据
      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(3.0)
      expect(result.summary).toBe('L4 基线')
      // parseResponse 返回 {} 时 rationale 为 undefined，evidence 保持基线证据不变
      expect(result.evidence).toEqual(['基线证据一', '基线证据二'])
    })

    it('LLM 返回带 ```json 代码块包装的 JSON 时应正确解析', async () => {
      const wrappedJson = '```json\n{"score":4.6,"summary":"代码块包装的响应","rationale":"理由","risks":["风险"],"citations":[{"source":"测试研报","content":"测试引用"}]}\n```'
      mockLlmChatSuccess(wrappedJson)

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(4.6)
      expect(result.summary).toBe('代码块包装的响应')
      expect(result.risks).toContain('风险')
    })

    it('L4 增强失败时 baseResult.evidence 应原样保留（不追加 [LLM增强]）', async () => {
      mockLlmHttpError(500, 'Server Error')

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 失败回退时 evidence 不应包含 [LLM增强]
      expect(result.evidence).toEqual(['基线证据一', '基线证据二'])
      expect(result.evidence.some((e) => e.includes('[LLM增强]'))).toBe(false)
    })
  })

  // ------------------------------------------------------------
  // 场景 5：离线模式（未配置 LLM）时透传
  // ------------------------------------------------------------
  describe('离线模式与禁用模式透传', () => {
    it('未调用 configure() 时 enhancer 应处于禁用状态，不调用 fetch', async () => {
      // 不配置 LLM
      const baseCalculator = createMockLayerCalculator('l4', 3.5)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(0)
      expect(result.score).toBe(3.5)
      expect(enhancer.isEnabled()).toBe(false)
    })

    it('configure 传入不完整配置（缺 apiKey）时不应启用增强', async () => {
      const incompleteConfig: LlmConfig = {
        baseURL: 'https://api.deepseek.com',
        apiKey: '', // 空 apiKey
        model: 'deepseek-v4-flash',
      }

      enhancer.configure(incompleteConfig)

      expect(enhancer.isEnabled()).toBe(false)
      // 即便调用 enhance，也不会触发 fetch
      const baseCalculator = createMockLayerCalculator('l4', 3.5)
      const enhancedCalculator = enhancer.enhance(baseCalculator)
      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(0)
      expect(result.score).toBe(3.5)
    })

    it('configure 传入不完整配置（缺 baseURL）时不应启用增强', async () => {
      const incompleteConfig: LlmConfig = {
        baseURL: '',
        apiKey: 'test-key',
        model: 'deepseek-v4-flash',
      }

      enhancer.configure(incompleteConfig)

      expect(enhancer.isEnabled()).toBe(false)
    })

    it('configure 传入不完整配置（缺 model）时不应启用增强', async () => {
      const incompleteConfig: LlmConfig = {
        baseURL: 'https://api.deepseek.com',
        apiKey: 'test-key',
        model: '',
      }

      enhancer.configure(incompleteConfig)

      expect(enhancer.isEnabled()).toBe(false)
    })

    it('disable() 后即使曾 configure 过也不应调用 fetch', async () => {
      enhancer.configure(VALID_LLM_CONFIG)
      expect(enhancer.isEnabled()).toBe(true)

      enhancer.disable()
      expect(enhancer.isEnabled()).toBe(false)

      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 5.0 }))
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)
      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(0)
      expect(result.score).toBe(3.0)
    })

    it('configure → disable → configure 应能重新启用', async () => {
      enhancer.configure(VALID_LLM_CONFIG)
      enhancer.disable()
      enhancer.configure(VALID_LLM_CONFIG)

      expect(enhancer.isEnabled()).toBe(true)

      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.5 }))
      const baseCalculator = createMockLayerCalculator('l7', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)
      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(4.5)
    })
  })

  // ------------------------------------------------------------
  // 场景 6：评分边界处理（score > 5 / score < 0 / 非数字）
  // ------------------------------------------------------------
  describe('LLM 增强评分边界处理', () => {
    it('LLM 返回 score > 5 时应被 clamp 到 5', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 8.5 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(5)
    })

    it('LLM 返回 score < 0 时应被 clamp 到 0', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: -2.3 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(0)
    })

    it('LLM 返回 score 为字符串时应被视为无效，回退到 baseResult.score', async () => {
      // score 是字符串而非 number
      mockLlmChatSuccess(JSON.stringify({ score: '4.5', summary: '摘要' }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 字符串 score 被识别为无效，使用 baseResult.score
      expect(result.score).toBe(3.0)
      // summary 仍使用 LLM 的
      expect(result.summary).toBe('摘要')
    })

    it('LLM 返回 score 为 null 时应回退到 baseResult.score', async () => {
      mockLlmChatSuccess(JSON.stringify({ score: null, summary: '摘要' }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(3.0)
    })

    it('LLM 未返回 score 字段时应回退到 baseResult.score', async () => {
      mockLlmChatSuccess(JSON.stringify({ summary: '只有摘要' }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(3.0)
      expect(result.summary).toBe('只有摘要')
    })

    it('LLM 返回 score=0（边界值）时应被保留，不回退', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // score=0 是有效数字，应使用 LLM 的 0 而非 baseResult 的 3.0
      expect(result.score).toBe(0)
    })

    it('LLM 返回 score=5（边界值）时应被保留', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 5 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.score).toBe(5)
    })

    it('LLM 返回 risks 非数组时应被视为 undefined，仅保留 baseResult.risks', async () => {
      mockLlmChatSuccess(JSON.stringify({ score: 4.0, risks: '应为数组但给了字符串' }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.risks).toEqual(['基线风险一'])
    })

    it('LLM 返回 risks 为数字数组时应被 String 转换', async () => {
      mockLlmChatSuccess(
        JSON.stringify({ score: 4.0, risks: [123, 456] }),
      )

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.risks).toEqual(['基线风险一', '123', '456'])
    })
  })

  // ------------------------------------------------------------
  // 场景 7：LLM 输出中的 XSS 内容处理验证（文档化当前未消毒的限制）
  // ------------------------------------------------------------
  describe('LLM 输出 XSS 内容处理（当前实现限制文档化）', () => {
    it('已知限制：LLM 返回的 summary 含 <script> 标签时当前 enhancer 不消毒', async () => {
      // AGENTS.md §6 要求「LLM 输出必须经 sanitizeLlmOutput 消毒后渲染」
      // 但 enhancer.ts 的 parseResponse 直接使用 LLM 字段，未调用 sanitizeLlmOutput
      // 此测试文档化该限制，提醒后续修复
      const xssSummary = '<script>alert("xss")</script>恶意摘要'
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0, summary: xssSummary }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 当前实现：summary 原样保留（含 <script>），未消毒
      // 期望（修复后）：summary 应被消毒，不含 <script>
      expect(result.summary).toBe(xssSummary) // 当前行为：未消毒
      expect(result.summary).toContain('<script>') // 文档化限制
    })

    it('已知限制：LLM 返回的 rationale 含 <img onerror> 时当前 enhancer 不消毒', async () => {
      const xssRationale = '<img src=x onerror=alert(1)>理由'
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0, rationale: xssRationale }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // rationale 被拼接到 evidence 中，原样保留
      expect(result.evidence).toContain(`[LLM增强] ${xssRationale}`)
      expect(result.evidence.some((e) => e.includes('<img'))).toBe(true)
    })

    it('已知限制：LLM 返回的 risks 含 javascript: 协议时当前 enhancer 不消毒', async () => {
      const xssRisks = ['javascript:alert(1)']
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0, risks: xssRisks }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(result.risks).toContain('javascript:alert(1)')
    })

    it('建议修复方向：渲染层应调用 sanitizeLlmOutput 处理 enhancer 输出', async () => {
      // 此测试验证 sanitizeLlmOutput 能正确处理 LLM 输出中的 XSS 内容
      // 提醒：渲染 enhancer 输出前必须先消毒
      const { sanitizeLlmOutput } = await import('@/lib/xssSanitizer')

      const xssContent = '<script>alert(1)</script>正常内容'
      const sanitized = sanitizeLlmOutput(xssContent)

      // sanitizeLlmOutput 应移除 <script> 标签
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('</script>')
      expect(sanitized).toContain('正常内容')
    })
  })

  // ------------------------------------------------------------
  // 场景 8：AGENTS.md §6 与 enhancer.ts 实现的冲突点文档化
  // ------------------------------------------------------------
  describe('AGENTS.md §6 与 enhancer.ts LLM_ENHANCEABLE_LAYERS 的冲突点', () => {
    it('文档化冲突：AGENTS.md §6 声明 L4/L7 是确定性层，但 enhancer.ts 中 LLM_ENHANCEABLE_LAYERS 包含 L4/L7', async () => {
      // AGENTS.md §6 原文：「L3/L4/L7/L8 是确定性层（程序计算），L0/L1/L2/L5/L6 是 LLM 可增强层」
      // enhancer.ts 实现：LLM_ENHANCEABLE_LAYERS = new Set(['l0', 'l1', 'l2', 'l4', 'l5', 'l6', 'l7'])
      // 冲突点：L4/L7 在 AGENTS.md 中是确定性层，但在 enhancer.ts 中是 LLM 可增强层
      //
      // 此测试通过实际行为验证当前实现：L4 确实会被 LLM 增强
      // 后续需产品决策：① 修改 enhancer.ts 移除 L4/L7；② 或修改 AGENTS.md 文档
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.5 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      // 当前实现：L4 被 LLM 增强（与 AGENTS.md §6 冲突）
      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(4.5)
    })

    it('文档化冲突：L7 同样被 LLM 增强（与 AGENTS.md §6 冲突）', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.5 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l7', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(4.5)
    })

    it('一致性验证：L0/L1/L2/L5/L6 应被 LLM 增强（与 AGENTS.md §6 一致）', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.5 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l0', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(1)
      expect(result.score).toBe(4.5)
    })

    it('一致性验证：L8 不应被 LLM 增强（与 AGENTS.md §6 一致）', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 5.0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l8', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      const result = await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(0)
      expect(result.score).toBe(3.0)
    })
  })

  // ------------------------------------------------------------
  // 场景 9：多次调用与并发场景
  // ------------------------------------------------------------
  describe('多次调用与并发场景', () => {
    it('同一 enhanced calculator 多次调用应每次都触发 fetch', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const baseCalculator = createMockLayerCalculator('l4', 3.0)
      const enhancedCalculator = enhancer.enhance(baseCalculator)

      await enhancedCalculator.calculate(input)
      await enhancedCalculator.calculate(input)
      await enhancedCalculator.calculate(input)

      expect(getFetchCallCount()).toBe(3)
    })

    it('不同层的 enhanced calculator 应独立调用 fetch', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const l4Calculator = enhancer.enhance(createMockLayerCalculator('l4', 3.0))
      const l7Calculator = enhancer.enhance(createMockLayerCalculator('l7', 3.0))

      await l4Calculator.calculate(input)
      await l7Calculator.calculate(input)

      expect(getFetchCallCount()).toBe(2)
      const calls = getFetchCalls()
      // 第一次 L4，第二次 L7
      expect(calls[0]?.body).toHaveProperty('messages')
      expect(calls[1]?.body).toHaveProperty('messages')
    })

    it('并发调用 L4 与 L7 应都成功返回（无竞争条件）', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.5 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const l4Calculator = enhancer.enhance(createMockLayerCalculator('l4', 3.0))
      const l7Calculator = enhancer.enhance(createMockLayerCalculator('l7', 3.0))

      const [l4Result, l7Result] = await Promise.all([
        l4Calculator.calculate(input),
        l7Calculator.calculate(input),
      ])

      expect(getFetchCallCount()).toBe(2)
      expect(l4Result.layerId).toBe('l4')
      expect(l7Result.layerId).toBe('l7')
      expect(l4Result.score).toBe(4.5)
      expect(l7Result.score).toBe(4.5)
    })
  })

  // ------------------------------------------------------------
  // 场景 10：自定义响应 handler 验证（验证 llmMockFetch 工具的灵活性）
  // ------------------------------------------------------------
  describe('mock fetch 工具的灵活调用验证', () => {
    it('mockLlmCustomResponse 应支持根据请求内容动态返回不同响应', async () => {
      // 根据 system prompt 中的层名返回不同 score
      mockLlmCustomResponse((_url: string, init?: RequestInit) => {
        const body = JSON.parse(init?.body as string) as {
          messages: Array<{ content: string }>
        }
        const systemPrompt = body.messages[0]!.content

        if (systemPrompt.includes('测试层 l4')) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      score: 4.4,
                      summary: 'L4 动态响应',
                      citations: [{ source: '测试研报', content: 'L4 测试引用' }],
                    }),
                  },
                },
              ],
            }),
            text: async () =>
              JSON.stringify({
                score: 4.4,
                summary: 'L4 动态响应',
                citations: [{ source: '测试研报', content: 'L4 测试引用' }],
              }),
          } as Response
        }

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    score: 4.7,
                    summary: 'L7 动态响应',
                    citations: [{ source: '测试研报', content: 'L7 测试引用' }],
                  }),
                },
              },
            ],
          }),
          text: async () =>
            JSON.stringify({
              score: 4.7,
              summary: 'L7 动态响应',
              citations: [{ source: '测试研报', content: 'L7 测试引用' }],
            }),
        } as Response
      })

      enhancer.configure(VALID_LLM_CONFIG)
      const l4Calculator = enhancer.enhance(createMockLayerCalculator('l4', 3.0))
      const l7Calculator = enhancer.enhance(createMockLayerCalculator('l7', 3.0))

      const l4Result = await l4Calculator.calculate(input)
      const l7Result = await l7Calculator.calculate(input)

      expect(l4Result.score).toBe(4.4)
      expect(l4Result.summary).toBe('L4 动态响应')
      expect(l7Result.score).toBe(4.7)
      expect(l7Result.summary).toBe('L7 动态响应')
    })

    it('resetFetchMock 应清空调用记录但保留 mock 实现', async () => {
      mockLlmChatSuccess(buildLlmEnhanceResponse({ score: 4.0 }))

      enhancer.configure(VALID_LLM_CONFIG)
      const calculator = enhancer.enhance(createMockLayerCalculator('l4', 3.0))

      await calculator.calculate(input)
      expect(getFetchCallCount()).toBe(1)

      resetFetchMock()
      expect(getFetchCallCount()).toBe(0)

      // mock 仍生效，可继续调用
      await calculator.calculate(input)
      expect(getFetchCallCount()).toBe(1)
    })
  })
})
