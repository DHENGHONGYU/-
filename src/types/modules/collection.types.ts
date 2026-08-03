/**
 * @module collection.types
 * @description 数据采集模块核心类型定义（零依赖，可被 config/services/store 各层引用）。
 *
 * @architecture 采集任务数据流
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  执行层（Service）                                        │
 *  │  - collectionPipeline.ts    → 执行采集流水线             │
 *  │  - fetcherService.ts        → 采集器健康检查/请求        │
 *  │  - qualityMetricsCollector  → 质量指标采集               │
 *  │  - tracePersistenceService  → Trace 持久化/查询          │
 *  │  - collectionReportService  → 采集报告生成               │
 *  │  执行产物 → eventBus.emit(COLLECTION_EVENTS.*)           │
 *  └──────────────────────┬──────────────────────────────────┘
 *                         │ 事件流
 *  ┌──────────────────────▼──────────────────────────────────┐
 *  │  状态层（Store）                                          │
 *  │  - collectionRuntimeStore   → 订阅事件，维护运行时状态    │
 *  │    .traceSpans   (Record<traceId, CollectionTraceSpan>)  │
 *  │    .logs         (CollectionLog[])                       │
 *  │    .taskStatuses (Record<taskId, CollectionTaskRuntime>) │
 *  │    .stats        (QualityMetrics)                        │
 *  │  - dataTestStore            → 单链路/批量测试状态         │
 *  │  - sevenDimConfigStore      → 七维维度配置               │
 *  └──────────────────────┬──────────────────────────────────┘
 *                         │ Store 消费
 *  ┌──────────────────────▼──────────────────────────────────┐
 *  │  展示层（Component）                                      │
 *  │  - CollectTask/index.tsx    → 采集任务监控页（9 Tab）     │
 *  │  - DataTestPanel.tsx        → 数据采集测试面板            │
 *  │  - FetcherConfigPage.tsx    → 抓取引擎配置页              │
 *  │  - HomePage.tsx             → 首页状态摘要                │
 *  │  子组件：                                                 │
 *  │  - TaskListTab / ScoreAnalysisTab / DimHealthTab         │
 *  │  - LiveLogStream / CollectionTimeline / Swimlane         │
 *  │  - CollectionProgressPanel / CollectionReportPanel       │
 *  └─────────────────────────────────────────────────────────┘
 *
  * @doc [V9-DOC-QA-066]
*/

// ============================================================
// 基础枚举
// ============================================================

/** 直连行情数据源标识（用于 dataSourceOrchestrator 的降级链） */
export type QuoteDataSourceId = 'tencent' | 'sina' | 'netease' | 'akshare' | 'tushare' | 'mock'

/** 业务数据源类型（用于七维配置中的维度数据源） */
export type DataSourceType = 'akshare' | 'ifind' | 'tushare' | 'yahoo' | 'tianyancha' | 'scholar' | 'cache'

/** 采集频率 */
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

/** 存储策略 */
export type StorageType = 'full' | 'lightweight'

/** 维度重要性等级 */
export type DimensionImportance = 'critical' | 'high' | 'medium' | 'low'

/** 策略模板标识 */
export type StrategyTemplateId = 'value' | 'growth' | 'defense' | 'cycle' | 'full'

// ============================================================
// 配置类型
// ============================================================

/** 单维度基础配置 */
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
  /** 数据源列表（按优先级排序） */
  sources: DataSourceType[]
  /** 缓存 TTL（分钟） */
  cacheTtl: number
  /** 存储策略 */
  storageType: StorageType
  /** 采集字段列表 */
  fields: string[]
  /** 重要性等级 */
  importance: DimensionImportance
}

/** 策略模板 */
export interface StrategyTemplate {
  id: StrategyTemplateId
  name: string
  description: string
  /** 启用的维度 code 列表 */
  dimensions: string[]
  /** 更新频率 */
  updateInterval: UpdateFrequency
  /** 历史数据天数 */
  historyDays: number
  /** 默认数据源 */
  sources: DataSourceType[]
}

/** 数据源端点元数据 */
export interface DataSourceEndpoint {
  id: QuoteDataSourceId
  name: string
  type: 'http' | 'python' | 'mock'
  /** 基础 URL */
  baseUrl: string
  /** 默认超时（毫秒） */
  timeoutMs: number
  /** 默认重试次数 */
  retries: number
  /** 是否启用 */
  enabled: boolean
  /** 是否支持实时行情 */
  supportsQuote: boolean
  /** 是否支持 K 线 */
  supportsKline: boolean
  /** 是否需要浏览器代理（CORS） */
  requiresProxy: boolean
  /** 描述 */
  description: string
}

/** 维度级数据源优先级项 */
export interface SourcePriorityItem {
  id: QuoteDataSourceId
  /** 优先级数字，越小越优先 */
  priority: number
  /** 是否启用 */
  enabled: boolean
}

/** 重试策略 */
export interface RetryPolicy {
  maxRetries: number
  /** 退避倍数 */
  backoffMultiplier: number
  /** 初始间隔（毫秒） */
  initialDelayMs: number
}

/** 超时策略 */
export interface TimeoutPolicy {
  /** 单次请求超时（毫秒） */
  requestTimeoutMs: number
  /** 整个维度采集超时（毫秒） */
  dimensionTimeoutMs: number
}

/** 降级策略 */
export interface FallbackPolicy {
  /** 是否允许降级到次优先级源 */
  allowFallback: boolean
  /** 是否允许最终降级到 Mock */
  allowMockFallback: boolean
  /** 触发告警的失败率阈值（%） */
  alertFailureRate: number
}

/** 维度级流水线配置（在基础配置之上增加高级参数） */
export interface DimensionPipelineConfig extends DimensionConfig {
  /** 数据源优先级链（按 priority 升序排列） */
  sourcePriority: SourcePriorityItem[]
  /** 并发数（单维度内部） */
  concurrency: number
  retryPolicy: RetryPolicy
  timeoutPolicy: TimeoutPolicy
  fallbackPolicy: FallbackPolicy
}

/** 全局采集策略 */
export interface GlobalCollectPolicy {
  /** 最大标的数 */
  maxSymbols: number
  /** 默认批量大小 */
  defaultBatchSize: number
  /** 每分钟限流 */
  rateLimitPerMinute: number
  /** 每小时限流 */
  rateLimitPerHour: number
  /** 每天限流 */
  rateLimitPerDay: number
  /** 完成通知 */
  notifyOnComplete: boolean
  /** 失败通知 */
  notifyOnError: boolean
  /** 全局默认超时 */
  defaultTimeoutMs: number
  /** 全局默认重试 */
  defaultRetries: number
}

/** 完整采集配置（可持久化） */
export interface CollectionConfig {
  version: string
  /** 当前策略模板 */
  activeTemplate: StrategyTemplateId
  /** 维度配置 */
  dimensions: DimensionPipelineConfig[]
  /** 全局策略 */
  global: GlobalCollectPolicy
  /** 目标标的数 */
  symbolCount: number
  /** 历史数据天数 */
  historyDays: number
  /** 更新时间 */
  updatedAt: number
}

// ============================================================
// 运行时事件与链路追踪
// ============================================================

/** 采集生命周期阶段 */
export type CollectionLifecycleStage =
  | 'triggered'
  | 'source:start'
  | 'source:success'
  | 'source:fail'
  | 'fallback'
  | 'transform'
  | 'write:start'
  | 'write:success'
  | 'write:fail'
  | 'complete'
  | 'task:status'

/** 事件名常量 */
export const COLLECTION_EVENTS = {
  TRIGGERED: 'collect:triggered',
  SOURCE_START: 'collect:source:start',
  SOURCE_SUCCESS: 'collect:source:success',
  SOURCE_FAIL: 'collect:source:fail',
  FALLBACK: 'collect:fallback',
  TRANSFORM: 'collect:transform',
  WRITE_START: 'collect:write:start',
  WRITE_SUCCESS: 'collect:write:success',
  WRITE_FAIL: 'collect:write:fail',
  COMPLETE: 'collect:complete',
  TASK_STATUS: 'collect:task:status',
} as const

/** 采集生命周期事件 */
export interface CollectionLifecycleEvent {
  /** 事件类型 */
  type: (typeof COLLECTION_EVENTS)[keyof typeof COLLECTION_EVENTS]
  /** 追踪 ID */
  traceId: string
  /** 任务 ID（批量/轮询任务） */
  taskId?: string
  /** 维度 code */
  dimensionCode?: string
  /** 标的代码 */
  symbol?: string
  /** 数据源标识 */
  sourceId?: QuoteDataSourceId
  /** 时间戳 */
  timestamp: number
  /** 耗时（毫秒） */
  durationMs?: number
  /** 事件消息 */
  message: string
  /** 错误信息 */
  error?: string
  /** 附加数据 */
  payload?: Record<string, unknown>
}

/** 单次采集链路追踪段 */
export interface CollectionTraceSpan {
  traceId: string
  taskId?: string
  /** 批次级父任务 ID（一个采集批次共享） */
  parentTaskId?: string
  dimensionCode: string
  symbol: string
  /** 各阶段记录 */
  stages: CollectionStageRecord[]
  /** 最终结果 */
  result: 'success' | 'fail' | 'partial'
  /** 总耗时（毫秒） */
  totalDurationMs: number
  /** 单次耗时（毫秒，简化版查询用） */
  durationMs?: number
  /** 附加元数据 */
  metadata?: Record<string, unknown>
  /** 最终数据源 */
  finalSource?: QuoteDataSourceId
  /** 降级次数 */
  fallbackCount: number
  /** 错误信息 */
  error?: string
  startedAt: number
  completedAt?: number
}

/** 采集阶段记录 */
export interface CollectionStageRecord {
  stage: CollectionLifecycleStage
  sourceId?: QuoteDataSourceId
  timestamp: number
  durationMs?: number
  message: string
  error?: string
}

/** 采集日志项 */
export interface CollectionLog {
  id: string
  timestamp: number
  /** 时间格式化字符串（HH:mm:ss） */
  time: string
  level: 'info' | 'warn' | 'error' | 'success'
  dimensionCode?: string
  symbol?: string
  sourceId?: QuoteDataSourceId
  message: string
  traceId: string
}

/** 任务状态 */
export type CollectionTaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error'

/** 采集任务运行时 */
export interface CollectionTaskRuntime {
  taskId: string
  dimensionCode: string
  symbol: string
  status: CollectionTaskStatus
  progress: number
  startedAt?: number
  completedAt?: number
  error?: string
}

// ============================================================
// 采集结果
// ============================================================

/** 单源采集结果 */
export interface SourceCollectionResult<T> {
  success: boolean
  data: T | null
  source: QuoteDataSourceId
  latency: number
  fallbackChain: QuoteDataSourceId[]
  error?: string
}

/** 批量采集结果 */
export interface BatchCollectionResult<T> {
  success: boolean
  data: T[]
  failed: string[]
  source: QuoteDataSourceId
  latency: number
  fallbackChain: QuoteDataSourceId[]
  error?: string
}

// ============================================================
// 字段注册表
// ============================================================

/** 字段元数据 */
export interface CollectionFieldDef {
  id: string
  name: string
  description: string
  /** 适用维度 code 列表 */
  dimensions: string[]
}

/** 字段注册表 */
export type FieldRegistry = Record<string, CollectionFieldDef[]>

// ============================================================
// 数据采集向导（Wizard）
// ============================================================

/** 向导步骤 */
export type CollectionWizardStep = 1 | 2 | 3 | 4

/** 采集频率 */
export type CollectionFrequency = 'realtime' | 'hourly' | 'daily' | 'custom'

/** 采集优先级 */
export type CollectionPriority = 'high' | 'medium' | 'low'

/** 缓存策略 */
export type CollectionCacheStrategy = 'stale-while-revalidate' | 'cache-first' | 'network-first'

/** API 配置 */
export interface ApiConfig {
  baseUrl: string
  apiKey?: string
  timeoutMs: number
  rateLimitPerMinute?: number
}

/** 维度进度 */
export interface DimensionProgress {
  dimensionCode: string
  dimensionName: string
  progress: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
}

/** 向导日志条目 */
export interface WizardLogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
  dimensionCode?: string
  /** 链路追踪 ID，关联同一任务的日志 */
  traceId?: string
  /** 阶段标识（如 source:start / write:success） */
  stage?: string
  /** 耗时（毫秒） */
  durationMs?: number
}

/** 持久化的数据源配置模板 */
export interface PersistedWizardConfig {
  id: string
  name: string
  selectedDimensions: string[]
  apiConfigs: Record<string, ApiConfig>
  frequency: CollectionFrequency
  cronExpression: string
  priority: CollectionPriority
  cacheTTL: number
  cacheStrategy: CollectionCacheStrategy
  saveAsTemplate: boolean
  createdAt: number
  updatedAt: number
}

/** 导出配置元数据 */
export interface ConfigExportMeta {
  exportVersion: string
  exportedAt: number
  sourceName: string
}

/** 导出配置文件结构 */
export interface ExportedConfigFile {
  meta: ConfigExportMeta
  config: PersistedWizardConfig
}

/** 数据采集向导状态 */
export interface CollectionWizardState {
  // 向导状态
  currentStep: CollectionWizardStep
  isOpen: boolean

  // 步骤1：数据源配置
  selectedDimensions: string[]
  apiConfigs: Record<string, ApiConfig>

  // 步骤2：采集策略
  frequency: CollectionFrequency
  cronExpression: string
  priority: CollectionPriority
  cacheTTL: number
  cacheStrategy: CollectionCacheStrategy

  // 步骤3：任务预览
  taskName: string
  saveAsTemplate: boolean

  // 步骤4：执行监控
  taskId: string | null
  taskStatus: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  dimensionProgress: DimensionProgress[]
  logs: WizardLogEntry[]

  // Actions
  setStep: (step: CollectionWizardStep) => void
  openWizard: () => void
  closeWizard: () => void
  toggleDimension: (code: string, checked: boolean) => void
  updateApiConfig: (code: string, config: ApiConfig) => void
  setFrequency: (frequency: CollectionFrequency) => void
  setCronExpression: (cron: string) => void
  setPriority: (priority: CollectionPriority) => void
  setCacheTTL: (ttl: number) => void
  setCacheStrategy: (strategy: CollectionCacheStrategy) => void
  setTaskName: (name: string) => void
  setSaveAsTemplate: (save: boolean) => void
  startTask: () => Promise<void>
  pauseTask: () => void
  resumeTask: () => void
  stopTask: () => void
  resetWizard: () => void
  
  // 配置导出/导入
  exportConfig: (configId: string) => void
  importConfig: (file: File) => Promise<{ success: true; configId: string } | { success: false; error: string }>
}
