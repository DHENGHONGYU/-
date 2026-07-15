/**
 * @fileoverview 预测校验面板
 *
 * 展示因子预测列表，含方向/置信度/驱动因子/校验状态。
 *
 * @module components/organisms/output/prediction/PredictionPanel
 * @created 2026-07-15 - 输出模块补强
 */

import { usePredictionStore } from '@/store/predictionStore'
import { BADGE_COLORS, COLOR_TOKENS } from '@/constants/theme.tokens'
import type { FactorPrediction, PredictionDirection, PredictionStatus } from '@/types/modules/prediction.types'

const DIRECTION_LABELS: Record<PredictionDirection, { text: string; color: string }> = {
  bullish: { text: '看涨', color: BADGE_COLORS.direction.bullish },
  bearish: { text: '看跌', color: BADGE_COLORS.direction.bearish },
  neutral: { text: '中性', color: BADGE_COLORS.direction.neutral },
}

const STATUS_LABELS: Record<PredictionStatus, { text: string; color: string }> = {
  pending: { text: '待校验', color: BADGE_COLORS.predictionStatus.pending },
  verified: { text: '已校验', color: BADGE_COLORS.predictionStatus.verified },
  expired: { text: '已过期', color: BADGE_COLORS.predictionStatus.expired },
}

function PredictionCard({ prediction }: { prediction: FactorPrediction }): React.JSX.Element {
  const dir = DIRECTION_LABELS[prediction.direction] ?? { text: '中性', color: BADGE_COLORS.direction.neutral }
  const status = STATUS_LABELS[prediction.status] ?? { text: '未知', color: BADGE_COLORS.predictionStatus.unknown }
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
        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${BADGE_COLORS.sentimentDominant}`}>
          情绪主导
        </span>
      )}

      {prediction.status === 'verified' && prediction.actualReturn !== undefined && (
        <div className="mt-2 border-t pt-2 text-xs">
          <span className="text-muted-foreground">实际收益: </span>
          <span className={prediction.actualReturn >= 0 ? BADGE_COLORS.direction.bullish : BADGE_COLORS.direction.bearish}>
            {prediction.actualReturn >= 0 ? '+' : ''}{prediction.actualReturn.toFixed(2)}%
          </span>
          {prediction.hitDirection && <span className={`ml-2 ${BADGE_COLORS.hit}`}>✓ 方向命中</span>}
          {prediction.hitRange && <span className={`ml-1 ${BADGE_COLORS.hit}`}>✓ 幅度命中</span>}
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
          <div className={`text-2xl font-bold ${COLOR_TOKENS.info.tailwind}`}>{stats.verified}</div>
          <div className="text-xs text-muted-foreground">已校验</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
          <div className={`text-2xl font-bold ${COLOR_TOKENS.up.tailwind}`}>{(stats.directionHitRate * 100).toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground">方向准确率</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center shadow-sm">
          <div className={`text-2xl font-bold ${COLOR_TOKENS.down.tailwind}`}>{(stats.rangeHitRate * 100).toFixed(0)}%</div>
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
