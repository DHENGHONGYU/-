/**
 * 分子组件统一导出入口
 *
 * 分子 = 2+ 原子组合，通用交互单元，仍与业务无关
 */

export { LoadingState } from './LoadingState'
export type { LoadingStateProps } from './LoadingState'

export { ErrorState } from './ErrorState'
export type { ErrorStateProps } from './ErrorState'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps, EmptyStateAction } from './EmptyState'

export {
  DataState,
  LoadingErrorState,
  LoadingEmptyState,
} from './DataState'
export type {
  DataStateProps,
  LoadingErrorStateProps,
  LoadingEmptyStateProps,
} from './DataState'

export { Alert, AlertTitle, AlertDescription } from './Alert'
export type { AlertProps, AlertTitleProps, AlertDescriptionProps } from './Alert'

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog'

export { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs'

export { FormField } from './FormField'
export type { FormFieldProps } from './FormField'

export { MetricCard } from './MetricCard'
export type { MetricCardProps } from './MetricCard'

export { SearchBar } from './SearchBar'
export type { SearchBarProps } from './SearchBar'

export { FilterChip } from './FilterChip'
export type { FilterChipProps } from './FilterChip'

// 行业分析组件（v2.9.5 新增）
export { SignalBadge } from './SignalBadge'
export type { SignalBadgeProps } from './SignalBadge'

export { ScoreGauge } from './ScoreGauge'
export type { ScoreGaugeProps } from './ScoreGauge'

export { TrendArrow } from './TrendArrow'
export type { TrendArrowProps } from './TrendArrow'

export { RankedCard } from './RankedCard'
export type { RankedCardProps } from './RankedCard'

export { DataQualityIndicator } from './DataQualityIndicator'
export type { DataQualityIndicatorProps } from './DataQualityIndicator'

// P3 交互状态组件（ErrorState 与 ./ErrorState 重名，不通过桶导出，需直引 @/components/molecules/states/Error）
export { Loading, Empty, Skeleton } from './states'
export type { LoadingProps, EmptyProps, SkeletonProps } from './states'
