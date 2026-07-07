/**
 * @module src/types/modules/doc-validation.types
 * @description 每日文档验证与更新流程类型定义
 *
 * 覆盖范围：
 * - 扫描文件元数据（文档、代码、测试、脚本、配置）
 * - 验证结果（完整性 / 一致性 / 正确性）
 * - 自动更新记录
 * - 结构化日志条目
 */

/** 验证结果状态 */
export type ValidationStatus = 'pass' | 'warning' | 'failure'

/** 文档/材料更新类型 */
export type UpdateType = 'added' | 'modified' | 'deleted' | 'format-converted' | 'unchanged'

/** 问题严重程度 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'

/** 材料分类 */
export type MaterialCategory =
  | 'doc'
  | 'code'
  | 'test'
  | 'script'
  | 'config'
  | 'executable'
  | 'other'

/** 验证维度 */
export type ValidationDimension = 'integrity' | 'consistency' | 'correctness'

/** 扫描到的单个文件记录 */
export interface ScannedFile {
  /** 文件绝对路径 */
  readonly absolutePath: string
  /** 相对仓库根目录的路径 */
  readonly relativePath: string
  /** 材料分类 */
  readonly category: MaterialCategory
  /** 更新类型 */
  readonly updateType: UpdateType
  /** 文件大小（字节） */
  readonly sizeBytes: number
  /** 最后修改时间（ISO 8601） */
  readonly lastModifiedAt: string
  /** 文件哈希（SHA-256）用于完整性校验 */
  readonly hash: string
}

/** 验证发现的问题 */
export interface ValidationFinding {
  /** 问题唯一标识 */
  readonly id: string
  /** 所属验证维度 */
  readonly dimension: ValidationDimension
  /** 严重程度 */
  readonly severity: SeverityLevel
  /** 验证结果状态 */
  readonly status: ValidationStatus
  /** 受影响文件路径 */
  readonly filePath: string
  /** 问题描述 */
  readonly message: string
  /** 建议修复措施 */
  readonly suggestion?: string
  /** 关联文件（如引用链） */
  readonly relatedFiles?: readonly string[]
}

/** 自动更新操作记录 */
export interface DocUpdateEntry {
  /** 更新唯一标识 */
  readonly id: string
  /** 精确时间戳（秒级 ISO 8601） */
  readonly timestamp: string
  /** 受影响文件完整路径 */
  readonly filePath: string
  /** 更新类型 */
  readonly updateType: Exclude<UpdateType, 'unchanged'>
  /** 更新原因 */
  readonly reason: string
  /** 同步的交叉引用列表 */
  readonly syncedRefs?: readonly string[]
}

/** 验证维度汇总 */
export interface DimensionSummary {
  /** 维度名称 */
  readonly dimension: ValidationDimension
  /** 扫描文件数 */
  readonly scannedCount: number
  /** 通过数 */
  readonly passCount: number
  /** 警告数 */
  readonly warningCount: number
  /** 失败数 */
  readonly failureCount: number
}

/** 每日文档验证报告 */
export interface DailyDocValidationReport {
  /** 报告元信息 */
  readonly meta: {
    /** 流程执行 ID */
    readonly runId: string
    /** 流程开始时间 */
    readonly startedAt: string
    /** 流程结束时间 */
    readonly finishedAt: string
    /** 仓库根目录 */
    readonly rootDir: string
    /** 扫描时间范围（起始） */
    readonly scanSince: string
    /** 扫描时间范围（结束） */
    readonly scanUntil: string
  }
  /** 扫描到的全部文件 */
  readonly scannedFiles: readonly ScannedFile[]
  /** 验证发现列表 */
  readonly findings: readonly ValidationFinding[]
  /** 自动更新记录 */
  readonly updates: readonly DocUpdateEntry[]
  /** 各维度汇总 */
  readonly dimensionSummaries: readonly DimensionSummary[]
  /** 总体汇总 */
  readonly summary: {
    /** 扫描文件总数 */
    readonly totalFiles: number
    /** 新增文件数 */
    readonly addedCount: number
    /** 修改文件数 */
    readonly modifiedCount: number
    /** 删除文件数 */
    readonly deletedCount: number
    /** 发现问题总数 */
    readonly totalFindings: number
    /** 自动更新操作数 */
    readonly totalUpdates: number
    /** 最终状态 */
    readonly overallStatus: ValidationStatus
  }
}

/** 每日验证流程配置 */
export interface DailyValidationConfig {
  /** 仓库根目录 */
  readonly rootDir: string
  /** 扫描时间范围（毫秒时间戳） */
  readonly scanSince: number
  /** 扫描时间范围（毫秒时间戳） */
  readonly scanUntil: number
  /** 是否执行自动更新 */
  readonly autoUpdate: boolean
  /** 最大重试次数 */
  readonly maxRetries: number
  /** 并发限制（资源占用控制） */
  readonly concurrency: number
  /** 输出目录 */
  readonly outputDir: string
}

/** 子验证器结果 */
export interface SubValidatorResult {
  /** 验证器名称 */
  readonly name: string
  /** 发现的问题 */
  readonly findings: readonly ValidationFinding[]
  /** 该验证器扫描的文件数 */
  readonly scannedCount: number
}
