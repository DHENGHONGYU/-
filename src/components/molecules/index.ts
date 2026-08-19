/**
 * 分子组件统一导出入口
 *
 * 分子 = 2+ 原子组合，通用交互单元，仍与业务无关
  * @doc [V9-DOC-FRONT-046]
*/

export { LoadingState } from './LoadingState'
export type { LoadingStateProps } from './LoadingState'

export type { ErrorStateProps } from './states/ErrorState'
export { ErrorState } from './ErrorState'

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


export { MetricCard } from './MetricCard'
export type { MetricCardProps } from './MetricCard'


export { DataQualityIndicator } from './DataQualityIndicator'
export type { DataQualityIndicatorProps } from './DataQualityIndicator'

export { CapitalAllocationPanel } from './CapitalAllocationPanel'
export type { CapitalAllocationPanelProps } from './CapitalAllocationPanel'

export { OnboardingGuide } from './OnboardingGuide'
// 注：OnboardingGuideProps 为源文件内部接口，暂不对外 barrel 导出


// 行业分析组件（v2.9.5 新增）
export { SignalBadge } from './SignalBadge'
export type { SignalBadgeProps } from './SignalBadge'

export { ScoreGauge } from './ScoreGauge'
export type { ScoreGaugeProps } from './ScoreGauge'

export { TrendArrow } from './TrendArrow'
export type { TrendArrowProps } from './TrendArrow'

export { RankedCard } from './RankedCard'
export type { RankedCardProps } from './RankedCard'


// P3 交互状态组件
export { Loading, Empty, Skeleton } from './states'
export type { LoadingProps, EmptyProps, SkeletonProps } from './states'

// 资金管理与双因子评估组件（v9 资金管理双轨框架）

export {
  DualFactorEvaluationPanel,
  evaluateDualFactor,
  scoreToIndustryRating,
} from './DualFactorEvaluationPanel'
export type {
  DualFactorEvaluationPanelProps,
  DualFactorResult,
  TechnicalSignal,
  IndustryRating,
} from './DualFactorEvaluationPanel'
