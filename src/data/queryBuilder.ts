import { getLogger } from '@/lib/logger'
import { dataLayer } from '@/data/dataLayer'
import type {
  DailyQuotes,
  IndustryScore,
  IntelligentScore,
  NewsArticle,
  Signal,
  Stock,
  V6Score,
} from '@/data/types'

const logger = getLogger()

/** 查询粒度开关 */
export interface UnifiedStockQuery {
  /** 股票代码（必填） */
  symbol: string
  /** 是否包含股票基础信息 */
  includeBasic?: boolean
  /** 是否包含 K 线行情 */
  includeQuotes?: boolean
  /** 是否包含 V6 评分 */
  includeV6Score?: boolean
  /** 是否包含智能评分 */
  includeIntelligentScore?: boolean
  /** 是否包含行业评分 */
  includeIndustryScore?: boolean
  /** 是否包含交易信号 */
  includeSignals?: boolean
  /** 是否包含关联新闻 */
  includeNews?: boolean
}

/** 综合查询结果 */
export interface QueryBuilderResult {
  /** 股票基础信息 */
  stock?: Stock
  /** K 线行情 */
  quotes?: DailyQuotes
  /** V6 评分 */
  v6Score?: V6Score
  /** 智能评分 */
  intelligentScore?: IntelligentScore
  /** 行业评分 */
  industryScore?: IndustryScore
  /** 交易信号列表 */
  signals?: Signal[]
  /** 关联新闻列表 */
  news?: NewsArticle[]
  /** 查询失败的维度 */
  errors?: string[]
}

type TaskResult = { key: keyof Omit<QueryBuilderResult, 'errors'>; value: unknown }

/**
 * QueryBuilder -- 绕开 Store 综合查询引擎
 *
 * 封装 dataLayer 多个 Store 的并发查询，一次性获取某只股票在
 * 基础信息 / 行情 / V6评分 / 智能评分 / 行业评分 / 交易信号 / 关联新闻
 * 等多个维度的数据，返回统一的 QueryBuilderResult。 */
export class QueryBuilder {
  /**
   * 从 DataLayer 查询多维度的股票数据
   * @param params 查询参数
   * @returns 综合后的 QueryBuilderResult
   */
  async queryStock(params: UnifiedStockQuery): Promise<QueryBuilderResult> {
    const { symbol } = params
    const tasks: Promise<TaskResult>[] = []
    const dimensions: string[] = []
    const errors: string[] = []

    // --- 基础信息 ---
    if (params.includeBasic) {
      dimensions.push('basic')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await dataLayer.stocks.get(symbol)
            return { key: 'stock', value }
          } catch (err) {
            const msg = `Failed to fetch basic data for ${symbol}: ${String(err)}`
            logger.warn(`[QueryBuilder] ${msg}`)
            errors.push('basic')
            return { key: 'stock', value: undefined }
          }
        })(),
      )
    }

    // --- K 线行情 ---
    if (params.includeQuotes) {
      dimensions.push('quotes')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await dataLayer.dailyQuotes.get(symbol)
            return { key: 'quotes', value }
          } catch (err) {
            const msg = `Failed to fetch quotes for ${symbol}: ${String(err)}`
            logger.warn(`[QueryBuilder] ${msg}`)
            errors.push('quotes')
            return { key: 'quotes', value: undefined }
          }
        })(),
      )
    }

    // --- V6 评分 ---
    if (params.includeV6Score) {
      dimensions.push('v6Score')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await dataLayer.v6Scores.get(symbol)
            return { key: 'v6Score', value }
          } catch (err) {
            const msg = `Failed to fetch V6 score for ${symbol}: ${String(err)}`
            logger.warn(`[QueryBuilder] ${msg}`)
            errors.push('v6Score')
            return { key: 'v6Score', value: undefined }
          }
        })(),
      )
    }

    // --- 智能评分 ---
    if (params.includeIntelligentScore) {
      dimensions.push('intelligentScore')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await dataLayer.intelligentScores.getLatestBySymbol(symbol)
            return { key: 'intelligentScore', value }
          } catch (err) {
            const msg = `Failed to fetch intelligent score for ${symbol}: ${String(err)}`
            logger.warn(`[QueryBuilder] ${msg}`)
            errors.push('intelligentScore')
            return { key: 'intelligentScore', value: undefined }
          }
        })(),
      )
    }

    // --- 行业评分（需要 industryCode） ---
    if (params.includeIndustryScore) {
      dimensions.push('industryScore')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            // 如果 includeBasic 已经开启，basic 任务会并发返回 stock。
            // 这里立即查询 stock 以确保 industryScore 任务自包含。
            const stock = await dataLayer.stocks.get(symbol).catch(() => undefined)
            if (stock?.industryCode) {
              const value = await dataLayer.industryScores.getLatestByCode(stock.industryCode)
              return { key: 'industryScore', value }
            }
            return { key: 'industryScore', value: undefined }
          } catch (err) {
            const msg = `Failed to fetch industry score for ${symbol}: ${String(err)}`
            logger.warn(`[QueryBuilder] ${msg}`)
            errors.push('industryScore')
            return { key: 'industryScore', value: undefined }
          }
        })(),
      )
    }

    // --- 交易信号 ---
    if (params.includeSignals) {
      dimensions.push('signals')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await dataLayer.signals.listBySymbol(symbol)
            return { key: 'signals', value }
          } catch (err) {
            const msg = `Failed to fetch signals for ${symbol}: ${String(err)}`
            logger.warn(`[QueryBuilder] ${msg}`)
            errors.push('signals')
            return { key: 'signals', value: [] }
          }
        })(),
      )
    }

    // --- 关联新闻（通过 newsStockMap 多对多关联） ---
    if (params.includeNews) {
      dimensions.push('news')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const mappings = await dataLayer.newsStockMap.listBySymbol(symbol)
            const newsList: NewsArticle[] = []
            // 并行获取所有关联新闻
            const newsResults = await Promise.allSettled(
              mappings.map((m) => dataLayer.news.get(m.newsId)),
            )
            for (const result of newsResults) {
              if (result.status === 'fulfilled' && result.value) {
                newsList.push(result.value)
              }
            }
            return { key: 'news', value: newsList }
          } catch (err) {
            const msg = `Failed to fetch news for ${symbol}: ${String(err)}`
            logger.warn(`[QueryBuilder] ${msg}`)
            errors.push('news')
            return { key: 'news', value: [] }
          }
        })(),
      )
    }

    // 并行执行所有查询
    const results = await Promise.all(tasks)

    // 组装结果
    const data: QueryBuilderResult = {}
    for (const result of results) {
      if (result.value !== undefined && result.value !== null) {
        ;(data as Record<string, unknown>)[result.key] = result.value
      }
    }

    if (errors.length > 0) {
      data.errors = errors
    }

    logger.info(`[QueryBuilder] queryStock: ${symbol}, dimensions=[${dimensions.join(',')}]`)
    return data
  }

  /**
   * 批量查询多只股票的综合数据
   * @param symbols 股票代码列表
   * @param params 查询参数（不含 symbol）
   * @returns Map<symbol, QueryBuilderResult>
   */
  async queryStocksBatch(
    symbols: string[],
    params: Omit<UnifiedStockQuery, 'symbol'>,
  ): Promise<Map<string, QueryBuilderResult>> {
    const results = new Map<string, QueryBuilderResult>()
    // 串行查询避免 IndexedDB 事务竞争
    for (const symbol of symbols) {
      results.set(symbol, await this.queryStock({ ...params, symbol }))
    }
    logger.info(`[QueryBuilder] queryStocksBatch: ${symbols.length} symbols queried`)
    return results
  }
}

/** 全局 QueryBuilder 实例 */
export const queryBuilder = new QueryBuilder()
