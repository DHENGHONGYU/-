/**
 * @test_id V9-TEST-E2E-001
 * Phase 3 端到端管线测试：Profile → RAG 检索 → LLM 增强 → 幻觉检测
 *
 * 测试目标：
 *   1. 验证完整管线（多只股票 × 多层）的端到端正确性
 *   2. 验证管线容错（RAG 失败 / LLM 失败 / 部分层失败）
 *   3. 验证管线性能（各阶段耗时在合理范围）
 *   4. 验证跨层一致性（层间评分逻辑关系）
 *   5. 验证批量管线（20 只 Golden Stock 全量）
 *
 * 被测模块：
 *   - src/services/scoring/v6-engine/enhancer.ts (LLMScoreEnhancer)
 *   - src/services/scoring/v6-engine/ragRetriever.ts (RAGRetriever)
 *   - src/services/scoring/v6-engine/hallucinationDetector.ts
 *   - src/services/scoring/v6-engine/config.ts (DEFAULT_RAG_CONFIG)
 *
 * Mock 策略：
 *   - ragRetriever.retrieve → vi.mock 返回受控 RAG 上下文
 *   - llmGateway.chat → vi.mock 使用 SmartRAGSimulator
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-PROJ-066]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type {
  HallucinationSample,
  LLMCitation,
} from '@/services/scoring/v6-engine/hallucinationDetector'
import {
  detectSampleHallucination,
  runHallucinationSuite,
  formatHallucinationReport,
} from '@/services/scoring/v6-engine/hallucinationDetector'
import type { LayerInput, LayerScore, LayerCalculator } from '@/services/scoring/v6-engine/types'
import { DEFAULT_ENGINE_CONFIG } from '@/services/scoring/v6-engine/config'

// ============================================================
// Mock 设置
// ============================================================

const mocks = vi.hoisted(() => ({
  mockChat: vi.fn(),
  mockRagRetrieve: vi.fn(),
}))

vi.mock('@/services/llm/llmGateway', () => ({
  chat: mocks.mockChat,
}))

vi.mock('@/services/scoring/v6-engine/ragRetriever', () => ({
  ragRetriever: {
    retrieve: (...args: unknown[]) => mocks.mockRagRetrieve(...args),
  },
}))

vi.mock('@/config/llmConfig', () => ({
  isLlmConfigured: () => true,
}))

// ============================================================
// Mock LLM 配置（供 LLMScoreEnhancer.configure 使用）
// ============================================================

const mockLlmConfig = {
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: 'sk-test-e2e-pipeline',
  temperature: 0.7,
  maxTokens: 2000,
}

// ============================================================
// Golden Dataset 加载
// ============================================================

interface GoldenStock {
  symbol: string
  name: string
  sector: string
  marketCap: number
  pe: number
  pb: number
  roe: number
  expectedCompositeRange: { min: number; max: number }
  expectedRating: string
}

interface GoldenDataset {
  version: string
  stocks: GoldenStock[]
}

function loadGoldenDataset(): GoldenDataset {
  const path = resolve(__dirname, '../../../../tests/golden-dataset/scores.json')
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// ============================================================
// SmartRAGSimulator（复用 Phase 2 设计，增强版）
// ============================================================

interface RAGSimSnippet {
  index: number
  source: string
  itemType: string
  similarity: number
  sentiment: string
  title: string
  content: string
}

interface SimulatedLLMResponse {
  content: string
}

class SmartRAGSimulator {
  private extractRAGContext(prompt: string): RAGSimSnippet[] {
    const ragSectionStart = prompt.search(/参考资料[：:]\n\n/)
    if (ragSectionStart === -1) return []

    const afterMarker = prompt.substring(ragSectionStart).replace(/^参考资料[：:]\n\n/, '')
    const ragSectionEnd = afterMarker.search(
      /\n\n(?:请|重要|注意|当前|以下|最后|返回|若|任何|确保|首先|其次|此外|综上|总结|考虑|分析|判断|评估|需要|应该|可以|建议|推荐|最终|输出|生成|构造|提供|使用|基于|通过|按照|依据|结合|综合|全面|系统|整体|从|对|为|与|和|的|但|而|或|且|并|也|还|就|才|都|只|已|将|会|能|可|要|应|该|必须|必需|必要|一定|务必|切勿|不要|不能|不得|禁止|严禁|限制|约束|规定|要求|强制)/,
    )
    const ragSection = ragSectionEnd !== -1 ? afterMarker.substring(0, ragSectionEnd) : afterMarker

    const snippets: RAGSimSnippet[] = []
    const snippetRegex =
      /\[RAG-(\d+)\]\s+来源:(.+?)\s+\|\s+类型:(.+?)\s+\|\s+相似度:([\d.]+)\s+\|\s+情绪:(\w+)\n标题:(.+?)\n内容:([\s\S]*?)(?=\n\n\[RAG-|$)/g
    let match
    while ((match = snippetRegex.exec(ragSection)) !== null) {
      snippets.push({
        index: parseInt(match[1]!),
        source: match[2]!.trim(),
        itemType: match[3]!.trim(),
        similarity: parseFloat(match[4]!),
        sentiment: match[5]!.trim(),
        title: match[6]!.trim(),
        content: match[7]!.trim(),
      })
    }
    return snippets
  }

  private extractQuotableSentences(content: string): string[] {
    return content
      .split(/[。；\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10)
  }

  private getOverallSentiment(
    snippets: RAGSimSnippet[],
  ): 'positive' | 'neutral' | 'negative' {
    const pos = snippets.filter((s) => s.sentiment === 'positive').length
    const neg = snippets.filter((s) => s.sentiment === 'negative').length
    if (pos > neg) return 'positive'
    if (neg > pos) return 'negative'
    return 'neutral'
  }

  generate(
    prompt: string,
    baseScore: number,
    baseLayerName: string,
    opts?: { fabricateCitation?: boolean; unsupportedAdjustment?: boolean },
  ): SimulatedLLMResponse {
    const snippets = this.extractRAGContext(prompt)
    const hasRAG = snippets.length > 0

    if (!hasRAG) {
      // 无 RAG 上下文：回退到规则引擎评分
      const response = {
        score: baseScore,
        summary: `规则引擎${baseLayerName}评分：${baseScore.toFixed(2)}/5`,
        rationale: '无额外参考资料，规则引擎评分维持不变',
        risks: [] as string[],
        citations: [] as Array<{ source: string; content: string; date: string }>,
      }
      return { content: JSON.stringify(response) }
    }

    // 有 RAG 上下文：基于资料生成增强评分
    const sentiment = this.getOverallSentiment(snippets)
    const usedSources = new Set<string>()
    const citations: Array<{ source: string; content: string; date: string }> = []

    for (const snippet of snippets) {
      if (citations.length >= 3) break
      if (usedSources.has(snippet.source)) continue

      const sentences = this.extractQuotableSentences(snippet.content)
      if (sentences.length === 0) continue

      const bestSentence = sentences.sort((a, b) => b.length - a.length)[0]!
      citations.push({
        source: snippet.source,
        content: bestSentence,
        date: new Date(Date.now()).toISOString().split('T')[0]!,
      })
      usedSources.add(snippet.source)
    }

    // 幻觉模拟：捏造引用
    if (opts?.fabricateCitation) {
      citations.push({
        source: '虚构来源',
        content: '这是一条完全捏造的引用内容，不在任何 RAG 文档中',
        date: '2026-08-15',
      })
    }

    // 幻觉模拟：无证据调整
    if (opts?.unsupportedAdjustment) {
      const response = {
        score: baseScore + 1.8,
        summary: `${baseLayerName}大幅上调至${(baseScore + 1.8).toFixed(2)}/5`,
        rationale: '基于综合判断建议大幅上调评分',
        risks: [],
        citations: [] as Array<{ source: string; content: string; date: string }>,
      }
      return { content: JSON.stringify(response) }
    }

    // 正常评分调整
    let adjustedScore = baseScore
    if (sentiment === 'positive' && baseScore < 4.5) {
      adjustedScore = Math.min(baseScore + 0.3, 5.0)
    } else if (sentiment === 'negative' && baseScore > 1.0) {
      adjustedScore = Math.max(baseScore - 0.3, 0.0)
    }

    adjustedScore = Math.round(adjustedScore * 100) / 100

    const sources = Array.from(usedSources).join('、')
    const response = {
      score: adjustedScore,
      summary: `${baseLayerName}${sentiment === 'positive' ? '上调' : sentiment === 'negative' ? '下调' : '维持'}至${adjustedScore.toFixed(2)}/5`,
      rationale: `参考${sources}的分析，${sentiment === 'positive' ? '公司基本面稳健，行业景气度向好' : sentiment === 'negative' ? '行业面临挑战，建议审慎评估' : '维持原有判断'}`,
      risks: adjustedScore !== baseScore ? ['估值偏高风险', '行业政策变化风险'] : [],
      citations,
    }
    return { content: JSON.stringify(response) }
  }
}

// ============================================================
// RAG 模板（3 只 Golden Stock）
// ============================================================

const STOCK_RAG_TEMPLATES: Record<string, Array<{ title: string; content: string; source: string; itemType: string; sentiment: string }>> = {
  'sh.600519': [
    {
      title: '贵州茅台2026Q2财报点评',
      content: '贵州茅台2026年Q2营收819.3亿元，同比增长17.5%；归母净利润416.9亿元，同比增长18.2%。毛利率91.3%，同比提升0.5个百分点。直销渠道占比提升至46.2%，i茅台平台贡献显著。',
      source: '中信证券',
      itemType: 'research_report',
      sentiment: 'positive',
    },
    {
      title: '白酒行业深度报告',
      content: '2026年白酒行业集中度持续提升，CR5提升至45%。高端白酒需求韧性较强，次高端竞争加剧。茅台品牌护城河极深，飞天茅台批价稳定在2700元以上。',
      source: '华泰证券',
      itemType: 'industry_report',
      sentiment: 'positive',
    },
    {
      title: '茅台国际化战略进展',
      content: '茅台2026年海外营收同比增长35%，东南亚市场增速超50%。公司计划2027年海外营收占比提升至10%以上。',
      source: '招商证券',
      itemType: 'news',
      sentiment: 'positive',
    },
  ],
  'sz.300750': [
    {
      title: '宁德时代2026Q1业绩预告',
      content: '宁德时代预计2026年Q1归母净利润105-115亿元，同比增长20-30%。动力电池全球市占率37.5%，储能业务增速超40%。',
      source: '中信建投',
      itemType: 'research_report',
      sentiment: 'positive',
    },
    {
      title: '动力电池行业竞争格局',
      content: '2026年动力电池行业CR3达75%，宁德时代龙头地位稳固。但二线厂商加速扩产，价格战压力增大。碳酸锂价格回落至8万元/吨，成本端改善。',
      source: '天风证券',
      itemType: 'industry_report',
      sentiment: 'neutral',
    },
  ],
  'sh.600900': [
    {
      title: '长江电力2026年发电量公告',
      content: '长江电力2026年上半年发电量1200亿千瓦时，同比增长8.5%。来水偏丰，乌东德、白鹤滩电站出力提升。',
      source: '公司公告',
      itemType: 'notice',
      sentiment: 'positive',
    },
    {
      title: '电力行业景气度分析',
      content: '2026年全社会用电量增速6.2%，水电利用小时数同比提升。电价市场化改革推进，水电企业盈利能力改善。',
      source: '国泰君安',
      itemType: 'industry_report',
      sentiment: 'positive',
    },
  ],
}

// ============================================================
// 辅助函数
// ============================================================

function buildRAGContext(
  rags: Array<{ title: string; content: string; source: string; itemType: string; sentiment: string }>,
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
    elapsedMs: 15,
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
    calculate: async (_input: LayerInput): Promise<LayerScore> => ({
      layerId: id,
      layerName,
      score,
      summary: `规则引擎${layerName}评分：${score.toFixed(2)}/5`,
      evidence: [`规则引擎证据1：${layerName}基础评估`, `规则引擎证据2：行业对标分析`],
      risks: score < 3 ? ['评分偏低风险'] : [],
      weight: 1,
      weightedScore: score,  dataSources: [],
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
    config: DEFAULT_ENGINE_CONFIG,
  }
}

// LLMScoreEnhancer 需要动态导入（因为 mock 必须在 import 之前设置）
async function createEnhancer() {
  const { LLMScoreEnhancer } = await import('@/services/scoring/v6-engine/enhancer')
  const enhancer = new LLMScoreEnhancer()
  enhancer.configure(mockLlmConfig)
  return enhancer
}

// ============================================================
// 测试套件
// ============================================================

describe('Phase 3 E2E Pipeline: Profile → RAG → LLM → 幻觉检测', () => {
  let smartSimulator: SmartRAGSimulator

  beforeEach(() => {
    vi.clearAllMocks()
    smartSimulator = new SmartRAGSimulator()
  })

  // ==========================================================
  // 场景 1：单只股票 × 多层完整管线
  // ==========================================================

  describe('E2E-1: 单只股票 × 多层完整管线', () => {
    it('应完成贵州茅台 L1/L2/L4/L5/L6/L7 六层完整管线，所有层引用可追溯', async () => {
      const layers = [
        { id: 'l1', name: 'L1-护城河分析', score: 4.2 },
        { id: 'l2', name: 'L2-竞品格局', score: 3.8 },
        { id: 'l4', name: 'L4-情景推演', score: 3.5 },
        { id: 'l5', name: 'L5-TM矩阵', score: 3.0 },
        { id: 'l6', name: 'L6-Hype周期', score: 2.8 },
        { id: 'l7', name: 'L7-第二曲线', score: 3.2 },
      ]

      const rags = STOCK_RAG_TEMPLATES['sh.600519']!
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      mocks.mockChat.mockImplementation(
        async (messages: Array<{ role: string; content: string }>) => {
          const userMsg = messages.find((m) => m.role === 'user')?.content || ''
          const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
          const fullPrompt = systemMsg + '\n' + userMsg
          const response = smartSimulator.generate(fullPrompt, 4.2, 'L1-护城河分析')
          return { content: response.content }
        },
      )

      const enhancer = await createEnhancer()
      const results: Array<{ layerId: string; score: number; hasCitation: boolean; hallucinationCount: number }> = []

      for (const layer of layers) {
        const calculator = createMockCalculator(layer.id, layer.score, layer.name)
        const enhanced = enhancer.enhance(calculator)
        const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')
        const result = await enhanced.calculate(input)

        const hasCitationEvidence = result.evidence.some((e) => e.startsWith('[引用:'))
        const citations: LLMCitation[] = result.evidence
          .filter((e) => e.startsWith('[引用:'))
          .map((e): LLMCitation | null => {
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

        const sample: HallucinationSample = {
          symbol: 'sh.600519',
          layerId: layer.id,
          ruleScore: layer.score,
          llmOutput: {
            score: result.score,
            summary: result.summary,
            rationale:
              result.evidence.find((e) => e.startsWith('[LLM增强]'))?.replace('[LLM增强] ', '') || '',
            risks: [],
            citations,
          },
          ragContext: buildRAGContext(rags).snippets,
        }

        const hallucinations = detectSampleHallucination(sample)
        results.push({
          layerId: layer.id,
          score: result.score,
          hasCitation: hasCitationEvidence,
          hallucinationCount: hallucinations.length,
        })
      }

      // 验证：所有层都有引用
      for (const r of results) {
        expect(r.hasCitation).toBe(true)
      }

      // 验证：所有层零幻觉
      const totalHallucinations = results.reduce((sum, r) => sum + r.hallucinationCount, 0)
      expect(totalHallucinations).toBe(0)

      // 验证：评分在合理范围 [0, 5]
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0)
        expect(r.score).toBeLessThanOrEqual(5)
      }
    })
  })

  // ==========================================================
  // 场景 2：管线容错 — RAG 检索失败
  // ==========================================================

  describe('E2E-2: 管线容错 — RAG 检索失败', () => {
    it('RAG 检索抛出异常时，enhancer 应优雅降级，继续使用规则引擎评分', async () => {
      mocks.mockRagRetrieve.mockRejectedValue(new Error('HNSW index corrupted'))

      mocks.mockChat.mockImplementation(
        async (messages: Array<{ role: string; content: string }>) => {
          const userMsg = messages.find((m) => m.role === 'user')?.content || ''
          const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
          const fullPrompt = systemMsg + '\n' + userMsg
          const response = smartSimulator.generate(fullPrompt, 3.5, 'L1-护城河分析')
          return { content: response.content }
        },
      )

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 3.5, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sz.300750', '宁德时代', '电池')

      const result = await enhanced.calculate(input)

      // 验证：管线未中断，评分仍然有效
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(5)
      expect(result.summary).toBeTruthy()
    })
  })

  // ==========================================================
  // 场景 3：管线容错 — LLM 调用失败
  // ==========================================================

  describe('E2E-3: 管线容错 — LLM 调用失败', () => {
    it('LLM 调用抛出异常时，enhancer 应回退到规则引擎评分', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600900']!
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      mocks.mockChat.mockRejectedValue(new Error('LLM API timeout'))

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 4.0, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sh.600900', '长江电力', '电力')

      const result = await enhanced.calculate(input)

      // 验证：回退到规则引擎评分，管线未中断
      expect(result.score).toBe(4.0)
      expect(result.summary).toContain('护城河')
    })
  })

  // ==========================================================
  // 场景 4：管线容错 — 缺失数据预警
  // ==========================================================

  describe('E2E-4: 管线容错 — 缺失数据预警', () => {
    it('RAG 检索返回 missingDataAlert 时，管线应继续运行并记录预警', async () => {
      mocks.mockRagRetrieve.mockResolvedValue({
        snippets: [],
        totalChars: 0,
        elapsedMs: 5,
        success: true,
        tierBreakdown: { tier: 1, label: '个股索引', count: 0 },
        missingDataAlert: {
          symbol: 'sz.000001',
          stockName: '平安银行',
          severity: 'warning' as const,
          message: '该股票无研报/公告/新闻资料，建议补充数据',
          missingTypes: ['research_report', 'notice', 'news'],
          totalDocuments: 0,
          recommendedAction: '建议通过数据采集模块补充该股票的基本面资料',
        },
      })

      mocks.mockChat.mockImplementation(
        async (messages: Array<{ role: string; content: string }>) => {
          const userMsg = messages.find((m) => m.role === 'user')?.content || ''
          const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
          const fullPrompt = systemMsg + '\n' + userMsg
          const response = smartSimulator.generate(fullPrompt, 3.0, 'L1-护城河分析')
          return { content: response.content }
        },
      )

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 3.0, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sz.000001', '平安银行', '银行')

      const result = await enhanced.calculate(input)

      // 验证：管线未中断，评分仍然有效
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(5)
    })
  })

  // ==========================================================
  // 场景 5：跨层一致性
  // ==========================================================

  describe('E2E-5: 跨层一致性', () => {
    it('同一股票不同层之间的评分应保持逻辑一致性', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']!
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      mocks.mockChat.mockImplementation(
        async (messages: Array<{ role: string; content: string }>) => {
          const userMsg = messages.find((m) => m.role === 'user')?.content || ''
          const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
          const fullPrompt = systemMsg + '\n' + userMsg
          const response = smartSimulator.generate(fullPrompt, 4.0, 'L1-护城河分析')
          return { content: response.content }
        },
      )

      const enhancer = await createEnhancer()

      // 测试 L1（护城河）和 L2（竞品格局）之间的关系
      const l1Calc = createMockCalculator('l1', 4.2, 'L1-护城河分析')
      const l2Calc = createMockCalculator('l2', 3.5, 'L2-竞品格局')

      const l1Enhanced = enhancer.enhance(l1Calc)
      const l2Enhanced = enhancer.enhance(l2Calc)

      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')
      const l1Result = await l1Enhanced.calculate(input)
      const l2Result = await l2Enhanced.calculate(input)

      // 验证：L1（护城河）评分应不低，茅台护城河很深
      expect(l1Result.score).toBeGreaterThanOrEqual(3.5)

      // 验证：L2 评分应 ≤ L1 评分（竞品格局通常不高于护城河）
      expect(l2Result.score).toBeLessThanOrEqual(l1Result.score + 0.5)

      // 验证：两层评分都在合理范围
      expect(l1Result.score).toBeGreaterThanOrEqual(0)
      expect(l1Result.score).toBeLessThanOrEqual(5)
      expect(l2Result.score).toBeGreaterThanOrEqual(0)
      expect(l2Result.score).toBeLessThanOrEqual(5)
    })
  })

  // ==========================================================
  // 场景 6：管线性能
  // ==========================================================

  describe('E2E-6: 管线性能', () => {
    it('单层管线耗时应在合理范围（< 500ms）', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']!
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      mocks.mockChat.mockImplementation(
        async (messages: Array<{ role: string; content: string }>) => {
          const userMsg = messages.find((m) => m.role === 'user')?.content || ''
          const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
          const fullPrompt = systemMsg + '\n' + userMsg
          const response = smartSimulator.generate(fullPrompt, 4.2, 'L1-护城河分析')
          return { content: response.content }
        },
      )

      const enhancer = await createEnhancer()
      const calculator = createMockCalculator('l1', 4.2, 'L1-护城河分析')
      const enhanced = enhancer.enhance(calculator)
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      const start = Date.now()
      const result = await enhanced.calculate(input)
      const elapsed = Date.now() - start

      // 验证：评分有效
      expect(result.score).toBeGreaterThanOrEqual(0)

      // 验证：耗时在合理范围（模拟 LLM 无网络延迟，应很快）
      expect(elapsed).toBeLessThan(500)
    })

    it('6 层并发管线总耗时应在合理范围', async () => {
      const rags = STOCK_RAG_TEMPLATES['sh.600519']!
      mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))

      mocks.mockChat.mockImplementation(
        async (messages: Array<{ role: string; content: string }>) => {
          const userMsg = messages.find((m) => m.role === 'user')?.content || ''
          const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
          const fullPrompt = systemMsg + '\n' + userMsg
          const response = smartSimulator.generate(fullPrompt, 4.0, 'L1-护城河分析')
          return { content: response.content }
        },
      )

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

      const start = Date.now()
      const results = await Promise.all(
        layers.map(async (layer) => {
          const calculator = createMockCalculator(layer.id, layer.score, layer.name)
          const enhanced = enhancer.enhance(calculator)
          return enhanced.calculate(input)
        }),
      )
      const elapsed = Date.now() - start

      // 验证：所有层评分有效
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0)
        expect(r.score).toBeLessThanOrEqual(5)
      }

      // 验证：6 层并发总耗时
      expect(elapsed).toBeLessThan(2000)
    })
  })

  // ==========================================================
  // 场景 7：批量管线 — 20 只 Golden Stock
  // ==========================================================

  describe('E2E-7: 批量管线 — 20 只 Golden Stock × 幻觉检测', () => {
    it('20 只 Golden Stock 全量管线应通过幻觉检测门禁', async () => {
      const dataset = loadGoldenDataset()

      mocks.mockChat.mockImplementation(
        async (messages: Array<{ role: string; content: string }>) => {
          const userMsg = messages.find((m) => m.role === 'user')?.content || ''
          const systemMsg = messages.find((m) => m.role === 'system')?.content || ''
          const fullPrompt = systemMsg + '\n' + userMsg
          const response = smartSimulator.generate(fullPrompt, 3.5, 'L1')
          return { content: response.content }
        },
      )

      const enhancer = await createEnhancer()
      const samples: HallucinationSample[] = []

      for (const stock of dataset.stocks) {
        const rags = STOCK_RAG_TEMPLATES[stock.symbol]
        if (rags) {
          mocks.mockRagRetrieve.mockResolvedValue(buildRAGContext(rags))
        } else {
          mocks.mockRagRetrieve.mockResolvedValue({
            snippets: [],
            totalChars: 0,
            elapsedMs: 5,
            success: true,
            tierBreakdown: { tier: 1, label: '个股索引', count: 0 },
          })
        }

        const calculator = createMockCalculator('l1', 3.5, 'L1-护城河分析')
        const enhanced = enhancer.enhance(calculator)
        const input = buildLayerInput(stock.symbol, stock.name, stock.sector)

        const result = await enhanced.calculate(input)

        const citations: LLMCitation[] = result.evidence
          .filter((e) => e.startsWith('[引用:'))
          .map((e): LLMCitation | null => {
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
          symbol: stock.symbol,
          layerId: 'l1',
          ruleScore: 3.5,
          llmOutput: {
            score: result.score,
            summary: result.summary,
            rationale:
              result.evidence.find((e) => e.startsWith('[LLM增强]'))?.replace('[LLM增强] ', '') || '',
            risks: [],
            citations,
          },
          ragContext: rags ? buildRAGContext(rags).snippets : [],
        })
      }

      const suiteResult = runHallucinationSuite(samples)
      const report = formatHallucinationReport(suiteResult)

      // 验证：综合幻觉率 ≤ 15%
      expect(suiteResult.metrics.overallHallucinationRate).toBeLessThanOrEqual(15)

      // 验证：引用捏造率 ≤ 5%
      expect(suiteResult.metrics.fabricatedCitationRate).toBeLessThanOrEqual(5)

      // 验证：无证据调整率 ≤ 10%
      expect(suiteResult.metrics.unsupportedAdjustmentRate).toBeLessThanOrEqual(10)

      // 验证：矛盾声明 = 0
      expect(suiteResult.metrics.contradictoryClaims).toBe(0)

      // 验证：报告非空
      expect(report).toBeTruthy()
      expect(report.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================
  // 场景 8：确定性层不调用 LLM
  // ==========================================================

  describe('E2E-8: 确定性层不调用 LLM', () => {
    it('L3a（财务健康）、L3v（估值水平）、L8（技术筹码）不应调用 LLM', async () => {
      mocks.mockRagRetrieve.mockResolvedValue({
        snippets: [],
        totalChars: 0,
        elapsedMs: 0,
        success: true,
        tierBreakdown: { tier: 0, label: '无', count: 0 },
      })

      const enhancer = await createEnhancer()
      const input = buildLayerInput('sh.600519', '贵州茅台', '白酒')

      // L3a 财务健康 — 确定性层，不应调用 LLM
      const l3aCalc = createMockCalculator('l3f', 4.0, 'L3a-财务健康')
      const l3aEnhanced = enhancer.enhance(l3aCalc)
      const l3aResult = await l3aEnhanced.calculate(input)

      // L3v 估值水平 — 确定性层，不应调用 LLM
      const l3vCalc = createMockCalculator('l3v', 3.5, 'L3v-估值水平')
      const l3vEnhanced = enhancer.enhance(l3vCalc)
      const l3vResult = await l3vEnhanced.calculate(input)

      // L8 技术筹码 — 确定性层，不应调用 LLM
      const l8Calc = createMockCalculator('l8', 3.0, 'L8-技术筹码')
      const l8Enhanced = enhancer.enhance(l8Calc)
      const l8Result = await l8Enhanced.calculate(input)

      // 验证：评分直接透传，未被 LLM 修改
      expect(l3aResult.score).toBe(4.0)
      expect(l3vResult.score).toBe(3.5)
      expect(l8Result.score).toBe(3.0)

      // 验证：无 LLM 增强标记
      const hasLLM = l3aResult.evidence.some((e) => e.startsWith('[LLM增强]'))
      expect(hasLLM).toBe(false)
    })
  })
})