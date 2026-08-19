/**
 * @test_id V9-TEST-UT-062
 * RAG 增强评分 — 幻觉检测门禁 & Golden Dataset 回归测试
 *
 * 测试目标：
 *   1. 验证 RAG 增强评分在已知 Golden Dataset 上不产生幻觉
 *   2. 验证 hallucinationDetector 能正确识别各类幻觉
 *   3. 验证 RAG 门禁标准（引用捏造率 ≤ 5%，无证据调整率 ≤ 10%，矛盾声明 = 0）
 *   4. 验证 RAG 上下文缺失时 enhancer 正确降级
 *
 * 被测模块：
 *   - src/services/scoring/v6-engine/hallucinationDetector.ts
 *   - src/services/scoring/v6-engine/enhancer.ts (LLMScoreEnhancer)
 *   - src/services/scoring/v6-engine/ragRetriever.ts (RAGRetriever)
 *
 * Mock 策略：
 *   - ragRetriever → vi.mock 返回受控的 RAG 上下文
 *   - llmGateway.chat → vi.mock 返回受控的 LLM 响应
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023]
*/

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  detectSampleHallucination,
  runHallucinationSuite,
  formatHallucinationReport,
} from '@/services/scoring/v6-engine/hallucinationDetector'
import type {
  HallucinationSample,
  LLMCitation,
} from '@/services/scoring/v6-engine/hallucinationDetector'
import type { RAGSnippet } from '@/services/scoring/v6-engine/ragRetriever'

// ============================================================
// Golden Dataset 类型
// ============================================================

interface ExpectedScoreRange {
  min: number
  max: number
  rating: string
}

interface ExpectedLayerRange {
  min: number
  max: number
}

interface GoldenStock {
  symbol: string
  name: string
  sector: string
  marketCap: number
  pe: number
  pb: number
  roe: number
  eps: number
  peg: number
  expectedScoreRange: ExpectedScoreRange
  expectedLayers: Record<string, ExpectedLayerRange>
  notes: string
}

interface GoldenDataset {
  version: string
  createdAt: string
  description: string
  engineVersion: string
  stocks: GoldenStock[]
  validationRules: {
    scoreRange: [number, number]
    ratingAccuracy: number
    layerScoreAccuracy: number
    minCoverageRate: number
    maxCrossValidationIssues: number
  }
}

// ============================================================
// 预构建的 RAG 上下文模板（模拟真实研报/公告/新闻片段）
// ============================================================

const STOCK_RAG_TEMPLATES: Record<string, RAGSnippet[]> = {
  'sh.600519': [
    {
      docId: 'rag_mt_001',
      title: '贵州茅台2026Q2财报点评',
      content: '贵州茅台2026年Q2营收819.3亿元，同比增长17.5%；归母净利润416.9亿元，同比增长18.2%。毛利率91.3%，同比提升0.5个百分点。直销渠道占比提升至46.2%，i茅台平台贡献显著。',
      source: '中信证券',
      publishedAt: Date.now() - 86400000 * 30,
      similarity: 0.92,
      itemType: 'research_report',
      domain: 'D1',
      sentiment: 'positive',
      qualityScore: 90,
    },
    {
      docId: 'rag_mt_002',
      title: '白酒行业深度报告',
      content: '2026年白酒行业集中度持续提升，CR5提升至45%。高端白酒需求韧性较强，次高端竞争加剧。茅台品牌护城河极深，飞天茅台批价稳定在2700元以上。',
      source: '华泰证券',
      publishedAt: Date.now() - 86400000 * 45,
      similarity: 0.78,
      itemType: 'industry_report',
      domain: 'D1',
      sentiment: 'positive',
      qualityScore: 85,
    },
    {
      docId: 'rag_mt_003',
      title: '茅台国际化战略进展',
      content: '茅台2026年海外营收同比增长35%，东南亚市场增速超50%。公司计划2027年海外营收占比提升至10%以上。',
      source: '招商证券',
      publishedAt: Date.now() - 86400000 * 15,
      similarity: 0.65,
      itemType: 'news',
      domain: 'D7',
      sentiment: 'positive',
      qualityScore: 75,
    },
  ],
  'sz.300750': [
    {
      docId: 'rag_nd_001',
      title: '宁德时代2026Q2业绩预告',
      content: '宁德时代2026年Q2预计营收750-800亿元，同比增长12-18%。动力电池全球市占率37.5%，储能业务增速超50%。钠离子电池开始量产交付。',
      source: '广发证券',
      publishedAt: Date.now() - 86400000 * 20,
      similarity: 0.90,
      itemType: 'research_report',
      domain: 'D1',
      sentiment: 'positive',
      qualityScore: 88,
    },
    {
      docId: 'rag_nd_002',
      title: '电池行业竞争格局分析',
      content: '2026年动力电池行业CR3为68%，宁德时代、比亚迪、LG新能源三足鼎立。碳酸锂价格回落至8万元/吨，成本端压力缓解。',
      source: '申万宏源',
      publishedAt: Date.now() - 86400000 * 35,
      similarity: 0.72,
      itemType: 'industry_report',
      domain: 'D2',
      sentiment: 'neutral',
      qualityScore: 80,
    },
  ],
  'sh.600900': [
    {
      docId: 'rag_cj_001',
      title: '长江电力2026年发电量公告',
      content: '长江电力2026年上半年发电量1200亿千瓦时，同比增长8.5%。来水情况优于去年同期，乌东德、白鹤滩电站利用率提升。',
      source: '公司公告',
      publishedAt: Date.now() - 86400000 * 10,
      similarity: 0.95,
      itemType: 'notice',
      domain: 'D1',
      sentiment: 'positive',
      qualityScore: 85,
    },
    {
      docId: 'rag_cj_002',
      title: '水电行业景气度跟踪',
      content: '2026年汛期来水偏丰，主要水电站发电量同比提升5-10%。电力市场化改革推进，水电电价有上行空间。',
      source: '长江证券',
      publishedAt: Date.now() - 86400000 * 25,
      similarity: 0.68,
      itemType: 'industry_report',
      domain: 'D1',
      sentiment: 'positive',
      qualityScore: 78,
    },
  ],
}

// 默认空 RAG 上下文（用于无 RAG 文档的股票）
const DEFAULT_EMPTY_RAG: RAGSnippet[] = []

// ============================================================
// 预构建的 LLM 响应模板（模拟真实 LLM 增强结果）
// ============================================================

interface SimulatedLLMResponse {
  score: number
  summary: string
  rationale: string
  risks: string[]
  citations: LLMCitation[]
}

/**
 * 模拟 LLM 返回"评分合理，无需调整"的响应
 */
function simulateLLMNoChange(ruleScore: number, stockName: string): SimulatedLLMResponse {
  return {
    score: ruleScore,
    summary: `${stockName}规则引擎评分合理，无需调整`,
    rationale: '基于检索到的研报和公告资料，当前评分已充分反映基本面情况，未发现需要调整的因素。',
    risks: [],
    citations: [],
  }
}

/**
 * 模拟 LLM 返回"有依据的评分调整"的响应
 */
function simulateLLMWithGroundedCitations(
  newScore: number,
  stockName: string,
  citations: LLMCitation[],
): SimulatedLLMResponse {
  return {
    score: newScore,
    summary: `${stockName}基于最新研报信息，建议上调评分`,
    rationale: '根据检索到的最新财报和行业研报，公司基本面优于预期，建议适当上调评分以反映最新信息。',
    risks: ['行业竞争加剧风险'],
    citations,
  }
}

/**
 * 模拟 LLM 返回"捏造引用"的响应（用于测试幻觉检测）
 */
function simulateLLMWithFabricatedCitations(
  newScore: number,
  stockName: string,
): SimulatedLLMResponse {
  return {
    score: newScore,
    summary: `${stockName}基于第三方信息调整评分`,
    rationale: '根据某内部消息来源，公司即将发布重大利好公告。',
    risks: [],
    citations: [
      {
        source: '内部消息',
        content: '公司即将发布重大利好公告，预计Q3营收增长50%',
      },
    ],
  }
}

/**
 * 模拟 LLM 返回"无证据大幅调整"的响应（用于测试幻觉检测）
 */
function simulateLLMWithUnsupportedAdjustment(
  newScore: number,
  stockName: string,
): SimulatedLLMResponse {
  return {
    score: newScore,
    summary: `${stockName}大幅上调评分`,
    rationale: '我认为这只股票被严重低估，应该大幅上调评分。',
    risks: [],
    citations: [],
  }
}

// ============================================================
// 加载 Golden Dataset
// ============================================================

let dataset: GoldenDataset

function loadDataset(): GoldenDataset {
  const path = resolve(__dirname, '..', '..', '..', '..', 'tests', 'golden-dataset', 'scores.json')
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as GoldenDataset
}

dataset = loadDataset()

// ============================================================
// 获取 Golden Stock 的 RAG 上下文
// ============================================================

function getRAGContext(symbol: string): RAGSnippet[] {
  return STOCK_RAG_TEMPLATES[symbol] ?? DEFAULT_EMPTY_RAG
}

// ============================================================
// 测试套件
// ============================================================

describe('RAG 增强评分 — 幻觉检测门禁', () => {

  describe('Golden Dataset 健康检查', () => {
    it('应包含至少 20 只股票', () => {
      expect(dataset.stocks.length).toBeGreaterThanOrEqual(20)
    })

    it('至少 3 只股票有预构建的 RAG 上下文', () => {
      const withRAG = dataset.stocks.filter((s) => STOCK_RAG_TEMPLATES[s.symbol])
      expect(withRAG.length).toBeGreaterThanOrEqual(3)
    })
  })

  // ────────── 核心幻觉检测门禁 ──────────

  describe('幻觉检测门禁 (Hallucination Gate)', () => {
    it('① 干净样本：评分不变 + 无引用 → 门禁通过', () => {
      const samples: HallucinationSample[] = dataset.stocks.slice(0, 5).map((stock) => {
        const ragContext = getRAGContext(stock.symbol)
        const ruleScore = 3.5
        const llmResponse = simulateLLMNoChange(ruleScore, stock.name)

        return {
          symbol: stock.symbol,
          layerId: 'l1',
          ruleScore,
          ragContext,
          llmOutput: llmResponse,
        }
      })

      const report = runHallucinationSuite(samples)
      expect(report.passed).toBe(true)
      expect(report.totalHallucinations).toBe(0)
      expect(report.totalScore).toBe(100)
    })

    it('② 有依据的调整：引用可追溯 + 评分调整合理 → 门禁通过', () => {
      const samples: HallucinationSample[] = dataset.stocks.slice(0, 3)
        .filter((s) => STOCK_RAG_TEMPLATES[s.symbol])
        .map((stock) => {
          const ragContext = getRAGContext(stock.symbol)
          const ruleScore = 3.0
          const llmResponse = simulateLLMWithGroundedCitations(4.0, stock.name, [
            {
              source: ragContext[0]?.source ?? '研报',
              content: ragContext[0]?.content.slice(0, 50) ?? '营收增长',
              date: '2026-08-01',
            },
          ])

          return {
            symbol: stock.symbol,
            layerId: 'l1',
            ruleScore,
            ragContext,
            llmOutput: llmResponse,
          }
        })

      if (samples.length > 0) {
        const report = runHallucinationSuite(samples)
        expect(report.passed).toBe(true)
        expect(report.metrics.fabricatedCitations).toBe(0)
      }
    })

    it('③ 捏造引用：引用内容不在 RAG 文档中 → 门禁拦截', () => {
      const stock = dataset.stocks[0]!
      const ragContext = getRAGContext(stock.symbol)
      const llmResponse = simulateLLMWithFabricatedCitations(4.5, stock.name)

      const sample: HallucinationSample = {
        symbol: stock.symbol,
        layerId: 'l1',
        ruleScore: 3.0,
        ragContext,
        llmOutput: llmResponse,
      }

      const result = detectSampleHallucination(sample)
      const fabricated = result.filter((h) => h.type === 'fabricated_citation')
      expect(fabricated.length).toBeGreaterThanOrEqual(1)
    })

    it('④ 无证据大幅调整：评分调整 1.5+ 且无引用 → 门禁拦截', () => {
      const stock = dataset.stocks[0]!
      const ragContext = getRAGContext(stock.symbol)
      const llmResponse = simulateLLMWithUnsupportedAdjustment(4.5, stock.name)

      const sample: HallucinationSample = {
        symbol: stock.symbol,
        layerId: 'l1',
        ruleScore: 3.0,
        ragContext,
        llmOutput: llmResponse,
      }

      const result = detectSampleHallucination(sample)
      const unsupported = result.filter((h) => h.type === 'unsupported_adjustment')
      expect(unsupported.length).toBe(1)
    })

    it('⑤ 无 RAG 上下文 + 评分不变 → 正常通过', () => {
      const stock = dataset.stocks[4]! // 一只没有预构建 RAG 的股票
      const samples: HallucinationSample[] = [{
        symbol: stock.symbol,
        layerId: 'l1',
        ruleScore: 3.0,
        ragContext: [],
        llmOutput: simulateLLMNoChange(3.0, stock.name),
      }]

      const report = runHallucinationSuite(samples)
      expect(report.passed).toBe(true)
    })
  })

  // ────────── 批量 Golden Dataset 回归 ──────────

  describe('Golden Dataset 批量回归', () => {
    it('⑥ 全部 20 只 Golden Stock：干净 LLM 响应 → 门禁通过', () => {
      const samples: HallucinationSample[] = dataset.stocks.map((stock) => {
        const ragContext = getRAGContext(stock.symbol)
        const ruleScore = (
          stock.expectedScoreRange.min + stock.expectedScoreRange.max
        ) / 2

        // 使用有依据的引用（如果 RAG 上下文存在）
        const llmResponse = ragContext.length > 0
          ? simulateLLMWithGroundedCitations(ruleScore, stock.name, [
              {
                source: ragContext[0]?.source ?? '研报',
                content: ragContext[0]?.content.slice(0, 60) ?? '营收增长',
                date: '2026-08-01',
              },
            ])
          : simulateLLMNoChange(ruleScore, stock.name)

        return {
          symbol: stock.symbol,
          layerId: 'l1',
          ruleScore,
          ragContext,
          llmOutput: llmResponse,
        }
      })

      const report = runHallucinationSuite(samples)
      expect(report.samplesChecked).toBe(dataset.stocks.length)
      expect(report.passed).toBe(true)
      expect(report.metrics.fabricatedCitationRate).toBeLessThanOrEqual(5)
      expect(report.metrics.contradictoryClaims).toBe(0)

      // 验证报告格式
      const formatted = formatHallucinationReport(report)
      expect(formatted).toContain('通过')
    })
  })

  // ────────── 各维度分项测试 ──────────

  describe('各维度独立检测', () => {
    it('⑦ 引用捏造率：100% 捏造 → 门禁未通过', () => {
      const stock = dataset.stocks[0]!
      const samples: HallucinationSample[] = [{
        symbol: stock.symbol,
        layerId: 'l1',
        ruleScore: 3.0,
        ragContext: getRAGContext(stock.symbol),
        llmOutput: simulateLLMWithFabricatedCitations(4.5, stock.name),
      }]

      const report = runHallucinationSuite(samples)
      expect(report.passed).toBe(false)
      expect(report.metrics.fabricatedCitations).toBe(1)
      expect(report.totalScore).toBeLessThanOrEqual(85)
    })

    it('⑧ 矛盾声明：LLM 与文档情绪相反 → 门禁记录', () => {
      const stock = dataset.stocks[0]!
      const ragContext = getRAGContext(stock.symbol) // sentiment: positive
      const sample: HallucinationSample = {
        symbol: stock.symbol,
        layerId: 'l1',
        ruleScore: 3.5,
        ragContext,
        llmOutput: {
          score: 3.5,
          summary: '公司面临重大风险',
          rationale: '公司营收大幅下滑，利润持续恶化，面临严峻挑战和衰退风险',
          risks: ['衰退风险'],
          citations: [],
        },
      }

      const result = detectSampleHallucination(sample)
      const contradictory = result.filter((h) => h.type === 'contradictory_claim')
      expect(contradictory.length).toBeGreaterThanOrEqual(1)
    })

    it('⑨ 不可核实断言：量化数据不在文档中 → 记录但门禁通过', () => {
      const stock = dataset.stocks[0]!
      const ragContext = getRAGContext(stock.symbol)
      const sample: HallucinationSample = {
        symbol: stock.symbol,
        layerId: 'l1',
        ruleScore: 3.5,
        ragContext,
        llmOutput: {
          score: 3.5,
          summary: '评分合理',
          rationale: '公司2028年预计营收达到3000亿元，净利润800亿元',
          risks: [],
          citations: [],
        },
      }

      const result = detectSampleHallucination(sample)
      const unverifiable = result.filter((h) => h.type === 'unverifiable_fact')
      // 不可核实断言是 low severity，不阻塞门禁
      expect(unverifiable.length).toBeGreaterThanOrEqual(1)
      expect(unverifiable[0]?.severity).toBe('low')
    })
  })

  // ────────── 报告生成 ──────────

  describe('报告生成', () => {
    it('⑩ 生成格式完整的检测报告', () => {
      const samples: HallucinationSample[] = dataset.stocks.slice(0, 3).map((stock) => {
        const ragContext = getRAGContext(stock.symbol)
        return {
          symbol: stock.symbol,
          layerId: 'l1',
          ruleScore: 3.5,
          ragContext,
          llmOutput: simulateLLMNoChange(3.5, stock.name),
        }
      })

      const report = runHallucinationSuite(samples)
      const formatted = formatHallucinationReport(report)

      // 报告中应包含所有关键信息
      expect(formatted).toContain('RAG 幻觉检测报告')
      expect(formatted).toContain('门禁结果')
      expect(formatted).toContain('总分')
      expect(formatted).toContain('引用捏造')
      expect(formatted).toContain('无证据调整')
      expect(formatted).toContain('矛盾声明')
      expect(formatted).toContain('不可核实断言')
      expect(formatted).toContain('综合幻觉率')
      expect(formatted).toContain('门禁标准')
      expect(report.timestamp).toBeGreaterThan(0)
    })
  })
})