/**
 * @fileoverview 采集配置持久化类型
 *
 * 对应 IndexedDB `collect_config` store，保存数据采集向导的配置模板。
/** API 配置 */
export interface ApiConfig {
  baseUrl: string
  apiKey?: string
  timeoutMs: number
  rateLimitPerMinute?: number
}

/** 采集频率 */
export type CollectionFrequency = 'realtime' | 'hourly' | 'daily' | 'custom'

/** 采集优先级 */
export type CollectionPriority = 'high' | 'medium' | 'low'

/** 缓存策略 */
export type CollectionCacheStrategy = 'stale-while-revalidate' | 'cache-first' | 'network-first'

/** 持久化的数据源配置模板 */
export interface PersistedWizardConfig {
  /** 配置 ID */
  id: string
  /** 配置名称 */
  name: string
  /** 已选维度 code 列表 */
  selectedDimensions: string[]
  /** API 配置映射（维度 code -> 配置） */
  apiConfigs: Record<string, ApiConfig>
  /** 采集频率 */
  frequency: CollectionFrequency
  /** cron 表达式 */
  cronExpression: string
  /** 优先级 */
  priority: CollectionPriority
  /** 缓存 TTL（秒） */
  cacheTTL: number
  /** 缓存策略 */
  cacheStrategy: CollectionCacheStrategy
  /** 是否保存为模板 */
  saveAsTemplate: boolean
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}
