/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { generateId } from '@/lib/utils'
import type { DataLayerResult, NewsArticle, NewsStockMap, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { analyzeNewsArticle, getOrAnalyzeSentiment } from './sentimentAnalyzer'
import type { StockInfo, StockLink } from './stockLinker'
import { DEFAULT_STOCK_LIBRARY, linkArticleToStocks } from './stockLinker'
import { MOCK_NEWS_URL_PREFIX } from '@/config/dataSourceUrls'
import { DJB2_HASH_INIT, DJB2_HASH_MULTIPLIER } from '@/constants/math.constants'

import { nanoid } from 'nanoid'
const logger = getLogger()

/** 基于输入字符串生成稳定哈希 */
export function generateNewsHash(input: string): string {
  let hash = DJB2_HASH_INIT
  for (let i = 0; i < input.length; i++) {
    hash = (hash * DJB2_HASH_MULTIPLIER) ^ input.charCodeAt(i)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function buildHash(article: { title: string; content: string }): string {
  return generateNewsHash(`${article.title}\x00${article.content}`)
}

function toStockInfo(stock: Stock): StockInfo {
  return {
    symbol: stock.symbol,
    name: stock.name,
    industry: stock.sector,
  }
}

async function resolveStockLibrary(explicitStocks?: StockInfo[]): Promise<StockInfo[]> {
  if (explicitStocks && explicitStocks.length > 0) {
    return explicitStocks
  }
  const result = await dataBridge.query<Stock[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.stocks })
  const poolStocks = result.success ? result.data ?? [] : []
  if (poolStocks.length > 0) {
    return poolStocks.map(toStockInfo)
  }
  return DEFAULT_STOCK_LIBRARY
}

/**
 * 批量保存新闻-股票关联映射，任一失败即返回错误
 */
async function saveNewsStockMaps(maps: NewsStockMap[]): Promise<DataLayerResult<void>> {
  for (const map of maps) {
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.news,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveNewsStockMap,
          traceId: `news-map-${nanoid(8)}-${map.newsId}`,
        },
        map,
      )
      await dataBridge.forward(envelope)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[newsService] saveNewsStockMap failed', { error: message, newsId: map.newsId })
      return { success: false, error: message }
    }
  }
  return { success: true }
}

/**
 * saveNewsArticle
 */
export async function saveNewsArticle(
  article: Omit<NewsArticle, 'id' | 'sentiment' | 'sentimentConfidence' | 'relatedStocks' | 'hash'>,
  options?: { stocks?: StockInfo[]; skipLinking?: boolean },
): Promise<DataLayerResult<NewsArticle>> {
  try {
    const hash = buildHash(article)
    const existingResult = await dataBridge.query<NewsArticle[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.news,
      indexName: 'by-hash',
      indexValue: hash,
    })
    const existingList = existingResult.success ? existingResult.data : []
    const existing = existingList && existingList.length > 0 ? existingList[0] : undefined
    if (existing) {
      return { success: true, data: existing }
    }

    const id = `news_${hash}`

    const sentimentInput = `${article.title}\n${article.content}`
    const sentimentResult = await getOrAnalyzeSentiment(sentimentInput)

    let links: StockLink[] = []
    let maps: NewsStockMap[] = []
    if ((options?.skipLinking ?? false) !== true) {
      const stocks = await resolveStockLibrary(options?.stocks)
      const linkResult = linkArticleToStocks(
        {
          ...article,
          id,
          sentiment: sentimentResult.sentiment,
          sentimentConfidence: sentimentResult.confidence,
        } as Pick<NewsArticle, 'title' | 'content'>,
        stocks,
      )
      links = linkResult.links
      maps = linkResult.maps
    }

    const fullArticle: NewsArticle = {
      ...article,
      id,
      hash,
      sentiment: sentimentResult.sentiment,
      sentimentConfidence: sentimentResult.confidence,
      relatedStocks: links.map((link) => link.symbol),
    }

    const mapSave = await saveNewsStockMaps(maps)
    if (!mapSave.success) {
      return { success: false, error: mapSave.error }
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.news,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveNews,
          traceId: `news-save-${nanoid(8)}-${id}`,
        },
        fullArticle,
      )
      await dataBridge.forward(envelope)
      logger.info('[newsService] DataBridge forwarded: saveNews', { id, title: article.title.slice(0, 30) })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[newsService] saveNews failed', { id, error: message })
      return { success: false, error: message }
    }

    return { success: true, data: fullArticle }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('saveNewsArticle failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * saveNewsArticles
 */
export async function saveNewsArticles(
  articles: Omit<NewsArticle, 'id' | 'sentiment' | 'sentimentConfidence' | 'relatedStocks' | 'hash'>[],
  options?: { stocks?: StockInfo[] },
): Promise<DataLayerResult<NewsArticle[]>> {
  const results = await Promise.all(
    articles.map((article) => saveNewsArticle(article, { ...options, skipLinking: true })),
  )
  const saved: NewsArticle[] = []
  for (const result of results) {
    if (result.success && result.data) {
      saved.push(result.data)
    }
  }
  return { success: true, data: saved }
}

/**
 * listNews
 */
export async function listNews(options?: {
  source?: string
  category?: string
  sentiment?: NewsArticle['sentiment']
  symbol?: string
  keyword?: string
  fromTime?: string
  toTime?: string
  limit?: number
}): Promise<DataLayerResult<NewsArticle[]>> {
  try {
    const result = await dataBridge.query<NewsArticle[]>({ action: ENVELOPE_ACTION.queryList, store: STORE_NAME.news })
    let articles = result.success ? result.data ?? [] : []

    if ((options?.source ?? '') !== '') {
      articles = articles.filter((article) => article.source === options!.source)
    }
    if ((options?.category ?? '') !== '') {
      articles = articles.filter((article) => article.category === options!.category)
    }
    if ((options?.sentiment ?? '') !== '') {
      articles = articles.filter((article) => article.sentiment === options!.sentiment)
    }
    if (options != null && (options.symbol ?? '') !== '') {
      const mapsResult = await dataBridge.query<NewsStockMap[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.newsStockMap,
        indexName: 'by-symbol',
        indexValue: options.symbol,
      })
      const maps = mapsResult.success ? mapsResult.data ?? [] : []
      const newsIds = new Set(maps.map((map) => map.newsId))
      articles = articles.filter((article) => newsIds.has(article.id))
    }
    if ((options?.keyword ?? '') !== '') {
      const keyword = options!.keyword!.toLowerCase()
      articles = articles.filter(
        (article) =>
          article.title.toLowerCase().includes(keyword) ||
          article.content.toLowerCase().includes(keyword),
      )
    }
    if ((options?.fromTime ?? '') !== '') {
      articles = articles.filter((article) => article.publishTime >= options!.fromTime!)
    }
    if ((options?.toTime ?? '') !== '') {
      articles = articles.filter((article) => article.publishTime <= options!.toTime!)
    }

    articles.sort((a, b) => b.publishTime.localeCompare(a.publishTime))

    const limit = options?.limit ?? articles.length
    const slicedArticles = articles.slice(0, limit)

    // DataBridge 事件转发：记录新闻列表加载（用于可观测性）
    // 使用 try-catch 确保 forward 失败不影响列表查询结果
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.news,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.newsArticleLoaded,
          traceId: `news-list-${nanoid(8)}`,
        },
        { count: slicedArticles.length, total: articles.length, options },
      )
      void dataBridge.forward(envelope).catch((forwardErr) => {
        logger.error('[newsService] DataBridge forward failed for listNews', { error: forwardErr })
      })
    } catch (err) {
      logger.error('[newsService] Failed to create listNews envelope', { error: err })
    }

    return { success: true, data: slicedArticles }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('listNews failed', { error: message })
    return { success: false, error: message }
  }
}

/**
 * getNewsBySymbol
 */
export async function getNewsBySymbol(
  symbol: string,
): Promise<DataLayerResult<NewsArticle[]>> {
  try {
    const mapsResult = await dataBridge.query<NewsStockMap[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.newsStockMap,
      indexName: 'by-symbol',
      indexValue: symbol,
    })
    const maps = mapsResult.success ? mapsResult.data ?? [] : []
    const newsIds = Array.from(new Set(maps.map((map) => map.newsId)))
    const articles: NewsArticle[] = []
    for (const newsId of newsIds) {
      const articleResult = await dataBridge.query<NewsArticle | undefined>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.news,
        key: newsId,
      })
      const article = articleResult.success ? articleResult.data : undefined
      if (!article) continue
      articles.push(article)
    }
    return { success: true, data: articles }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('getNewsBySymbol failed', { error: message, symbol })
    return { success: false, error: message }
  }
}

/**
 * getNewsByHash
 */
export async function getNewsByHash(
  hash: string,
): Promise<DataLayerResult<NewsArticle | undefined>> {
  try {
    const result = await dataBridge.query<NewsArticle[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.news,
      indexName: 'by-hash',
      indexValue: hash,
    })
    const list = result.success ? result.data : []
    const article = list && list.length > 0 ? list[0] : undefined
    return { success: true, data: article }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('getNewsByHash failed', { error: message, hash })
    return { success: false, error: message }
  }
}

/** 生成用于测试或 UI 演示的模拟资讯 */
export function generateMockArticles(count = 5): NewsArticle[] {
  const templates = [
    {
      title: '贵州茅台年报超预期，白酒板块强劲上涨',
      content:
        '600519贵州茅台发布年报，全年盈利大幅增长，白酒行业景气度向好，机构看好后续表现。',
      category: '个股',
      sentiment: 'positive' as const,
    },
    {
      title: '比亚迪新能源汽车销量创新高',
      content:
        '002594比亚迪公布最新销量数据，新能源汽车销量持续攀升，锂电池产业链受益明显。',
      category: '个股',
      sentiment: 'positive' as const,
    },
    {
      title: '银行板块承压，工商银行息差收窄',
      content:
        '受降息预期影响，银行板块整体下跌，601398工商银行股价走弱，市场担忧息差进一步收窄。',
      category: '行业',
      sentiment: 'negative' as const,
    },
    {
      title: '人工智能概念活跃，科大讯飞大涨',
      content:
        'AI 大模型持续推进，002230科大讯飞盘中涨停，计算机板块资金流入明显。',
      category: '行业',
      sentiment: 'positive' as const,
    },
    {
      title: '宏观数据公布，市场维持震荡',
      content:
        '今日公布的宏观经济数据符合预期，A股市场维持震荡走势，投资者情绪保持中性。',
      category: '宏观',
      sentiment: 'neutral' as const,
    },
  ]

  const articles: NewsArticle[] = []
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length]!
    const publishTime = new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
    const fetchTime = new Date().toISOString()

    const article: NewsArticle = {
      id: '',
      title: template.title,
      content: template.content,
      url: `${MOCK_NEWS_URL_PREFIX}/${generateId()}`,
      source: 'mock',
      category: template.category,
      publishTime,
      fetchTime,
      sentiment: 'neutral',
      sentimentConfidence: 0,
      relatedStocks: [],
      keywords: ['mock'],
      hash: '',
    }

    article.hash = buildHash(article)
    article.id = `news_${article.hash}`

    const sentiment = analyzeNewsArticle(article)
    article.sentiment = sentiment.sentiment
    article.sentimentConfidence = sentiment.confidence

    articles.push(article)
  }

  return articles
}
