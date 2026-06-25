import { dataLayer } from '@/data/dataLayer'
import { generateId } from '@/data/db'
import type { DataLayerResult, NewsArticle, NewsStockMap, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { analyzeNewsArticle, getOrAnalyzeSentiment } from './sentimentAnalyzer'
import type { StockInfo, StockLink } from './stockLinker'
import { DEFAULT_STOCK_LIBRARY, linkArticleToStocks } from './stockLinker'

const logger = getLogger()

/** 基于输入字符串生成稳定哈希 */
export function generateNewsHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
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
  const poolStocks = await dataLayer.stocks.list()
  if (poolStocks.length > 0) {
    return poolStocks.map(toStockInfo)
  }
  return DEFAULT_STOCK_LIBRARY
}

export async function saveNewsArticle(
  article: Omit<NewsArticle, 'id' | 'sentiment' | 'sentimentConfidence' | 'relatedStocks' | 'hash'>,
  options?: { stocks?: StockInfo[]; skipLinking?: boolean },
): Promise<DataLayerResult<NewsArticle>> {
  try {
    const hash = buildHash(article)
    const existing = await dataLayer.news.getByHash(hash)
    if (existing) {
      return { success: true, data: existing }
    }

    const id = `news_${hash}`

    const sentimentInput = `${article.title}\n${article.content}`
    const sentimentResult = await getOrAnalyzeSentiment(sentimentInput)

    let links: StockLink[] = []
    let maps: NewsStockMap[] = []
    if (!options?.skipLinking) {
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

    for (const map of maps) {
      const saveMapResult = await dataLayer.newsStockMap.save(map)
      if (!saveMapResult.success) {
        return { success: false, error: saveMapResult.error }
      }
    }

    const saveResult = await dataLayer.news.save(fullArticle)
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, data: fullArticle }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('saveNewsArticle failed', { error: message })
    return { success: false, error: message }
  }
}

export async function saveNewsArticles(
  articles: Omit<NewsArticle, 'id' | 'sentiment' | 'sentimentConfidence' | 'relatedStocks' | 'hash'>[],
  options?: { stocks?: StockInfo[] },
): Promise<DataLayerResult<NewsArticle[]>> {
  const saved: NewsArticle[] = []
  for (const article of articles) {
    const result = await saveNewsArticle(article, options)
    if (result.success && result.data) {
      saved.push(result.data)
    }
  }
  return { success: true, data: saved }
}

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
    let articles = await dataLayer.news.list()

    if (options?.source) {
      articles = articles.filter((article) => article.source === options.source)
    }
    if (options?.category) {
      articles = articles.filter((article) => article.category === options.category)
    }
    if (options?.sentiment) {
      articles = articles.filter((article) => article.sentiment === options.sentiment)
    }
    if (options?.symbol) {
      const maps = await dataLayer.newsStockMap.listBySymbol(options.symbol)
      const newsIds = new Set(maps.map((map) => map.newsId))
      articles = articles.filter((article) => newsIds.has(article.id))
    }
    if (options?.keyword) {
      const keyword = options.keyword.toLowerCase()
      articles = articles.filter(
        (article) =>
          article.title.toLowerCase().includes(keyword) ||
          article.content.toLowerCase().includes(keyword),
      )
    }
    if (options?.fromTime) {
      articles = articles.filter((article) => article.publishTime >= options.fromTime!)
    }
    if (options?.toTime) {
      articles = articles.filter((article) => article.publishTime <= options.toTime!)
    }

    articles.sort((a, b) => b.publishTime.localeCompare(a.publishTime))

    const limit = options?.limit ?? articles.length
    return { success: true, data: articles.slice(0, limit) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('listNews failed', { error: message })
    return { success: false, error: message }
  }
}

export async function getNewsBySymbol(
  symbol: string,
): Promise<DataLayerResult<NewsArticle[]>> {
  try {
    const maps = await dataLayer.newsStockMap.listBySymbol(symbol)
    const newsIds = Array.from(new Set(maps.map((map) => map.newsId)))
    const articles: NewsArticle[] = []
    for (const newsId of newsIds) {
      const article = await dataLayer.news.get(newsId)
      if (article) {
        articles.push(article)
      }
    }
    return { success: true, data: articles }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('getNewsBySymbol failed', { error: message, symbol })
    return { success: false, error: message }
  }
}

export async function getNewsByHash(
  hash: string,
): Promise<DataLayerResult<NewsArticle | undefined>> {
  try {
    const article = await dataLayer.news.getByHash(hash)
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
      url: `https://mock.news/${generateId()}`,
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
