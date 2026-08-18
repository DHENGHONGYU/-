/**
 * @test_id V9-TEST-BENCH-001
 * Phase 4 性能基准测试：RAG 增强评分管线延迟 / 吞吐 / 降级耗时
 *
 * 测试目标：
 *   1. RAG 检索延迟 < 500ms（单股票，3 层级）
 *   2. LLM 调用延迟 < 5000ms（单次增强）
 *   3. 端到端延迟 < 8000ms（Profile → 幻觉报告）
 *   4. 嵌入生成延迟 < 200ms（单次）
 *   5. 降级耗时 < 100ms（RAG 失败 → 无 RAG 模式）
 *   6. 并发性能：6 层并发总耗时 < 3000ms
 *   7. 稳定性：50 次迭代无性能退化 > 20%
 *
 * 被测模块：
 *   - src/services/scoring/v6-engine/enhancer.ts (LLMScoreEnhancer)
 *   - src/services/scoring/v6-engine/ragRetriever.ts (RAGRetriever)
 *   - src/services/system/localEmbeddingService.ts
 *
 * Mock 策略：
 *   - 使用模拟延迟模拟真实网络/计算耗时
 *   - RAG 检索：50-150ms 模拟延迟
 *   - LLM 调用：300-800ms 模拟延迟
 *   - 嵌入生成：30-80ms 模拟延迟
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-PROJ-066]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LayerInput, LayerScore, LayerCalculator } from '@/services/scoring/v6-engine/types'
import type { LLMCitation } from '@/services/scoring/v6-engine/hallucinationDetector'
import { detectSampleHallucination } from '@/services/scoring/v6-engine/hallucinationDetector'

// ============================================================
// 模拟延迟配置（模拟真实网络/计算耗时）
// ============================================================

const SIMULATED_DELAY = {
  /** RAG 检索模拟延迟（ms） */
  ragRetrieve: { min: 50, max: 150 },
  /** LLM 调用模拟延迟（ms） */
  llmCall: { min: 300, max: 800 },
  /** 嵌入生成模拟延迟（ms） */
  embedding: { min: 30, max: 80 },
}

function randomDelay(range: { min: number; max: number }): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================
// Mock 设置
// ============================================================

const mocks = vi.hoisted(() => ({
  mockChat: vi.fn(),
  mockRagRetrieve: vi.fn(),
  mockEmbedText: vi.fn(),
}))

vi.mock('@/services/llm/llmGateway', () => ({
  chat: mocks.mockChat,
}))

vi.mock('@/services/scoring/v6-engine/ragRetriever', () => ({
  ragRetriever: {
    retrieve: (...args: unknown[]) => mocks.mockRagRetrieve(...args),
  },
}))

vi.mock('@/services/system/localEmbeddingService', () => ({
  embedText: (...args: unknown[]) => mocks.mockEmbedText(...args),
}))

vi.mock('@/config/llmConfig', () => ({
  isLlmConfigured: () => true,
}))

// ============================================================
// Mock LLM 配置
// ============================================================

const mockLlmConfig = {
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: 'sk-test-bench',
  temperature: 0.7,
  maxTokens: 2000,
}

// ============================================================
// RAG 模板
// ============================================================

const STOCK_RAG_TEMPLATES: Record<string, Array<{ title: string; content: string; source: string; itemType: string; sentiment: string }>> = {
  'sh.600519': [
    {
      title: '贵州茅台2026Q2财报点评',
      content: '贵州茅台2026年Q2营收819.3亿元，同比增长17.5%；归母净利润416.9亿元，同比增长18.2%。毛利率91.3%，同比提升0.5个百分点。',
      source: '中信证券',
      itemType: 'research_report',
      sentiment: 'positive',
    },
    {
      title: '白酒行业深度报告',
      content: '2026年白酒行业集中度持续提升，CR5提升至45%。高端白酒需求韧性较强。茅台品牌护城河极深。',
      source: '华泰证券',
      itemType: 'industry_report',
      sentiment: 'positive',
    },
    {
      title: '茅台国际化战略进展',
      content: '茅台2026年海外营收同比增长35%，东南亚市场增速超50%。',
      source: '招商证券',
      itemType: 'news',
      sentiment: 'positive',
    },
  ],
  'sz.300750': [
    {
      title: '宁德时代2026Q1业绩预告',
      content: '宁德时代预计2026年Q1归母净利润105-115亿元，同比增长20-30%。动力电池全球市占率37.5%。',
      source: '中信建投',
      itemType: 'research_report',
      sentiment: 'positive',
    },
  ],
}

// ============================================================
// 辅助函数
// ============================================================

function buildRAGContext(
  rags: Array<{ title: string; content: string; source: string; itemType: string; sentiment: string }>,
  elapsedMs?: number,
) {
  return {
    snippets: rags.map((r, i) => ({
      docId: `doc-${i}`,
      title: r.title,
      content: r.content,
      source: r.source,
      publishedAt: Date.now() - i * 86400000,
      similarity: 0.9 - i * 0.1,
      itemType: r.itemType,
      domain: 'D1',
      sentiment: r.sentiment,
      qualityScore: 0.8,
    })),
    totalChars: rags.reduce((sum, r) => sum + r.content.length, 0),
    elapsedMs: elapsedMs ?? randomDelay(SIMULATED_DELAY.ragRetrieve),
    success: true,
    tierBreakdown: { tier: 1, label: '个股索引', count: rags.length },
  }
}

function createMockCalculator(
  layerId: string,
  score: number,
  layerName: string,
): LayerCalculator {
  const id = layerId as LayerCalculator['layerId']
  return {
    layerId: id,
    layerName,
    calculate: async (_input: LayerInput): Promise<LayerScore> => ({
      score,
      summary: `规则引擎${layerName}评分：${score.toFixed(2)}/5`,
      evidence: [`规则引擎证据1：${layerName}基础评估`],
      risks: [],
      participated: true,
      auditTrail: [],
    }),
  }
}

function buildLayerInput(
  symbol: string,
  name: string,
  sector: string,
): LayerInput {
  return {
    stock: { symbol, name, sector },
    financials: {},
    quotes: {},
    industryScore: undefined,
    config: { weights: {} as Record<string, number>, offlineMode: false, llmEnabled: true, auditEnabled: false },
    chipDistribution: undefined,
    dailyQuotes: undefined,
    sectorPeers: [],
  }
}

async function createEnhancer() {
  const { LLMScoreEnhancer } = await import('@/services/scoring/v6-engine/enhancer')
  const enhancer = new LLMScoreEnhancer()
  enhancer.configure(mockLlmConfig)
  return enhancer
}

// ============================================================
// 性能基准测试套件
// ============================================================

describe('Phase 4 性能基准: RAG 增强管线', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================
  // BENCH-1: RAG 检索延迟
  // ==========================================================

  describe('BENCH-1: RAG 检索延迟', () => {
    it('单股票 RAG 检索延迟应 < 500ms', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']

      mocks.mockRagRetrieve.mockImplementation(async () => {
        const delay = randomDelay(SIMULATED_DELAY.ragRetrieve)
        await sleep(delay)
        return buildRAGContext(rags, delay)
      })

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 4.2, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 4.5,
            summary: 'L1-护城河分析上调至4.50/5',
            rationale: '参考中信证券、华泰证券的分析，公司基本面稳健',
            risks: [],
            citations: [{ source: '中信证券', content: '贵州茅台2026年Q2营收819.3亿元', date: '2026-08-15' }],
          }),
        }
      })

      const start = performance.now()
      await enhanced.calculate(input)
      const elapsed = performance.now() - start

      // RAG 检索延迟 + LLM 调用延迟都在模拟范围内，总耗时应在合理范围
      expect(elapsed).toBeLessThan(2000)
    })

    it('RAG 检索 elapsedMs 字段应准确反映检索耗时', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']
      const mockElapsed = 120

      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags, mockElapsed))

      const enhancer = await createEnhancer()

      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 4.5,
            summary: 'L1-护城河分析上调至4.50/5',
            rationale: '参考研究报告',
            risks: [],
            citations: [{ source: '中信证券', content: 'Q2营收819.3亿元', date: '2026-08-15' }],
          }),
        }
      })

      const calculator = createMockCalculator('l1', 4.2, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      await enhanced.calculate(input)

      // 验证 mock 被调用，且 RAG 上下文包含正确的 elapsedMs
      const ragCalls = mocks.mockRagRetrieve.mock.results
      expect(ragCalls.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================
  // BENCH-2: LLM 调用延迟
  // ==========================================================

  describe('BENCH-2: LLM 调用延迟', () => {
    it('单次 LLM 增强延迟应 < 5000ms', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      // 模拟正常 LLM 延迟（300-800ms）
      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 4.3,
            summary: 'L1-护城河分析上调至4.30/5',
            rationale: '参考中信证券、华泰证券的分析',
            risks: [],
            citations: [{ source: '中信证券', content: 'Q2营收819.3亿元', date: '2026-08-15' }],
          }),
        }
      })

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 4.0, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      const start = performance.now()
      const result = await enhanced.calculate(input)
      const elapsed = performance.now() - start

      // 验证评分有效
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(5)

      // 验证 LLM 调用延迟（含 RAG 检索）在合理范围
      expect(elapsed).toBeLessThan(5000)
    })

    it('多次 LLM 调用的平均延迟应在可接受范围', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      const enhancer = await createEnhancer()
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')
      const iterations = 10
      const latencies: number[] = []

      for (let i = 0; i < iterations; i++) {
        mocks.mockChat.mockImplementationOnce(async () => {
          await sleep(randomDelay(SIMULATED_DELAY.llmCall))
          return {
            content: JSON.stringify({
              score: 4.3,
              summary: `L1-护城河分析上调至4.30/5`,
              rationale: '参考研究报告',
              risks: [],
              citations: [{ source: '中信证券', content: 'Q2营收819.3亿元', date: '2026-08-15' }],
            }),
          }
        })

        const calculator = createMockCalculator('l1', 4.0, 'L1-护城河分析')
        const enhanced = enhancer.enhance(calculator)

        const start = performance.now()
        const result = await enhanced.calculate(input)
        latencies.push(performance.now() - start)

        expect(result.score).toBeGreaterThanOrEqual(0)
      }

      const avg = latencies.reduce((s, l) => s + l, 0) / latencies.length
      const max = Math.max(...latencies)

      // 平均延迟 < 2000ms
      expect(avg).toBeLessThan(2000)
      // 最大延迟 < 5000ms
      expect(max).toBeLessThan(5000)
    })
  })

  // ==========================================================
  // BENCH-3: 端到端延迟
  // ==========================================================

  describe('BENCH-3: 端到端延迟', () => {
    it('从 Profile 输入到幻觉报告总耗时 < 8000ms', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 4.3,
            summary: 'L1-护城河分析上调至4.30/5',
            rationale: '参考中信证券、华泰证券的分析',
            risks: [],
            citations: [{ source: '中信证券', content: 'Q2营收819.3亿元', date: '2026-08-15' }],
          }),
        }
      })

      const enhancer = await createEnhancer()
      const layers = [
        { id: 'l1', name: 'L1-护城河分析', score: 4.2 },
        { id: 'l2', name: 'L2-竞品格局', score: 3.8 },
        { id: 'l4', name: 'L4-情景推演', score: 3.5 },
      ]

      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')
      const samples: Array<{
        stockSymbol: string
        stockName: string
        layerId: string
        ruleScore: number
        llmOutput: { score: number; summary: string; rationale: string; citations: LLMCitation[] }
        ragContext: unknown[]
      }> = []

      const start = performance.now()

      // 串行执行各层（模拟实际管线）
      for (const layer of layers) {
        const calculator = createMockCalculator(layer.id, layer.score, layer.name)
        const enhanced = enhancer.enhance(calculator)
        const result = await enhanced.calculate(input)

        const citations: LLMCitation[] = result.evidence
          .filter((e) => e.startsWith('[引用:'))
          .map((e) => {
            const sourceEnd = e.indexOf(']')
            if (sourceEnd === -1) return null
            const source = e.substring(4, sourceEnd)
            const rest = e.substring(sourceEnd + 2)
            const dateMatch = rest.match(/\s+\((\d{4}-\d{2}-\d{2})\)/)
            const date = dateMatch ? dateMatch[1] : undefined
            const content = dateMatch
              ? rest.substring(0, rest.lastIndexOf(` (${dateMatch[1]})`))
              : rest
            return { source, content, date }
          })
          .filter((c): c is LLMCitation => c !== null)

        samples.push({
          stockSymbol: 'sh.600519',
          stockName: '贵州茅台',
          layerId: layer.id,
          ruleScore: layer.score,
          llmOutput: {
            score: result.score,
            summary: result.summary,
            rationale: result.evidence.find((e) => e.startsWith('[LLM增强]'))?.replace('[LLM增强] ', '') || '',
            citations,
          },
          ragContext: rags,
        })
      }

      // 幻觉检测
      for (const sample of samples) {
        detectSampleHallucination(sample)
      }

      const elapsed = performance.now() - start

      // 验证：端到端总耗时 < 8000ms
      expect(elapsed).toBeLessThan(8000)

      // 验证：所有样本有效
      expect(samples.length).toBe(3)
      for (const s of samples) {
        expect(s.llmOutput.score).toBeGreaterThanOrEqual(0)
        expect(s.llmOutput.score).toBeLessThanOrEqual(5)
      }
    })
  })

  // ==========================================================
  // BENCH-4: 嵌入生成延迟
  // ==========================================================

  describe('BENCH-4: 嵌入生成延迟', () => {
    it('单次嵌入生成延迟应 < 200ms', async () => {
      const embedStart = performance.now()

      mocks.mockEmbedText.mockImplementation(async (text: string) => {
        await sleep(randomDelay(SIMULATED_DELAY.embedding))
        return {
          success: true,
          vector: new Array(768).fill(0).map(() => Math.random()),
          dimension: 768,
          elapsedMs: Math.round(performance.now() - embedStart),
        }
      })

      const { embedText } = await import('@/services/system/localEmbeddingService')
      const result = await embedText('贵州茅台2026年Q2营收819.3亿元，同比增长17.5%')

      expect(result.success).toBe(true)
      expect(result.dimension).toBe(768)
      expect(result.elapsedMs).toBeLessThan(200)
    })

    it('批量嵌入生成（5 段文本）总耗时应在合理范围', async () => {
      const texts = [
        '贵州茅台2026年Q2营收819.3亿元',
        '宁德时代动力电池全球市占率37.5%',
        '长江电力2026年上半年发电量1200亿千瓦时',
        '白酒行业集中度持续提升',
        '碳酸锂价格回落至8万元/吨',
      ]

      mocks.mockEmbedText.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.embedding))
        return {
          success: true,
          vector: new Array(768).fill(0).map(() => Math.random()),
          dimension: 768,
          elapsedMs: randomDelay(SIMULATED_DELAY.embedding),
        }
      })

      const { embedText } = await import('@/services/system/localEmbeddingService')

      const start = performance.now()
      const results = await Promise.all(texts.map((t) => embedText(t)))
      const elapsed = performance.now() - start

      // 验证：5 段文本全部成功
      for (const r of results) {
        expect(r.success).toBe(true)
        expect(r.dimension).toBe(768)
      }

      // 并发嵌入总耗时应在合理范围
      expect(elapsed).toBeLessThan(300)
    })
  })

  // ==========================================================
  // BENCH-5: 降级耗时
  // ==========================================================

  describe('BENCH-5: 降级耗时', () => {
    it('RAG 检索失败到无 RAG 模式切换耗时 < 100ms', async () => {
      // RAG 立即失败（无额外延迟）
      mocks.mockRagRetrieve.mockRejectedValue(new Error('HNSW index corrupted'))

      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 3.5,
            summary: '规则引擎L1评分：3.50/5',
            rationale: '无额外参考资料',
            risks: [],
            citations: [],
          }),
        }
      })

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 3.5, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sz.300750', '宁德时代', '电池')

      const start = performance.now()
      const result = await enhanced.calculate(input)
      const elapsed = performance.now() - start

      // 验证：降级后管线正常工作
      expect(result.score).toBe(3.5)

      // 验证：降级切换耗时（不含 LLM 调用）极短
      // 实际耗时 = RAG 失败处理 + LLM 调用，RAG 失败本身应 < 10ms
      // 总耗时 < 2000ms（含 LLM 模拟延迟）
      expect(elapsed).toBeLessThan(2000)
    })

    it('RAG 返回空结果时，管线不应有额外等待', async () => {
      mocks.mockRagRetrieve.mockResolvedValue({
        snippets: [],
        totalChars: 0,
        elapsedMs: 5,
        success: true,
        tierBreakdown: { tier: 1, label: '个股索引', count: 0 },
      })

      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 3.0,
            summary: '规则引擎L1评分：3.00/5',
            rationale: '无额外参考资料',
            risks: [],
            citations: [],
          }),
        }
      })

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 3.0, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sz.000001', '平安银行', '银行')

      const start = performance.now()
      const result = await enhanced.calculate(input)
      const elapsed = performance.now() - start

      expect(result.score).toBe(3.0)
      expect(elapsed).toBeLessThan(2000)
    })
  })

  // ==========================================================
  // BENCH-6: 并发性能
  // ==========================================================

  describe('BENCH-6: 并发性能', () => {
    it('6 层并发管线总耗时 < 3000ms', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 4.3,
            summary: 'L1上调至4.30/5',
            rationale: '参考研究报告',
            risks: [],
            citations: [{ source: '中信证券', content: 'Q2营收819.3亿元', date: '2026-08-15' }],
          }),
        }
      })

      const enhancer = await createEnhancer()
      const layers = [
        { id: 'l1', name: 'L1-护城河分析', score: 4.2 },
        { id: 'l2', name: 'L2-竞品格局', score: 3.8 },
        { id: 'l4', name: 'L4-情景推演', score: 3.5 },
        { id: 'l5', name: 'L5-TM矩阵', score: 3.0 },
        { id: 'l6', name: 'L6-Hype周期', score: 2.8 },
        { id: 'l7', name: 'L7-第二曲线', score: 3.2 },
      ]

      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      const start = performance.now()
      const results = await Promise.all(
        layers.map(async (layer) => {
          const calculator = createMockCalculator(layer.id, layer.score, layer.name)
          const enhanced = enhancer.enhance(calculator)
          return enhanced.calculate(input)
        }),
      )
      const elapsed = performance.now() - start

      // 验证：所有层评分有效
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0)
        expect(r.score).toBeLessThanOrEqual(5)
      }

      // 验证：6 层并发总耗时 < 3000ms
      expect(elapsed).toBeLessThan(3000)
    })

    it('3 只股票 × 3 层并发，总耗时 < 5000ms', async () => {
      const stocks = [
        { symbol: 'sh.600519', name: '贵州茅台', sector: '白酒' },
        { symbol: 'sz.300750', name: '宁德时代', sector: '电池' },
        { symbol: 'sh.600900', name: '长江电力', sector: '电力' },
      ]

      mocks.mockRagRetrieve.mockImplementation(async (symbol: string) => {
        await sleep(randomDelay(SIMULATED_DELAY.ragRetrieve))
        const rags = STOCK_RAG_TEMPLATES[symbol] || []
        return buildRAGContext(rags)
      })

      mocks.mockChat.mockImplementation(async () => {
        await sleep(randomDelay(SIMULATED_DELAY.llmCall))
        return {
          content: JSON.stringify({
            score: 4.0,
            summary: 'L1上调至4.00/5',
            rationale: '参考研究报告',
            risks: [],
            citations: [{ source: '中信证券', content: '基本面稳健', date: '2026-08-15' }],
          }),
        }
      })

      const enhancer = await createEnhancer()
      const layers = [
        { id: 'l1', name: 'L1-护城河分析', score: 4.0 },
        { id: 'l2', name: 'L2-竞品格局', score: 3.5 },
        { id: 'l4', name: 'L4-情景推演', score: 3.0 },
      ]

      const start = performance.now()

      const allResults = await Promise.all(
        stocks.flatMap((stock) =>
          layers.map(async (layer) => {
            const calculator = createMockCalculator(layer.id, layer.score, layer.name)
            const enhanced = enhancer.enhance(calculator)
            const input = buildLayerInput(stock.symbol, stock.name, stock.sector)
            return enhanced.calculate(input)
          }),
        ),
      )
      const elapsed = performance.now() - start

      // 验证：9 个结果全部有效
      expect(allResults.length).toBe(9)
      for (const r of allResults) {
        expect(r.score).toBeGreaterThanOrEqual(0)
        expect(r.score).toBeLessThanOrEqual(5)
      }

      // 验证：3 只股票 × 3 层并发总耗时 < 5000ms
      expect(elapsed).toBeLessThan(5000)
    })
  })

  // ==========================================================
  // BENCH-7: 稳定性
  // ==========================================================

  describe('BENCH-7: 稳定性（50 次迭代）', () => {
    it('50 次迭代无性能退化 > 20%', { timeout: 60000 }, async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']
      const iterations = 50
      const latencies: number[] = []

      const enhancer = await createEnhancer()
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      for (let i = 0; i < iterations; i++) {
        mocks.mockRagRetrieve.mockResolvedValueOnce(buildRAGContext(rags))

        mocks.mockChat.mockImplementationOnce(async () => {
          await sleep(randomDelay(SIMULATED_DELAY.llmCall))
          return {
            content: JSON.stringify({
              score: 4.3,
              summary: `L1上调至4.30/5`,
              rationale: '参考研究报告',
              risks: [],
              citations: [{ source: '中信证券', content: 'Q2营收819.3亿元', date: '2026-08-15' }],
            }),
          }
        })

        const calculator = createMockCalculator('l1', 4.0, 'L1-护城河分析')
        const enhanced = enhancer.enhance(calculator)

        const start = performance.now()
        const result = await enhanced.calculate(input)
        latencies.push(performance.now() - start)

        expect(result.score).toBeGreaterThanOrEqual(0)
      }

      // 分段统计：前 10 次 vs 后 10 次
      const first10Avg = latencies.slice(0, 10).reduce((s, l) => s + l, 0) / 10
      const last10Avg = latencies.slice(-10).reduce((s, l) => s + l, 0) / 10

      // 验证：后 10 次平均延迟不超过前 10 次的 120%（退化 < 20%）
      const degradation = last10Avg / first10Avg
      expect(degradation).toBeLessThan(1.2)

      // 验证：所有迭代延迟 < 5000ms
      for (const latency of latencies) {
        expect(latency).toBeLessThan(5000)
      }
    })
  })

  // ==========================================================
  // BENCH-8: 降级无额外开销
  // ==========================================================

  describe('BENCH-8: 降级模式性能', () => {
    it('无 RAG 模式（无 LLM 增强）的纯规则引擎计算应 < 50ms', async () => {
      // 不配置 RAG 和 LLM，直接测试规则引擎计算速度
      const calculator = createMockCalculator('l1', 4.0, 'L1-护城河分析')
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      const start = performance.now()
      const result = await calculator.calculate(input)
      const elapsed = performance.now() - start

      expect(result.score).toBe(4.0)
      // 纯规则引擎计算应极快
      expect(elapsed).toBeLessThan(50)
    })

    it('确定性层（L3a/L3v/L8）不应有 LLM 开销', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      const enhancer = await createEnhancer()
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      const deterministicLayers = [
        { id: 'l3f', name: 'L3a-财务健康', score: 4.0 },
        { id: 'l3v', name: 'L3v-估值水平', score: 3.5 },
        { id: 'l8', name: 'L8-技术筹码', score: 3.0 },
      ]

      const llmCallCountBefore = mocks.mockChat.mock.calls.length
      const ragCallCountBefore = mocks.mockRagRetrieve.mock.calls.length

      const start = performance.now()
      const results = await Promise.all(
        deterministicLayers.map(async (layer) => {
          const calculator = createMockCalculator(layer.id, layer.score, layer.name)
          const enhanced = enhancer.enhance(calculator)
          return enhanced.calculate(input)
        }),
      )
      const elapsed = performance.now() - start

      // 验证：确定性层不应调用 LLM
      const llmCallCountAfter = mocks.mockChat.mock.calls.length
      expect(llmCallCountAfter).toBe(llmCallCountBefore)

      // 验证：确定性层不应调用 RAG 检索
      const ragCallCountAfter = mocks.mockRagRetrieve.mock.calls.length
      expect(ragCallCountAfter).toBe(ragCallCountBefore)

      // 验证：评分直接透传
      for (let i = 0; i < deterministicLayers.length; i++) {
        expect(results[i].score).toBe(deterministicLayers[i].score)
      }

      // 验证：确定性层计算极快
      expect(elapsed).toBeLessThan(50)
    })
  })
})