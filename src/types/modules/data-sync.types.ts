/**
 * @fileoverview 双通道数据采集与更新类型定义
 *
 * 定义系统自动采集与本地文件采集双通道所需的全部类型：
 * - 采集通道与更新模式枚举
 * - 冲突处理策略
 * - 文件校验结果
 * - 差异分析与哈希比对
 * - 校对报告
 * - 过期检测
 * - 历史记录
 * - 检索条件与结果
 *
 * @module types/modules/data-sync
 * @created 2026-07-14 - 双通道数据采集整改 P0-1
 */

import type { QuoteDataSourceId, UpdateFrequency } from './collection.types'
import type { StoreName } from '@/config/dbConfig'

// ============================================================
// 枚举类型
// ============================================================

/** 数据采集通道 */
export type CollectionChannel = 'auto-collect' | 'file-import' | 'manual-trigger'

/** 更新模式 */
export type UpdateMode = 'batch' | 'incremental'

/** 冲突处理策略 */
export type ConflictPolicy =
  | 'last-write-wins'
  | 'highest-priority'
  | 'merge-fields'
  | 'skip-if-newer'
  | 'ask-user'
  | 'keep-both'

/** 文件导入数据类型 */
export type FileImportDataType =
  | 'stocks'
  | 'dailyQuotes'
  | 'financialReports'
  | 'scores'
  | 'news'
  | 'researchReports'
  | 'knowledgeDocs'
  | 'auto'

/** 同步状态机状态 */
export type SyncState =
  | 'idle'
  | 'checking'
  | 'auto-collecting'
  | 'file-importing'
  | 'validating'
  | 'conflict-detection'
  | 'auto-resolve'
  | 'wait-user'
  | 'updating'
  | 'recording'
  | 'error'

/** 记录差异状态 */
export type RecordDiffStatus = 'added' | 'modified' | 'unchanged' | 'deleted' | 'conflict'

/** 字段差异类型 */
export type FieldDiffType = 'value-changed' | 'null-to-value' | 'value-to-null' | 'type-mismatch'

/** 严重程度 */
export type DiffSeverity = 'info' | 'warning' | 'critical'

// ============================================================
// 文件校验
// ============================================================

/** 文件元数据 */
export interface FileMetadata {
  /** 文件名 */
  readonly fileName: string
  /** 文件大小（字节） */
  readonly fileSize: number
  /** 推断的数据类型 */
  readonly fileType: FileImportDataType
  /** MIME 类型 */
  readonly mimeType: string
  /** 文件编码 */
  readonly encoding: 'utf-8' | 'gbk' | 'unknown'
  /** 行数（CSV/JSON） */
  readonly rowCount?: number
  /** Sheet 数（Excel） */
  readonly sheetCount?: number
  /** 内容哈希（SHA-256） */
  readonly hash: string
}

/** 文件校验错误 */
export interface FileValidationError {
  /** 错误码 */
  readonly code: string
  /** 错误信息 */
  readonly message: string
  /** 字段名 */
  readonly field?: string
  /** 错误值 */
  readonly value?: unknown
}

/** 文件校验警告 */
export interface FileValidationWarning {
  /** 警告码 */
  readonly code: string
  /** 警告信息 */
  readonly message: string
  /** 修复建议 */
  readonly suggestion?: string
}

/** 文件校验结果 */
export interface FileValidationResult {
  /** 是否通过 */
  readonly valid: boolean
  /** 错误列表 */
  readonly errors: readonly FileValidationError[]
  /** 警告列表 */
  readonly warnings: readonly FileValidationWarning[]
  /** 文件元数据 */
  readonly metadata: FileMetadata
}

// ============================================================
// 解析器接口
// ============================================================

/** 解析后的数据 */
export interface ParsedData {
  /** 数据类型 */
  readonly dataType: FileImportDataType
  /** 目标 store */
  readonly targetStore: StoreName
  /** 解析后的记录数组 */
  readonly records: readonly Record<string, unknown>[]
  /** 解析元信息 */
  readonly parseMeta: {
    /** 总行数 */
    readonly totalRows: number
    /** 成功解析行数 */
    readonly parsedRows: number
    /** 跳过行数 */
    readonly skippedRows: number
    /** 列名列表 */
    readonly columns: readonly string[]
  }
}

/** 文件解析器接口 */
export interface FileParser {
  /** 支持的扩展名 */
  readonly extensions: readonly string[]
  /** 解析后的数据类型 */
  readonly dataType: FileImportDataType
  /** 解析文件 */
  parse(file: File, options?: ParseOptions): Promise<ParsedData>
}

/** 解析选项 */
export interface ParseOptions {
  /** 期望的数据类型 */
  readonly expectedType?: FileImportDataType
  /** 目标 store */
  readonly targetStore?: StoreName
  /** CSV 分隔符 */
  readonly delimiter?: string
  /** 是否跳过空行 */
  readonly skipEmptyLines?: boolean
  /** 最大行数限制 */
  readonly maxRows?: number
}

// ============================================================
// 差异分析
// ============================================================

/** 字段差异 */
export interface FieldDiff {
  /** 字段名 */
  readonly fieldName: string
  /** 现有值 */
  readonly existingValue: unknown
  /** 新值 */
  readonly newValue: unknown
  /** 差异类型 */
  readonly diffType: FieldDiffType
  /** 严重程度 */
  readonly severity: DiffSeverity
}

/** 记录差异 */
export interface RecordDiff {
  /** 主键（symbol） */
  readonly symbol: string
  /** 差异状态 */
  readonly status: RecordDiffStatus
  /** 现有数据快照 */
  readonly existingData?: Record<string, unknown>
  /** 新数据 */
  readonly newData?: Record<string, unknown>
  /** 字段级差异 */
  readonly fieldDiffs?: readonly FieldDiff[]
}

/** 字段差异统计 */
export interface FieldDiffStat {
  /** 字段名 */
  readonly fieldName: string
  /** 变化次数 */
  readonly changeCount: number
  /** 冲突次数 */
  readonly conflictCount: number
}

/** 差异分析结果 */
export interface DiffAnalysisResult {
  /** 比对摘要 */
  readonly summary: {
    readonly totalRecords: number
    readonly newRecords: number
    readonly modifiedRecords: number
    readonly unchangedRecords: number
    readonly deletedRecords: number
    readonly conflictRecords: number
  }
  /** 逐记录差异 */
  readonly recordDiffs: readonly RecordDiff[]
  /** 字段级差异统计 */
  readonly fieldStats: readonly FieldDiffStat[]
  /** 整体建议 */
  readonly recommendation: 'import-all' | 'import-new-only' | 'review-conflicts' | 'abort'
}

// ============================================================
// 哈希比对
// ============================================================

/** 哈希比对结果 */
export interface HashComparisonResult {
  /** 文件整体哈希 */
  readonly fileHash: string
  /** 上次导入的文件哈希 */
  readonly lastImportHash?: string
  /** 文件是否有变化 */
  readonly fileChanged: boolean
  /** 逐记录哈希 */
  readonly recordHashes: ReadonlyArray<{
    readonly symbol: string
    readonly existingHash: string
    readonly newHash: string
    readonly changed: boolean
  }>
  /** 变更记录的 symbol 列表 */
  readonly changedRecords: readonly string[]
}

// ============================================================
// 校对报告
// ============================================================

/** 校对报告 */
export interface FileImportProofreadReport {
  /** 元信息 */
  readonly meta: {
    readonly reportId: string
    readonly generatedAt: string
    readonly fileName: string
    readonly fileSize: number
    readonly fileHash: string
    readonly dataType: FileImportDataType
    readonly targetStore: StoreName
  }
  /** 校验结果 */
  readonly validation: FileValidationResult
  /** 差异分析 */
  readonly diff: DiffAnalysisResult
  /** 哈希比对 */
  readonly hashComparison: HashComparisonResult
  /** 冲突记录 */
  readonly conflicts: ReadonlyArray<{
    readonly symbol: string
    readonly fieldDiffs: ReadonlyArray<FieldDiff>
    readonly suggestedResolution: ConflictPolicy
    readonly autoResolved: boolean
  }>
  /** 采集历史关联 */
  readonly collectionHistoryRef?: {
    readonly lastAutoCollectAt: string
    readonly lastAutoCollectSource: string
    readonly dataAgeHours: number
  }
  /** 建议操作 */
  readonly recommendations: ReadonlyArray<{
    readonly action: string
    readonly target: string
    readonly reason: string
  }>
  /** 汇总 */
  readonly summary: {
    readonly overallStatus: 'pass' | 'warning' | 'failure'
    readonly totalFindings: number
    readonly criticalCount: number
    readonly warningCount: number
    readonly infoCount: number
    readonly estimatedImportTime: string
  }
}

// ============================================================
// 过期检测
// ============================================================

/** 过期维度 */
export interface StaleDimension {
  readonly symbol: string
  readonly dimensionCode: string
  readonly lastUpdatedAt: string | null
  readonly ageHours: number
  readonly thresholdHours: number
  readonly severity: 'fresh' | 'stale' | 'very-stale'
}

/** 过期检测结果 */
export interface StalenessCheckResult {
  readonly isStale: boolean
  readonly staleDimensions: readonly StaleDimension[]
  readonly recommendedAction: 'auto-collect' | 'file-import' | 'skip'
}

// ============================================================
// 调度配置
// ============================================================

/** 全局调度配置 */
export interface GlobalScheduleConfig {
  readonly scheduleId: string
  readonly symbols: readonly string[]
  readonly symbolPoolId?: string
  readonly dimensions: readonly string[]
  readonly strategyTemplate?: 'value' | 'growth' | 'defense' | 'cycle' | 'full'
  readonly frequency: UpdateFrequency
  readonly customCron?: string
  readonly sourceScope: {
    readonly enabled: readonly QuoteDataSourceId[]
    readonly fallbackChain: readonly QuoteDataSourceId[]
    readonly allowMockFallback: boolean
  }
  readonly conflictPolicy: ConflictPolicy
  readonly updateMode: UpdateMode
  readonly activeWindow?: {
    readonly start: string
    readonly end: string
    readonly weekdays: readonly number[]
  }
  enabled: boolean
  lastRunAt?: string
  nextRunAt?: string
  runCount: number
  consecutiveFailures: number
}

// ============================================================
// 历史记录
// ============================================================

/** 采集历史记录 */
export interface CollectionHistoryEntry {
  readonly id: string
  readonly timestamp: string
  readonly date: string
  readonly channel: CollectionChannel
  readonly collectionInfo: {
    readonly symbols: readonly string[]
    readonly dimensions: readonly string[]
    readonly dataSource?: QuoteDataSourceId
    readonly fileName?: string
    readonly fileHash?: string
  }
  readonly updateInfo: {
    readonly mode: UpdateMode
    readonly recordsAdded: number
    readonly recordsModified: number
    readonly recordsDeleted: number
    readonly recordsUnchanged: number
    readonly conflictsDetected: number
    readonly conflictsResolved: number
    readonly conflictPolicy?: ConflictPolicy
  }
  readonly qualityInfo: {
    readonly successRate: number
    readonly completeness: number
    readonly latency?: number
    readonly parseTime?: number
  }
  readonly proofreadInfo?: {
    readonly reportId: string
    readonly findings: number
    readonly criticalCount: number
    readonly warningCount: number
  }
  readonly status: 'success' | 'partial' | 'failed'
  readonly errorMessage?: string
}

// ============================================================
// 检索
// ============================================================

/** 检索条件 */
export interface SearchCriteria {
  readonly keyword?: string
  readonly dateRange?: {
    readonly start?: string
    readonly end?: string
    readonly preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom'
  }
  readonly fileTypes?: readonly string[]
  readonly channels?: readonly CollectionChannel[]
  readonly symbols?: readonly string[]
  readonly dimensions?: readonly string[]
  readonly dataSources?: readonly QuoteDataSourceId[]
  readonly statuses?: ReadonlyArray<'success' | 'partial' | 'failed'>
  readonly sortBy?: 'timestamp' | 'symbol' | 'channel' | 'status'
  readonly sortOrder?: 'asc' | 'desc'
  readonly page?: number
  readonly pageSize?: number
}

/** 检索结果项 */
export interface SearchItem {
  readonly source: 'collection-history' | 'local-doc' | 'code-file' | 'script-file'
  readonly id: string
  readonly timestamp: string
  readonly title: string
  readonly snippet: string
  readonly details: Record<string, unknown>
}

/** 检索结果 */
export interface SearchResult {
  readonly items: readonly SearchItem[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly facets: {
    readonly byChannel: Record<string, number>
    readonly byFileType: Record<string, number>
    readonly byStatus: Record<string, number>
    readonly byDimension: Record<string, number>
  }
}

// ============================================================
// 合并规则
// ============================================================

/** 合并策略 */
export type MergeStrategy = 'take-newer' | 'take-non-null' | 'take-higher-priority' | 'take-average' | 'manual'

/** 合并规则 */
export interface MergeRule {
  readonly fieldName: string
  readonly strategy: MergeStrategy
  /** 数据源优先级（索引越小优先级越高，支持业务数据源名） */
  readonly priority?: readonly string[]
}

/** 合并结果 */
export interface MergeResult {
  readonly merged: Record<string, unknown>
  readonly conflicts: readonly FieldDiff[]
}
