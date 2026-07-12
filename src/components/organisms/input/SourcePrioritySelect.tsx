/**
 * @module SourcePrioritySelect
 * @description 数据源优先级配置组件。
 *
 * 用 Select 为每个数据源指定 1~N 级优先级，并提供启用开关。
 */

import { useMemo } from 'react'
import { Select, SelectItem } from '@/components/atoms/Select'
import { Switch } from '@/components/atoms/Switch'
import { DATA_SOURCE_ENDPOINTS } from '@/config/dataSourceRegistry'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type {
  QuoteDataSourceId,
  SourcePriorityItem,
} from '@/types/modules/collection.types'

interface SourcePrioritySelectProps {
  value: SourcePriorityItem[]
  onChange: (items: SourcePriorityItem[]) => void
  disabled?: boolean
}

/**
 * SourcePrioritySelect
 */
export default function SourcePrioritySelect({
  value,
  onChange,
  disabled = false,
}: SourcePrioritySelectProps): React.JSX.Element {
  const endpoints = DATA_SOURCE_ENDPOINTS
  const maxPriority = endpoints.length

  const valueMap = useMemo(() => {
    const map = new Map<QuoteDataSourceId, SourcePriorityItem>()
    for (const item of value) {
      map.set(item.id, item)
    }
    return map
  }, [value])

  const handleToggle = (id: QuoteDataSourceId, enabled: boolean): void => {
    const existing = valueMap.get(id)
    if (existing) {
      onChange(value.map((item) => (item.id === id ? { ...item, enabled } : item)))
      return
    }
    const nextPriority = Math.max(1, ...value.map((item) => item.priority)) + 1
    onChange([...value, { id, priority: nextPriority, enabled }])
  }

  const handlePriorityChange = (id: QuoteDataSourceId, priority: number): void => {
    const existing = valueMap.get(id)
    if (!existing) return

    const others = value.filter((item) => item.id !== id)
    const conflict = others.find((item) => item.priority === priority)
    if (conflict) {
      // 交换优先级
      onChange(
        others
          .map((item) =>
            item.id === conflict.id ? { ...item, priority: existing.priority } : item,
          )
          .concat({ ...existing, priority })
          .sort((a, b) => a.priority - b.priority),
      )
      return
    }

    onChange(
      value
        .map((item) => (item.id === id ? { ...item, priority } : item))
        .sort((a, b) => a.priority - b.priority),
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">数字越小优先级越高</p>
      {endpoints.map((endpoint) => {
        const item = valueMap.get(endpoint.id)
        const enabled = item?.enabled ?? false
        const priority = item?.priority ?? 1
        return (
          <div
            key={endpoint.id}
            className="flex items-center justify-between rounded-md border px-2 py-1.5"
          >
            <div className="flex items-center gap-2">
              <Switch
                checked={enabled}
                disabled={disabled}
                onChange={() => handleToggle(endpoint.id, !enabled)}
              />
              <div>
                <p className="text-xs font-medium">{endpoint.name}</p>
                <p className="text-[10px] text-muted-foreground">{endpoint.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">优先级</span>
              <Select
                value={String(priority)}
                disabled={disabled || !enabled}
                onValueChange={(v) => handlePriorityChange(endpoint.id, Number(v))}
                className="h-7 w-16 text-xs"
              >
                {Array.from({ length: maxPriority }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>
        )
      })}
      {value.filter((item) => item.enabled).length === 0 && (
        <p className="text-xs" style={{ color: COLOR_TOKENS.warning.hex }}>
          至少需要启用一个数据源
        </p>
      )}
    </div>
  )
}
