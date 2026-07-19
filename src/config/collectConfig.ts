/**
 * @module collectConfig
 * @description 七维采集配置常量定义。
 *
 * 参考 V6 Pro collectConfig.ts 设计，适配 V9 架构：
 * - 8 个采集维度（七维 + 研报中心）
 * - 5 个策略模板（价值 / 成长 / 防御 / 周期 / 全维度）
 * - 频率枚举与中文标签映射
 * - 数据源类型与优先级
 * - 全局限流参数
 * - 字段注册表与默认策略
 *
 * @see V6 Pro: cockpit-app/src/data/collectConfig.ts
 */

import type {
  UpdateFrequency,
  DataSourceType,
  StorageType,
  DimensionImportance,
  StrategyTemplateId,
  StrategyTemplate,
  DimensionConfig,
  FieldRegistry,
  RetryPolicy,
  TimeoutPolicy,
  FallbackPolicy,
} from '@/types/modules/collection.types'

// Re-export 类型，保持现有导入路径兼容
export type {
  UpdateFrequency,
  DataSourceType,
  StorageType,
  DimensionImportance,
  StrategyTemplateId,
  StrategyTemplate,
  DimensionConfig,
  FieldRegistry,
}

// ============================================================
// 频率枚举
// ============================================================

export const FREQUENCY_LABELS: Record<UpdateFrequency, string> = {
  realtime: '实时',
  '1h': '每小时',
  '3h': '每3小时',
  daily: '每日',
  '3d': '每3天',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月',
  quarterly: '每季度',
  manual: '手动',
}

export const FREQUENCY_MINUTES: Record<UpdateFrequency, number> = {
  realtime: 5,
  '1h': 60,
  '3h': 180,
  daily: 1440,
  '3d': 4320,
  weekly: 10080,
  biweekly: 20160,
  monthly: 43200,
  quarterly: 129600,
  manual: 0,
}

// ============================================================
// 数据源类型
// ============================================================

export const DATA_SOURCE_LABELS: Record<DataSourceType, string> = {
  akshare: 'AKShare',
  ifind: 'iFinD',
  yahoo: 'Yahoo',
  tianyancha: '天眼查',
  scholar: '学术',
  cache: '缓存',
}

// ============================================================
// 存储策略
// ============================================================

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  full: '全量存储',
  lightweight: '轻量索引',
}

// ============================================================
// 重要性等级
// ============================================================

export const IMPORTANCE_LABELS: Record<DimensionImportance, string> = {
  critical: '核心',
  high: '高',
  medium: '中',
  low: '低',
}

// ============================================================
// 策略模板
// ============================================================

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'value',
    name: '价值投资',
    description: '低频深度采集，聚焦基本面与筹码',
    dimensions: ['01', '02', '03', '04'],
    updateInterval: 'daily',
    historyDays: 252,
    sources: ['akshare', 'ifind'],
  },
  {
    id: 'growth',
    name: '成长投资',
    description: '中频采集，关注行业趋势与新闻',
    dimensions: ['01', '02', '03', '05', '06'],
    updateInterval: 'daily',
    historyDays: 126,
    sources: ['akshare', 'yahoo'],
  },
  {
    id: 'defense',
    name: '防御配置',
    description: '低频广覆盖，侧重关联指数与长期数据',
    dimensions: ['01', '02', '03', '07'],
    updateInterval: 'weekly',
    historyDays: 504,
    sources: ['akshare', 'ifind'],
  },
  {
    id: 'cycle',
    name: '周期轮动',
    description: '中频采集，跟踪行业排名与资金流向',
    dimensions: ['01', '02', '05', '06', '07'],
    updateInterval: 'daily',
    historyDays: 252,
    sources: ['akshare', 'yahoo'],
  },
  {
    id: 'full',
    name: '全维度',
    description: '高频全量采集，适用于深度研究',
    dimensions: ['01', '02', '03', '04', '05', '06', '07', '08'],
    updateInterval: 'daily',
    historyDays: 756,
    sources: ['akshare', 'ifind', 'yahoo'],
  },
]

// ============================================================
// 8 个采集维度默认配置
// ============================================================

export const DEFAULT_DIMENSIONS: DimensionConfig[] = [
  {
    code: '01',
    name: '基本信息',
    enabled: true,
    frequency: 'monthly',
    batchSize: 50,
    sources: ['akshare', 'ifind'],
    cacheTtl: 43200,
    storageType: 'full',
    fields: ['name', 'industry', 'marketCap', 'pe', 'pb', 'roe'],
    importance: 'low',
  },
  {
    code: '02',
    name: 'K线数据',
    enabled: true,
    frequency: 'daily',
    batchSize: 100,
    sources: ['akshare'],
    cacheTtl: 1440,
    storageType: 'full',
    fields: ['open', 'close', 'high', 'low', 'volume', 'amount', 'ma5', 'ma20', 'ma60'],
    importance: 'medium',
  },
  {
    code: '03',
    name: '筹码分布',
    enabled: true,
    frequency: '3d',
    batchSize: 50,
    sources: ['akshare', 'ifind'],
    cacheTtl: 4320,
    storageType: 'full',
    fields: ['chipDistribution', 'holderCount', 'costDistribution'],
    importance: 'high',
  },
  {
    code: '04',
    name: '重大事项',
    enabled: true,
    frequency: 'daily',
    batchSize: 30,
    sources: ['akshare', 'ifind'],
    cacheTtl: 1440,
    storageType: 'lightweight',
    fields: ['announcements', 'notices', 'reports'],
    importance: 'high',
  },
  {
    code: '05',
    name: '热点新闻',
    enabled: true,
    frequency: 'daily',
    batchSize: 50,
    sources: ['akshare', 'yahoo'],
    cacheTtl: 720,
    storageType: 'lightweight',
    fields: ['title', 'summary', 'source', 'url', 'publishedAt'],
    importance: 'medium',
  },
  {
    code: '06',
    name: '行业竞品',
    enabled: true,
    frequency: 'weekly',
    batchSize: 20,
    sources: ['akshare', 'ifind'],
    cacheTtl: 10080,
    storageType: 'lightweight',
    fields: ['industryRank', 'competitors', 'marketShare'],
    importance: 'medium',
  },
  {
    code: '07',
    name: '关联指数',
    enabled: true,
    frequency: 'weekly',
    batchSize: 30,
    sources: ['akshare', 'ifind', 'yahoo'],
    cacheTtl: 10080,
    storageType: 'lightweight',
    fields: ['indexCode', 'etfCode', 'correlation', 'fundFlow'],
    importance: 'low',
  },
  {
    code: '08',
    name: '研报中心',
    enabled: true,
    frequency: 'daily',
    batchSize: 20,
    sources: ['ifind'],
    cacheTtl: 1440,
    storageType: 'lightweight',
    fields: ['reportTitle', 'rating', 'targetPrice', 'analyst', 'summary'],
    importance: 'critical',
  },
]

// ============================================================
// 维度颜色映射（用于 UI 标识）
// ============================================================

export const DIMENSION_COLORS: Record<string, string> = {
  '01': 'bg-blue-500',
  '02': 'bg-green-500',
  '03': 'bg-purple-500',
  '04': 'bg-orange-500',
  '05': 'bg-cyan-500',
  '06': 'bg-pink-500',
  '07': 'bg-indigo-500',
  '08': 'bg-red-500',
}

export const IMPORTANCE_BADGE_VARIANT: Record<DimensionImportance, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
}

// ============================================================
// 字段注册表
// ============================================================

export const FIELD_REGISTRY: FieldRegistry = {
  '01': [
    { id: 'name', name: '名称', description: '股票名称', dimensions: ['01'] },
    { id: 'industry', name: '行业', description: '所属行业', dimensions: ['01'] },
    { id: 'marketCap', name: '市值', description: '总市值', dimensions: ['01'] },
    { id: 'pe', name: 'PE', description: '市盈率', dimensions: ['01'] },
    { id: 'pb', name: 'PB', description: '市净率', dimensions: ['01'] },
    { id: 'roe', name: 'ROE', description: '净资产收益率', dimensions: ['01'] },
  ],
  '02': [
    { id: 'open', name: '开盘价', description: '日线开盘价', dimensions: ['02'] },
    { id: 'close', name: '收盘价', description: '日线收盘价', dimensions: ['02'] },
    { id: 'high', name: '最高价', description: '日线最高价', dimensions: ['02'] },
    { id: 'low', name: '最低价', description: '日线最低价', dimensions: ['02'] },
    { id: 'volume', name: '成交量', description: '日线成交量', dimensions: ['02'] },
    { id: 'amount', name: '成交额', description: '日线成交额', dimensions: ['02'] },
    { id: 'ma5', name: 'MA5', description: '5 日均线', dimensions: ['02'] },
    { id: 'ma20', name: 'MA20', description: '20 日均线', dimensions: ['02'] },
    { id: 'ma60', name: 'MA60', description: '60 日均线', dimensions: ['02'] },
  ],
  '03': [
    { id: 'chipDistribution', name: '筹码分布', description: '筹码分布数据', dimensions: ['03'] },
    { id: 'holderCount', name: '股东户数', description: '股东户数', dimensions: ['03'] },
    { id: 'costDistribution', name: '成本分布', description: '成本分布', dimensions: ['03'] },
  ],
  '04': [
    { id: 'announcements', name: '公告', description: '公司公告', dimensions: ['04'] },
    { id: 'notices', name: '通知', description: '交易所通知', dimensions: ['04'] },
    { id: 'reports', name: '报告', description: '定期报告', dimensions: ['04'] },
  ],
  '05': [
    { id: 'title', name: '标题', description: '新闻标题', dimensions: ['05'] },
    { id: 'summary', name: '摘要', description: '新闻摘要', dimensions: ['05'] },
    { id: 'source', name: '来源', description: '新闻来源', dimensions: ['05'] },
    { id: 'url', name: '链接', description: '原文链接', dimensions: ['05'] },
    { id: 'publishedAt', name: '发布时间', description: '新闻发布时间', dimensions: ['05'] },
  ],
  '06': [
    { id: 'industryRank', name: '行业排名', description: '行业内排名', dimensions: ['06'] },
    { id: 'competitors', name: '竞品', description: '主要竞争对手', dimensions: ['06'] },
    { id: 'marketShare', name: '市场份额', description: '市场份额', dimensions: ['06'] },
  ],
  '07': [
    { id: 'indexCode', name: '指数代码', description: '关联指数代码', dimensions: ['07'] },
    { id: 'etfCode', name: 'ETF 代码', description: '关联 ETF 代码', dimensions: ['07'] },
    { id: 'correlation', name: '相关性', description: '与指数相关性', dimensions: ['07'] },
    { id: 'fundFlow', name: '资金流向', description: '板块资金流向', dimensions: ['07'] },
  ],
  '08': [
    { id: 'reportTitle', name: '研报标题', description: '研报标题', dimensions: ['08'] },
    { id: 'rating', name: '评级', description: '机构评级', dimensions: ['08'] },
    { id: 'targetPrice', name: '目标价', description: '目标价', dimensions: ['08'] },
    { id: 'analyst', name: '分析师', description: '分析师', dimensions: ['08'] },
    { id: 'summary', name: '摘要', description: '研报摘要', dimensions: ['08'] },
  ],
}

// ============================================================
// 默认策略
// ============================================================

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  backoffMultiplier: 2,
  initialDelayMs: 500,
}

export const DEFAULT_TIMEOUT_POLICY: TimeoutPolicy = {
  requestTimeoutMs: 5000,
  dimensionTimeoutMs: 30000,
}

export const DEFAULT_FALLBACK_POLICY: FallbackPolicy = {
  allowFallback: true,
  // 生产环境禁止 Mock 数据回退，避免 API 失败时静默切换到假数据
  allowMockFallback: !import.meta.env.PROD,
  alertFailureRate: 80,
}

// ============================================================
// 全局限流参数
// ============================================================

export const GLOBAL_LIMITS = {
  /** 最大标的数 */
  maxSymbols: 500,
  /** 默认批量大小 */
  defaultBatchSize: 50,
  /** 每分钟限流 */
  rateLimitPerMinute: 10,
  /** 每小时限流 */
  rateLimitPerHour: 200,
  /** 每天限流 */
  rateLimitPerDay: 2000,
  /** L1 缓存 TTL（秒） */
  l1CacheTtl: 300,
} as const

// ============================================================
// 额度预估计算
// ============================================================

/**
 * 计算单维度月调用次数
 * @param dimension 维度配置
 * @param symbolCount 标的数
 * @returns 月调用次数
 */
export function estimateMonthlyCalls(dimension: DimensionConfig, symbolCount: number): number {
  if (!dimension.enabled || dimension.frequency === 'manual') return 0
  const minutesPerMonth = 43200
  const intervalMinutes = FREQUENCY_MINUTES[dimension.frequency]
  if (intervalMinutes === 0) return 0
  const callsPerSymbolPerMonth = Math.ceil(minutesPerMonth / intervalMinutes)
  return callsPerSymbolPerMonth * Math.ceil(symbolCount / dimension.batchSize)
}

/**
 * 计算全部启用维度的月调用总量
 */
export function estimateTotalMonthlyCalls(dimensions: DimensionConfig[], symbolCount: number): number {
  return dimensions.reduce((total, dim) => total + estimateMonthlyCalls(dim, symbolCount), 0)
}

// ============================================================
// 数据源连通性测试端点（配置层，供 ApiTestDialog 消费）
// ============================================================

export interface TestApiEndpoint {
  id: string
  name: string
  testApi: string
}

export const TEST_API_ENDPOINTS: TestApiEndpoint[] = [
  { id: 'akshare', name: 'AKShare', testApi: '/api/test/akshare' },
  { id: 'ifind', name: 'iFinD', testApi: '/api/test/ifind' },
  { id: 'yahoo', name: 'Yahoo', testApi: '/api/test/yahoo' },
  { id: 'tianyancha', name: '天眼查', testApi: '/api/test/tianyancha' },
  { id: 'scholar', name: '学术', testApi: '/api/test/scholar' },
]

// ============================================================
// 维度接口映射（配置层，供 CollectionPlanPanel 消费）
// ============================================================

export interface DimensionApiMapping {
  code: string
  name: string
  api: string
  method: string
  cache: string
}

export const DIMENSION_API_MAPPING: DimensionApiMapping[] = [
  { code: '01', name: '基本信息', api: '/api/stock/basic', method: 'GET', cache: '43200s' },
  { code: '02', name: 'K线数据', api: '/api/stock/kline', method: 'GET', cache: '1440s' },
  { code: '03', name: '筹码分布', api: '/api/stock/chip', method: 'GET', cache: '4320s' },
  { code: '04', name: '重大事项', api: '/api/stock/news', method: 'GET', cache: '1440s' },
  { code: '05', name: '热点新闻', api: '/api/news/hot', method: 'GET', cache: '720s' },
  { code: '06', name: '行业竞品', api: '/api/industry/competitors', method: 'GET', cache: '10080s' },
  { code: '07', name: '关联指数', api: '/api/index/correlation', method: 'GET', cache: '10080s' },
  { code: '08', name: '研报中心', api: '/api/research/reports', method: 'GET', cache: '1440s' },
]
