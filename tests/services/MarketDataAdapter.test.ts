/**
 * @test_id V9-TEST-UT-080
 * @covers_docs []
 */
import { describe, expect, it } from 'vitest'
import { marketDataAdapter } from '@/services/data-collector/MarketDataAdapter'
import type { RawMarketData } from '@/types/modules/widget.types'

/**
 * MarketDataAdapter 单元测试
 * @description 重点验证 A/B/C 三个板块原始 payload 到标准化 MarketData 的字段映射逻辑
 * @coverage 投资画像/分析中心、股票池管理、KAI 选股综合评分
 */
describe('MarketDataAdapter - 字段映射（A/B/C 板块）', () => {
  // ============================================================
  // A. 投资画像 / 分析中心
  // ============================================================
  describe('A. 投资画像/分析中心 analysisScores', () => {
    it('应将原始 payload 映射为标准化 AnalysisScores 结构', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'analysisScores',
        source: 'rest',
        payload: {
          profile: {
            tags: ['老股民', '择时'],
            metrics: [
              { name: '投资能力', score: 85, description: '综合收益能力' },
              { name: '风控能力', score: 72 },
            ],
          },
          kai: {
            totalScore: 78,
            sentiment: 80,
            trend: 75,
            flow: 70,
            dimensions: [],
            detailDistribution: [],
          },
        },
      }

      const result = marketDataAdapter.adapt(raw)
      expect(result.analysisScores).toBeDefined()
      expect(result.analysisScores!.profile.tags).toEqual(['老股民', '择时'])
      expect(result.analysisScores!.profile.metrics).toHaveLength(2)
      expect(result.analysisScores!.profile.metrics[0]!.score).toBe(85)
      expect(result.analysisScores!.profile.metrics[0]!.description).toBe('综合收益能力')
    })

    it('应支持 profile 字段别名映射', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'analysisScores',
        source: 'rest',
        payload: {
          userProfile: {
            tags: ['价值投资者'],
            metrics: [{ name: '投资风格', score: 90 }],
          },
          score: {
            total_score: 88,
            sentiment: 82,
            trend: 79,
            flow: 76,
            dimensions: [],
            detailDistribution: [],
          },
        },
      }

      const result = marketDataAdapter.adapt(raw)
      expect(result.analysisScores?.kai.totalScore).toBe(88)
      expect(result.analysisScores?.profile.tags).toEqual(['价值投资者'])
    })

    it('非法 payload 应返回安全的默认值', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'analysisScores',
        source: 'rest',
        payload: null,
      }

      const result = marketDataAdapter.adapt(raw)
      expect(result.analysisScores?.profile.tags).toEqual([])
      expect(result.analysisScores?.profile.metrics).toEqual([])
      expect(result.analysisScores?.kai.totalScore).toBe(0)
    })
  })

  // ============================================================
  // B. 股票池管理与监控
  // ============================================================
  describe('B. 股票池管理 poolBoard', () => {
    it('应将原始 payload 映射为标准化 PoolBoard 结构', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'poolBoard',
        source: 'rest',
        payload: {
          stocks: [
            {
              code: '600519',
              name: '贵州茅台',
              price: 1680.0,
              changePercent: 2.35,
              turnover: '36.5亿',
              turnoverRate: '0.58%',
              statusColor: 'bg-green-500',
              statusLabel: '活跃',
            },
          ],
          total: 12,
          page: 1,
          pageSize: 8,
        },
      }

      const result = marketDataAdapter.adapt(raw)
      expect(result.poolBoard).toBeDefined()
      expect(result.poolBoard?.items).toHaveLength(1)
      expect(result.poolBoard!.items[0]!.code).toBe('600519')
      expect(result.poolBoard!.items[0]!.name).toBe('贵州茅台')
      expect(result.poolBoard!.items[0]!.price).toBe(1680.0)
      expect(result.poolBoard!.items[0]!.changePercent).toBe(2.35)
      expect(result.poolBoard!.items[0]!.statusColor).toBe('bg-green-500')
      expect(result.poolBoard!.total).toBe(12)
    })

    it('应支持股票池字段别名映射', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'poolBoard',
        source: 'rest',
        payload: {
          stocks: [
            {
              symbol: '000858',
              stockName: '五粮液',
              currentPrice: 145.0,
              pctChange: -1.2,
              turnover: '12.3亿',
              turnover_rate: '1.05%',
              status_color: 'bg-amber-500',
              status_label: '温热',
            },
          ],
          total: 8,
          page: 2,
          limit: 10,
        },
      }

      const result = marketDataAdapter.adapt(raw)
      const stock = result.poolBoard!.items[0]!
      expect(stock.code).toBe('000858')
      expect(stock.name).toBe('五粮液')
      expect(stock.price).toBe(145.0)
      expect(stock.changePercent).toBe(-1.2)
      expect(stock.turnoverRate).toBe('1.05%')
      expect(stock.statusColor).toBe('bg-amber-500')
      expect(result.poolBoard!.pageSize).toBe(10)
    })

    it('非法 payload 应返回空股票池默认值', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'poolBoard',
        source: 'rest',
        payload: 'invalid',
      }

      const result = marketDataAdapter.adapt(raw)
      expect(result.poolBoard?.items).toEqual([])
      expect(result.poolBoard?.total).toBe(0)
      expect(result.poolBoard?.page).toBe(1)
    })
  })

  // ============================================================
  // C. KAI 选股综合评分
  // ============================================================
  describe('C. KAI 选股综合评分 analysisScores.kai', () => {
    it('应将 KAI 原始 payload 映射为标准化 KaiScore 结构', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'analysisScores',
        source: 'rest',
        payload: {
          kai: {
            totalScore: 82,
            sentiment: 78,
            trend: 85,
            flow: 80,
            dimensions: [
              { name: '竞争力', score: 88, weight: 0.17, status: '优秀', color: 'bg-green-500' },
              { name: '技术面', score: 75, weight: 0.17, status: '良好', color: 'bg-blue-500' },
            ],
            detailDistribution: [
              { dimensionName: '竞争力', itemName: '市占率', score: 90, weight: 0.042, color: 'bg-green-500' },
            ],
          },
        },
      }

      const result = marketDataAdapter.adapt(raw)
      const kai = result.analysisScores!.kai
      expect(kai.totalScore).toBe(82)
      expect(kai.sentiment).toBe(78)
      expect(kai.trend).toBe(85)
      expect(kai.flow).toBe(80)
      expect(kai.dimensions).toHaveLength(2)
      expect(kai.detailDistribution).toHaveLength(1)
      expect(kai.detailDistribution[0]!.dimensionName).toBe('竞争力')
    })

    it('应支持 KAI 字段别名映射', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'analysisScores',
        source: 'rest',
        payload: {
          kai: {
            total_score: 77,
            dimensions: [
              { name: '基本面', score: 66, weight: 0.17, status: '一般', color: 'bg-amber-500' },
            ],
            detailDistribution: [
              {
                dimension_name: '基本面',
                item_name: '盈利能力',
                score: 70,
                weight: 0.04,
                color: 'bg-amber-500',
              },
            ],
          },
        },
      }

      const result = marketDataAdapter.adapt(raw)
      const kai = result.analysisScores!.kai
      expect(kai.totalScore).toBe(77)
      expect(kai.dimensions[0]!.name).toBe('基本面')
      expect(kai.detailDistribution[0]!.dimensionName).toBe('基本面')
      expect(kai.detailDistribution[0]!.itemName).toBe('盈利能力')
    })

    it('缺失 kai payload 时应返回安全默认值', () => {
      const raw: RawMarketData = {
        timestamp: Date.now(),
        dataType: 'analysisScores',
        source: 'rest',
        payload: { profile: { tags: [], metrics: [] } },
      }

      const result = marketDataAdapter.adapt(raw)
      const kai = result.analysisScores?.kai
      expect(kai?.totalScore).toBe(0)
      expect(kai?.dimensions).toEqual([])
      expect(kai?.detailDistribution).toEqual([])
    })
  })

  // ============================================================
  // D. 合并与默认值
  // ============================================================
  describe('D. merge 合并与默认值', () => {
    it('merge 应包含新增金融业务字段的默认值', () => {
      const merged = marketDataAdapter.merge()

      expect(merged.analysisScores).toBeDefined()
      expect(merged.analysisScores.profile.tags).toEqual([])
      expect(merged.modelComparison).toBeDefined()
      expect(merged.modelComparison.dimensions).toEqual([])
      expect(merged.poolBoard).toBeDefined()
      expect(merged.poolBoard.items).toEqual([])
      expect(merged.chatHistory).toBeDefined()
      expect(merged.chatHistory.messages).toEqual([])
    })

    it('merge 多个 partial 时应正确覆盖新增字段', () => {
      const partial1 = marketDataAdapter.adapt({
        timestamp: Date.now(),
        dataType: 'analysisScores',
        source: 'mock',
        payload: {
          profile: { tags: ['测试'], metrics: [] },
          kai: {
            totalScore: 90,
            sentiment: 80,
            trend: 70,
            flow: 60,
            dimensions: [],
            detailDistribution: [],
          },
        },
      })

      const partial2 = marketDataAdapter.adapt({
        timestamp: Date.now(),
        dataType: 'poolBoard',
        source: 'mock',
        payload: {
          stocks: [{ code: '000001', name: '平安银行', price: 11, changePercent: 0, turnover: '', turnoverRate: '', statusColor: '', statusLabel: '' }],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      })

      const merged = marketDataAdapter.merge(partial1, partial2)
      expect(merged.analysisScores.profile.tags).toEqual(['测试'])
      expect(merged.analysisScores.kai.totalScore).toBe(90)
      expect(merged.poolBoard.total).toBe(1)
    })
  })
})
