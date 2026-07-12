/**
 * IntelligentScoreExplanation - 智能评分解释可视化（DA-003）
 *
 * 展示智能评分结果：维度雷达图、关键因子高亮、可折叠的思维链。
 * LLM 原始输出统一经 sanitizeLlmOutput 净化后渲染。
 */

import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { DataState } from '@/components/molecules/DataState'
import { ScoreRadar } from '@/components/chart/ScoreRadar'
import { FactorHeatmap, type FactorHeatmapData } from '@/components/chart/FactorHeatmap'
import { ScoreFactorWaterfall } from '@/components/organisms/analysis/score/ScoreFactorWaterfall'
import { sanitizeLlmOutput } from '@/utils/xssSanitizer'
import type { IntelligentScore } from '@/data/types'
import {
  INTELLIGENT_SCORE_EXPLANATION_CONFIG,
  INTELLIGENT_SCORE_EXPLANATION_LABELS,
} from '@/constants/score.constants'
import { CHART_PALETTE } from '@/constants/theme.tokens'

export interface IntelligentScoreExplanationProps {
  result?: IntelligentScore
  loading?: boolean
  error?: string | null
  className?: string
}

const SCORE_SCALE_MAX = 5

/**
 * buildRadarData
 * @param result
 */
export function buildRadarData(result: IntelligentScore) {
  return result.dimensionScores
    .filter((dim) => typeof dim.score === 'number' && Number.isFinite(dim.score))
    .slice(0, INTELLIGENT_SCORE_EXPLANATION_CONFIG.maxRadarDimensions)
    .map((dim) => ({
      dimension: dim.name,
      score: dim.score as number,
      fullMark: SCORE_SCALE_MAX,
    }))
}

/**
 * buildKeyFactors
 * @param result
 */
export function buildKeyFactors(result: IntelligentScore) {
  const valid = result.dimensionScores.filter(
    (dim) => typeof dim.score === 'number' && Number.isFinite(dim.score),
  )
  const sorted = valid.slice().sort((a, b) => (b.score as number) - (a.score as number))
  return sorted.slice(0, INTELLIGENT_SCORE_EXPLANATION_CONFIG.topFactorCount)
}

/**
 * buildFactorHeatmapData
 * @param result
 * @returns FactorHeatmapData[]
 */
export function buildFactorHeatmapData(result: IntelligentScore): FactorHeatmapData[] {
  return result.dimensionScores
    .filter((dim) => typeof dim.score === 'number' && Number.isFinite(dim.score))
    .map((dim) => ({
      name: dim.name,
      value: dim.score as number,
    }))
}

/**
 * IntelligentScoreExplanation
 */
export const IntelligentScoreExplanation = memo(function IntelligentScoreExplanation({
  result,
  loading,
  error,
  className,
}: IntelligentScoreExplanationProps) {
  const [showChain, setShowChain] = useState(!INTELLIGENT_SCORE_EXPLANATION_CONFIG.chainCollapsed)

  const radarData = useMemo(() => (result ? buildRadarData(result) : []), [result])
  const keyFactors = useMemo(() => (result ? buildKeyFactors(result) : []), [result])
  const heatmapData = useMemo(() => (result ? buildFactorHeatmapData(result) : []), [result])
  const sanitizedChain = useMemo(() => {
    if (!result) return ''
    return sanitizeLlmOutput(result.modelResponse ?? result.basis ?? '')
  }, [result])

  const isEmpty = !loading && !error && !result

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          {INTELLIGENT_SCORE_EXPLANATION_LABELS.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <DataState
          isLoading={loading ?? false}
          isError={!!error}
          isEmpty={isEmpty}
          data={result}
          loadingProps={{ message: '加载中...' }}
          errorProps={{ error: error ?? '加载失败', showErrorDetail: true }}
          emptyProps={{
            title: INTELLIGENT_SCORE_EXPLANATION_LABELS.emptyTitle,
            description: INTELLIGENT_SCORE_EXPLANATION_LABELS.emptyDescription,
          }}
        >
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {INTELLIGENT_SCORE_EXPLANATION_LABELS.radarTitle}
                  </p>
                  <ScoreRadar
                    data={radarData}
                    height={240}
                    colors={{ fill: CHART_PALETTE.series1, stroke: CHART_PALETTE.series1 }}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {INTELLIGENT_SCORE_EXPLANATION_LABELS.keyFactorsTitle}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {keyFactors.map((factor) => {
                      const score = factor.score as number
                      const isHighlight = score >= INTELLIGENT_SCORE_EXPLANATION_CONFIG.highlightThreshold
                      return (
                        <Badge
                          key={factor.name}
                          variant={isHighlight ? 'success' : 'outline'}
                          className="text-xs"
                        >
                          {factor.name}: {score.toFixed(1)}
                        </Badge>
                      )
                    })}
                    {keyFactors.length === 0 && (
                      <span className="text-sm text-muted-foreground">暂无有效维度得分</span>
                    )}
                  </div>
                </div>
              </div>

              {heatmapData.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {INTELLIGENT_SCORE_EXPLANATION_LABELS.heatmapTitle}
                  </p>
                  <FactorHeatmap
                    data={heatmapData}
                    minValue={0}
                    maxValue={SCORE_SCALE_MAX}
                    height={Math.max(160, Math.ceil(heatmapData.length / 3) * 64)}
                  />
                </div>
              )}

              {result.dimensionScores.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    {INTELLIGENT_SCORE_EXPLANATION_LABELS.waterfallTitle}
                  </p>
                  <ScoreFactorWaterfall
                    dimensionScores={result.dimensionScores}
                    height={360}
                  />
                </div>
              )}

              {sanitizedChain && (
                <div className="rounded-md border p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowChain((prev) => !prev)}
                    aria-expanded={showChain}
                  >
                    {showChain
                      ? INTELLIGENT_SCORE_EXPLANATION_LABELS.collapseChain
                      : INTELLIGENT_SCORE_EXPLANATION_LABELS.expandChain}
                  </Button>
                  {showChain && (
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {sanitizedChain}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  )
})
