import { getLogger } from '@/lib/logger'
import { BaseCollector } from './BaseCollector'
import type { RawMarketData, DataSourceConfig } from '@/types/modules/widget.types'
import { MOCK_COLLECTOR_CONFIG } from '@/constants/cockpit.constants'
import {
  mockMarketIndices,
  mockSectorData,
  mockFundFlows,
  mockMarketSentiment,
  mockWatchlist,
  mockPortfolioStats,
  mockTradeReview,
} from '@/cockpit/data/mockDataProvider'
import { MockStockAnalysisProvider } from '@/services/stock-analysis/mockStockAnalysisProvider'

const logger = getLogger()

/**
 * Mock 数据采集器
 * @description 生成随机模拟数据，支持模拟延迟和随机波动
 * @remarks 当环境变量 VITE_DATA_SOURCE_TYPE=mock 时启用
 */
export class MockCollector extends BaseCollector {
  constructor() {
    super()
  }

  /**
   * 执行 Mock 数据采集
   * @param dataSource 数据源配置（通过 endpoint 区分数据类型）
   */
  async collect(dataSource: DataSourceConfig): Promise<RawMarketData> {
    const { endpoint = '' } = dataSource

    // 模拟网络延迟
    const delay = this.getRandomDelay()
    logger.debug(`[MockCollector] 模拟延迟 ${delay}ms`)
    await this.delay(delay)

    // 根据 endpoint 路由到对应的数据生成器
    if (endpoint.includes('indices')) {
      return this.wrapData('indices', this.generateIndicesData(), 'mock')
    }
    if (endpoint.includes('sectors')) {
      return this.wrapData('sectors', this.generateSectorsData(), 'mock')
    }
    if (endpoint.includes('fund-flow')) {
      return this.wrapData('fundFlow', this.generateFundFlowData(), 'mock')
    }
    if (endpoint.includes('sentiment')) {
      return this.wrapData('sentiment', this.generateSentimentData(), 'mock')
    }
    if (endpoint.includes('watchlist')) {
      return this.wrapData('watchlist', this.generateWatchlistData(), 'mock')
    }
    if (endpoint.includes('portfolio')) {
      return this.wrapData('portfolio', this.generatePortfolioData(), 'mock')
    }
    if (endpoint.includes('trade-review')) {
      return this.wrapData('tradeReview', this.generateTradeReviewData(), 'mock')
    }
    // ============================================================
    // 新增股票分析业务 Mock 路由
    // @remarks 生产环境切换为 REST/WebSocket Collector 后，以下路由由真实 API 接管
    // ============================================================
    if (endpoint.includes('stock-analysis/profile') || endpoint.includes('stock-analysis/kai')) {
      const scores = await MockStockAnalysisProvider.getAnalysisScores()
      return this.wrapData('analysisScores', scores, 'mock')
    }
    if (endpoint.includes('stock-analysis/compare')) {
      const comparison = await MockStockAnalysisProvider.getModelComparison()
      return this.wrapData('modelComparison', comparison, 'mock')
    }
    if (endpoint.includes('stock-analysis/pool')) {
      const pool = await MockStockAnalysisProvider.getStockPool()
      return this.wrapData('stockPool', pool, 'mock')
    }
    if (endpoint.includes('stock-analysis/chat')) {
      const chat = await MockStockAnalysisProvider.getChatHistory()
      return this.wrapData('chatHistory', chat, 'mock')
    }

    throw new Error(`[MockCollector] 未知的 endpoint: ${endpoint}`)
  }

  /**
   * 生成随机延迟
   */
  private getRandomDelay(): number {
    const { MIN_DELAY, MAX_DELAY } = MOCK_COLLECTOR_CONFIG
    return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY
  }

  /**
   * 生成波动后的指数数据
   */
  private generateIndicesData() {
    const { PRICE_FLUCTUATION } = MOCK_COLLECTOR_CONFIG
    return mockMarketIndices.map((item) => ({
      ...item,
      value: this.fluctuate(item.value, PRICE_FLUCTUATION),
      change: this.fluctuate(item.change, PRICE_FLUCTUATION),
      changePercent: this.fluctuate(item.changePercent, PRICE_FLUCTUATION),
    }))
  }

  /**
   * 生成波动后的板块数据
   */
  private generateSectorsData() {
    const { PRICE_FLUCTUATION } = MOCK_COLLECTOR_CONFIG
    return mockSectorData.map((item) => ({
      ...item,
      changePercent: this.fluctuate(item.changePercent, PRICE_FLUCTUATION),
    }))
  }

  /**
   * 生成波动后的资金流向数据
   */
  private generateFundFlowData() {
    const { PRICE_FLUCTUATION } = MOCK_COLLECTOR_CONFIG
    return mockFundFlows.map((item) => ({
      ...item,
      value: this.fluctuate(item.value, PRICE_FLUCTUATION),
    }))
  }

  /**
   * 生成波动后的市场情绪数据
   */
  private generateSentimentData() {
    const { PRICE_FLUCTUATION } = MOCK_COLLECTOR_CONFIG
    return {
      ...mockMarketSentiment,
      fearGreedIndex: Math.max(0, Math.min(100, Math.floor(this.fluctuate(mockMarketSentiment.fearGreedIndex, 0.05)))),
      up: Math.max(0, Math.floor(this.fluctuate(mockMarketSentiment.up, PRICE_FLUCTUATION))),
      down: Math.max(0, Math.floor(this.fluctuate(mockMarketSentiment.down, PRICE_FLUCTUATION))),
    }
  }

  /**
   * 生成波动后的自选股数据
   */
  private generateWatchlistData() {
    const { PRICE_FLUCTUATION } = MOCK_COLLECTOR_CONFIG
    return mockWatchlist.map((item) => ({
      ...item,
      price: this.fluctuate(item.price, PRICE_FLUCTUATION),
      changePercent: this.fluctuate(item.changePercent, PRICE_FLUCTUATION),
    }))
  }

  /**
   * 生成持仓概览数据（变化较小）
   */
  private generatePortfolioData() {
    return mockPortfolioStats
  }

  /**
   * 生成交易复盘数据（静态）
   */
  private generateTradeReviewData() {
    return mockTradeReview
  }

  /**
   * 数值波动工具
   * @param value 原始值
   * @param range 波动范围（0-1）
   */
  private fluctuate(value: number, range: number): number {
    const factor = 1 + (Math.random() - 0.5) * 2 * range
    return Number((value * factor).toFixed(2))
  }
}
