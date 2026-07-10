import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/atoms'

export interface FilterChipProps {
  /** 显示文本 */
  label: string
  /** 关闭回调 */
  onRemove?: () => void
  /** 是否可关闭 */
  removable?: boolean
  /** 容器 className */
  className?: string
}

/**
 * 筛选标签分子
 *
 * 组合：Badge + 关闭按钮
 */
export function FilterChip({
  label,
  onRemove,
  removable = true,
  className,
}: FilterChipProps) {
  return (
    <Badge
      variant="secondary"
      className={cn('inline-flex items-center gap-1 pr-1.5', className)}
    >
      <span>{label}</span>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 hover:bg-muted"
          aria-label={`移除 ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  )
}
