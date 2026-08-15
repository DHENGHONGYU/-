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

/** Mock 数据标签样式 */
const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '12px',
  lineHeight: '1.4',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  userSelect: 'none',
}

const mockStyle: React.CSSProperties = {
  ...badgeStyle,
  background: '#FFF3CD',
  color: '#856404',
  border: '1px solid #FFEEBA',
}

const degradedStyle: React.CSSProperties = {
  ...badgeStyle,
  background: '#FFF3CD',
  color: '#856404',
  border: '1px solid #FFEEBA',
}

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
        className={className}
        style={{
          ...mockStyle,
          ...(isSmall ? { fontSize: '10px', padding: '1px 4px' } : {}),
        }}
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
        className={className}
        style={{
          ...degradedStyle,
          ...(isSmall ? { fontSize: '10px', padding: '1px 4px' } : {}),
        }}
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