/**
 * @fileoverview 控制舱 · 架构健康仪表盘 DTO Zod Schema（ControlHealthDash）
 *
 * 对应 TS 类型: {@link @/types/modules/health.types.ts → HealthMetric / HealthReport / HealthMetricStatus}
 * 设计原则: 1. HealthMetricStatus 4 值 enum 双射
 *         2. overallScore ∈ [0,100]（仪表盘主刻度，和 Lighthouse / 架构雷达对齐）
 *         3. value / baseline 必须 finite，status 严格匹配 enum（前端渲染颜色映射安全）
 *
 * 纯新增窄化扩展 (方案 A): 对 src/types/modules/health.types.ts 零侵入
 */

import { z } from 'zod'

// ---------- 1. enum 双射 ----------
export const Z_HEALTH_METRIC_STATUS = z.enum(['healthy', 'warning', 'critical', 'info'])

// ---------- 2. 子 schema ----------
export const Z_HEALTH_METRIC = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  value: z.number().finite(),
  baseline: z.number().finite().optional(),
  unit: z.string().min(0).max(8, '单位字符串不宜过长（≤ 8 字符，仪表盘 UI 对齐）'),
  status: Z_HEALTH_METRIC_STATUS,
  detail: z.string().optional(),
}).strict()

export const Z_HEALTH_REPORT = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  agentsVersion: z.string().regex(/^v?\d+\.\d+\.\d+(?:-[\w.]+)?$/, 'agentsVersion 必须 semver 合法（如 v2.0.0-rc.2）'),
  overallScore: z.number().finite().min(0, 'overallScore 必须 ≥ 0').max(100, 'overallScore 必须 ≤ 100'),
  metrics: z.array(Z_HEALTH_METRIC).min(3, '仪表盘至少 3 项指标（性能/质量/合规 最低配置）'),
}).strict()

// ---------- 3. 顶层 DTO: Control 仪表盘 ----------
export const Z_CATEGORY_KEY = z.enum(['performance', 'quality', 'compliance', 'security', 'architecture'])
export type CategoryKey = z.infer<typeof Z_CATEGORY_KEY>
export const Z_CATEGORIES_MAP = z.record(
  Z_CATEGORY_KEY,
  z.array(Z_HEALTH_METRIC).min(1, '每个分类至少 1 项指标'),
)
// 默认值: 5 类齐全（每类给最小 placeholder 指标）；factory 函数签名与重载 2 完全匹配，修复 TS2769
const DEFAULT_CATEGORIES: Record<CategoryKey, Array<z.infer<typeof Z_HEALTH_METRIC>>> = {
  performance: [{ name: 'fcp_p50', label: '首屏 FCP P50', value: 0, unit: 'ms', status: 'info', detail: 'placeholder-not-yet-scraped' }],
  quality:     [{ name: 'tsc_errors', label: 'TSC 类型错误', value: 0, unit: '项', status: 'info', detail: 'placeholder-not-yet-scraped' }],
  compliance:  [{ name: 'secrets_scan', label: '密钥泄露扫描', value: 0, unit: '项', status: 'info', detail: 'placeholder-not-yet-scraped' }],
  security:    [{ name: 'csp_policy', label: 'CSP 安全策略', value: 0, unit: '启用数', status: 'info', detail: 'placeholder-not-yet-scraped' }],
  architecture:[{ name: 'layer_violations', label: '分层违规', value: 0, unit: '项', status: 'info', detail: 'placeholder-not-yet-scraped' }],
}

export const Z_CONTROL_HEALTH_DASH_DTO = z.object({
  dashId: z.string().uuid(),
  refreshedAt: z.string().datetime({ offset: true }),
  refreshIntervalMs: z.number().int().finite().min(5000, '刷新间隔不得 < 5s（性能兜底，避免轮询爆 IndexedDB）').max(3600_000),
  /** 指标按 category 分组（前端渲染 Tab） */
  categories: Z_CATEGORIES_MAP.default(() => DEFAULT_CATEGORIES),
  /** 总报告：用于雷达图 */
  report: Z_HEALTH_REPORT,
  /** 历史得分时间轴（24 小时窗口） */
  timeline24h: z.array(z.object({ ts: z.number().int().finite().positive(), score: z.number().min(0).max(100) }))
    .max(288, '24h 以 5min 步长 = 288 点上限（渲染性能兜底）')
    .default([]),
}).strict()

// ---------- 4. TS 类型反推 ----------
export type HealthMetricZod = z.infer<typeof Z_HEALTH_METRIC>
export type HealthReportZod = z.infer<typeof Z_HEALTH_REPORT>
export type ControlHealthDashDto = z.infer<typeof Z_CONTROL_HEALTH_DASH_DTO>
