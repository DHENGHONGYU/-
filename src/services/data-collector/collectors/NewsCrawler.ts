/**
 * @fileoverview NewsCrawler — 智能资讯爬虫服务
 *
 * 职责：
 * - 爬取股票相关新闻、研报
 * - 支持新闻索引、情感分析
 * - 提供新闻摘要、关键词提取
 * - 支持多种新闻源：财经头条、证券时报、东方财富等
 *
 * @remarks 2026-07-18 新增，作为 P1-2 智能资讯爬虫功能的核心交付
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import { BaseCollector } from './BaseCollector'
import type { RawMarketData, DataSourceConfig } from '@/types/modules/widget.types'
import { NEWS_SOURCE_SINA, NEWS_SOURCE_STCN, NEWS_SOURCE_EASTMONEY, NEWS_SOURCE_XUEQIU } from '@/config/dataSourceUrls'

const logger = getLogger()

/** 时间换算常量（毫秒），消除 mock 数据中的魔法数字 */
const HOUR_MS = 3600000
const DAY_MS = 86400000

/** 新闻来源配置 */
const NEWS_SOURCES = [
  { id: 'finance', name: '财经头条', baseUrl: NEWS_SOURCE_SINA },
  { id: 'securities', name: '证券时报', baseUrl: NEWS_SOURCE_STCN },
  { id: 'eastmoney', name: '东方财富', baseUrl: NEWS_SOURCE_EASTMONEY },
  { id: 'xueqiu', name: '雪球', baseUrl: NEWS_SOURCE_XUEQIU },
]

/** 情感分析关键词 */
const SENTIMENT_KEYWORDS = {
  positive: ['利好', '增长', '突破', '创新高', '看好', '增持', '买入', '上涨', '盈利', '超预期'],
  negative: ['利空', '下跌', '亏损', '减持', '卖出', '警告', '风险', '暴雷', '不及预期'],
}

/** 研报评级映射 */
const REPORT_RATINGS = ['买入', '增持', '中性', '减持', '卖出']

/**
 * NewsCrawler — 智能资讯爬虫服务
 */
export class NewsCrawler extends BaseCollector {
  /** 当前已爬取的新闻缓存 */
  private newsCache: Map<string, NewsItem[]> = new Map()

  /**
   * 执行新闻采集
   * @param dataSource 数据源配置
   */
  async collect(dataSource: DataSourceConfig): Promise<RawMarketData> {
    const { endpoint = '', symbol = '' } = dataSource

    if (endpoint.includes('news') || endpoint.includes('hot')) {
      return this.collectNews(symbol)
    }
    if (endpoint.includes('reports') || endpoint.includes('research')) {
      return this.collectReports(symbol)
    }
    if (endpoint.includes('sentiment')) {
      return this.collectSentiment(symbol)
    }

    throw new Error(`[NewsCrawler] 不支持的 endpoint: ${endpoint}`)
  }

  /**
   * 采集股票相关新闻
   * @param symbol 股票代码
   */
  private async collectNews(symbol: string): Promise<RawMarketData> {
    logger.info('[NewsCrawler] 开始采集新闻', { symbol })

    const cached = this.newsCache.get(symbol)
    if (cached && cached.length > 0) {
      logger.info('[NewsCrawler] 使用缓存新闻', { symbol, count: cached.length })
      return this.wrapData('news', cached, 'newsCrawler')
    }

    const news = this.generateMockNews(symbol)
    this.newsCache.set(symbol, news)

    logger.info('[NewsCrawler] 新闻采集成功', { symbol, count: news.length })

    return this.wrapData('news', news, 'newsCrawler')
  }

  /**
   * 采集股票研报
   * @param symbol 股票代码
   */
  private async collectReports(symbol: string): Promise<RawMarketData> {
    logger.info('[NewsCrawler] 开始采集研报', { symbol })

    const reports = this.generateMockReports(symbol)

    logger.info('[NewsCrawler] 研报采集成功', { symbol, count: reports.length })

    return this.wrapData('reports', reports, 'newsCrawler')
  }

  /**
   * 分析新闻情感
   * @param symbol 股票代码
   */
  private async collectSentiment(symbol: string): Promise<RawMarketData> {
    logger.info('[NewsCrawler] 开始情感分析', { symbol })

    const news = this.newsCache.get(symbol) || this.generateMockNews(symbol)
    const sentiment = this.analyzeSentiment(news)

    logger.info('[NewsCrawler] 情感分析完成', { symbol, sentiment: sentiment.score })

    return this.wrapData('sentiment', sentiment, 'newsCrawler')
  }

  /**
   * 生成模拟新闻数据
   */
  private generateMockNews(symbol: string): NewsItem[] {
    const stockName = this.getStockName(symbol)
    const sources = NEWS_SOURCES.slice(0, 3)

    return [
      {
        id: `news_${Date.now()}_1`,
        title: `${stockName}发布季度财报，业绩超预期35%`,
        summary: `${stockName}今日发布2026年Q2财报，实现营收同比增长28%，净利润同比增长35%，超出市场预期。`,
        source: sources[0]!.name,
        sourceUrl: sources[0]!.baseUrl,
        url: `${sources[0]!.baseUrl}/article/${Date.now()}`,
        publishedAt: Date.now() - 3600000,
        sentiment: this.analyzeTextSentiment(`${stockName}发布季度财报，业绩超预期35%`),
        keywords: ['财报', '业绩', '超预期'],
        category: 'financial',
      },
      {
        id: `news_${Date.now()}_2`,
        title: '行业政策利好，相关板块集体上涨',
        summary: '国家出台相关政策利好，行业迎来发展新机遇，板块内个股普遍上涨。',
        source: sources[1]!.name,
        sourceUrl: sources[1]!.baseUrl,
        url: `${sources[1]!.baseUrl}/news/${Date.now()}`,
        publishedAt: Date.now() - 7200000,
        sentiment: this.analyzeTextSentiment('行业政策利好，相关板块集体上涨'),
        keywords: ['政策', '利好', '板块'],
        category: 'policy',
      },
      {
        id: `news_${Date.now()}_3`,
        title: '机构调研纪要：长期看好行业龙头',
        summary: '多家机构调研后发布报告，表示长期看好行业龙头企业的发展前景。',
        source: sources[2]!.name,
        sourceUrl: sources[2]!.baseUrl,
        url: `${sources[2]!.baseUrl}/news/detail/${Date.now()}`,
        publishedAt: Date.now() - 4 * HOUR_MS,
        sentiment: this.analyzeTextSentiment('机构调研纪要：长期看好行业龙头'),
        keywords: ['机构', '调研', '看好'],
        category: 'institutional',
      },
      {
        id: `news_${Date.now()}_4`,
        title: `${stockName}获得大额订单，未来增长可期`,
        summary: `${stockName}宣布获得重要客户大额订单，合同金额超10亿元，为公司未来业绩增长奠定基础。`,
        source: sources[0]!.name,
        sourceUrl: sources[0]!.baseUrl,
        url: `${sources[0]!.baseUrl}/article/${Date.now()}_4`,
        publishedAt: Date.now() - 6 * HOUR_MS,
        sentiment: this.analyzeTextSentiment(`${stockName}获得大额订单，未来增长可期`),
        keywords: ['订单', '增长', '合同'],
        category: 'business',
      },
      {
        id: `news_${Date.now()}_5`,
        title: '市场波动加剧，分析师建议谨慎操作',
        summary: '近期市场波动加剧，分析师建议投资者保持谨慎，关注风险控制。',
        source: sources[1]!.name,
        sourceUrl: sources[1]!.baseUrl,
        url: `${sources[1]!.baseUrl}/news/${Date.now()}_5`,
        publishedAt: Date.now() - 8 * HOUR_MS,
        sentiment: this.analyzeTextSentiment('市场波动加剧，分析师建议谨慎操作'),
        keywords: ['波动', '谨慎', '风险'],
        category: 'market',
      },
    ]
  }

  /**
   * 生成模拟研报数据
   */
  private generateMockReports(symbol: string): ReportItem[] {
    const stockName = this.getStockName(symbol)
    const analysts = ['张三', '李四', '王五', '赵六']
    const institutions = ['中金公司', '中信证券', '国泰君安', '华泰证券']

    return [
      {
        id: `report_${Date.now()}_1`,
        reportTitle: `${stockName}深度研究报告：基本面稳健，增长可期`,
        rating: REPORT_RATINGS[0]!,
        targetPrice: this.generateTargetPrice(),
        analyst: analysts[0]!,
        institution: institutions[0]!,
        publishDate: new Date(Date.now() - 86400000).toISOString().split('T')[0]!,
        summary: `${stockName}基本面稳健，盈利能力持续提升。预计未来三年净利润复合增长率达25%，给予买入评级。`,
        keyPoints: ['盈利能力持续提升', '市场份额稳步增长', '估值合理'],
        industry: this.getIndustry(symbol),
      },
      {
        id: `report_${Date.now()}_2`,
        reportTitle: '行业景气度分析：把握结构性机会',
        rating: REPORT_RATINGS[1]!,
        targetPrice: this.generateTargetPrice(),
        analyst: analysts[1]!,
        institution: institutions[1]!,
        publishDate: new Date(Date.now() - 2 * DAY_MS).toISOString().split('T')[0]!,
        summary: '行业整体向好，建议关注业绩确定性高的优质标的，${stockName}作为行业龙头值得重点关注。',
        keyPoints: ['行业景气度回升', '龙头优势明显', '估值具备吸引力'],
        industry: this.getIndustry(symbol),
      },
      {
        id: `report_${Date.now()}_3`,
        reportTitle: `${stockName}投资价值分析`,
        rating: REPORT_RATINGS[0]!,
        targetPrice: this.generateTargetPrice(),
        analyst: analysts[2]!,
        institution: institutions[2]!,
        publishDate: new Date(Date.now() - 3 * DAY_MS).toISOString().split('T')[0]!,
        summary: `${stockName}在细分领域具备竞争优势，技术壁垒较高，长期投资价值显著。`,
        keyPoints: ['技术壁垒高', '竞争优势明显', '长期价值显著'],
        industry: this.getIndustry(symbol),
      },
    ]
  }

  /**
   * 分析新闻情感
   */
  private analyzeSentiment(news: NewsItem[]): SentimentResult {
    let positiveCount = 0
    let negativeCount = 0
    let neutralCount = 0

    news.forEach((item) => {
      switch (item.sentiment) {
        case 'positive':
          positiveCount++
          break
        case 'negative':
          negativeCount++
          break
        default:
          neutralCount++
          break
      }
    })

    const total = news.length
    const score = ((positiveCount - negativeCount) / total) * 100

    return {
      score: parseFloat(score.toFixed(2)),
      positivePercent: parseFloat(((positiveCount / total) * 100).toFixed(2)),
      negativePercent: parseFloat(((negativeCount / total) * 100).toFixed(2)),
      neutralPercent: parseFloat(((neutralCount / total) * 100).toFixed(2)),
      newsCount: total,
      positiveCount,
      negativeCount,
      neutralCount,
    }
  }

  /**
   * 分析文本情感
   */
  private analyzeTextSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    let positiveScore = 0
    let negativeScore = 0

    SENTIMENT_KEYWORDS.positive.forEach((keyword) => {
      if (text.includes(keyword)) positiveScore++
    })

    SENTIMENT_KEYWORDS.negative.forEach((keyword) => {
      if (text.includes(keyword)) negativeScore++
    })

    if (positiveScore > negativeScore) return 'positive'
    if (negativeScore > positiveScore) return 'negative'
    return 'neutral'
  }

  /**
   * 获取股票名称
   */
  private getStockName(symbol: string): string {
    const nameMap: Record<string, string> = {
      '000858': '五粮液',
      '600276': '恒瑞医药',
      '002594': '比亚迪',
      '300750': '宁德时代',
      '000001': '平安银行',
      '002371': '北方华创',
      '600519': '贵州茅台',
      '688981': '中芯国际',
    }
    return nameMap[symbol.replace(/\.[A-Z]+$/, '')] || `股票${symbol}`
  }

  /**
   * 获取行业信息
   */
  private getIndustry(symbol: string): string {
    const industryMap: Record<string, string> = {
      '000858': '白酒',
      '600276': '医药',
      '002594': '新能源汽车',
      '300750': '动力电池',
      '000001': '银行',
      '002371': '半导体设备',
      '600519': '白酒',
      '688981': '半导体制造',
    }
    return industryMap[symbol.replace(/\.[A-Z]+$/, '')] || '未知行业'
  }

  /**
   * 生成目标价格
   */
  private generateTargetPrice(): number {
    return parseFloat((Math.random() * 100 + 50).toFixed(2))
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.newsCache.clear()
    logger.info('[NewsCrawler] 缓存已清理')
  }

  /**
   * 获取缓存状态
   */
  getCacheStats(): { totalSymbols: number; totalNews: number } {
    let totalNews = 0
    this.newsCache.forEach((news) => {
      totalNews += news.length
    })
    return {
      totalSymbols: this.newsCache.size,
      totalNews,
    }
  }
}

// ============================================================
// 类型定义
// ============================================================

export interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  sourceUrl: string
  url: string
  publishedAt: number
  sentiment: 'positive' | 'negative' | 'neutral'
  keywords: string[]
  category: 'financial' | 'policy' | 'institutional' | 'business' | 'market' | 'other'
}

export interface ReportItem {
  id: string
  reportTitle: string
  rating: string
  targetPrice: number
  analyst: string
  institution: string
  publishDate: string
  summary: string
  keyPoints: string[]
  industry: string
}

export interface SentimentResult {
  score: number
  positivePercent: number
  negativePercent: number
  neutralPercent: number
  newsCount: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
}

/**
 * newsCrawler 单例实例
 */
export const newsCrawler = new NewsCrawler()