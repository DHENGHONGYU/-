import { z } from 'zod'
import { ok, fail, type Result } from '@/core/result'
import { ValidationError } from '@/lib/errors'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import type {
  DailyQuotes,
  IndustryScore,
  IntelligentScore,
  NewsArticle,
  NewsStockMap,
  Signal,
  Stock,
  V6Score,
} from '@/data/types'

const logger = getLogger()

async function queryGet<T>(store: typeof STORE_NAME[keyof typeof STORE_NAME], key: string): Promise<T | undefined> {
  const result = await dataBridge.query<T | undefined>({
    action: ENVELOPE_ACTION.queryGet,
    store,
    key,
    source: 'datalayer',
  })
  return result.success ? result.data : undefined
}

async function queryListByIndex<T>(
  store: typeof STORE_NAME[keyof typeof STORE_NAME],
  indexName: string,
  indexValue: unknown,
): Promise<T[]> {
  const result = await dataBridge.query<T[]>({
    action: ENVELOPE_ACTION.queryByIndex,
    store,
    indexName,
    indexValue,
    source: 'datalayer',
  })
  return result.success ? result.data ?? [] : []
}

/** 查询粒度开关（参数 schema，运行时校验） */
export const unifiedStockQuerySchema = z.object({
  /** 股票代码（必填） */
  symbol: z.string({ error: 'symbol 不能为空' }).min(1, { error: 'symbol 不能为空' }),
  /** 是否包含股票基础信息 */
  includeBasic: z.boolean().optional(),
  /** 是否包含 K 线行情 */
  includeQuotes: z.boolean().optional(),
  /** 是否包含 V6 评分 */
  includeV6Score: z.boolean().optional(),
  /** 是否包含智能评分 */
  includeIntelligentScore: z.boolean().optional(),
  /** 是否包含行业评分 */
  includeIndustryScore: z.boolean().optional(),
  /** 是否包含交易信号 */
  includeSignals: z.boolean().optional(),
  /** 是否包含关联新闻 */
  includeNews: z.boolean().optional(),
})

/** 统一股票查询请求（由 schema 推断，保证运行时与编译期一致） */
export type UnifiedStockQuery = z.infer<typeof unifiedStockQuerySchema>

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
 * QueryBuilder — 绕开 Store 综合查询引擎（D-02 类型安全化）
 *
 * 封装 DataBridge 多个 Store 的并发查询，一次性获取某只股票在
 * 基础信息 / 行情 / V6评分 / 智能评分 / 行业评分 / 交易信号 / 关联新闻
 * 等多个维度的数据，返回统一的 `Result<QueryBuilderResult>`。
 *
 * - 入参经 zod 校验，symbol 缺失/非法时返回 `fail(ValidationError)`，
 *   与 S-01 的统一 Result 约定一致，避免吞异常。
 * - 单维度失败仅记入 `errors` 字段，不影响其余维度（partial success）。
 */
export class QueryBuilder {
  /**
   * 从 DataLayer 查询多维度的股票数据
   * @param params 查询参数（symbol 必填）
   * @returns Result<QueryBuilderResult>
   */
  async queryStock(params: UnifiedStockQuery): Promise<Result<QueryBuilderResult>> {
    const parsed = unifiedStockQuerySchema.safeParse(params)
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join('; ')
      logger.warn(`[QueryBuilder] queryStock 参数校验失败: ${message}`)
      return fail(new ValidationError(message, 'symbol'))
    }
    const p = parsed.data
    const { symbol } = p

    const tasks: Promise<TaskResult>[] = []
    const dimensions: string[] = []
    const errors: string[] = []

    // --- 基础信息 ---
    if (p.includeBasic) {
      dimensions.push('basic')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await queryGet<Stock>(STORE_NAME.stocks, symbol)
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
    if (p.includeQuotes) {
      dimensions.push('quotes')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await queryGet<DailyQuotes>(STORE_NAME.dailyQuotes, symbol)
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
    if (p.includeV6Score) {
      dimensions.push('v6Score')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await queryGet<V6Score>(STORE_NAME.v6Scores, symbol)
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
    if (p.includeIntelligentScore) {
      dimensions.push('intelligentScore')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const list = await queryListByIndex<IntelligentScore>(STORE_NAME.intelligentScores, 'by-symbol', symbol)
            const value = list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
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
    if (p.includeIndustryScore) {
      dimensions.push('industryScore')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const stock = await queryGet<Stock>(STORE_NAME.stocks, symbol)
            if (stock?.industryCode) {
              const list = await queryListByIndex<IndustryScore>(STORE_NAME.industryScores, 'by-code', stock.industryCode)
              const value = list.sort((a, b) => b.scoredAt - a.scoredAt)[0]
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
    if (p.includeSignals) {
      dimensions.push('signals')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const value = await queryListByIndex<Signal>(STORE_NAME.signals, 'by-symbol', symbol)
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

function collectSuccessfulNews(
  newsResults: PromiseSettledResult<NewsArticle | undefined>[],
): NewsArticle[] {
  const newsList: NewsArticle[] = []
  for (const result of newsResults) {
    if (result.status === 'fulfilled' && result.value) {
      newsList.push(result.value)
    }
  }
  return newsList
}

    // --- 关联新闻（通过 newsStockMap 多对多关联） ---
    if (p.includeNews) {
      dimensions.push('news')
      tasks.push(
        (async (): Promise<TaskResult> => {
          try {
            const mappings = await queryListByIndex<NewsStockMap>(STORE_NAME.newsStockMap, 'by-symbol', symbol)
            const newsResults = await Promise.allSettled(
              mappings.map((m) => queryGet<NewsArticle>(STORE_NAME.news, m.newsId)),
            )
            const newsList = collectSuccessfulNews(newsResults)
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
    return ok(data)
  }

  /**
   * 批量查询多只股票的综合数据
   * @param symbols 股票代码列表
   * @param params 查询参数（不含 symbol）
   * @returns Result<Map<symbol, QueryBuilderResult>>，单标的失败仅记录日志并跳过
   */
  async queryStocksBatch(
    symbols: string[],
    params: Omit<UnifiedStockQuery, 'symbol'>,
  ): Promise<Result<Map<string, QueryBuilderResult>>> {
    const map = new Map<string, QueryBuilderResult>()
    // 串行查询避免 IndexedDB 事务竞争
    for (const symbol of symbols) {
      const res = await this.queryStock({ ...params, symbol })
      if (res.ok) {
        map.set(symbol, res.value)
      } else {
        logger.warn(`[QueryBuilder] queryStocksBatch 跳过失败标的: ${symbol}`)
      }
    }
    logger.info(`[QueryBuilder] queryStocksBatch: ${symbols.length} symbols, ${map.size} succeeded`)
    return ok(map)
  }
}

/** 全局 QueryBuilder 实例 */
export const queryBuilder = new QueryBuilder()
