/**
 * @fileoverview 预测校验面板
 *
 * 展示因子预测列表，含方向/置信度/驱动因子/校验状态。
 *
 * @module components/organisms/output/prediction/PredictionPanel
 * @created 2026-07-15 - 输出模块补强
 */

import { usePredictionStore } from '@/store/predictionStore'
import { twText, twBg, DARK } from '@/constants/theme.tokens'
import type { FactorPrediction, PredictionDirection, PredictionStatus } from '@/types/modules/prediction.types'

const DIRECTION_LABELS: Record<PredictionDirection, { text: string; color: string }> = {
  bullish: { text: '看涨', color: 'text-red-600 dark:text-red-400' },
  bearish: { text: '看跌', color: 'text-green-600 dark:text-green-400' },
  neutral: { text: '中性', color: 'text-stone-500' },
}

const STATUS_LABELS: Record<PredictionStatus, { text: string; color: string }> = {
  pending: { text: '待校验', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  verified: { text: '已校验', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  expired: { text: '已过期', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
}

function PredictionCard({ prediction }: { prediction: FactorPrediction }): React.JSX.Element {
  const dir = DIRECTION_LABELS[prediction.direction] ?? { text: '中性', color: 'text-stone-500' }
  const status = STATUS_LABELS[prediction.status] ?? { text: '未知', color: 'bg-gray-100 text-gray-500' }
  const confidencePercent = Math.round(prediction.confidence * 100)

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{prediction.stockName}</span>
          <span className="text-xs text-muted-foreground">{prediction.symbol}</span>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${status.color}`}>
          {status.text}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className={`text-lg font-bold ${dir.color}`}>{dir.text}</span>
        <span className="text-sm text-muted-foreground">
          预期 {prediction.predictedReturnRange.min.toFixed(1)}% ~ {prediction.predictedReturnRange.max.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">{prediction.horizon}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">置信度</span>
        <div className="h-2 flex-1 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary"
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
        <span className="text-xs font-medium">{confidencePercent}%</span>
      </div>

      {prediction.sentimentDominant && (
        <span className={`mt-1 inline-block rounded ${twBg('amber', 100)} px-1.5 py-0.5 text-xs ${twText('amber', 700)} ${DARK.bgAmber950_30} ${DARK.textAmber300}`}>
          情绪主导
        </span>
      )}

      {prediction.status === 'verified' && prediction.actualReturn !== undefined && (
        <div className="mt-2 border-t pt-2 text-xs">
          <span className="text-muted-foreground">实际收益: </span>
          <span className={prediction.actualReturn >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
            {prediction.actualReturn >= 0 ? '+' : ''}{prediction.actualReturn.toFixed(2)}%
          </span>
          {prediction.hitDirection && <span className={`ml-2 ${twText('blue', 500)}`}>✓ 方向命中</span>}
          {prediction.hitRange && <span className={`ml-1 ${twText('blue', 500)}`}>✓ 幅度命中</span>}
        </div>
      )}

      {prediction.drivingFactors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {prediction.drivingFactors.slice(0, 3).map((f) => (
            <span key={f.factorId} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {f.factorId}: {f.factorScore.toFixed(1)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 预测校验面板
 *
 * 展示预测列表与准确率统计。
 */
export function PredictionPanel(): React.JSX.Element {
  const predictions = usePredictionStore((s) => s.predictions)

  // 直接从 predictions 计算统计（避免 selector 返回函数调用）
  const verified = predictions.filter((p) => p.status === 'verified')
  const directionHits = verified.filter((p) => p.hitDirection).length
  const rangeHits = verified.filter((p) => p.hitRange).length
  const stats = {
    total: predictions.length,
    verified: verified.length,
    directionHitRate: verified.length > 0 ? directionHits / verified.length : 0,
    rangeHitRate: verified.length > 0 ? rangeHits / verified.length : 0,
  }

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">总预测</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
          <div className={`text-2xl font-bold ${twText('blue', 500)}`}>{stats.verified}</div>
          <div className="text-xs text-muted-foreground">已校验</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
          <div className={`text-2xl font-bold ${twText('red', 500)}`}>{(stats.directionHitRate * 100).toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">方向准确率</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
          <div className={`text-2xl font-bold ${twText('green', 500)}`}>{(stats.rangeHitRate * 100).toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">幅度准确率</div>
        </div>
      </div>

      {/* 预测列表 */}
      <div className="space-y-2">
        {predictions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">暂无预测记录</div>
        ) : (
          predictions.slice(0, 20).map((p) => (
            <PredictionCard key={p.predictionId} prediction={p} />
          ))
        )}
      </div>
    </div>
  )
}
