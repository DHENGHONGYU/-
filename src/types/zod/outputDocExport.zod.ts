/**
 * @fileoverview 输出舱 · 文档导出 DTO Zod Schema（OutputDocExport）
 *
 * 对应 TS 类型: {@link @/types/modules/doc-validation.types.ts → DailyDocValidationReport / QualityScores / QualityGate / QualitySnapshot / DocMeta}
 * 设计原则: 1. SeverityLevel 与 ValidationDimension 使用 z.enum 双射
 *         2. 质量分数 QualityScores ∈ [0, 100] 4 维度 + overall
 *         3. DocUpdateEntry 使用 ISO datetime（已 datetime({offset:true}) 验证）
 *
 * 纯新增窄化扩展 (方案 A): 对 src/types/modules/doc-validation.types.ts 零侵入
 */

import { z } from 'zod'

// ---------- 1. enum 双射 ----------
export const Z_VALIDATION_STATUS = z.enum(['pass', 'warning', 'failure'])
export const Z_UPDATE_TYPE = z.enum(['added', 'modified', 'deleted', 'format-converted', 'unchanged', 'missing'])
export const Z_SEVERITY_LEVEL = z.enum(['critical', 'high', 'medium', 'low'])
export const Z_MATERIAL_CATEGORY = z.enum([
  'core-concept', 'architecture', 'release-process', 'feature-doc', 'api-spec',
  'test-report', 'design-record', 'operation-runbook', 'compliance', 'misc',
])
export const Z_VALIDATION_DIMENSION = z.enum(['integrity', 'consistency', 'correctness', 'crossref'])

// ---------- 2. 原子类型 ----------
const Z_SCORE_0_100 = z.number().finite().min(0).max(100)
const Z_ISO_DATETIME = z.string().datetime({ offset: true })
const Z_ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// ---------- 3. 嵌套 sub-schema ----------
export const Z_SCANNED_FILE = z.object({
  path: z.string().min(1, '文件路径必填（相对仓库根）'),
  size: z.number().int().finite().nonnegative(),
  sha256: z.string().length(64, 'sha256 必须为 64 hex 字符').optional(),
  lastModified: Z_ISO_DATETIME,
  category: Z_MATERIAL_CATEGORY,
  lastAuthor: z.string().min(1).optional(),
}).strict()

export const Z_VALIDATION_FINDING = z.object({
  id: z.string().min(8),
  severity: Z_SEVERITY_LEVEL,
  dimension: Z_VALIDATION_DIMENSION,
  title: z.string().min(1),
  detail: z.string(),
  file: z.string().min(1),
  line: z.number().int().finite().positive().optional(),
  suggestion: z.string().optional(),
}).strict()

export const Z_DOC_UPDATE_ENTRY = z.object({
  date: Z_ISO_DATE,
  files: z.array(z.string().min(1)),
  type: Z_UPDATE_TYPE,
  author: z.string().min(1),
  summary: z.string().max(280, '变更摘要 ≤ 280 字（微博长度）'),
}).strict()

export const Z_DIMENSION_SUMMARY = z.object({
  dimension: Z_VALIDATION_DIMENSION,
  total: z.number().int().finite().nonnegative(),
  passed: z.number().int().finite().nonnegative(),
  warnings: z.number().int().finite().nonnegative(),
  failures: z.number().int().finite().nonnegative(),
}).strict()

export const Z_DOC_META = z.object({
  docId: z.string().min(4).max(64),
  title: z.string().min(1),
  version: z.string().regex(/^v?\d+\.\d+\.\d+(?:-[\w.]+)?$/, '版本号 semver 格式，例 v2.0.0-rc.2'),
  lastUpdated: Z_ISO_DATETIME,
  author: z.string().min(1),
  reviewers: z.array(z.string().min(1)).default([]),
  coversDocs: z.array(z.string().min(1)).default([]),
  coversCode: z.array(z.string().min(1)).default([]),
  relatedDocs: z.array(z.string().min(1)).default([]),
}).strict()

export const Z_QUALITY_SCORES = z.object({
  overall: Z_SCORE_0_100,
  integrity: Z_SCORE_0_100,
  consistency: Z_SCORE_0_100,
  correctness: Z_SCORE_0_100,
  crossref: Z_SCORE_0_100,
}).strict()

export const Z_CONTRACT_MISMATCH = z.object({
  location: z.string().min(1),
  expectedType: z.string().min(1),
  actualType: z.string().min(1),
  fixSuggestion: z.string().optional(),
}).strict()

export const Z_QUALITY_ISSUES = z.object({
  critical: z.array(Z_VALIDATION_FINDING),
  high: z.array(Z_VALIDATION_FINDING),
  medium: z.array(Z_VALIDATION_FINDING),
  low: z.array(Z_VALIDATION_FINDING),
}).strict()

export const Z_QUALITY_SNAPSHOT = z.object({
  capturedAt: Z_ISO_DATETIME,
  scores: Z_QUALITY_SCORES,
  issuesSummary: Z_QUALITY_ISSUES,
}).strict()

export const Z_QUALITY_GATE = z.object({
  status: Z_VALIDATION_STATUS,
  passed: z.boolean(),
  threshold: Z_SCORE_0_100.default(80),
  actual: Z_SCORE_0_100,
  blockingReasons: z.array(z.string().min(1)).default([]),
}).strict()

// ---------- 4. 核心 DailyDocValidationReport ----------
export const Z_DAILY_DOC_VALIDATION_REPORT = z.object({
  reportId: z.string().uuid(),
  reportDate: Z_ISO_DATE,
  generatedAt: Z_ISO_DATETIME,
  generatedBy: z.string().min(1),
  scannedFiles: z.array(Z_SCANNED_FILE),
  findings: z.array(Z_VALIDATION_FINDING),
  updates: z.array(Z_DOC_UPDATE_ENTRY),
  dimensionSummaries: z.array(Z_DIMENSION_SUMMARY).length(4), // 4 维度必须齐全
  meta: Z_DOC_META.nullable().optional(),
  contracts: z.array(Z_CONTRACT_MISMATCH).default([]),
  qualitySnapshot: Z_QUALITY_SNAPSHOT,
  qualityGate: Z_QUALITY_GATE,
}).strict()

// ---------- 5. 顶层 DTO: Output 文档导出 ----------
export const Z_OUTPUT_DOC_EXPORT_DTO = z.object({
  exportId: z.string().uuid(),
  exportedAt: Z_ISO_DATETIME,
  format: z.enum(['mdx', 'docx', 'pdf', 'json', 'html']),
  filename: z.string().regex(/^[\w\-. ]+\.(mdx|docx|pdf|json|html)$/i, 'filename.ext 必选（合法扩展名）'),
  size: z.number().int().finite().nonnegative(),
  /** 嵌入完整报告（输出舱 DataBridge 层 validateWithSchema 守卫调用） */
  report: Z_DAILY_DOC_VALIDATION_REPORT,
  signers: z.array(z.object({ role: z.string().min(2), name: z.string().min(1), signedAt: Z_ISO_DATETIME })).default([]),
}).strict()

// ---------- 6. TS 类型反推 ----------
export type ScannedFileZod = z.infer<typeof Z_SCANNED_FILE>
export type ValidationFindingZod = z.infer<typeof Z_VALIDATION_FINDING>
export type DocUpdateEntryZod = z.infer<typeof Z_DOC_UPDATE_ENTRY>
export type DimensionSummaryZod = z.infer<typeof Z_DIMENSION_SUMMARY>
export type DocMetaZod = z.infer<typeof Z_DOC_META>
export type QualityScoresZod = z.infer<typeof Z_QUALITY_SCORES>
export type QualitySnapshotZod = z.infer<typeof Z_QUALITY_SNAPSHOT>
export type QualityGateZod = z.infer<typeof Z_QUALITY_GATE>
export type DailyDocValidationReportZod = z.infer<typeof Z_DAILY_DOC_VALIDATION_REPORT>
export type OutputDocExportDto = z.infer<typeof Z_OUTPUT_DOC_EXPORT_DTO>
