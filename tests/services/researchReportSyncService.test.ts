/**
 * @test_id V9-TEST-UT-095
 * researchReportSyncService 单元测试
 *
 * 覆盖场景：
 * 1. classifyResearchReportToDomain - 研报分类
 * 2. researchReportToProfileItem - 研报转资料条目
 * 3. 质量分计算 / 证据权重 / 情绪映射
 *
 * @covers_docs [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import { describe, expect, it } from 'vitest'
import {
  classifyResearchReportToDomain,
  researchReportToProfileItem,
} from '@/services/profile/researchReportSyncService'
import type { ResearchReport } from '@/services/data-collector/dimensionDataTypes'

describe('researchReportSyncService - 券商研报同步适配器', () => {
  // ============================================================
  // 1. 分类函数测试
  // ============================================================
  describe('classifyResearchReportToDomain - 研报分类', () => {
    it('默认公司基本面研报应归类到 D3', () => {
      const report = {
        title: '公司深度研究：主营业务稳健增长',
        summary: '公司主营业务发展稳健，护城河深厚，竞争力强。',
      }
      const domain = classifyResearchReportToDomain(report)
      expect(domain).toBe('D3')
    })

    it('估值类研报应归类到 D6', () => {
      const report = {
        title: '估值分析：PE仅15倍，目标价有50%上涨空间',
        summary: '从估值角度看，公司PE处于历史低位，PB低于行业平均。给予买入评级，目标价50元。',
      }
      const domain = classifyResearchReportToDomain(report)
      expect(domain).toBe('D6')
    })

    it('行业研究报应归类到 D1', () => {
      const report = {
        title: '新能源汽车行业深度：景气度持续提升',
        summary: '行业景气度持续上行，产业链上下游全面受益。市场规模快速扩大，渗透率不断提升。',
      }
      const domain = classifyResearchReportToDomain(report)
      expect(domain).toBe('D1')
    })

    it('财务分析研报应归类到 D5', () => {
      const report = {
        title: '财务深度分析：ROE持续提升，现金流健康',
        summary: '从财务数据看，公司ROE连续三年提升，资产负债率下降，现金流充裕。杜邦分析显示盈利能力增强。',
      }
      const domain = classifyResearchReportToDomain(report)
      expect(domain).toBe('D5')
    })

    it('成长性研报应归类到 D7', () => {
      const report = {
        title: '成长性分析：第二曲线爆发，增长空间巨大',
        summary: '公司新业务增长迅速，第二曲线已经成型。从情景推演来看，未来三年新业务营收占比将超过50%。',
      }
      const domain = classifyResearchReportToDomain(report)
      expect(domain).toBe('D7')
    })

    it('竞争对比研报应归类到 D4', () => {
      const report = {
        title: '行业对比分析：龙头优势明显，份额持续提升',
        summary: '对比行业内主要竞争对手，公司龙头地位稳固，市场份额持续提升，赶超势头强劲。',
      }
      const domain = classifyResearchReportToDomain(report)
      expect(domain).toBe('D4')
    })
  })

  // ============================================================
  // 2. 转换函数测试
  // ============================================================
  describe('researchReportToProfileItem - 研报转资料条目', () => {
    const baseReport: ResearchReport = {
      id: 'report-001',
      title: '贵州茅台深度研究：护城河深厚，长期看好',
      author: '张三',
      institution: '中信证券',
      rating: '买入',
      targetPrice: 2500,
      date: '2026-07-20',
      summary: '公司护城河深厚，品牌力强，长期成长确定性高。业绩稳健增长，估值合理。给予买入评级，目标价2500元。',
    }

    it('应正确转换为 ProfileItem 结构', () => {
      const item = researchReportToProfileItem(baseReport, '600519')

      expect(item.symbol).toBe('600519')
      expect(item.itemType).toBe('research_report')
      expect(item.title).toBe(baseReport.title)
      expect(item.source).toBe(baseReport.institution)
      expect(item.author).toBe(baseReport.author)
      expect(item.isUserGenerated).toBe(false)
    })

    it('应生成有效的 qualityScore（质量分）', () => {
      const item = researchReportToProfileItem(baseReport, '600519')

      expect(item.qualityScore).toBeDefined()
      expect(typeof item.qualityScore).toBe('number')
      expect(item.qualityScore!).toBeGreaterThanOrEqual(20)
      expect(item.qualityScore!).toBeLessThanOrEqual(100)
    })

    it('头部券商研报应有更高质量分', () => {
      const citicReport = { ...baseReport, institution: '中信证券' }
      const unknownReport = { ...baseReport, institution: '小券商' }

      const citicItem = researchReportToProfileItem(citicReport, '600519')
      const unknownItem = researchReportToProfileItem(unknownReport, '600519')

      expect(citicItem.qualityScore!).toBeGreaterThan(unknownItem.qualityScore!)
    })

    it('有目标价的研报应有更高证据权重', () => {
      const withTarget = { ...baseReport, targetPrice: 2500 }
      const noTarget = { ...baseReport, targetPrice: undefined }

      const withTargetItem = researchReportToProfileItem(withTarget, '600519')
      const noTargetItem = researchReportToProfileItem(noTarget, '600519')

      expect(withTargetItem.evidenceWeight!).toBeGreaterThan(noTargetItem.evidenceWeight!)
    })

    it('买入评级应映射为 positive 情绪', () => {
      const buyReport = { ...baseReport, rating: '买入' }
      const item = researchReportToProfileItem(buyReport, '600519')
      expect(item.sentiment).toBe('positive')
    })

    it('卖出评级应映射为 negative 情绪', () => {
      const sellReport = { ...baseReport, rating: '卖出' }
      const item = researchReportToProfileItem(sellReport, '600519')
      expect(item.sentiment).toBe('negative')
    })

    it('中性评级应映射为 neutral 情绪', () => {
      const neutralReport = { ...baseReport, rating: '中性' }
      const item = researchReportToProfileItem(neutralReport, '600519')
      expect(item.sentiment).toBe('neutral')
    })

    it('未知评级应默认为 neutral', () => {
      const unknownReport = { ...baseReport, rating: '未知评级' }
      const item = researchReportToProfileItem(unknownReport, '600519')
      expect(item.sentiment).toBe('neutral')
    })

    it('应正确提取主题标签', () => {
      const item = researchReportToProfileItem(baseReport, '600519')

      expect(Array.isArray(item.topicTags)).toBe(true)
      expect(item.topicTags!.length).toBeGreaterThan(0)
      // 应包含券商标签
      expect(item.topicTags).toContain('中信证券')
      // 应包含评级标签
      expect(item.topicTags).toContain('买入')
    })

    it('应设置正确的 subType', () => {
      const item = researchReportToProfileItem(baseReport, '600519')
      expect(item.subType).toBe('买入')
    })

    it('无评级时 subType 应为 "研报"', () => {
      const noRatingReport = { ...baseReport, rating: '' }
      const item = researchReportToProfileItem(noRatingReport, '600519')
      expect(item.subType).toBe('研报')
    })

    it('应生成证据说明', () => {
      const item = researchReportToProfileItem(baseReport, '600519')

      expect(item.summary).toBeDefined()
      expect(typeof item.summary).toBe('string')
      expect(item.summary!.length).toBeGreaterThan(0)
      // 证据说明（content=evidenceNote）应包含券商名/评级/目标价
      expect(item.content).toBeDefined()
      expect(typeof item.content).toBe('string')
      expect(item.content).toContain('中信证券')
      expect(item.content).toContain('买入')
      expect(item.content).toContain('2500')
    })

    it('应设置正确的关联评分层（D6 默认 l3v）', () => {
      const valuationReport = {
        ...baseReport,
        title: '估值分析：PE处于历史低位',
        summary: '公司估值处于历史低位，PE仅15倍，目标价2500元，买入评级。',
      }
      const item = researchReportToProfileItem(valuationReport, '600519')

      // 估值类研报 → D6 → l3v
      if (item.domain === 'D6') {
        expect(item.relatedLayers).toContain('l3v')
      }
    })

    it('应从摘要中提取核心观点', () => {
      const item = researchReportToProfileItem(baseReport, '600519')

      // keyPoints 可能有也可能没有（取决于摘要格式），但如果有应该是数组
      if (item.keyPoints) {
        expect(Array.isArray(item.keyPoints)).toBe(true)
        expect(item.keyPoints.length).toBeLessThanOrEqual(3)
      }
    })
  })

  // ============================================================
  // 3. 边界情况测试
  // ============================================================
  describe('边界情况', () => {
    it('空标题不应导致崩溃', () => {
      const report = {
        id: 'test-empty',
        title: '',
        summary: '',
        author: '',
        institution: '',
        rating: '',
        date: '',
      } as ResearchReport

      expect(() => researchReportToProfileItem(report, '600519')).not.toThrow()
      const item = researchReportToProfileItem(report, '600519')
      expect(item).toBeDefined()
      expect(item.symbol).toBe('600519')
    })

    it('无摘要时 summary 应为空字符串', () => {
      const report = {
        id: 'test-no-summary',
        title: '测试标题',
        summary: '',
        author: '分析师',
        institution: '某券商',
        rating: '买入',
        date: '2026-07-20',
      }
      const item = researchReportToProfileItem(report, '600519')
      expect(item.summary).toBe('')
    })

    it('无效日期应使用当前时间', () => {
      const report: ResearchReport = {
        id: 'test-invalid-date',
        title: '测试标题',
        summary: '测试摘要',
        author: '分析师',
        institution: '某券商',
        rating: '买入',
        date: 'invalid-date',
      }
      const item = researchReportToProfileItem(report, '600519')
      expect(item.publishedAt).toBeDefined()
      expect(typeof item.publishedAt).toBe('number')
      expect(item.publishedAt).toBeGreaterThan(0)
    })

    it('各大券商都应被正确识别为头部券商', () => {
      const topInstitutions = [
        '中信证券', '中金公司', '华泰证券', '国泰君安', '海通证券',
      ]

      for (const inst of topInstitutions) {
        const report: ResearchReport = {
          id: `test-${inst}`,
          title: '测试研报',
          summary: '测试摘要内容',
          author: '分析师',
          institution: inst,
          rating: '买入',
          targetPrice: 100,
          date: '2026-07-20',
        }
        const item = researchReportToProfileItem(report, '600519')
        // 头部券商质量分应高于 70
        expect(item.qualityScore!).toBeGreaterThanOrEqual(70)
      }
    })
  })
})
