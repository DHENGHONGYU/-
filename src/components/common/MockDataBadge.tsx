/**
 * @module MockDataBadge
 * @description Mock 数据视觉标识组件（P0 修复 R03：Mock 数据 UI 层标识）
 *
 * 当数据来自 Mock 时，在数据展示处显示醒目的"模拟数据"标签。
 * 所有数据表格、卡片、KPI 组件应统一使用此组件。
 *
 * @doc V9-DOC-QUALITY-003
 */

import React from 'react'
import { cn } from '@/lib/utils'
import type { DataRecordMeta } from '@/types/data/DataRecordMeta'

/** MockDataBadge 属性 */
export interface MockDataBadgeProps {
  /** 数据记录元数据，为 null/undefined 时不显示 */
  meta?: DataRecordMeta | null

  /** 显示尺寸 */
  size?: 'small' | 'default'

  /** 自定义 CSS 类名 */
  className?: string
}

/** Mock 数据标签基础样式（使用主题 Token，消除硬编码颜色） */
const badgeBase = cn(
  'inline-flex items-center gap-[2px] px-[6px] py-[2px] rounded text-xs leading-[1.4] font-medium whitespace-nowrap select-none',
)

/** Mock 数据样式（警告色） */
const mockBadge = cn(
  badgeBase,
  'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.3)]',
)

/** 降级数据样式（与 Mock 相同警告色） */
const degradedBadge = cn(
  badgeBase,
  'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.3)]',
)

/**
 * MockDataBadge 组件
 *
 * 使用示例：
 * ```tsx
 * <MockDataBadge meta={record.__meta} />
 * <MockDataBadge meta={record.__meta} size="small" />
 * ```
 */
export function MockDataBadge({ meta, size = 'default', className }: MockDataBadgeProps): React.ReactElement | null {
  if (!meta) return null

  const isSmall = size === 'small'

  // Mock 数据
  if (meta.isMock || meta.reliability === 'mock') {
    return (
      <span
        className={cn(mockBadge, isSmall && 'text-[10px] px-1 py-px', className)}
        title={meta.mockReason ? `原因: ${meta.mockReason}` : '模拟数据'}
      >
        {isSmall ? '⚠' : '⚠ 模拟数据'}
      </span>
    )
  }

  // 降级数据
  if (meta.reliability === 'degraded') {
    return (
      <span
        className={cn(degradedBadge, isSmall && 'text-[10px] px-1 py-px', className)}
        title="数据来源降级，可能不完整"
      >
        {isSmall ? '↓' : '↓ 降级数据'}
      </span>
    )
  }

  // 真实数据不显示标识（默认行为）
  return null
}

/**
 * 数据来源列渲染函数（用于表格列定义）
 *
 * 使用示例：
 * ```tsx
 * const columns = [
 *   { key: 'dataSource', title: '数据来源', render: renderDataSourceColumn }
 * ]
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export function renderDataSourceColumn(record: Record<string, unknown>): React.ReactElement {
  const meta = record.__meta as DataRecordMeta | undefined
  return <MockDataBadge meta={meta} size="small" />
}

/**
 * 批量检查数据中是否包含 Mock 数据
 */
// eslint-disable-next-line react-refresh/only-export-components
export function hasMockData(records: Array<Record<string, unknown>>): boolean {
  return records.some((r) => {
    const meta = r.__meta as DataRecordMeta | undefined
    return meta?.isMock === true
  })
}