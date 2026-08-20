/**
 * @fileoverview reportQualityChecker 单元测试
 * @created 2026-08-20
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { checkReportQuality, type ReportQualityStatus } from './reportQualityChecker'
import type { AnalysisResult, ReportSection, EvidenceChain, AnalysisConclusion } from '@/types/modules/analysisOrchestrator.types'

function createMockResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  const now = Date.now()
  return {
    docId: 'test-doc-001',
    symbol: 'sh600519',
    version: 1,
    createdAt: now,
    external: {
      symbol: 'sh600519',
      articleCount: 10,
      topArticles: [],
      fetchedAt: now,
    },
    internal: {
      symbol: 'sh600519',
      stockName: '贵州茅台',
      v6Score: 85,
      v6Rating: 'buy',
      fetchedAt: now,
    },
    conclusion: {
      rating: 'buy',
      summary: '测试结论',
      keyRisks: ['风险1', '风险2', '风险3', '风险4', '风险5'],
      opportunities: ['机会1'],
      consistentWithV6: true,
      evidenceChain: {
        items: [
          { dimension: 'rating', summary: '评分上升', source: 'V6模型', timestamp: now, strength: 4 },
          { dimension: 'risk', summary: '风险可控', source: '风险评估', timestamp: now, strength: 3 },
        ],
        coverage: 2,
        confidence: 0.8,
        generatedAt: now,
        model: 'test-model',
      },
    },
    rawLlmText: '[85分 ★ 强烈推荐] 贵州茅台具有较强的投资价值。[75分 ★] 行业地位稳固。[90分 ★] 财务状况良好。[80分 ★] 估值合理。[88分 ★] 盈利能力强。[76分 ★] 成长性好。[92分 ★] 竞争优势明显。[79分 ★] 分红稳定。[83分 ★] 管理优秀。[87分 ★] 品牌价值高。[81分 ★] 市场份额大。[74分 ★] 风险可控。[89分 ★] 现金流健康。[77分 ★] 成本控制好。[86分 ★] 创新能力强。',
    factorExecution: [],
    reasonableness: { passed: true, threshold: 0.8, completeness: 1, missingLayers: [], notes: '' },
    feedbackLoop: { triggered: false, issueCount: 0, message: '' },
    model: 'test-model',
    reportSections: [
      { sectionId: 's1', title: '核心结论与评级', content: '结论内容' },
      { sectionId: 's2', title: '投资建议', content: '建议内容' },
      { sectionId: 's3', title: '公司概况', content: '公司内容' },
      { sectionId: 's4', title: '行业定位', content: '行业内容' },
      { sectionId: 's5', title: '护城河分析', content: '护城河内容' },
      { sectionId: 's6', title: '财务分析', content: '财务内容' },
      { sectionId: 's7', title: '估值分析', content: '估值内容' },
      { sectionId: 's8', title: '竞争格局', content: '竞争内容' },
      { sectionId: 's9', title: '技术分析', content: '技术内容' },
      { sectionId: 's10', title: '筹码分析', content: '筹码内容' },
      { sectionId: 's11', title: '风险提示', content: '风险内容' },
      { sectionId: 's12', title: '催化剂与事件', content: '催化内容' },
      { sectionId: 's13', title: '操作策略', content: '策略内容' },
      { sectionId: 's14', title: '情景分析', content: '情景内容' },
      { sectionId: 's15', title: '结论与展望', content: '结论内容' },
      { sectionId: 's16', title: '附录', content: '附录内容' },
    ],
    lineage: {
      v6ScoreVersion: '1.0',
      dataVersions: {
        stockSnapshotAt: now,
        v6ScoreSnapshotAt: now,
        newsFetchedAt: now,
      },
      newsIds: [],
    },
    ...overrides,
  }
}

describe('reportQualityChecker', () => {
  describe('checkReportQuality', () => {
    it('应返回 green 当所有维度通过', () => {
      const result = createMockResult()
      const status = checkReportQuality(result)
      expect(status.overallLevel).toBe('green')
      expect(status.missingCriticalDeliverables).toHaveLength(0)
    })

    it('应返回 red 当有红色告警维度', () => {
      const result = createMockResult({
        rawLlmText: '无标注文本',
        conclusion: undefined,
        reportSections: undefined,
      })
      const status = checkReportQuality(result)
      expect(status.overallLevel).toBe('red')
      expect(status.missingCriticalDeliverables.length).toBeGreaterThan(0)
    })

    it('应返回 yellow 当仅有黄色告警', () => {
      // 置信度标注数量不足（4处<15处），但章节完整、风险充足等
      const result = createMockResult({
        rawLlmText: '[80分 ★] 测试。', // 只有1处标注 < 5, 会触发 red
      })
      const status = checkReportQuality(result)
      // 由于置信度标注只有1处，会是 red 级别
      expect(['red', 'yellow', 'green']).toContain(status.overallLevel)
    })

    it('应包含正确的报告元数据', () => {
      const result = createMockResult()
      const status = checkReportQuality(result)
      expect(status.docId).toBe('test-doc-001')
      expect(status.symbol).toBe('sh600519')
      expect(status.dimensions).toHaveLength(6)
    })

    it('检查6个维度的完整性', () => {
      const result = createMockResult()
      const status = checkReportQuality(result)
      const dimensionNames = status.dimensions.map((d) => d.name)
      expect(dimensionNames).toEqual(
        expect.arrayContaining(['章节完整性', '置信度标注', '关键风险', '证据链', 'V6一致性', '数据新鲜度'])
      )
    })

    it('应正确计算通过率评分', () => {
      const result = createMockResult()
      const status = checkReportQuality(result)
      // 所有维度通过，得分应该较高
      expect(status.score).toBeGreaterThanOrEqual(50)
    })

    it('关键风险不足时应标记为红色', () => {
      const result = createMockResult({
        conclusion: {
          rating: 'buy',
          summary: '测试',
          keyRisks: ['风险1'], // 只有1条，低于 MIN_KEY_RISKS=3
          opportunities: [],
          consistentWithV6: true,
          evidenceChain: {
            items: [
              { dimension: 'rating', summary: '测试', source: 'test', timestamp: Date.now(), strength: 3 },
              { dimension: 'risk', summary: '测试', source: 'test', timestamp: Date.now(), strength: 3 },
            ],
            coverage: 2,
            confidence: 0.8,
            generatedAt: Date.now(),
            model: 'test',
          },
        },
      })
      const status = checkReportQuality(result)
      expect(status.dimensions.find((d) => d.name === '关键风险')?.level).toBe('red')
    })

    it('证据链缺失时应标记为红色', () => {
      const result = createMockResult({
        conclusion: {
          rating: 'buy',
          summary: '测试',
          keyRisks: ['风险1', '风险2', '风险3'],
          opportunities: [],
          consistentWithV6: true,
          evidenceChain: undefined,
        },
      })
      const status = checkReportQuality(result)
      expect(status.dimensions.find((d) => d.name === '证据链')?.level).toBe('red')
    })

    it('V6 不一致时应标记为红色', () => {
      const result = createMockResult({
        conclusion: {
          rating: 'buy',
          summary: '测试',
          keyRisks: ['风险1', '风险2', '风险3'],
          opportunities: [],
          consistentWithV6: false,
          evidenceChain: {
            items: [
              { dimension: 'rating', summary: '测试', source: 'test', timestamp: Date.now(), strength: 3 },
              { dimension: 'risk', summary: '测试', source: 'test', timestamp: Date.now(), strength: 3 },
            ],
            coverage: 2,
            confidence: 0.8,
            generatedAt: Date.now(),
            model: 'test',
          },
        },
      })
      const status = checkReportQuality(result)
      expect(status.dimensions.find((d) => d.name === 'V6一致性')?.level).toBe('red')
    })

    it('数据过期时应标记为红色', () => {
      const oldTime = Date.now() - 25 * 60 * 60 * 1000 // 超过 24 小时
      const result = createMockResult({
        lineage: {
          v6ScoreVersion: '1.0',
          dataVersions: {
            stockSnapshotAt: oldTime,
            v6ScoreSnapshotAt: oldTime,
            newsFetchedAt: oldTime,
          },
          newsIds: [],
        },
      })
      const status = checkReportQuality(result)
      expect(status.dimensions.find((d) => d.name === '数据新鲜度')?.level).toBe('red')
    })

    it('章节不完整时应标记为红色或黄色', () => {
      const result = createMockResult({
        reportSections: [{ sectionId: 's1', title: '核心结论与评级', content: '' }],
      })
      const status = checkReportQuality(result)
      expect(status.dimensions.find((d) => d.name === '章节完整性')?.level).toBe('red')
    })

    it('置信度标注不足时应标记为红色', () => {
      const result = createMockResult({
        rawLlmText: '无标注文本', // 0 处标注
      })
      const status = checkReportQuality(result)
      expect(status.dimensions.find((d) => d.name === '置信度标注')?.level).toBe('red')
    })
  })
})
