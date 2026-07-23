/**
 * @test_id V9-TEST-UT-092
 * @covers_docs [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */
import { describe, expect, it } from 'vitest'
import {
  classifyCommunityPostToDomain,
  communityPostToProfileItem,
} from '@/services/profile/communitySyncService'
import type { CommunityPost } from '@/services/data-collector/dimensionDataTypes'

/**
 * communitySyncService 单元测试
 * @description 验证社区帖分类、转换、质量评估等核心功能
 * @coverage 八域资料体系 / 社区帖同步适配器
 */
describe('communitySyncService - 社区帖同步适配器', () => {
  // ============================================================
  // 1. 分类函数测试
  // ============================================================
  describe('classifyCommunityPostToDomain - 社区帖分类', () => {
    it('默认市场情绪帖应归类到 D8（市场信号）', () => {
      const post = {
        title: '今天这只股票涨停了，散户都疯了',
        content: '今天主力资金大幅流入，散户情绪高涨，技术面突破压力位。',
        source: 'xueqiu',
      }
      const domain = classifyCommunityPostToDomain(post)
      expect(domain).toBe('D8')
    })

    it('行业分析帖应归类到 D1（行业产业）', () => {
      const post = {
        title: '新能源汽车行业景气度持续提升，产业链上下游全面受益',
        content: '从行业数据来看，新能源汽车市场规模持续扩大，渗透率不断提升。上游锂矿资源供需紧张，中游电池产能扩张，下游整车销售火爆。',
        source: 'xueqiu',
      }
      const domain = classifyCommunityPostToDomain(post)
      expect(domain).toBe('D1')
    })

    it('公司业绩分析帖应归类到 D3（公司基本面）', () => {
      const post = {
        title: '某公司年报解读：营收增长30%，净利润超预期',
        content: '公司年报发布，营收同比增长30%，净利润大幅超预期。主营业务竞争力强，护城河持续拓宽。',
        source: 'xueqiu',
      }
      const domain = classifyCommunityPostToDomain(post)
      expect(domain).toBe('D3')
    })

    it('估值分析帖应归类到 D6（估值定价）', () => {
      const post = {
        title: '深度估值分析：PE仅15倍，严重低估',
        content: '从PE、PB等估值指标来看，公司当前估值处于历史低位，目标价有50%上涨空间。买入评级。',
        source: 'xueqiu',
      }
      const domain = classifyCommunityPostToDomain(post)
      expect(domain).toBe('D6')
    })

    it('财务分析帖应归类到 D5（财务分析）', () => {
      const post = {
        title: '财务深度分析：ROE持续提升，现金流健康',
        content: '从财务数据看，公司ROE连续三年提升，资产负债率下降，现金流充裕，分红稳定。杜邦分析显示盈利能力增强。',
        source: 'xueqiu',
      }
      const domain = classifyCommunityPostToDomain(post)
      expect(domain).toBe('D5')
    })

    it('成长性分析帖应归类到 D7（成长前沿）', () => {
      const post = {
        title: '公司第二曲线业务爆发，增长空间巨大',
        content: '公司新业务增长迅速，第二曲线已经成型。从情景分析来看，未来三年新业务营收占比将超过50%，天花板很高。',
        source: 'xueqiu',
      }
      const domain = classifyCommunityPostToDomain(post)
      expect(domain).toBe('D7')
    })
  })

  // ============================================================
  // 2. 转换函数测试
  // ============================================================
  describe('communityPostToProfileItem - 社区帖转资料条目', () => {
    const basePost: CommunityPost = {
      id: 'test-001',
      title: '某公司深度研究：护城河深厚，成长空间大',
      content: '这是一篇深度研究报告，详细分析了公司的护城河、商业模式和成长空间。公司主营业务竞争力强，行业地位领先。',
      source: 'xueqiu',
      author: '价值投资大V',
      date: '2026-07-20',
      url: 'https://xueqiu.com/test/001',
      views: 10000,
      comments: 200,
      likes: 500,
      sentiment: 'positive',
      qualityScore: 80,
      keyPoints: ['护城河深厚', '成长性好', '估值合理'],
      stockName: '贵州茅台',
    }

    it('应正确转换为 ProfileItem 结构', () => {
      const item = communityPostToProfileItem(basePost, '600519')

      expect(item.symbol).toBe('600519')
      expect(item.itemType).toBe('community')
      expect(item.title).toBe(basePost.title)
      expect(item.source).toBe(basePost.source)
      expect(item.author).toBe(basePost.author)
      expect(item.sourceUrl).toBe(basePost.url)
      expect(item.sentiment).toBe('positive')
      expect(item.isUserGenerated).toBe(false)
    })

    it('应生成有效的 qualityScore（质量分）', () => {
      const item = communityPostToProfileItem(basePost, '600519')

      expect(item.qualityScore).toBeDefined()
      expect(typeof item.qualityScore).toBe('number')
      expect(item.qualityScore!).toBeGreaterThanOrEqual(10)
      expect(item.qualityScore!).toBeLessThanOrEqual(100)
    })

    it('雪球来源的帖子应有更高的质量加权', () => {
      const xueqiuPost = { ...basePost, source: 'xueqiu', qualityScore: 60 }
      const gubaPost = { ...basePost, source: '东方财富股吧', qualityScore: 60 }

      const xueqiuItem = communityPostToProfileItem(xueqiuPost, '600519')
      const gubaItem = communityPostToProfileItem(gubaPost, '600519')

      // 雪球来源质量加权更高（1.2 vs 0.8），所以质量分应更高
      expect(xueqiuItem.qualityScore!).toBeGreaterThan(gubaItem.qualityScore!)
    })

    it('高互动帖子应有更高的证据权重', () => {
      const highEngagementPost = { ...basePost, views: 100000, comments: 1000, likes: 5000 }
      const lowEngagementPost = { ...basePost, views: 100, comments: 5, likes: 10 }

      const highItem = communityPostToProfileItem(highEngagementPost, '600519')
      const lowItem = communityPostToProfileItem(lowEngagementPost, '600519')

      expect(highItem.evidenceWeight!).toBeGreaterThan(lowItem.evidenceWeight!)
    })

    it('应正确提取主题标签', () => {
      const post = {
        ...basePost,
        title: '贵州茅台业绩分析：护城河深厚，估值合理',
      }
      const item = communityPostToProfileItem(post, '600519')

      expect(Array.isArray(item.topicTags)).toBe(true)
      expect(item.topicTags!.length).toBeGreaterThan(0)
      // 应包含来源标签
      expect(item.topicTags).toContain('xueqiu')
    })

    it('无内容帖子应生成空摘要', () => {
      const post = { ...basePost, content: undefined }
      const item = communityPostToProfileItem(post, '600519')

      expect(item.summary).toBe('')
    })

    it('长内容应被截断为摘要', () => {
      const longContent = 'a'.repeat(500)
      const post = { ...basePost, content: longContent }
      const item = communityPostToProfileItem(post, '600519')

      expect(item.summary.length).toBeLessThan(310) // 300 + '...'
      expect(item.summary.endsWith('...')).toBe(true)
    })

    it('应设置正确的关联评分层（D8 默认 L7+L8）', () => {
      const marketPost = {
        ...basePost,
        title: '技术面分析：突破压力位，上涨空间打开',
        content: '从技术面看，MACD金叉，均线多头排列，资金流入明显。',
      }
      const item = communityPostToProfileItem(marketPost, '600519')

      expect(item.relatedLayers).toContain('l7')
      expect(item.relatedLayers).toContain('l8')
    })

    it('应生成证据说明', () => {
      const item = communityPostToProfileItem(basePost, '600519')

      expect(item.summary).toBeDefined()
      expect(typeof item.summary).toBe('string')
      expect(item.summary!.length).toBeGreaterThan(0)
    })

    it('subType 应正确映射来源', () => {
      const xueqiuItem = communityPostToProfileItem({ ...basePost, source: 'xueqiu' }, '600519')
      const gubaItem = communityPostToProfileItem({ ...basePost, source: '东方财富股吧' }, '600519')
      const zhihuItem = communityPostToProfileItem({ ...basePost, source: 'zhihu' }, '600519')

      expect(xueqiuItem.subType).toBe('雪球深度')
      expect(gubaItem.subType).toBe('股吧讨论')
      expect(zhihuItem.subType).toBe('知乎分析')
    })
  })

  // ============================================================
  // 3. 边界情况测试
  // ============================================================
  describe('边界情况', () => {
    it('空帖子标题不应导致崩溃', () => {
      const post = {
        id: 'test-empty',
        title: '',
        content: '',
        source: 'unknown',
        date: '',
      } as CommunityPost

      expect(() => communityPostToProfileItem(post, '600519')).not.toThrow()
      const item = communityPostToProfileItem(post, '600519')
      expect(item).toBeDefined()
    })

    it('未知来源应使用默认质量权重', () => {
      const post = {
        id: 'test-unknown',
        title: '未知来源帖子',
        content: '内容',
        source: 'unknown_source',
        date: '2026-07-20',
        qualityScore: 50,
      } as CommunityPost

      const item = communityPostToProfileItem(post, '600519')
      expect(item.qualityScore).toBeDefined()
      expect(item.qualityScore!).toBeGreaterThanOrEqual(10)
      expect(item.qualityScore!).toBeLessThanOrEqual(100)
    })

    it('中立情绪帖子不应带有情绪偏向', () => {
      const post = {
        id: 'test-neutral',
        title: '中性分析',
        content: '客观分析，多空皆有道理。',
        source: 'xueqiu',
        date: '2026-07-20',
        sentiment: 'neutral',
      } as CommunityPost

      const item = communityPostToProfileItem(post, '600519')
      expect(item.sentiment).toBe('neutral')
    })
  })
})
