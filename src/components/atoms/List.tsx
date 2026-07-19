/**
 * List — 列表容器原子
 *
 * 提供有序/无序列表、分组、带图标/操作的列表项。
 * 支持 striped/dense 等变体。
 *
 * @module atoms/List
 * @since 2026-07-18 (P2 规划实现)
 */

import { type ReactNode, type HTMLAttributes } from 'react'

export interface ListItem {
  key: string
  content: ReactNode
  icon?: ReactNode
  action?: ReactNode
  description?: ReactNode
  disabled?: boolean
}

export interface ListProps extends Omit<HTMLAttributes<HTMLUListElement>, 'children'> {
  /** 列表项 */
  items: ListItem[]
  /** 是否紧凑模式 */
  dense?: boolean
  /** 是否斑马纹 */
  striped?: boolean
  /** 有序列表 */
  ordered?: boolean
}

/**
 * List
 */
export function List({
  items, dense = false, striped = false, ordered = false,
  className = '', ...rest
}: ListProps) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`divide-y ${className}`} {...rest}>
      {items.map((item, idx) => (
        <li
          key={item.key}
          className={`
            flex items-center gap-2
            ${dense ? 'px-2 py-1' : 'px-3 py-2'}
            ${striped && idx % 2 === 1 ? 'bg-muted/30' : ''}
            ${item.disabled ? 'cursor-not-allowed opacity-50' : ''}
          `}
        >
          {item.icon && <span className="flex-shrink-0 text-muted-foreground">{item.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm">{item.content}</div>
            {item.description && (
              <div className="text-xs text-muted-foreground">{item.description}</div>
            )}
          </div>
          {item.action && <span className="flex-shrink-0">{item.action}</span>}
        </li>
      ))}
    </Tag>
  )
}
