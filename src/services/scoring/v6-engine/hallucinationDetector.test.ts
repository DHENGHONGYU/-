/**
 * @test_id V9-TEST-UT-061
 * hallucinationDetector 单元测试
 *
 * 覆盖场景：
 *   1. 引用捏造检测：LLM 返回的 citations 在 RAG 上下文中找不到
 *   2. 无证据评分调整：LLM 调整评分但无引用支撑
 *   3. 矛盾声明检测：LLM 声明与源文档情绪矛盾
 *   4. 不可核实断言：LLM 量化断言无法在 RAG 文档中追溯
 *   5. 纯规则引擎评分（无引用）→ 正常通过
 *   6. 门禁综合判断
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023]
*/

import { describe, it, expect } from 'vitest'
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

// ─── 测试辅助 ────────────────────────────────────────────────

function createRAGSnippet(overrides: Partial<RAGSnippet> = {}): RAGSnippet {
  return {
    docId: 'doc_001',
    title: '贵州茅台2026年Q2财报分析',
    content: '贵州茅台2026年Q2营收同比增长15%，净利润同比增长18%，毛利率提升至91.5%。直销渠道占比持续提升至45%，系列酒增速放缓。公司计划2026年全年营收增长目标15%。',
    source: '中信证券',
    publishedAt: Date.now(),
    similarity: 0.85,
    itemType: 'research_report',
    domain: 'D1',
    sentiment: 'positive',
    qualityScore: 85,
    ...overrides,
  }
}

function createLLMOutput(overrides: Partial<{
  score: number
  summary: string
  rationale: string
  risks: string[]
  citations: LLMCitation[]
}> = {}): {
  score: number
  summary: string
  rationale: string
  risks: string[]
  citations: LLMCitation[]
} {
  return {
    score: 4.2,
    summary: '估值合理，营收增长稳健',
    rationale: '基于Q2财报，公司营收同比增长15%，净利润同比增长18%，增长势头良好',
    risks: [],
    citations: [
      {
        source: '中信证券研报',
        content: '贵州茅台2026年Q2营收同比增长15%，净利润同比增长18%',
        date: '2026-08-01',
      },
    ],
    ...overrides,
  }
}

function createSample(overrides: Partial<HallucinationSample> = {}): HallucinationSample {
  return {
    symbol: 'sh.600519',
    layerId: 'l1',
    ruleScore: 3.5,
    ragContext: [createRAGSnippet()],
    llmOutput: createLLMOutput(),
    ...overrides,
  }
}

// ─── 测试套件 ────────────────────────────────────────────────

describe('HallucinationDetector 幻觉检测器', () => {

  // ────────── 1. 引用捏造检测 ──────────

  describe('引用捏造检测 (Fabricated Citation)', () => {
    it('① 引用内容可在 RAG 文档中找到 → 不视为捏造', () => {
      const sample = createSample({
        llmOutput: createLLMOutput({
          citations: [{
            source: '中信证券研报',
            content: '营收同比增长15%，净利润同比增长18%',
          }],
        }),
      })

      const result = detectSampleHallucination(sample)
      const fabricated = result.filter((h) => h.type === 'fabricated_citation')
      expect(fabricated.length).toBe(0)
    })

    it('② 引用内容完全不存在于 RAG 文档 → 视为捏造', () => {
      const sample = createSample({
        llmOutput: createLLMOutput({
          citations: [{
            source: '未知来源',
            content: '公司预计2027年营收突破2000亿，远超市场预期',
          }],
        }),
      })

      const result = detectSampleHallucination(sample)
      const fabricated = result.filter((h) => h.type === 'fabricated_citation')
      expect(fabricated.length).toBe(1)
      expect(fabricated[0]?.severity).toBe('high')
      expect(fabricated[0]?.description).toContain('未知来源')
    })

    it('③ 无 RAG 上下文时任何引用均视为捏造', () => {
      const sample = createSample({
        ragContext: [],
        llmOutput: createLLMOutput({
          citations: [{
            source: '某券商研报',
            content: '营收同比增长15%，净利润同比增长18%',
          }],
        }),
      })

      const result = detectSampleHallucination(sample)
      const fabricated = result.filter((h) => h.type === 'fabricated_citation')
      expect(fabricated.length).toBe(1)
    })

    it('④ 引用内容过短（< 10字符）→ 不检测', () => {
      const sample = createSample({
        llmOutput: createLLMOutput({
          citations: [{ source: '研报', content: '增长' }],
        }),
      })

      const result = detectSampleHallucination(sample)
      const fabricated = result.filter((h) => h.type === 'fabricated_citation')
      expect(fabricated.length).toBe(0)
    })
  })

  // ────────── 2. 无证据评分调整检测 ──────────

  describe('无证据评分调整检测 (Unsupported Adjustment)', () => {
    it('⑤ 评分未变 → 不检测', () => {
      const sample = createSample({
        ruleScore: 3.5,
        llmOutput: createLLMOutput({ score: 3.5, citations: [] }),
      })

      const result = detectSampleHallucination(sample)
      const unsupported = result.filter((h) => h.type === 'unsupported_adjustment')
      expect(unsupported.length).toBe(0)
    })

    it('⑥ 微小调整（< 0.3）无引用 → 不视为无证据', () => {
      const sample = createSample({
        ruleScore: 3.5,
        llmOutput: createLLMOutput({ score: 3.7, citations: [] }),
      })

      const result = detectSampleHallucination(sample)
      const unsupported = result.filter((h) => h.type === 'unsupported_adjustment')
      expect(unsupported.length).toBe(0)
    })

    it('⑦ 大幅调整（≥ 0.3）无引用 → 视为无证据调整', () => {
      const sample = createSample({
        ruleScore: 3.0,
        llmOutput: createLLMOutput({
          score: 4.5,
          citations: [],
          rationale: '我认为这只股票很好',
        }),
      })

      const result = detectSampleHallucination(sample)
      const unsupported = result.filter((h) => h.type === 'unsupported_adjustment')
      expect(unsupported.length).toBe(1)
      expect(unsupported[0]?.severity).toBe('high')
    })

    it('⑧ 大幅调整有引用但引用内容不相关 → 仍视为无证据', () => {
      const sample = createSample({
        ruleScore: 3.0,
        llmOutput: createLLMOutput({
          score: 4.5,
          citations: [{
            source: '研报',
            content: '公司办公地址变更至北京市朝阳区',
          }],
          rationale: '上调评分',
        }),
      })

      const result = detectSampleHallucination(sample)
      const unsupported = result.filter((h) => h.type === 'unsupported_adjustment')
      expect(unsupported.length).toBe(1)
    })
  })

  // ────────── 3. 矛盾声明检测 ──────────

  describe('矛盾声明检测 (Contradictory Claim)', () => {
    it('⑨ LLM 负面声明 vs positive 情绪文档 → 检测矛盾', () => {
      const sample = createSample({
        ragContext: [createRAGSnippet({ sentiment: 'positive' })],
        llmOutput: createLLMOutput({
          rationale: '公司营收大幅下滑，利润持续恶化，面临严峻挑战',
        }),
      })

      const result = detectSampleHallucination(sample)
      const contradictory = result.filter((h) => h.type === 'contradictory_claim')
      expect(contradictory.length).toBeGreaterThanOrEqual(1)
    })

    it('⑩ LLM 正面声明 vs negative 情绪文档 → 检测矛盾', () => {
      const sample = createSample({
        ragContext: [createRAGSnippet({ sentiment: 'negative' })],
        llmOutput: createLLMOutput({
          rationale: '公司营收大幅增长，利润持续改善，基本面强劲利好',
        }),
      })

      const result = detectSampleHallucination(sample)
      const contradictory = result.filter((h) => h.type === 'contradictory_claim')
      expect(contradictory.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ────────── 4. 不可核实断言检测 ──────────

  describe('不可核实断言检测 (Unverifiable Fact)', () => {
    it('⑪ 量化断言中的数字不在 RAG 文档中 → 不可核实', () => {
      const sample = createSample({
        ragContext: [createRAGSnippet({
          content: '公司营收增长稳定，行业前景良好',
        })],
        llmOutput: createLLMOutput({
          rationale: '公司2026年营收达到5000亿元，同比增长25%',
        }),
      })

      const result = detectSampleHallucination(sample)
      const unverifiable = result.filter((h) => h.type === 'unverifiable_fact')
      // 5000亿在文档中不存在 → 不可核实
      expect(unverifiable.length).toBeGreaterThanOrEqual(1)
    })

    it('⑫ 量化断言中的数字在 RAG 文档中存在 → 可核实', () => {
      const sample = createSample({
        ragContext: [createRAGSnippet({
          content: '公司2026年营收达到1500亿元，同比增长15%',
        })],
        llmOutput: createLLMOutput({
          rationale: '公司2026年营收1500亿元，增长15%',
        }),
      })

      const result = detectSampleHallucination(sample)
      const unverifiable = result.filter((h) => h.type === 'unverifiable_fact')
      // 1500 在文档中存在 → 可核实
      expect(unverifiable.length).toBe(0)
    })
  })

  // ────────── 5. 综合样本 ──────────

  describe('综合样本', () => {
    it('⑬ 纯规则引擎评分（评分不变，无引用）→ 无幻觉', () => {
      const sample = createSample({
        ruleScore: 3.5,
        llmOutput: createLLMOutput({
          score: 3.5,
          summary: '规则引擎评分合理',
          rationale: '当前评分已反映基本面情况',
          citations: [],
        }),
      })

      const result = detectSampleHallucination(sample)
      expect(result.length).toBe(0)
    })
  })
})

// ────────── 6. 批量检测与门禁 ──────────

describe('runHallucinationSuite 批量检测', () => {
  it('⑭ 全部干净样本 → 门禁通过', () => {
    const samples: HallucinationSample[] = [
      createSample({
        ruleScore: 3.5,
        llmOutput: createLLMOutput({
          score: 3.5,
          citations: [],
        }),
      }),
      createSample({
        ruleScore: 4.0,
        llmOutput: createLLMOutput({
          score: 4.0,
          citations: [],
        }),
      }),
    ]

    const report = runHallucinationSuite(samples)
    expect(report.passed).toBe(true)
    expect(report.totalScore).toBe(100)
    expect(report.totalHallucinations).toBe(0)
  })

  it('⑮ 包含捏造引用 → 门禁未通过', () => {
    const samples: HallucinationSample[] = [
      createSample({
        llmOutput: createLLMOutput({
          citations: [{
            source: '假来源',
            content: '完全不存在的内容xyzabc123',
          }],
        }),
      }),
    ]

    const report = runHallucinationSuite(samples)
    expect(report.metrics.fabricatedCitations).toBe(1)
    expect(report.totalScore).toBeLessThan(100)
  })

  it('⑯ 包含无证据调整 → 门禁未通过', () => {
    const samples: HallucinationSample[] = [
      createSample({
        ruleScore: 3.0,
        llmOutput: createLLMOutput({
          score: 4.5,
          citations: [],
          rationale: '无理由调整',
        }),
      }),
    ]

    const report = runHallucinationSuite(samples)
    expect(report.metrics.unsupportedAdjustments).toBe(1)
    expect(report.passed).toBe(false)
  })

  it('⑰ formatHallucinationReport 生成可读报告', () => {
    const samples: HallucinationSample[] = [createSample()]
    const report = runHallucinationSuite(samples)
    const formatted = formatHallucinationReport(report)

    expect(formatted).toContain('RAG 幻觉检测报告')
    expect(formatted).toContain('门禁标准')
    expect(formatted).toContain('样本数')
    expect(typeof formatted).toBe('string')
  })
})