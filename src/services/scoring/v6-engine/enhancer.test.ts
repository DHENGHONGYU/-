/**
 * LLMScoreEnhancer — M2 依据追溯闸单元测试
 *
 * 覆盖场景：
 * 1. 引证闸激活：LLM 调整评分但无引用 → 回退到规则评分
 * 2. 引证闸放行：LLM 调整评分且有引用 → 合并增强结果
 * 3. 评分未变：citations 可选，正常合并摘要/理由
 * 4. 不可增强层（L3a/L3v/L-1/L8）：透传原始结果
 * 5. LLM 错误：优雅降级回退到原始结果
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// ============================================================
// Mock LLM 网关与配置
// ============================================================

const { mockChat } = vi.hoisted(() => ({
  mockChat: vi.fn(),
}))


vi.mock('@/services/llm/llmGateway', () => ({
  chat: mockChat,
}))

vi.mock('@/config/llmConfig', () => ({
  isLlmConfigured: vi.fn(() => true),
}))

// ============================================================
// 导入测试目标（必须在 vi.mock 之后）
// ============================================================

import { LLMScoreEnhancer } from './enhancer'
import type { LayerCalculator, LayerId, LayerScore } from './types'
import type { LlmConfig } from '@/config/llmConfig'
import type { CitationAuditEntry } from './enhancer'

// ============================================================
// 测试辅助
// ============================================================

const LLM_NON_ENHANCEABLE_LAYERS: LayerId[] = ['lMinus1', 'l3f', 'l3v', 'l8']

const mockLlmConfig: LlmConfig = {
  baseURL: 'https://api.test.com',
  model: 'deepseek-chat',
  apiKey: 'sk-test',
  temperature: 0.7,
  maxTokens: 2000,
}

function createMockCalculator(layerId: LayerId = 'l0', baseScore = 3.5): LayerCalculator {
  return {
    layerId,
    calculate: async (): Promise<LayerScore> => ({
      layerId,
      layerName: '测试层',
      score: baseScore,
      summary: '规则引擎评分摘要',
      risks: ['规则引擎风险1'],
      evidence: ['规则引擎证据1', '规则引擎证据2'],
      weight: 0.15,
      weightedScore: baseScore * 0.15,
      dataSources: ['规则引擎'],
    }),
  }
}

function createEnhancer(): LLMScoreEnhancer {
  const enhancer = new LLMScoreEnhancer()
  enhancer.configure(mockLlmConfig)
  return enhancer
}

/** 模拟 LLM 返回含引证的调整评分 */
function mockLlmWithCitations(newScore: number) {
  mockChat.mockResolvedValueOnce({
    content: JSON.stringify({
      score: newScore,
      summary: 'LLM 增强摘要',
      rationale: '参考近期财报与行业研报，认为该股基本面有改善',
      risks: ['LLM 识别的新风险'],
      citations: [
        {
          source: '2026年Q2财报',
          content: '营收同比增长25%，毛利率提升至65%',
          date: '2026-07-01',
          url: 'https://example.com/financial-report',
        },
        {
          source: '行业研报',
          content: '半导体行业景气度回升至扩张区间',
          date: '2026-06-28',
        },
      ],
    }),
  })
}

/** 模拟 LLM 返回评分调整但无引证 */
function mockLlmWithoutCitations(newScore: number) {
  mockChat.mockResolvedValueOnce({
    content: JSON.stringify({
      score: newScore,
      summary: 'LLM 增强摘要',
      rationale: '我认为这个评分应该调整',
      risks: ['LLM 识别的新风险'],
      citations: [],
    }),
  })
}

/** 模拟 LLM 返回评分不变 */
function mockLlmScoreUnchanged() {
  mockChat.mockResolvedValueOnce({
    content: JSON.stringify({
      score: 3.5, // 与 baseScore 相同
      summary: 'LLM 确认规则引擎评分合理',
      rationale: '当前评分已反映基本面情况，无需调整',
      risks: [],
      citations: [],
    }),
  })
}

/** 模拟 LLM 返回解析错误 */
function mockLlmMalformed() {
  mockChat.mockResolvedValueOnce({
    content: '抱歉，我无法处理这个请求',
  })
}

// ============================================================
// 测试套件
// ============================================================

describe('M2 依据追溯闸 (Citation Gate)', () => {
  beforeEach(() => {
    mockChat.mockReset()
  })

  // ────────── 1. 引证闸激活 ──────────
  test('① 引证闸激活：LLM 调整评分但无引用 → 回退到规则评分', async () => {
    mockLlmWithoutCitations(4.8) // LLM 建议 4.8 → 与 base 3.5 差异大
    const enhancer = createEnhancer()
    const enhancedCalc = enhancer.enhance(createMockCalculator('l0', 3.5))
    const result = await enhancedCalc.calculate({
      stock: { symbol: '000001', name: '测试', sector: '金融' },
      financials: {},
      quotes: {},
      config: { weights: {} } as never,
    } as never)

    // 引证闸激活：评分应回退到规则引擎的 3.5
    expect(result.score).toBe(3.5)
    // 摘要和理由应保留（作为备注）
    expect(result.summary).toBe('LLM 增强摘要')
    // 证据中应包含无引用的标记
    expect(result.evidence.some(e => e.includes('无引用'))).toBe(true)
    // 风险应包含 LLM 新增的风险（即使引证闸激活，补充信息仍保留）
    expect(result.risks.length).toBeGreaterThanOrEqual(2)
    expect(result.risks.some(r => r.includes('LLM 识别的新风险'))).toBe(true)
    // [M2 深化] 闸激活时不应有 llm-citation 审计条目
    const gateEntries = (result.auditTrail ?? []).filter(e => e.step === 'llm-citation')
    expect(gateEntries.length).toBe(0)
  })

  // ────────── 2. 引证闸放行 ──────────
  test('② 引证闸放行：LLM 调整评分且有引用 → 合并增强结果', async () => {
    mockLlmWithCitations(4.2) // LLM 建议 4.2，有引证
    const enhancer = createEnhancer()
    const enhancedCalc = enhancer.enhance(createMockCalculator('l0', 3.5))
    const result = await enhancedCalc.calculate({
      stock: { symbol: '000001', name: '测试', sector: '金融' },
      financials: {},
      quotes: {},
      config: { weights: {} } as never,
    } as never)

    // 评分应为 LLM 的 4.2
    expect(result.score).toBe(4.2)
    // 摘要应为 LLM 增强后的值
    expect(result.summary).toBe('LLM 增强摘要')
    // 证据中应包含引用来源
    expect(result.evidence.some(e => e.includes('[引用:'))).toBe(true)
    expect(result.evidence.some(e => e.includes('2026年Q2财报'))).toBe(true)
    expect(result.evidence.some(e => e.includes('行业研报'))).toBe(true)
    // 应包含 LLM 增强理由
    expect(result.evidence.some(e => e.includes('[LLM增强]'))).toBe(true)
    // 风险应包含规则引擎 + LLM 识别的风险
    expect(result.risks.length).toBeGreaterThanOrEqual(2)

    // [M2 深化] 结构化 auditTrail 应包含引证条目
    const citationEntries = (result.auditTrail ?? [])
      .filter(e => e.step === 'llm-citation') as unknown as CitationAuditEntry[]
    expect(citationEntries.length).toBe(2) // mock 返回 2 条 citations
    // 第一条引用：2026年Q2财报
    expect(citationEntries[0]?.citation.source).toBe('2026年Q2财报')
    expect(citationEntries[0]?.citation.content).toContain('营收同比增长25%')
    expect(citationEntries[0]?.citation.url).toBe('https://example.com/financial-report')
    expect(citationEntries[0]?.layerId).toBe('l0')
    // 第二条引用：行业研报
    expect(citationEntries[1]?.citation.source).toBe('行业研报')
    expect(citationEntries[1]?.citation.date).toBe('2026-06-28')
    // 每条条目都应有合法 timestamp
    for (const entry of citationEntries) {
      expect(entry.timestamp).toBeGreaterThan(0)
      expect(typeof entry.citation.source).toBe('string')
      expect(typeof entry.citation.content).toBe('string')
    }
  })

  // ────────── 3. 评分未变 ──────────
  test('③ LLM 确认评分不变时，即使无引证也正常合并', async () => {
    mockLlmScoreUnchanged() // 返回 3.5，与 baseScore 一致
    const enhancer = createEnhancer()
    const enhancedCalc = enhancer.enhance(createMockCalculator('l0', 3.5))
    const result = await enhancedCalc.calculate({
      stock: { symbol: '000001', name: '测试', sector: '金融' },
      financials: {},
      quotes: {},
      config: { weights: {} } as never,
    } as never)

    // 评分保持 3.5（与 baseResult 一致）
    expect(result.score).toBe(3.5)
    // 摘要应为 LLM 增强后的值
    expect(result.summary).toBe('LLM 确认规则引擎评分合理')
    // 证据包含 LLM 理由
    expect(result.evidence.some(e => e.includes('[LLM增强]'))).toBe(true)
    // 证据不应包含引用标记（因无引证）
    expect(result.evidence.some(e => e.includes('[引用:'))).toBe(false)
    // [M2 深化] 评分未变且无引证时不应有 llm-citation 审计条目
    const unchangedEntries = (result.auditTrail ?? []).filter(e => e.step === 'llm-citation')
    expect(unchangedEntries.length).toBe(0)
  })

  // ────────── 4. 不可增强层 ──────────
  test('④ 非可增强层（L-1）→ 透传规则引擎结果', async () => {
    // 即使 LLM 可用，L-1 也不调用 LLM
    mockChat.mockReset() // 不应被调用
    const enhancer = createEnhancer()

    for (const layerId of LLM_NON_ENHANCEABLE_LAYERS) {
      const enhancedCalc = enhancer.enhance(createMockCalculator(layerId, 2.8))
      const result = await enhancedCalc.calculate({
        stock: { symbol: '000001', name: '测试', sector: '金融' },
        financials: {},
        quotes: {},
        config: { weights: {} } as never,
      } as never)

      // 纯规则引擎结果
      expect(result.score).toBe(2.8)
      expect(result.summary).toBe('规则引擎评分摘要')
      // chat 不应被调用
      expect(mockChat).not.toHaveBeenCalled()
    }
  })

  // ────────── 5. LLM 错误降级 ──────────
  test('⑤ LLM 调用异常时 → 优雅降级回退规则引擎', async () => {
    mockChat.mockRejectedValueOnce(new Error('API 超时'))
    const enhancer = createEnhancer()
    const enhancedCalc = enhancer.enhance(createMockCalculator('l0', 3.0))
    const result = await enhancedCalc.calculate({
      stock: { symbol: '000001', name: '测试', sector: '金融' },
      financials: {},
      quotes: {},
      config: { weights: {} } as never,
    } as never)

    // 降级：完全透传规则引擎结果
    expect(result.score).toBe(3.0)
    expect(result.summary).toBe('规则引擎评分摘要')
    expect(result.evidence).toEqual(['规则引擎证据1', '规则引擎证据2'])
  })

  // ────────── 6. LLM 返回格式错误 ──────────
  test('⑥ LLM 返回不可解析内容 → 降级回退规则引擎', async () => {
    mockLlmMalformed()
    const enhancer = createEnhancer()
    const enhancedCalc = enhancer.enhance(createMockCalculator('l0', 3.0))
    const result = await enhancedCalc.calculate({
      stock: { symbol: '000001', name: '测试', sector: '金融' },
      financials: {},
      quotes: {},
      config: { weights: {} } as never,
    } as never)

    // 降级：评分保持 3.0，摘要保持规则引擎值
    expect(result.score).toBe(3.0)
    expect(result.summary).toBe('规则引擎评分摘要')
  })

  // ────────── 7. LLM 禁用时 ──────────
  test('⑦ LLM 增强已禁用 → 透传原始结果', async () => {
    mockChat.mockReset()
    const enhancer = createEnhancer()
    enhancer.disable()
    const enhancedCalc = enhancer.enhance(createMockCalculator('l0', 3.5))
    const result = await enhancedCalc.calculate({
      stock: { symbol: '000001', name: '测试', sector: '金融' },
      financials: {},
      quotes: {},
      config: { weights: {} } as never,
    } as never)

    expect(result.score).toBe(3.5)
    expect(result.summary).toBe('规则引擎评分摘要')
    expect(mockChat).not.toHaveBeenCalled()
  })
})
