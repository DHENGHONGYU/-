import React from 'react'
import { Badge } from '@/components/atoms/Badge'
import { twText, COLOR_SHADES } from '@/constants/theme.tokens'
import type { StockDataQuality } from '@/data/types'

export interface QualityIndicatorProps {
  quality?: StockDataQuality
  size?: 'sm' | 'xs'
}

/**
 * QualityIndicator
 * @param size
 */
export function QualityIndicator({ quality, size = 'xs' }: QualityIndicatorProps): React.JSX.Element {
  const items = [
    { key: 'basic', label: '基础', ok: quality?.basic },
    { key: 'kline', label: '行情', ok: quality?.kline },
    { key: 'finance', label: '财务', ok: quality?.finance },
  ] as const

  const sizeClass = size === 'xs' ? 'h-4 px-1 text-[10px]' : 'h-5 px-1.5 text-xs'

  return (
    <div className="flex flex-wrap gap-1" aria-label="数据质量指示">
      {items.map(({ key, label, ok }) =>
        ok ? (
          <Badge
            key={key}
            className={`${sizeClass} ${twText('green', 400)}`}
            style={{ backgroundColor: `${COLOR_SHADES.green.hex[500]}33` }}
            title={`${label}数据已采集`}
          >
            {label}✓
          </Badge>
        ) : (
          <Badge
            key={key}
            variant="outline"
            className={`${sizeClass} text-muted-foreground`}
            title={`${label}数据缺失`}
          >
            {label}—
          </Badge>
        ),
      )}
    </div>
  )
}
