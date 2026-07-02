import React, { memo, useEffect, useMemo } from 'react'
import { TrendingUp, BarChart3, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { getLogger } from '@/lib/logger'
import { useOrderStore, initOrderStoreSubscriptions } from '@/store/orderStore'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

interface PnLAnalysisWidgetProps {
  config: WidgetConfig
}

const PnLAnalysisWidget = memo(function PnLAnalysisWidget({ config }: PnLAnalysisWidgetProps): React.JSX.Element {
  const { orders, tradePairs, pnlSummary, loading, error } = useOrderStore()

  useEffect(() => {
    let cancelled = false
    logger.info('[PnLAnalysisWidget] 加载盈亏数据')
    const cleanup = initOrderStoreSubscriptions()
    const doRefresh = async () => {
      try {
        await useOrderStore.getState().refresh()
      } catch (err) {
        if (!cancelled) {
          logger.error('[PnLAnalysisWidget] 刷新盈亏数据失败', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }
    void doRefresh()
    return () => { cancelled = true; cleanup() }
  }, [])

  // 盈亏曲线最近 20 个点及最大绝对值（避免在 map 内重复计算）
  const dailyCurveSlice = useMemo(
    () => pnlSummary.dailyCurve.slice(-20),
    [pnlSummary.dailyCurve],
  )
  const dailyCurveMaxAbs = useMemo(
    () => Math.max(...dailyCurveSlice.map((p) => Math.abs(p.cumulativePnL)), 1),
    [dailyCurveSlice],
  )

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-red-500">
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (orders.length === 0 || tradePairs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">暂无盈亏数据</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
            完成交易后将自动生成盈亏分析与收益曲线
          </p>
        </CardContent>
      </Card>
    )
  }

  const data = pnlSummary

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 核心指标 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex justify-center mb-1">
              <BarChart3 className="h-5 w-5" style={{ color: data.totalRealizedPnl >= 0 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: data.totalRealizedPnl >= 0 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex }}>
              {data.totalRealizedPnl >= 0 ? '+' : ''}{data.totalRealizedPnl}%
            </div>
            <div className="text-xs text-gray-400">总盈亏</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex justify-center mb-1">
              <TrendingUp className="h-5 w-5" style={{ color: COLOR_TOKENS.success.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>{data.winRate}%</div>
            <div className="text-xs text-gray-400">胜率</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="flex justify-center mb-1">
              <TrendingUp className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-xl font-bold text-yellow-500">{data.profitFactor}</div>
            <div className="text-xs text-gray-400">盈亏比</div>
          </div>
        </div>

        {/* 盈亏曲线（简化柱状图） */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" /> 盈亏曲线
          </h4>
          <div className="h-24 flex items-end gap-1">
            {dailyCurveSlice.map((point) => {
              const heightPct = Math.abs(point.cumulativePnL) / dailyCurveMaxAbs * 100
              const isPositive = point.cumulativePnL >= 0
              return (
                <div
                  key={point.date}
                  className="flex-1 relative group"
                  title={`${point.date}: ${isPositive ? '+' : ''}${point.cumulativePnL}%`}
                >
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(heightPct, 4)}%`,
                      backgroundColor: isPositive ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex,
                      opacity: 0.8,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* 月度盈亏 */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Calendar className="h-4 w-4" /> 月度盈亏
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {data.monthlyPnL.slice(-6).map((month) => (
              <div key={month.month} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{month.month}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{month.trades}笔</Badge>
                  <span
                    className="font-medium"
                    style={{ color: month.pnl >= 0 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex }}
                  >
                    {month.pnl >= 0 ? '+' : ''}{month.pnl}%
                  </span>
                </div>
              </div>
            ))}
            {data.monthlyPnL.length === 0 && (
              <p className="text-xs text-gray-400 text-center">暂无月度数据</p>
            )}
          </div>
        </div>

        {/* 交易统计 */}
        <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
          <span>盈利: <span className="font-medium text-green-500">{data.profitTrades}笔</span></span>
          <span>亏损: <span className="font-medium text-red-500">{data.lossTrades}笔</span></span>
          <span>总计: <span className="font-medium">{data.totalTrades}笔</span></span>
        </div>
      </CardContent>
    </Card>
  )
})

export default PnLAnalysisWidget
