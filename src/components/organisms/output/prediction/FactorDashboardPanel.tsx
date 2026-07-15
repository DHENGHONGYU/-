/**
 * @fileoverview 因子画板面板
 *
 * 展示市场周期/活跃因子/告警/顶部预测。
 *
 * @module components/organisms/output/prediction/FactorDashboardPanel
 * @created 2026-07-15 - 输出模块补强
 */

import { usePredictionStore } from '@/store/predictionStore'
import { twText } from '@/constants/theme.tokens'

const CYCLE_LABELS: Record<string, string> = {
  'left-bottom': '左侧底部',
  'right-up': '右侧上升',
  'top': '顶部区域',
  'left-down': '左侧下降',
}

const CYCLE_COLORS: Record<string, string> = {
  'left-bottom': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'right-up': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'top': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'left-down': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const ALERT_COLORS: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  warning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
  critical: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
}

const DIRECTION_COLORS: Record<string, string> = {
  bullish: 'text-red-600 dark:text-red-400',
  bearish: 'text-green-600 dark:text-green-400',
  neutral: 'text-stone-500',
}

/**
 * 因子画板面板
 *
 * 展示当前市场周期、活跃因子排名、告警信息和顶部预测。
 */
export function FactorDashboardPanel(): React.JSX.Element {
  const dashboardData = usePredictionStore((s) => s.dashboardData)
  const currentCycle = usePredictionStore((s) => s.currentCycle)

  if (!dashboardData) {
    return (
      <div className="space-y-4">
        {/* 周期状态（即使无数据也显示） */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">市场周期</h3>
            <span className={`rounded px-2 py-1 text-xs font-medium ${CYCLE_COLORS[currentCycle] ?? 'bg-muted'}`}>
              {CYCLE_LABELS[currentCycle] ?? currentCycle}
            </span>
          </div>
        </div>
        <div className="py-8 text-center text-muted-foreground">
          画板数据加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 市场周期 */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">市场周期判定</h3>
          <span className={`rounded px-2 py-1 text-xs font-medium ${CYCLE_COLORS[dashboardData.marketCycle] ?? 'bg-muted'}`}>
            {CYCLE_LABELS[dashboardData.marketCycle] ?? dashboardData.marketCycle}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">置信度</span>
          <div className="h-2 flex-1 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.round(dashboardData.cycleConfidence * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium">{Math.round(dashboardData.cycleConfidence * 100)}%</span>
        </div>
      </div>

      {/* 告警 */}
      {dashboardData.alerts.length > 0 && (
        <div className="space-y-1">
          {dashboardData.alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded px-3 py-1.5 text-xs ${ALERT_COLORS[alert.level] ?? ALERT_COLORS.info}`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* 活跃因子排名 */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-semibold">活跃因子排名</h4>
        <div className="space-y-1">
          {dashboardData.activeFactors.map((f) => (
            <div key={f.factorId} className="flex items-center gap-2 text-xs">
              <span className="w-16 font-medium">{f.factorId}</span>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${(f.score / 5) * 100}%` }}
                  />
                </div>
              </div>
              <span className="w-8 text-right">{f.score.toFixed(1)}</span>
              <span className="w-10 text-right text-muted-foreground">×{f.weight.toFixed(1)}</span>
              {f.effectiveness === 'ineffective' && (
                <span className={twText('red', 500)}>❌</span>
              )}
              {f.effectiveness === 'weakening' && (
                <span className={twText('yellow', 500)}>⚠️</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 顶部预测 */}
      {dashboardData.topPredictions.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h4 className="mb-2 text-sm font-semibold">高置信度预测</h4>
          <div className="space-y-1">
            {dashboardData.topPredictions.map((p) => (
              <div key={p.symbol} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.stockName}</span>
                  <span className="text-muted-foreground">{p.symbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${DIRECTION_COLORS[p.direction] ?? DIRECTION_COLORS.neutral}`}>
                    {p.direction === 'bullish' ? '看涨' : p.direction === 'bearish' ? '看跌' : '中性'}
                  </span>
                  <span className="text-muted-foreground">{p.predictedReturn}</span>
                  <span className="font-medium">{Math.round(p.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
