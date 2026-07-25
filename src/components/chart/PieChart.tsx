/**
 * PieChart - 饼图通用组件
 *
 * 基于 Recharts 的 PieChart 二次封装，统一项目内饼图样式与配色。
 * 与 LineChart/AreaChart/BarChart 保持一致的 API 风格。
 *
 * @example
 * ```tsx
 * <PieChart
 *   data={[
 *     { name: '科技', value: 35 },
 *     { name: '消费', value: 25 },
 *     { name: '医药', value: 20 },
 *   ]}
 *   height={280}
 *   showLabel
 * />
 * ```
 *
 * @doc [V9-DOC-FRONT-061]
 */
import { memo, forwardRef, useCallback } from 'react'
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_PALETTE, COLOR_SHADES } from '@/constants/theme.tokens'
import { PIE_CHART_PALETTE } from '@/config/chartColors'
import { usePerfTrace } from '@/hooks/usePerfTrace'

interface PieChartProps {
  /** 数据源，每项包含 name 和 value */
  data?: Array<{ name: string; value: number; [key: string]: unknown }>
  /** 图表高度，默认 280 */
  height?: number
  /** 是否显示标签，默认 false */
  showLabel?: boolean
  /** 是否显示 Legend，默认 true */
  showLegend?: boolean
  /** 是否显示 Tooltip，默认 true */
  showTooltip?: boolean
  /** 内半径（用于环形图），默认 0 */
  innerRadius?: number
  /** 外半径，默认 'auto' */
  outerRadius?: number | string
  /** 自定义颜色数组，默认使用 PIE_CHART_PALETTE */
  colors?: string[]
  /** 自定义 Tooltip 格式化函数 */
  tooltipFormatter?: (value: number, name: string) => [string, string]
  /** 自定义 className */
  className?: string
  /** 加载状态（显示骨架屏），默认 false */
  loading?: boolean
  /** 空数据占位文案 */
  emptyText?: string
  /** 点击扇区回调 */
  onPieClick?: (entry: { name: string; value: number }, index: number) => void
}

/**
 * PieChart 通用饼图组件
 *
 * 设计原则：
 * - 颜色默认从 PIE_CHART_PALETTE 读取，禁止硬编码
 * - 支持 innerRadius 实现环形图
 * - 与 LineChart/AreaChart/BarChart 保持 API 风格一致
 */
export const PieChart = memo(
  forwardRef<HTMLDivElement, PieChartProps>(
    (
      {
        data = [],
        height = 280,
        showLabel = false,
        showLegend = true,
        showTooltip = true,
        innerRadius = 0,
        outerRadius = 'auto',
        colors,
        tooltipFormatter,
        className,
        loading = false,
        emptyText = '暂无数据',
        onPieClick,
      },
      ref,
    ) => {
      const safeData = data
      usePerfTrace('PieChart', { segments: safeData.length })

      const palette = colors ?? PIE_CHART_PALETTE

      // 加载状态骨架屏
      if (loading) {
        return (
          <div ref={ref} className={cn('w-full animate-pulse', className)}>
            <div className={cn('rounded-lg', COLOR_SHADES.gray[100])} style={{ height }} />
          </div>
        )
      }

      // 空数据占位
      if (safeData.length === 0) {
        return (
          <div
            ref={ref}
            className={cn('w-full flex items-center justify-center text-muted-foreground text-sm', className)}
            style={{ height }}
          >
            {emptyText}
          </div>
        )
      }

      const handleClick = useCallback(
        (_: unknown, index: number) => {
          if (onPieClick && safeData[index]) {
            onPieClick(
              { name: safeData[index]!.name, value: safeData[index]!.value },
              index,
            )
          }
        },
        [onPieClick, safeData],
      )

      return (
        <div ref={ref} className={cn('w-full', className)}>
          <ResponsiveContainer width="100%" height={height}>
            <RechartsPie>
              {showTooltip && (
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_PALETTE.tooltipBg,
                    border: 'none',
                    borderRadius: 8,
                    color: CHART_PALETTE.tooltipText,
                  }}
                  formatter={tooltipFormatter as never}
                />
              )}
              {showLegend && (
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                />
              )}
              <Pie
                data={safeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius === 'auto' ? Math.min(height / 3, 100) : outerRadius}
                paddingAngle={2}
                label={showLabel ? ({ name, percent }) => {
              const pct = typeof percent === 'number' ? percent : 0
              return `${name} ${(pct * 100).toFixed(0)}%`
            } : false}
                onClick={handleClick}
                isAnimationActive={false}
              >
                {safeData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={palette[index % palette.length]}
                    stroke={CHART_PALETTE.tooltipBg}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </RechartsPie>
          </ResponsiveContainer>
        </div>
      )
    },
  ),
)

PieChart.displayName = 'PieChart'
export default PieChart
