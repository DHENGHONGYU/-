/**
 * @module dataSourceRegistry
 * @description 数据源端点注册表。
 *
 * 集中管理腾讯/新浪/网易/AKShare/Mock 等端点元数据，
 * 作为 `dataSourceOrchestrator`、`FetcherConfigPage` 与 `collectionPipeline` 的统一数据来源。
 */

import {
  TENCENT_API_BASE,
  SINA_API_BASE,
  NETEASE_API_BASE,
  TUSHARE_API_BASE,
} from '@/config/marketDataEndpoints'
import type {
  DataSourceEndpoint,
  QuoteDataSourceId,
  SourcePriorityItem,
} from '@/types/modules/collection.types'

/** 已注册的数据源端点列表 */
export const DATA_SOURCE_ENDPOINTS: DataSourceEndpoint[] = [
  {
    id: 'tencent',
    name: '腾讯财经',
    type: 'http',
    baseUrl: TENCENT_API_BASE,
    timeoutMs: 5000,
    retries: 2,
    enabled: true,
    supportsQuote: true,
    supportsKline: true,
    requiresProxy: true,
    description: '实时行情 + 历史 K 线（Qt + IFzq 双域代理）',
  },
  {
    id: 'sina',
    name: '新浪财经',
    type: 'http',
    baseUrl: SINA_API_BASE,
    timeoutMs: 5000,
    retries: 2,
    enabled: true,
    supportsQuote: true,
    supportsKline: false,
    requiresProxy: true,
    description: '实时行情、批量行情（浏览器 CORS 需代理）',
  },
  {
    id: 'netease',
    name: '网易财经',
    type: 'http',
    baseUrl: NETEASE_API_BASE,
    timeoutMs: 3000,
    retries: 1,
    enabled: false,
    supportsQuote: false,
    supportsKline: true,
    requiresProxy: true,
    description: '历史 K 线（已不可用，DNS 不可达）',
  },
  {
    id: 'akshare',
    name: 'AKShare',
    type: 'python',
    baseUrl: 'http://localhost:8000',
    timeoutMs: 30000,
    retries: 1,
    enabled: false,
    supportsQuote: false,
    supportsKline: false,
    requiresProxy: false,
    description: 'Python 本地/远程服务，浏览器环境暂不可用',
  },
  {
    id: 'tushare',
    name: 'Tushare Pro',
    type: 'http',
    baseUrl: TUSHARE_API_BASE,
    timeoutMs: 10000,
    retries: 2,
    enabled: true,
    supportsQuote: true,
    supportsKline: true,
    requiresProxy: true,
    description: 'Tushare Pro 金融数据 API（需经后端代理持有 Token）',
  },
  {
    id: 'mock',
    name: 'Mock 数据源',
    type: 'mock',
    baseUrl: 'mock://local',
    timeoutMs: 1000,
    retries: 0,
    enabled: true,
    supportsQuote: true,
    supportsKline: true,
    requiresProxy: false,
    description: '本地 Mock 数据，用于开发与测试兜底',
  },
] as const

/** 端点 ID → 端点元数据映射 */
export const DATA_SOURCE_ENDPOINT_MAP: Readonly<Record<QuoteDataSourceId, DataSourceEndpoint>> =
  DATA_SOURCE_ENDPOINTS.reduce((map, endpoint) => {
    map[endpoint.id] = endpoint
    return map
  }, {} as Record<QuoteDataSourceId, DataSourceEndpoint>)

/** 默认行情数据源优先级（Tushare Pro → 腾讯 → 新浪 → Mock） */
export const DEFAULT_QUOTE_PRIORITY: SourcePriorityItem[] = [
  { id: 'tushare', priority: 1, enabled: true },
  { id: 'tencent', priority: 2, enabled: true },
  { id: 'sina', priority: 3, enabled: true },
  { id: 'mock', priority: 4, enabled: true },
]

/** 默认 K 线数据源优先级（Tushare Pro → 腾讯日 K 线 → 网易（已不可用） → Mock） */
export const DEFAULT_KLINE_PRIORITY: SourcePriorityItem[] = [
  { id: 'tushare', priority: 1, enabled: true },
  { id: 'tencent', priority: 2, enabled: true },
  { id: 'netease', priority: 3, enabled: false },
  { id: 'mock', priority: 4, enabled: true },
]

/**
 * 获取默认优先级链（按 priority 升序）。
 */
export function getDefaultQuotePriority(enabledOnly = true): SourcePriorityItem[] {
  return sortPriorityChain(DEFAULT_QUOTE_PRIORITY, enabledOnly)
}

export function getDefaultKlinePriority(enabledOnly = true): SourcePriorityItem[] {
  return sortPriorityChain(DEFAULT_KLINE_PRIORITY, enabledOnly)
}

/**
 * 对优先级链排序，并可选过滤未启用项。
 */
export function sortPriorityChain(
  chain: SourcePriorityItem[],
  enabledOnly = true,
): SourcePriorityItem[] {
  const sorted = [...chain].sort((a, b) => a.priority - b.priority)
  return enabledOnly ? sorted.filter((item) => item.enabled) : sorted
}

/**
 * 根据维度配置生成可用的数据源优先级链。
 * 若未提供配置，返回默认行情链。
 */
export function resolveQuotePriorityChain(
  dimensionSourcePriority?: SourcePriorityItem[],
): SourcePriorityItem[] {
  if (dimensionSourcePriority && dimensionSourcePriority.length > 0) {
    return sortPriorityChain(dimensionSourcePriority, true)
  }
  return getDefaultQuotePriority(true)
}

/**
 * 根据维度配置生成可用的 K 线数据源优先级链。
 */
export function resolveKlinePriorityChain(
  dimensionSourcePriority?: SourcePriorityItem[],
): SourcePriorityItem[] {
  if (dimensionSourcePriority && dimensionSourcePriority.length > 0) {
    const klineSources = dimensionSourcePriority.filter(
      (item) => DATA_SOURCE_ENDPOINT_MAP[item.id]?.supportsKline,
    )
    if (klineSources.length > 0) {
      return sortPriorityChain(klineSources, true)
    }
  }
  return getDefaultKlinePriority(true)
}

/**
 * 获取端点元数据。
 */
export function getEndpoint(id: QuoteDataSourceId): DataSourceEndpoint | undefined {
  return DATA_SOURCE_ENDPOINT_MAP[id]
}

/**
 * 获取所有已启用端点。
 */
export function getEnabledEndpoints(): DataSourceEndpoint[] {
  return DATA_SOURCE_ENDPOINTS.filter((endpoint) => endpoint.enabled)
}
