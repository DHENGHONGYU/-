/**
 * SignalQualityTrendChart - 信号质量趋势图（准确率 + 胜率双折线）
 *
 * 基于 LineChart 通用组件封装，展示信号准确率与胜率随累计信号数变化的趋势。
 * 数据由父组件通过派生查询 `accuracyTrend(N)` 和 `winRateTrend(N)` 获取后传入，
 * 本组件只负责数据合并、格式化与渲染，不直接调用派生查询（保持单向数据流）。
 *
 * @example
 * ```tsx
 * const reviews = useSignalQualityStore(s => s.reviews)
 * const accuracyData = useMemo(() => accuracyTrend(20), [reviews])
 * const winRateData = useMemo(() => winRateTrend(20), [reviews])
 *
 * <SignalQualityTrendChart
 *   accuracyTrendData={accuracyData}
 *   winRateTrendData={winRateData}
 *   loading={loading}
 *   error={error}
 *   onRetry={() => loadReviews()}
 * />
 * ```
 */

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DataState } from '@/components/ui/DataState'
import { LineChart } from '@/components/chart/LineChart'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 准确率趋势数据点（来自 accuracyTrend 派生查询） */
export interface AccuracyTrendPoint {
  /** 累计已实现信号数 */
  period: number
  /** 准确率（0-1） */
  accuracy: number
}

/** 胜率趋势数据点（来自 winRateTrend 派生查询） */
export interface WinRateTrendPoint {
  /** 累计已实现信号数 */
  period: number
  /** 胜率（0-1） */
  winRate: number
}

/** 合并后的趋势数据点（供 LineChart 渲染） */
interface MergedTrendPoint {
  /** X 轴标签（累计 N 条信号） */
  period: string
  /** 准确率（0-1），可能为 null（该周期无已实现信号） */
  accuracy: number | null
  /** 胜率（0-1），可能为 null（该周期无 pnlPercent 数据） */
  winRate: number | null
}

export interface SignalQualityTrendChartProps {
  /** 准确率趋势数据（来自 accuracyTrend 派生查询） */
  accuracyTrendData: AccuracyTrendPoint[]
  /** 胜率趋势数据（来自 winRateTrend 派生查询） */
  winRateTrendData: WinRateTrendPoint[]
  /** 滚动窗口大小（仅用于显示标签，默认 20） */
  windowSize?: number
  /** 图表高度，默认 240 */
  height?: number
  /** 加载状态 */
  loading?: boolean
  /** 错误信息 */
  error?: string | null
  /** 重试回调 */
  onRetry?: () => void
  /** 自定义 className */
  className?: string
}

// ============================================================
// 常量定义
// ============================================================

/** 默认图表高度（px） */
const DEFAULT_TREND_CHART_HEIGHT = 240

/** 准确率阈值：≥0.7 视为良好（绿色） */
const ACCURACY_GOOD_THRESHOLD = 0.7
/** 准确率阈值：0.5-0.7 视为警告（黄色） */
const ACCURACY_WARN_THRESHOLD = 0.5

/** 胜率阈值：≥0.6 视为良好（绿色） */
const WIN_RATE_GOOD_THRESHOLD = 0.6
/** 胜率阈值：0.4-0.6 视为警告（黄色） */
const WIN_RATE_WARN_THRESHOLD = 0.4

// ============================================================
// 辅助函数
// ============================================================

/**
 * 合并 accuracyTrend 与 winRateTrend 数据为统一格式
 *
 * @remarks
 * 两个派生查询返回的 period 相同（均为 i + windowSize），
 * 但长度可能不同（accuracyTrend 过滤 r.correct !== undefined，
 * winRateTrend 过滤 r.pnlPercent !== undefined）。
 * 使用 period 作为合并键，缺失值填充为 null（LineChart 会断开折线）。
 */
function mergeTrendData(
  accuracy: AccuracyTrendPoint[],
  winRate: WinRateTrendPoint[],
): MergedTrendPoint[] {
  const periodSet = new Set<number>([
    ...accuracy.map((p) => p.period),
    ...winRate.map((p) => p.period),
  ])
  const accuracyMap = new Map(accuracy.map((p) => [p.period, p.accuracy]))
  const winRateMap = new Map(winRate.map((p) => [p.period, p.winRate]))

  return Array.from(periodSet)
    .sort((a, b) => a - b)
    .map((period) => ({
      period: `${period}`,
      accuracy: accuracyMap.has(period) ? (accuracyMap.get(period) as number) : null,
      winRate: winRateMap.has(period) ? (winRateMap.get(period) as number) : null,
    }))
}

/** 格式化百分比（0-1 → "65.0%"） */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * 计算波动幅度（最大值 - 最小值）
 * 用于在图表标题处显示，便于用户快速评估信号质量稳定性
 */
function computeVolatility(values: Array<number | null>): number {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2) return 0
  return Number((Math.max(...valid) - Math.min(...valid)).toFixed(2))
}

// ============================================================
// 组件实现
// ============================================================

/**
 * SignalQualityTrendChart 信号质量趋势图
 *
 * 设计原则：
 * - 数据源由父组件传入，保持单向数据流
 * - 准确率折线使用 CHART_PALETTE.series1（蓝色，信息语义）
 * - 胜率折线使用 CHART_PALETTE.series3（琥珀色，警告语义）
 * - Y 轴域限定为 [0, 1]，避免视觉误导
 * - 缺失值显示为 null（折线断开），保留数据真实性
 * - 通过 DataState 统一处理 loading/error/empty 三态
/**
 * SignalQualityTrendChart
 */
export const SignalQualityTrendChart = memo(function SignalQualityTrendChart({
  accuracyTrendData,
  winRateTrendData,
  windowSize = 20,
  height = DEFAULT_TREND_CHART_HEIGHT,
  loading = false,
  error = null,
  onRetry,
  className,
}: SignalQualityTrendChartProps) {
  // 合并数据并计算统计指标
  const mergedData = useMemo(
    () => mergeTrendData(accuracyTrendData, winRateTrendData),
    [accuracyTrendData, winRateTrendData],
  )

  const latestAccuracy = useMemo(() => {
    for (let i = mergedData.length - 1; i >= 0; i--) {
      const accuracy = mergedData[i]!.accuracy
      if (accuracy !== null) {
        return accuracy
      }
    }
    return null
  }, [mergedData])

  const latestWinRate = useMemo(() => {
    for (let i = mergedData.length - 1; i >= 0; i--) {
      const winRate = mergedData[i]!.winRate
      if (winRate !== null) {
        return winRate
      }
    }
    return null
  }, [mergedData])

  const accuracyVolatility = useMemo(
    () => computeVolatility(mergedData.map((p) => p.accuracy)),
    [mergedData],
  )

  const isEmpty = !loading && error === null && mergedData.length === 0

  // 渲染统计徽章的颜色映射
  const accuracyBadgeClass =
    latestAccuracy !== null && latestAccuracy >= ACCURACY_GOOD_THRESHOLD
      ? COLOR_TOKENS.success.tailwind
      : latestAccuracy !== null && latestAccuracy >= ACCURACY_WARN_THRESHOLD
        ? COLOR_TOKENS.warning.tailwind
        : COLOR_TOKENS.danger.tailwind

  const winRateBadgeClass =
    latestWinRate !== null && latestWinRate >= WIN_RATE_GOOD_THRESHOLD
      ? COLOR_TOKENS.success.tailwind
      : latestWinRate !== null && latestWinRate >= WIN_RATE_WARN_THRESHOLD
        ? COLOR_TOKENS.warning.tailwind
        : COLOR_TOKENS.danger.tailwind

  logger.info('[SignalQualityTrendChart] 渲染', {
    points: mergedData.length,
    latestAccuracy,
    latestWinRate,
    accuracyVolatility,
  })

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">信号质量趋势</CardTitle>
        <div className="flex items-center gap-2">
          {latestAccuracy !== null && (
            <Badge variant="outline" className={cn('text-xs', accuracyBadgeClass)}>
              准确率 {formatPercent(latestAccuracy)}
            </Badge>
          )}
          {latestWinRate !== null && (
            <Badge variant="outline" className={cn('text-xs', winRateBadgeClass)}>
              胜率 {formatPercent(latestWinRate)}
            </Badge>
          )}
          {accuracyVolatility > 0 && (
            <Badge variant="outline" className="text-xs">
              波动 ±{(accuracyVolatility * 100).toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <DataState
          isLoading={loading}
          isError={error !== null && error.length > 0}
          isEmpty={isEmpty}
          data={mergedData}
          loadingProps={{ message: '加载趋势数据中...' }}
          errorProps={{ error: error ?? '加载失败', onRetry, showErrorDetail: true }}
          emptyProps={{
            title: '暂无趋势数据',
            description: `需要至少 ${windowSize} 条已实现复盘记录才会生成首个统计周期`,
          }}
        >
          <LineChart
            data={mergedData as unknown as Array<Record<string, unknown>>}
            xKey="period"
            lines={[
              {
                dataKey: 'accuracy',
                name: '准确率',
                color: CHART_PALETTE.series1,
                strokeWidth: 2,
              },
              {
                dataKey: 'winRate',
                name: '胜率',
                color: CHART_PALETTE.series3,
                strokeWidth: 2,
              },
            ]}
            height={height}
            yDomain={[0, 1]}
            yTickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
            tooltipFormatter={(value: number, name: string) => [
              formatPercent(value),
              name,
            ]}
            showGrid
            showTooltip
            showLegend
          />
        </DataState>
      </CardContent>
    </Card>
  )
})

export default SignalQualityTrendChart
