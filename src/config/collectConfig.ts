/**
 * @module collectConfig
 * @description 七维采集配置常量定义。
 *
 * 参考V6 Pro collectConfig.ts 设计，适配V9架构：
 * - 8个采集维度（七维+研报中心）
 * - 5个策略模板（价值/成长/防御/周期/全维度）
 * - 频率枚举与中文标签映射
 * - 数据源类型与优先级
 * - 全局限流参数
 *
 * @see V6 Pro: cockpit-app/src/data/collectConfig.ts
 */

// ============================================================
// 频率枚举
// ============================================================

export type UpdateFrequency =
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

export type DataSourceType = 'akshare' | 'ifind' | 'yahoo' | 'tianyancha' | 'scholar' | 'cache'

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

export type StorageType = 'full' | 'lightweight'

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  full: '全量存储',
  lightweight: '轻量索引',
}

// ============================================================
// 重要性等级
// ============================================================

export type DimensionImportance = 'critical' | 'high' | 'medium' | 'low'

export const IMPORTANCE_LABELS: Record<DimensionImportance, string> = {
  critical: '核心',
  high: '高',
  medium: '中',
  low: '低',
}

// ============================================================
// 单维度配置接口
// ============================================================

export interface DimensionConfig {
  /** 维度代码 "01"~"08" */
  code: string
  /** 维度名称 */
  name: string
  /** 是否启用 */
  enabled: boolean
  /** 采集频率 */
  frequency: UpdateFrequency
  /** 批量大小 */
  batchSize: number
  /** 数据源优先级列表（按序尝试） */
  sources: DataSourceType[]
  /** 缓存TTL（分钟） */
  cacheTtl: number
  /** 存储策略 */
  storageType: StorageType
  /** 采集字段列表 */
  fields: string[]
  /** 重要性等级 */
  importance: DimensionImportance
}

// ============================================================
// 策略模板
// ============================================================

export type StrategyTemplateId = 'value' | 'growth' | 'defense' | 'cycle' | 'full'

export interface StrategyTemplate {
  id: StrategyTemplateId
  name: string
  description: string
  /** 启用的维度code列表 */
  dimensions: string[]
  /** 更新频率 */
  updateInterval: UpdateFrequency
  /** 历史数据天数 */
  historyDays: number
  /** 数据源 */
  sources: DataSourceType[]
}

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
// 8个采集维度默认配置
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
// 维度颜色映射（用于UI标识）
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
  /** L1缓存TTL（秒） */
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
