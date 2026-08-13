/**
 * @fileoverview 周期复盘面板
 *
 * 展示复盘报告：准确率/因子IC/权重调整建议。
 *
 * @module components/organisms/output/prediction/CycleRetrospectivePanel
 * @created 2026-07-15 - 输出模块补强
 */

import { usePredictionStore } from '@/store/predictionStore'
import type { FactorEffectiveness } from '@/types/modules/prediction.types'

const CYCLE_LABELS: Record<string, string> = {
  'left-bottom': '左侧底部',
  'right-up': '右侧上升',
  'top': '顶部区域',
  'left-down': '左侧下降',
}

const EFFECTIVENESS_LABELS: Record<FactorEffectiveness, { text: string; color: string }> = {
  effective: { text: '✅ 有效', color: 'text-success' },
  weakening: { text: '⚠️ 衰减', color: 'text-warning' },
  ineffective: { text: '❌ 失效', color: 'text-destructive' },
}

/**
 * 周期复盘面板
 *
 * 展示月度复盘报告，含准确率统计、因子 IC 排名、权重调整建议。
 */
export function CycleRetrospectivePanel(): React.JSX.Element {
  const report = usePredictionStore((s) => s.latestReport)

  if (!report) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        暂无复盘报告
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 报告头 */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">复盘报告 — {report.period}</h3>
          <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {CYCLE_LABELS[report.marketCycle] ?? report.marketCycle}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xl font-bold">{report.totalPredictions}</div>
            <div className="text-xs text-muted-foreground">总预测</div>
          </div>
          <div>
            <div className="text-xl font-bold text-destructive">
              {(report.directionAccuracy * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">方向准确率</div>
          </div>
          <div>
            <div className="text-xl font-bold text-success">
              {(report.rangeAccuracy * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">幅度准确率</div>
          </div>
        </div>
      </div>

      {/* 因子 IC 排名 */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-semibold">因子 IC/IR 排名</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-3">因子</th>
                <th className="py-1 pr-3">IC</th>
                <th className="py-1 pr-3">IR</th>
                <th className="py-1 pr-3">命中率</th>
                <th className="py-1">状态</th>
              </tr>
            </thead>
            <tbody>
              {report.factorICs.slice(0, 10).map((stat) => {
                const eff = EFFECTIVENESS_LABELS[stat.status] ?? { text: '未知', color: 'text-muted-foreground' }
                return (
                  <tr key={stat.factorId} className="border-b last:border-0">
                    <td className="py-1 pr-3 font-medium">{stat.factorId}</td>
                    <td className="py-1 pr-3">{stat.ic.toFixed(3)}</td>
                    <td className="py-1 pr-3">{stat.ir.toFixed(3)}</td>
                    <td className="py-1 pr-3">{(stat.hitRate * 100).toFixed(0)}%</td>
                    <td className={`py-1 ${eff.color}`}>{eff.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 权重调整建议 */}
      {report.weightAdjustments.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h4 className="mb-2 text-sm font-semibold">权重调整建议</h4>
          <div className="space-y-1">
            {report.weightAdjustments.slice(0, 8).map((adj) => {
              const isUp = adj.suggestedWeight > adj.currentWeight
              const isDown = adj.suggestedWeight < adj.currentWeight
              return (
                <div key={adj.factorId} className="flex items-center gap-2 text-xs">
                  <span className="w-16 font-medium">{adj.factorId}</span>
                  <span className="text-muted-foreground">{adj.currentWeight.toFixed(2)}</span>
                  <span className={isUp ? 'text-destructive' : isDown ? 'text-success' : 'text-muted-foreground'}>
                    {isUp ? '→↑' : isDown ? '→↓' : '→'} {adj.suggestedWeight.toFixed(2)}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">{adj.reason}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 周期适配度 */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-semibold">周期适配度</h4>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {(Object.entries(report.cycleAdaptation)).map(([cycle, rate]) => (
            <div key={cycle} className="rounded bg-muted/50 p-2">
              <div className="font-medium">{CYCLE_LABELS[cycle] ?? cycle}</div>
              <div className="mt-1 text-lg font-bold">{(rate * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
