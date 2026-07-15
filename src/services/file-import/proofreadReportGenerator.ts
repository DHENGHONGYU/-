/**
 * @fileoverview 校对报告生成器
 *
 * 将文件校验、差异分析、哈希比对的结果汇总为结构化校对报告，
 * 支持 Markdown 格式输出，用于用户确认和归档。
 *
 * @module services/file-import/proofreadReportGenerator
 * @created 2026-07-14 - 双通道整改 P0-4
 */

import { getLogger } from '@/lib/logger'
import type { StoreName } from '@/config/dbConfig'
import type {
  DiffAnalysisResult,
  FileImportDataType,
  FileImportProofreadReport,
  FileValidationResult,
  HashComparisonResult,
  ConflictPolicy,
  FieldDiff,
} from '@/types/modules/data-sync.types'

const logger = getLogger()

/**
 * 生成唯一报告 ID
 * @returns 报告 ID（格式：proofread-{timestamp}-{random}）
 */
function generateReportId(): string {
  const now = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `proofread-${now}-${random}`
}

/**
 * 计算问题总数
 * @param diff - 差异分析结果
 * @returns 各严重度的问题数
 */
function countFindings(diff: DiffAnalysisResult): {
  totalFindings: number
  criticalCount: number
  warningCount: number
  infoCount: number
} {
  let criticalCount = 0
  let warningCount = 0
  let infoCount = 0

  for (const record of diff.recordDiffs) {
    if (!record.fieldDiffs) continue
    for (const field of record.fieldDiffs) {
      if (field.severity === 'critical') criticalCount++
      else if (field.severity === 'warning') warningCount++
      else infoCount++
    }
  }

  const totalFindings = criticalCount + warningCount + infoCount
  return { totalFindings, criticalCount, warningCount, infoCount }
}

/**
 * 评估整体状态
 * @param validation - 校验结果
 * @param diff - 差异分析
 * @returns 整体状态
 */
function assessOverallStatus(
  validation: FileValidationResult,
  diff: DiffAnalysisResult,
): 'pass' | 'warning' | 'failure' {
  if (!validation.valid) return 'failure'
  if (diff.recommendation === 'abort') return 'failure'
  if (diff.summary.conflictRecords > 0) return 'warning'
  return 'pass'
}

/**
 * 预估导入时间
 * @param totalRecords - 总记录数
 * @returns 预估时间描述
 */
function estimateImportTime(totalRecords: number): string {
  // 假设每条记录写入约 2ms
  const ms = totalRecords * 2
  if (ms < 1000) return `< 1 秒`
  if (ms < 60000) return `约 ${Math.ceil(ms / 1000)} 秒`
  return `约 ${Math.ceil(ms / 60000)} 分钟`
}

/**
 * 从差异分析中提取冲突记录
 * @param diff - 差异分析结果
 * @returns 冲突记录数组
 */
function extractConflicts(
  diff: DiffAnalysisResult,
): ReadonlyArray<{
  symbol: string
  fieldDiffs: readonly FieldDiff[]
  suggestedResolution: ConflictPolicy
  autoResolved: boolean
}> {
  return diff.recordDiffs
    .filter(r => r.status === 'conflict' && r.fieldDiffs && r.fieldDiffs.length > 0)
    .map(r => ({
      symbol: r.symbol,
      fieldDiffs: r.fieldDiffs!,
      suggestedResolution: 'ask-user',
      autoResolved: false,
    }))
}

/**
 * 生成建议操作列表
 * @param diff - 差异分析
 * @param validation - 校验结果
 * @returns 建议操作数组
 */
function generateRecommendations(
  diff: DiffAnalysisResult,
  validation: FileValidationResult,
): ReadonlyArray<{ action: string; target: string; reason: string }> {
  const recommendations: Array<{ action: string; target: string; reason: string }> = []

  if (!validation.valid) {
    recommendations.push({
      action: 'abort',
      target: 'all',
      reason: `文件校验失败：${validation.errors.length} 个错误`,
    })
    return recommendations
  }

  const { summary } = diff

  if (summary.newRecords > 0) {
    recommendations.push({
      action: 'import',
      target: `${summary.newRecords} 条新增记录`,
      reason: 'IndexedDB 中不存在的新记录',
    })
  }

  if (summary.modifiedRecords > 0) {
    recommendations.push({
      action: 'update',
      target: `${summary.modifiedRecords} 条修改记录`,
      reason: '字段值有变化，非关键字段',
    })
  }

  if (summary.conflictRecords > 0) {
    recommendations.push({
      action: 'review',
      target: `${summary.conflictRecords} 条冲突记录`,
      reason: '关键字段不一致，需人工确认',
    })
  }

  if (summary.unchangedRecords > 0) {
    recommendations.push({
      action: 'skip',
      target: `${summary.unchangedRecords} 条未变化记录`,
      reason: '数据完全相同，无需更新',
    })
  }

  if (summary.deletedRecords > 0) {
    recommendations.push({
      action: 'review',
      target: `${summary.deletedRecords} 条删除记录`,
      reason: 'IndexedDB 有但文件中没有，确认是否删除',
    })
  }

  return recommendations
}

// ============================================================
// 主生成入口
// ============================================================

/**
 * 生成校对报告
 *
 * 将校验、差异分析、哈希比对的结果汇总为结构化报告。
 *
 * @param validation - 文件校验结果
 * @param diff - 差异分析结果
 * @param hashComparison - 哈希比对结果
 * @param fileName - 文件名
 * @param fileSize - 文件大小
 * @param fileHash - 文件哈希
 * @param dataType - 数据类型
 * @param targetStore - 目标 store
 * @returns 校对报告
 *
 * @example
 * ```typescript
 * const report = generateProofreadReport(
 *   validationResult,
 *   diffResult,
 *   hashResult,
 *   'stocks.csv',
 *   1024,
 *   'abc123',
 *   'stocks',
 *   STORE_NAME.stocks,
 * )
 * ```
 */
export function generateProofreadReport(
  validation: FileValidationResult,
  diff: DiffAnalysisResult,
  hashComparison: HashComparisonResult,
  fileName: string,
  fileSize: number,
  fileHash: string,
  dataType: FileImportDataType,
  targetStore: StoreName,
): FileImportProofreadReport {
  const reportId = generateReportId()
  const generatedAt = new Date().toISOString()

  const findings = countFindings(diff)
  const overallStatus = assessOverallStatus(validation, diff)
  const conflicts = extractConflicts(diff)
  const recommendations = generateRecommendations(diff, validation)

  const report: FileImportProofreadReport = {
    meta: {
      reportId,
      generatedAt,
      fileName,
      fileSize,
      fileHash,
      dataType,
      targetStore,
    },
    validation,
    diff,
    hashComparison,
    conflicts,
    recommendations,
    summary: {
      overallStatus,
      totalFindings: findings.totalFindings,
      criticalCount: findings.criticalCount,
      warningCount: findings.warningCount,
      infoCount: findings.infoCount,
      estimatedImportTime: estimateImportTime(diff.summary.totalRecords),
    },
  }

  logger.info('[generateProofreadReport] 校对报告已生成', {
    reportId,
    fileName,
    overallStatus,
    totalFindings: findings.totalFindings,
    conflicts: conflicts.length,
  })

  return report
}

/**
 * 将校对报告渲染为 Markdown 格式
 * @param report - 校对报告
 * @returns Markdown 字符串
 */
export function renderReportAsMarkdown(report: FileImportProofreadReport): string {
  const lines: string[] = []
  const { meta, validation, diff, hashComparison, conflicts, recommendations, summary } = report

  lines.push('# 文件校对报告')
  lines.push('')

  // 文件信息
  lines.push('## 文件信息')
  lines.push(`- 文件名: ${meta.fileName}`)
  lines.push(`- 文件大小: ${(meta.fileSize / 1024).toFixed(2)} KB`)
  lines.push(`- 文件类型: ${meta.dataType}`)
  lines.push(`- 内容哈希: ${meta.fileHash}`)
  if (hashComparison.lastImportHash) {
    lines.push(`- 上次导入哈希: ${hashComparison.lastImportHash}（${hashComparison.fileChanged ? '已变化' : '无变化'}）`)
  }
  lines.push('')

  // 校验结果
  lines.push('## 校验结果')
  if (validation.valid) {
    lines.push(`- 扩展名: ✅ 通过`)
    lines.push(`- 文件大小: ✅ 通过（${(meta.fileSize / 1024).toFixed(2)} KB）`)
    lines.push(`- 编码: ${validation.metadata.encoding} ${validation.metadata.encoding === 'utf-8' ? '✅' : '⚠️'}`)
    if (validation.metadata.rowCount !== undefined) {
      lines.push(`- 行数: ${validation.metadata.rowCount} ✅`)
    }
  } else {
    for (const err of validation.errors) {
      lines.push(`- ❌ [${err.code}] ${err.message}`)
    }
  }
  for (const warn of validation.warnings) {
    lines.push(`- ⚠️ [${warn.code}] ${warn.message}`)
  }
  lines.push('')

  // 差异分析
  lines.push('## 差异分析')
  const s = diff.summary
  lines.push('| 状态 | 数量 |')
  lines.push('|------|------|')
  lines.push(`| 新增 | ${s.newRecords} |`)
  lines.push(`| 修改 | ${s.modifiedRecords} |`)
  lines.push(`| 未变化 | ${s.unchangedRecords} |`)
  lines.push(`| 冲突 | ${s.conflictRecords} |`)
  lines.push(`| 删除 | ${s.deletedRecords} |`)
  lines.push(`- **建议**: ${diff.recommendation}`)
  lines.push('')

  // 冲突详情
  if (conflicts.length > 0) {
    lines.push('## 冲突详情')
    for (const conflict of conflicts) {
      lines.push(`### ${conflict.symbol} — ${conflict.fieldDiffs.length} 处冲突`)
      lines.push('| 字段 | 现有值 | 文件值 | 严重度 |')
      lines.push('|------|--------|--------|--------|')
      for (const field of conflict.fieldDiffs) {
        const existingStr = field.existingValue === null
          ? 'null'
          : typeof field.existingValue === 'string' || typeof field.existingValue === 'number'
            ? String(field.existingValue)
            : '[object]'
        const newStr = field.newValue === null
          ? 'null'
          : typeof field.newValue === 'string' || typeof field.newValue === 'number'
            ? String(field.newValue)
            : '[object]'
        lines.push(`| ${field.fieldName} | ${existingStr} | ${newStr} | ${field.severity} |`)
      }
      lines.push('')
    }
  }

  // 建议操作
  if (recommendations.length > 0) {
    lines.push('## 建议操作')
    for (const rec of recommendations) {
      const icon = rec.action === 'import' ? '✅' : rec.action === 'review' ? '⚠️' : rec.action === 'skip' ? 'ℹ️' : '❌'
      lines.push(`${icon} ${rec.action} — ${rec.target}（${rec.reason}）`)
    }
    lines.push('')
  }

  // 汇总
  lines.push('## 汇总')
  lines.push(`- 整体状态: ${summary.overallStatus}`)
  lines.push(`- 问题总数: ${summary.totalFindings}`)
  lines.push(`- 严重: ${summary.criticalCount} / 警告: ${summary.warningCount} / 信息: ${summary.infoCount}`)
  lines.push(`- 预估导入时间: ${summary.estimatedImportTime}`)

  return lines.join('\n')
}
