import { cn } from '@/lib/utils'
import { Badge } from '@/components/atoms'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

export interface DataQualityIndicatorProps {
  completeness: number
  sampleCount: number
  sampleAdequacy?: 'sufficient' | 'warning' | 'insufficient'
  className?: string
}

const getQualityStatus = (completeness: number): {
  label: string
  color: string
  textColor: string
  icon: typeof CheckCircle
} => {
  if (completeness >= 0.7) {
    return {
      label: '数据充足',
      color: COLOR_TOKENS.success.bgClass,
      textColor: 'text-success-foreground',
      icon: CheckCircle,
    }
  }
  if (completeness >= 0.4) {
    return {
      label: '数据一般',
      color: COLOR_TOKENS.warning.bgClass,
      textColor: 'text-warning-foreground',
      icon: AlertCircle,
    }
  }
  return {
    label: '数据不足',
    color: COLOR_TOKENS.danger.bgClass,
    textColor: 'text-destructive-foreground',
    icon: XCircle,
  }
}

const getSampleStatus = (
  sampleAdequacy?: DataQualityIndicatorProps['sampleAdequacy'],
): {
  label: string
  color: string
} => {
  switch (sampleAdequacy) {
    case 'sufficient':
      return { label: '样本充足', color: 'text-success' }
    case 'warning':
      return { label: '样本偏少', color: 'text-warning' }
    case 'insufficient':
      return { label: '样本不足', color: 'text-destructive' }
    default:
      return { label: '', color: '' }
  }
}

/**
 * DataQualityIndicator
 */
export function DataQualityIndicator({
  completeness,
  sampleCount,
  sampleAdequacy,
  className,
}: DataQualityIndicatorProps) {
  const quality = getQualityStatus(completeness)
  const sample = getSampleStatus(sampleAdequacy)
  const Icon = quality.icon
  const percentage = Math.round(completeness * 100)

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', quality.textColor)} />
        <Badge
          variant="default"
          className={cn(quality.color, quality.textColor, 'text-xs')}
        >
          {quality.label}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">完整度:</span>
        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', quality.color)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs font-medium">{percentage}%</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-muted">样本:</span>
        <span className="text-xs font-medium">{sampleCount}</span>
        {sample.label && (
          <span className={cn('text-xs', sample.color)}>{sample.label}</span>
        )}
      </div>
    </div>
  )
}

export default DataQualityIndicator
