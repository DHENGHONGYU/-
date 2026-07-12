/**
 * @module mcp/servers/news
 * @description 新闻分析 MCP Server — 新闻获取、情绪分析、股票关联
 * @created 2026-07-04
 */

import { MCPServerBase } from '@/mcp/core/server'
import type { ServerInfo, ToolDescriptor, ResourceTemplate, PromptTemplate } from '@/mcp/core/types'
import { getLogger } from '@/lib/logger'
import { getNewsBySymbol } from '@/services/news/newsService'
import { analyzeNewsArticle } from '@/services/news/sentimentAnalyzer'
import { aggregateSentimentTrend } from '@/services/news/sentimentTrendEngine'
import type { SentimentTrendDimension } from '@/types/modules/news.types'

const logger = getLogger()

const DEFAULT_TREND_OPTIONS = {
  dimension: 'global' as SentimentTrendDimension,
  fillGaps: true,
}

export class NewsServer extends MCPServerBase {
  readonly info: ServerInfo = {
    name: 'news',
    version: '1.0.0',
    description: '新闻分析 — 新闻获取、情绪分析、股票关联',
    dependencies: ['fetcher'],
  }

  protected getTools(): ToolDescriptor[] {
    return [
      {
        name: 'fetch_news',
        description: '获取指定股票的最新新闻',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          logger.info('[NewsServer] fetch_news called', { symbol: args.symbol as string })
          const result = await getNewsBySymbol(args.symbol as string)
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'analyze_sentiment',
        description: '分析单条新闻情绪倾向',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '新闻标题' },
            content: { type: 'string', description: '新闻内容' },
          },
          required: ['title', 'content'],
        },
        handler: async (args) => {
          logger.info('[NewsServer] analyze_sentiment called')
          const result = analyzeNewsArticle({
            title: args.title as string,
            content: args.content as string,
          })
          return { content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      },
      {
        name: 'get_sentiment_trend',
        description: '获取股票情绪趋势',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: '股票代码' },
            days: { type: 'number', description: '回溯天数，默认 30', default: 30 },
          },
          required: ['symbol'],
        },
        handler: async (args) => {
          const symbol = args.symbol as string
          logger.info('[NewsServer] get_sentiment_trend called', { symbol })
          const newsResult = await getNewsBySymbol(symbol)
          const articles = newsResult.success && newsResult.data ? newsResult.data : []
          const trend = aggregateSentimentTrend(articles, {
            ...DEFAULT_TREND_OPTIONS,
            value: symbol,
            dimension: 'stock',
          })
          return { content: [{ type: 'text', text: JSON.stringify(trend) }] }
        },
      },
    ]
  }

  protected getResources(): ResourceTemplate[] {
    return [
      {
        uriTemplate: 'news://{symbol}/latest',
        name: '最新新闻',
        description: '指定股票的最新新闻列表',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const symbol = uri.split('/')[2] ?? ''
          const result = await getNewsBySymbol(symbol)
          return { uri, mimeType: 'application/json', text: JSON.stringify(result) }
        },
      },
      {
        uriTemplate: 'sentiment://{symbol}/trend',
        name: '情绪趋势',
        description: '指定股票的情绪趋势数据',
        mimeType: 'application/json',
        resolver: async (uri) => {
          const symbol = uri.split('/')[2] ?? ''
          const newsResult = await getNewsBySymbol(symbol)
          const articles = newsResult.success && newsResult.data ? newsResult.data : []
          const trend = aggregateSentimentTrend(articles, {
            ...DEFAULT_TREND_OPTIONS,
            value: symbol,
            dimension: 'stock',
          })
          return { uri, mimeType: 'application/json', text: JSON.stringify(trend) }
        },
      },
    ]
  }

  protected getPrompts(): PromptTemplate[] {
    return [
      {
        name: 'news_summary',
        description: '新闻摘要生成模板',
        arguments: [{ name: 'symbol', description: '股票代码', required: true }],
        generator: async (args) => {
          return [{
            role: 'user',
            content: {
              type: 'text',
              text: `请总结股票 ${args.symbol} 的最新新闻要点和情绪倾向。`,
            },
          }]
        },
      },
    ]
  }
}