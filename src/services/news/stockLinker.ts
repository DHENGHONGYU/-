import { generateId } from '@/lib/utils'
import type { NewsArticle, NewsStockMap } from '@/data/types'

export interface StockInfo {
  symbol: string
  name: string
  industry?: string
}

export interface StockLink {
  symbol: string
  name: string
  matchType: 'exact_code' | 'exact_name' | 'fuzzy_name' | 'industry'
  confidence: number
  source: 'title' | 'content'
  matchedKeyword: string
}

export interface LinkerConfig {
  enableExactCode: boolean
  enableExactName: boolean
  enableFuzzy: boolean
  enableIndustry: boolean
  minFuzzyLength: number
  confidenceThreshold: number
  maxLinks: number
  titleWeight: number
  contentWeight: number
}

/**
 * DEFAULT_LINKER_CONFIG
 */
export const DEFAULT_LINKER_CONFIG: Required<LinkerConfig> = {
  enableExactCode: true,
  enableExactName: true,
  enableFuzzy: true,
  enableIndustry: true,
  minFuzzyLength: 3,
  confidenceThreshold: 0.3,
  maxLinks: 5,
  titleWeight: 1.5,
  contentWeight: 1.0,
}

/** 行业关键词映射：行业名称 -> 触发关键词列表 */
export const DEFAULT_INDUSTRY_KEYWORDS: Record<string, string[]> = {
  银行: ['银行', '降准', '降息', '信贷', '息差', '不良资产'],
  白酒: ['白酒', '茅台', '五粮液', '酱香', '浓香', '国窖'],
  新能源汽车: ['新能源汽车', '电动车', '锂电池', '动力电池', '新能源车'],
  医药: ['医药', '创新药', '医疗器械', '集采', '生物药'],
  非银金融: ['券商', '保险', '证券', '投行', '资管'],
  食品饮料: ['食品', '饮料', '乳业', '牛奶', '调味品'],
  电力设备: ['光伏', '风电', '储能', '新能源', '逆变器', '硅片'],
  电子: ['芯片', '半导体', '集成电路', '晶圆', '封测', '光刻'],
  房地产: ['房地产', '楼市', '房价', '拿地', '土拍'],
  计算机: ['人工智能', 'AI', '大模型', '算力', '云计算', '软件'],
}

/** 内置 A 股股票库（测试与兜底使用） */
export const DEFAULT_STOCK_LIBRARY: StockInfo[] = [
  { symbol: '600000.SH', name: '浦发银行', industry: '银行' },
  { symbol: '600519.SH', name: '贵州茅台', industry: '白酒' },
  { symbol: '000858.SZ', name: '五粮液', industry: '白酒' },
  { symbol: '002594.SZ', name: '比亚迪', industry: '新能源汽车' },
  { symbol: '300750.SZ', name: '宁德时代', industry: '新能源汽车' },
  { symbol: '600036.SH', name: '招商银行', industry: '银行' },
  { symbol: '601318.SH', name: '中国平安', industry: '非银金融' },
  { symbol: '000333.SZ', name: '美的集团', industry: '家用电器' },
  { symbol: '600276.SH', name: '恒瑞医药', industry: '医药' },
  { symbol: '002415.SZ', name: '海康威视', industry: '电子' },
  { symbol: '600887.SH', name: '伊利股份', industry: '食品饮料' },
  { symbol: '601012.SH', name: '隆基绿能', industry: '电力设备' },
  { symbol: '300059.SZ', name: '东方财富', industry: '非银金融' },
  { symbol: '002230.SZ', name: '科大讯飞', industry: '计算机' },
  { symbol: '600030.SH', name: '中信证券', industry: '非银金融' },
  { symbol: '601888.SH', name: '中国中免', industry: '商贸零售' },
  { symbol: '000002.SZ', name: '万科A', industry: '房地产' },
  { symbol: '601398.SH', name: '工商银行', industry: '银行' },
]

const MATCH_CONFIDENCE_BASE = {
  exact_code: 0.95,
  exact_name: 0.9,
  fuzzy_name: 0.7,
  industry: 0.5,
}

/** 构建以 symbol 与 6 位代码为键的股票映射 */
export function buildStockMap(stocks: StockInfo[]): Map<string, StockInfo> {
  const map = new Map<string, StockInfo>()
  for (const stock of stocks) {
    map.set(stock.symbol, stock)
    const codeMatch = stock.symbol.match(/(\d{6})/)
    if (codeMatch?.[1]) {
      map.set(codeMatch[1], stock)
    }
  }
  return map
}

function normalizeNewsArticle(
  article: Pick<NewsArticle, 'title' | 'content'>,
): NewsArticle {
  const partial = article as Partial<NewsArticle>
  const id = partial.id ?? `news_${generateId()}`
  const now = new Date().toISOString()
  return {
    id,
    title: article.title ?? '',
    content: article.content ?? '',
    url: partial.url ?? '',
    source: partial.source ?? '',
    category: partial.category ?? '',
    publishTime: partial.publishTime ?? now,
    fetchTime: partial.fetchTime ?? now,
    sentiment: partial.sentiment ?? 'neutral',
    sentimentConfidence: partial.sentimentConfidence ?? 0,
    relatedStocks: partial.relatedStocks ?? [],
    keywords: partial.keywords ?? [],
    hash: partial.hash ?? '',
  }
}

function matchExactCode(
  text: string,
  stock: StockInfo,
  stockMap: Map<string, StockInfo>,
  source: 'title' | 'content',
  sourceWeight: number,
): StockLink[] {
  const links: StockLink[] = []
  const codePattern = /\b(\d{6})\b/g
  let match: RegExpExecArray | null
  while ((match = codePattern.exec(text)) !== null) {
    const code = match[1]
    if (!code) continue
    const matchedStock = stockMap.get(code) ?? stockMap.get(`${code}.SH`) ?? stockMap.get(`${code}.SZ`)
    if (matchedStock?.symbol === stock.symbol) {
      links.push({
        symbol: stock.symbol,
        name: stock.name,
        matchType: 'exact_code',
        confidence: Math.min(1, MATCH_CONFIDENCE_BASE.exact_code * sourceWeight),
        source,
        matchedKeyword: code,
      })
    }
  }
  return links
}

function matchExactName(text: string, stock: StockInfo, source: 'title' | 'content', sourceWeight: number): StockLink[] {
  if (!text.includes(stock.name)) return []
  return [{
    symbol: stock.symbol,
    name: stock.name,
    matchType: 'exact_name',
    confidence: Math.min(1, MATCH_CONFIDENCE_BASE.exact_name * sourceWeight),
    source,
    matchedKeyword: stock.name,
  }]
}

function matchFuzzyName(text: string, stock: StockInfo, source: 'title' | 'content', sourceWeight: number): StockLink[] {
  if (stock.name.length < 2) return []
  const links: StockLink[] = []
  for (let len = 2; len <= Math.min(4, stock.name.length); len++) {
    const prefix = stock.name.slice(0, len)
    if (text.includes(prefix)) {
      links.push({
        symbol: stock.symbol,
        name: stock.name,
        matchType: 'fuzzy_name',
        confidence: Math.min(1, MATCH_CONFIDENCE_BASE.fuzzy_name * sourceWeight),
        source,
        matchedKeyword: prefix,
      })
      break
    }
  }
  return links
}

function matchIndustry(text: string, stock: StockInfo, source: 'title' | 'content', sourceWeight: number): StockLink[] {
  if (!stock.industry) return []
  const keywords = DEFAULT_INDUSTRY_KEYWORDS[stock.industry] ?? []
  const links: StockLink[] = []
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      links.push({
        symbol: stock.symbol,
        name: stock.name,
        matchType: 'industry',
        confidence: Math.min(1, MATCH_CONFIDENCE_BASE.industry * sourceWeight),
        source,
        matchedKeyword: keyword,
      })
    }
  }
  return links
}

function matchText(
  text: string,
  source: 'title' | 'content',
  stockMap: Map<string, StockInfo>,
  config: Required<LinkerConfig>,
): StockLink[] {
  const sourceWeight = source === 'title' ? config.titleWeight : config.contentWeight
  const stocks = Array.from(new Set(stockMap.values()))
  const links: StockLink[] = []

  for (const stock of stocks) {
    const candidates: StockLink[] = []

    if (config.enableExactCode) {
      candidates.push(...matchExactCode(text, stock, stockMap, source, sourceWeight))
    }
    if (config.enableExactName) {
      candidates.push(...matchExactName(text, stock, source, sourceWeight))
    }
    if (config.enableFuzzy) {
      candidates.push(...matchFuzzyName(text, stock, source, sourceWeight))
    }
    if (config.enableIndustry && stock.industry) {
      candidates.push(...matchIndustry(text, stock, source, sourceWeight))
    }

    const best = selectBestLink(candidates, config.confidenceThreshold)
    if (best) links.push(best)
  }

  return links
}

/** 从候选链接中挑出置信度最高且达阈值者，否则返回 null */
function selectBestLink(candidates: StockLink[], threshold: number): StockLink | null {
  if (candidates.length === 0) return null
  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0]
  if (!best || best.confidence < threshold) return null
  return best
}

/** 对单篇资讯进行股票关联，返回 links 并填充 article.relatedStocks */
export function linkArticleToStocks(
  article: Pick<NewsArticle, 'title' | 'content'>,
  stocks: StockInfo[],
  config?: Partial<LinkerConfig>,
): { article: NewsArticle; links: StockLink[]; maps: NewsStockMap[] } {
  const fullConfig = { ...DEFAULT_LINKER_CONFIG, ...config }
  const stockMap = buildStockMap(stocks)
  const fullArticle = normalizeNewsArticle(article)

  const titleLinks = matchText(fullArticle.title, 'title', stockMap, fullConfig)
  const contentLinks = matchText(fullArticle.content, 'content', stockMap, fullConfig)

  const bestBySymbol = new Map<string, StockLink>()
  for (const link of [...titleLinks, ...contentLinks]) {
    const existing = bestBySymbol.get(link.symbol)
    if (!existing || link.confidence > existing.confidence) {
      bestBySymbol.set(link.symbol, link)
    }
  }

  const links = Array.from(bestBySymbol.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, fullConfig.maxLinks)

  fullArticle.relatedStocks = links.map((link) => link.symbol)

  const maps: NewsStockMap[] = links.map((link) => ({
    id: `${link.symbol}_${fullArticle.id}`,
    symbol: link.symbol,
    newsId: fullArticle.id,
    relevanceScore: link.confidence,
    isTitleMatch: link.source === 'title',
    isContentMatch: link.source === 'content',
    industryMatch: link.matchType === 'industry',
  }))

  return { article: fullArticle, links, maps }
}
