/**
 * @module FieldSelector
 * @description 维度字段多选器。
 *
 * 从 `FIELD_REGISTRY` 读取维度可用字段，以可点击 Badge 形式展示。
 */

import { Badge } from '@/components/ui/Badge'
import { FIELD_REGISTRY } from '@/config/collectConfig'
import type { CollectionFieldDef } from '@/types/modules/collection.types'

interface FieldSelectorProps {
  dimensionCode: string
  selected: string[]
  onChange: (fields: string[]) => void
  disabled?: boolean
}

/**
 * FieldSelector
 */
export default function FieldSelector({
  dimensionCode,
  selected,
  onChange,
  disabled = false,
}: FieldSelectorProps): React.JSX.Element {
  const fields: CollectionFieldDef[] = FIELD_REGISTRY[dimensionCode] ?? []

  const toggleField = (fieldId: string): void => {
    if (disabled) return
    const next = selected.includes(fieldId)
      ? selected.filter((id) => id !== fieldId)
      : [...selected, fieldId]
    onChange(next)
  }

  if (fields.length === 0) {
    return <p className="text-xs text-muted-foreground">该维度暂无字段配置</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((field) => {
        const active = selected.includes(field.id)
        return (
          <Badge
            key={field.id}
            variant={active ? 'default' : 'outline'}
            className={
              disabled
                ? 'pointer-events-none opacity-50 text-[10px]'
                : 'cursor-pointer text-[10px] hover:scale-105'
            }
            title={field.description}
            onClick={() => toggleField(field.id)}
          >
            {field.name}
          </Badge>
        )
      })}
    </div>
  )
}
