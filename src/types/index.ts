/**
 * UI 层类型门面（barrel）
 *
 * 使 pages/apps/components 通过 `@/types` 获取领域实体类型，
 * 避免 UI 层直接依赖 data 层（@/data/types）。数据层实体类型的权威源
 * 仍位于 @/data/types，本文件仅做 re-export，不新增类型定义。
 *
 * - P2-01/02/03 整改：UI 层 type-only import 由 @/data/types/* 迁移至 @/types
 * - 覆盖主 barrel + 页面实际使用但主 barrel 未转发的子模块类型（见下方补充分组）
 */
export * from '@/data/types'

// 主 barrel 未 re-export、但 UI 层实际使用的领域实体补充分组
export type { ScreenSource } from '@/data/types/types.stock'
export type {
  TrendDirection,
  TrendStrength,
  RotationSignalType,
  IndustryV4AnalysisEnhanced,
  IndustryRotationSignal,
} from '@/data/types/types.sector'