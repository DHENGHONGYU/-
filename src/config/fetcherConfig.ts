/**
 * 数据采集模块配置
 *
 * 原则：
 * - 本文件位于 src/config/，禁止依赖 services/、apps/、pages/、components/、core/（除类型外）。
 * - 所有默认值可通过环境变量覆盖。
 */

export type FetcherFrequency =
  | 'realtime'
  | '1h'
  | '3h'
  | 'daily'
  | '3d'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'manual'

export const FETCHER_FREQUENCY_LABELS: Record<FetcherFrequency, string> = {
  realtime: '实时',
  '1h': '1小时',
  '3h': '3小时',
  daily: '日收盘后',
  '3d': '3日',
  weekly: '每周',
  biweekly: '双周',
  monthly: '月度',
  quarterly: '季度',
  manual: '手动',
}

export const FETCHER_FREQUENCY_MINUTES: Record<FetcherFrequency, number | null> = {
  realtime: 5,
  '1h': 60,
  '3h': 180,
  daily: 1440,
  '3d': 4320,
  weekly: 10080,
  biweekly: 20160,
  monthly: 43200,
  quarterly: 129600,
  manual: null,
}

export interface FetcherServiceConfig {
  baseURL: string
  timeoutMs: number
  retries: number
}

export interface FetcherDimensionConfig {
  code: string
  name: string
  enabled: boolean
  frequency: FetcherFrequency
  sources: string[]
  cacheTtlMinutes: number
  fields: string[]
}

export interface FetcherGlobalConfig {
  maxSymbols: number
  batchSize: number
  defaultFrequency: FetcherFrequency
  rateLimitPerMinute: number
  rateLimitPerHour: number
  rateLimitPerDay: number
  notifyOnComplete: boolean
  notifyOnError: boolean
}

export interface FetcherConfig {
  version: string
  service: FetcherServiceConfig
  global: FetcherGlobalConfig
  dimensions: FetcherDimensionConfig[]
}

export function getDefaultFetcherServiceConfig(): FetcherServiceConfig {
  return {
    baseURL: import.meta.env.VITE_AKSHARE_BASE_URL ?? 'http://localhost:8000',
    timeoutMs: 30000,
    retries: 3,
  }
}

export function getDefaultFetcherGlobalConfig(): FetcherGlobalConfig {
  return {
    maxSymbols: 40,
    batchSize: 10,
    defaultFrequency: 'daily',
    rateLimitPerMinute: 10,
    rateLimitPerHour: 200,
    rateLimitPerDay: 1000,
    notifyOnComplete: true,
    notifyOnError: true,
  }
}

export function getDefaultFetcherDimensions(): FetcherDimensionConfig[] {
  return [
    {
      code: '01',
      name: '基本信息',
      enabled: true,
      frequency: 'monthly',
      sources: ['akshare'],
      cacheTtlMinutes: 43200,
      fields: ['name', 'price', 'pe', 'pb', 'roe', 'market_cap'],
    },
    {
      code: '02',
      name: 'K线数据',
      enabled: true,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['open', 'high', 'low', 'close', 'volume', 'amount'],
    },
    {
      code: '03',
      name: '筹码分布',
      enabled: false,
      frequency: '3d',
      sources: ['akshare'],
      cacheTtlMinutes: 4320,
      fields: ['股东户数', '户均持股', '机构持仓', '十大流通股东'],
    },
    {
      code: '04',
      name: '重大事项',
      enabled: false,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['公告标题', '公告类型', '发布日期', 'PDF链接'],
    },
    {
      code: '05',
      name: '热点新闻',
      enabled: false,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['标题', '摘要', '来源', '日期', '链接'],
    },
    {
      code: '06',
      name: '行业竞品',
      enabled: false,
      frequency: 'weekly',
      sources: ['akshare'],
      cacheTtlMinutes: 10080,
      fields: ['行业排名', '竞品对比', 'ETF规模'],
    },
    {
      code: '07',
      name: '关联指数',
      enabled: false,
      frequency: 'weekly',
      sources: ['akshare'],
      cacheTtlMinutes: 10080,
      fields: ['所属指数', 'ETF代码', 'ETF规模'],
    },
    {
      code: '08',
      name: '研报中心',
      enabled: false,
      frequency: 'daily',
      sources: ['akshare'],
      cacheTtlMinutes: 180,
      fields: ['标题', '作者', '评级', '目标价', '摘要'],
    },
  ]
}

export function getDefaultFetcherConfig(): FetcherConfig {
  return {
    version: '0.9.1',
    service: getDefaultFetcherServiceConfig(),
    global: getDefaultFetcherGlobalConfig(),
    dimensions: getDefaultFetcherDimensions(),
  }
}
