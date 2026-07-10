import React, { memo, useEffect, useMemo } from 'react'
import { TrendingUp, BarChart3, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/states'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { getLogger } from '@/lib/logger'
import { useOrderStore, initOrderStoreSubscriptions } from '@/store/orderStore'
import { COLOR_TOKENS, COLOR_SHADES, twText } from '@/constants/theme.tokens'
import { WidgetStateShell } from './components/WidgetStateShell'

const logger = getLogger()

interface PnLAnalysisWidgetProps {
  config: WidgetConfig
}

const PnLAnalysisWidget = memo(function PnLAnalysisWidget({ config }: PnLAnalysisWidgetProps): React.JSX.Element {
  const { orders, tradePairs, pnlSummary, loading, error, refresh } = useOrderStore()

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

  const visualState = error ? 'error' : loading ? 'loading' : orders.length === 0 || tradePairs.length === 0 ? 'empty' : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={refresh}
      emptyTitle="暂无盈亏数据"
      emptyDescription="完成交易后将自动生成盈亏分析与收益曲线"
      skeleton={(
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-32" />
        </div>
      )}
    >
      <div className="space-y-4">
        {/* 核心指标 */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`${COLOR_SHADES.gray[50]} rounded-lg p-3 text-center`}>
            <div className="flex justify-center mb-1">
              <BarChart3 className="h-5 w-5" style={{ color: pnlSummary.totalRealizedPnl >= 0 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: pnlSummary.totalRealizedPnl >= 0 ? COLOR_TOKENS.success.hex : COLOR_TOKENS.danger.hex }}>
              {pnlSummary.totalRealizedPnl >= 0 ? '+' : ''}{pnlSummary.totalRealizedPnl}%
            </div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>总盈亏</div>
          </div>
          <div className={`${COLOR_SHADES.gray[50]} rounded-lg p-3 text-center`}>
            <div className="flex justify-center mb-1">
              <TrendingUp className="h-5 w-5" style={{ color: COLOR_TOKENS.success.hex }} />
            </div>
            <div className="text-xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>{pnlSummary.winRate}%</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>胜率</div>
          </div>
          <div className={`${COLOR_SHADES.gray[50]} rounded-lg p-3 text-center`}>
            <div className="flex justify-center mb-1">
              <TrendingUp className={`h-5 w-5 ${twText('yellow', 500)}`} />
            </div>
            <div className={`text-xl font-bold ${twText('yellow', 500)}`}>{pnlSummary.profitFactor}</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>盈亏比</div>
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
            {pnlSummary.monthlyPnL.slice(-6).map((month) => (
              <div key={month.month} className="flex items-center justify-between text-xs">
                <span className={COLOR_SHADES.gray[500]}>{month.month}</span>
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
            {pnlSummary.monthlyPnL.length === 0 && (
              <p className={`text-xs ${COLOR_SHADES.gray[400]} text-center`}>暂无月度数据</p>
            )}
          </div>
        </div>

        {/* 交易统计 */}
        <div className={`flex items-center justify-between text-xs ${COLOR_SHADES.gray[500]} ${COLOR_SHADES.gray[50]} rounded-lg p-2`}>
          <span>盈利: <span className={`font-medium ${COLOR_TOKENS.success.tailwind}`}>{pnlSummary.profitTrades}笔</span></span>
          <span>亏损: <span className={`font-medium ${COLOR_TOKENS.danger.tailwind}`}>{pnlSummary.lossTrades}笔</span></span>
          <span>总计: <span className="font-medium">{pnlSummary.totalTrades}笔</span></span>
        </div>
      </div>
    </WidgetStateShell>
  )
})

export default PnLAnalysisWidget
