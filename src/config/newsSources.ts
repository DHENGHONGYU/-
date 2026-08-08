/**
 * 新闻源配置
 * @module config/newsSources
 * @doc V9-DOC-CONFIG-002
 */

export interface NewsSourceConfig {
  id: string
  name: string
  baseUrl: string
}

export const NEWS_SOURCES: ReadonlyArray<NewsSourceConfig> = [
  { id: 'finance', name: '财经头条', baseUrl: 'https://finance.sina.com.cn' },
  { id: 'securities', name: '证券时报', baseUrl: 'https://www.stcn.com' },
  { id: 'eastmoney', name: '东方财富', baseUrl: 'https://www.eastmoney.com' },
  { id: 'xueqiu', name: '雪球', baseUrl: 'https://xueqiu.com' },
] as const
