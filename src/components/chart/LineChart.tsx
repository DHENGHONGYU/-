/**
 * LineChart - 折线图通用组件
 *
 * 基于 Recharts 的 LineChart 二次封装，统一项目内折线图样式与配色。
 * 与 AreaChart/BarChart 保持一致的 API 风格，支持多系列、网格、Tooltip、Legend。
 *
 * @example
 * ```tsx
 * <LineChart
 *   data={[
 *     { period: '2026-01', accuracy: 0.65, winRate: 0.55 },
 *     { period: '2026-02', accuracy: 0.72, winRate: 0.60 },
 *   ]}
 *   xKey="period"
 *   lines={[
 *     { dataKey: 'accuracy', name: '准确率', color: CHART_PALETTE.series1 },
 *     { dataKey: 'winRate', name: '胜率', color: CHART_PALETTE.series3 },
 *   ]}
 *   height={240}
 * />
 * ```
 */

import { memo, forwardRef } from 'react'
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_PALETTE, COLOR_SHADES } from '@/constants/theme.tokens'
import { usePerfTrace } from '@/hooks/usePerfTrace'

interface LineChartProps {
  /** 数据源，每项为一个数据点 */
  data?: Array<Record<string, unknown>>
  /** X 轴数据字段名 */
  xKey: string
  /** 折线系列配置 */
  lines: Array<{
    dataKey: string
    name?: string
    color?: string
    /** 线宽，默认 2 */
    strokeWidth?: number
    /** 是否显示数据点，默认 false */
    showDot?: boolean
    /** 是否为虚线（用于预测/目标系列），默认 false */
    dashed?: boolean
  }>
  /** 图表高度，默认 300 */
  height?: number
  /** 是否显示网格，默认 true */
  showGrid?: boolean
  /** 是否显示 Tooltip，默认 true */
  showTooltip?: boolean
  /** 是否显示 Legend，默认 true */
  showLegend?: boolean
  /** Y 轴域，例如 [0, 1] 限定百分比范围 */
  yDomain?: [number | string, number | string]
  /** 自定义 Y 轴 tick 格式化函数 */
  yTickFormatter?: (value: number) => string
  /** 自定义 Tooltip 格式化函数 */
  tooltipFormatter?: (value: number, name: string) => [string, string]
  /** 自定义 className */
  className?: string
  /** 加载状态（显示骨架屏），默认 false */
  loading?: boolean
  /** 空数据占位文案，默认「暂无数据」 */
  emptyText?: string
}

const DEFAULT_COLORS = [
  CHART_PALETTE.series1,
  CHART_PALETTE.series2,
  CHART_PALETTE.series3,
  CHART_PALETTE.series4,
  CHART_PALETTE.series5,
  CHART_PALETTE.series6,
]

/**
 * LineChart 通用折线图组件
 *
 * 设计原则：
 * - 颜色默认从 CHART_PALETTE.series1-6 轮转，避免硬编码
 * - 与 AreaChart/BarChart 保持 API 风格一致
 * - 支持 yDomain 限定值域（如百分比 0-1）
 * - 支持虚线系列（用于目标线/预测线）
 */
export const LineChart = memo(
  forwardRef<HTMLDivElement, LineChartProps>(
    (
      {
        data,
        xKey,
        lines,
        height = 300,
        showGrid = true,
        showTooltip = true,
        showLegend = true,
        yDomain,
        yTickFormatter,
        tooltipFormatter,
        className,
        loading = false,
        emptyText,
      },
      ref,
    ) => {
      const safeData = data ?? []
      const pointCount = safeData.length
      usePerfTrace('LineChart', { points: pointCount, series: lines.length })

      // 加载状态骨架屏
      if (loading) {
        return (
          <div ref={ref} className={cn('w-full animate-pulse', className)}>
            <div className={cn('rounded-lg', COLOR_SHADES.gray[100])} style={{ height }} />
          </div>
        )
      }

      // 空数据占位
      if (pointCount === 0) {
        return (
          <div ref={ref} className={cn('w-full flex items-center justify-center text-muted-foreground text-sm', className)} style={{ height }}>
            {emptyText ?? '暂无数据'}
          </div>
        )
      }

      return (
        <div ref={ref} className={cn('w-full', className)} role="img" aria-label="折线图">
          <ResponsiveContainer width="100%" height={height}>
            <RechartsLine
              data={safeData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_PALETTE.grid}
                  vertical={false}
                />
              )}
              <XAxis
                dataKey={xKey}
                tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
                axisLine={{ stroke: CHART_PALETTE.grid }}
                tickLine={false}
              />
              <YAxis
                domain={yDomain ?? ['auto', 'auto']}
                tick={{ fill: CHART_PALETTE.axis, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={yTickFormatter}
              />
              {showTooltip && (
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_PALETTE.tooltipBg,
                    border: 'none',
                    borderRadius: 8,
                    color: CHART_PALETTE.tooltipText,
                  }}
                  labelStyle={{ color: CHART_PALETTE.tooltipText }}
                  formatter={tooltipFormatter as never}
                />
              )}
              {showLegend && <Legend />}
              {lines.map((line, index) => {
                const color = line.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                return (
                  <Line
                    key={line.dataKey}
                    type="monotone"
                    dataKey={line.dataKey}
                    name={line.name}
                    stroke={color}
                    strokeWidth={line.strokeWidth ?? 2}
                    strokeDasharray={line.dashed === true ? '5 5' : undefined}
                    dot={line.showDot === true ? { r: 3, fill: color } : false}
                    activeDot={{ r: 5, fill: color }}
                    isAnimationActive={false}
                  />
                )
              })}
            </RechartsLine>
          </ResponsiveContainer>
        </div>
      )
    },
  ),
)

LineChart.displayName = 'LineChart'

export default LineChart
