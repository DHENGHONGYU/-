/**
 * 复盘启动分析关键页面（RLES 评价体系入口）
 *
 * 复用现有评分组件（ScoreRadar 四维雷达、GaugeChart 总分仪表）展示
 * D1 数据就绪度 / D2 策略适配度 / D3 时机成熟度 / D4 风险健康度，并给出
 * 三级分流（优先/常规/谨慎）与风险降级标签。
 */

import React, { useEffect } from 'react'
import { PageHeader } from '@/components/templates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { ScoreRadar } from '@/components/chart/ScoreRadar'
import { GaugeChart } from '@/components/chart/GaugeChart'
import { StockSelector } from '@/components/organisms/input/StockSelector'
import { useReviewLaunchStore } from '@/store/reviewLaunchStore'
import type { SecondWaveSignal } from '@/services/scoring/rles-engine/secondWaveDetector'
import { POPULAR_STOCKS } from '@/constants/stockList'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

function tierBadgeVariant(tier: string): 'default' | 'secondary' | 'outline' {
  if (tier === 'priority') return 'default'
  if (tier === 'normal') return 'secondary'
  return 'outline'
}

function tierLabel(tier: string): string {
  if (tier === 'priority') return '优先深度复盘'
  if (tier === 'normal') return '常规复盘'
  return '谨慎'
}

function swTypeLabel(t: SecondWaveSignal['signalType']): string {
  switch (t) {
    case 'strong_wave':
      return '二波启动（试盘/突破）'
    case 'pullback':
      return '分级回踩'
    case 'trial':
      return '主升未回踩'
    default:
      return '非主升浪'
  }
}

export default function ReviewLaunchPage(): React.JSX.Element {
  const symbol = useReviewLaunchStore((s) => s.symbol)
  const result = useReviewLaunchStore((s) => s.result)
  const secondWave = useReviewLaunchStore((s) => s.secondWaveSignal)
  const loading = useReviewLaunchStore((s) => s.loading)
  const error = useReviewLaunchStore((s) => s.error)
  const setSymbol = useReviewLaunchStore((s) => s.setSymbol)
  const runEvaluation = useReviewLaunchStore((s) => s.runEvaluation)
  const reset = useReviewLaunchStore((s) => s.reset)

  useEffect(() => {
    if (error) logger.warn('[ReviewLaunchPage]', { error })
  }, [error])

  const radarData = result
    ? result.dimensions.map((d) => ({ dimension: d.name, score: Math.round(d.score), fullMark: 100 }))
    : []

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="复盘启动分析 · RLES 评价体系"
        description="数据就绪度(D1) · 策略适配度(D2) · 时机成熟度(D3) · 风险健康度(D4)"
        actions={
          <Button size="sm" variant="secondary" onClick={() => reset()}>
            重置
          </Button>
        }
      />

      {/* 标的输入 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <StockSelector
            value={symbol}
            stocks={POPULAR_STOCKS}
            onChange={(opt) => {
              setSymbol(opt.symbol)
              void runEvaluation(opt.symbol)
            }}
            placeholder="选择复盘标的"
          />
          <Button size="sm" onClick={() => void runEvaluation()} disabled={loading || !symbol}>
            {loading ? '评估中...' : '运行评估'}
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* 总分 + 分流建议 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>复盘启动就绪度</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <GaugeChart
                  value={Math.round(result.total)}
                  max={100}
                  size={180}
                  label="RLES 总分"
                  sublabel={result.tier === 'priority' ? '优先' : result.tier === 'normal' ? '常规' : '谨慎'}
                  colorMode="score"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={tierBadgeVariant(result.tier)}>{tierLabel(result.tier)}</Badge>
                  {result.riskDowngraded && (
                    <Badge variant="destructive">风险降级 ×{result.riskMultiplier}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>启动建议</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{result.recommendation}</p>
                {result.riskTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {result.riskTags.map((t) => (
                      <Badge key={t} variant="destructive">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  评估时间：{new Date(result.evaluatedAt).toLocaleString('zh-CN')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 四维雷达 + 维度明细 */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>四维评分雷达</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreRadar data={radarData} height={280} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>维度明细</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.dimensions.map((d) => (
                  <div key={d.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {d.id} {d.name}
                      </span>
                      <Badge variant="outline">{Math.round(d.score)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 主升浪二波形态诊断 */}
          {secondWave && (
            <Card>
              <CardHeader>
                <CardTitle>主升浪二波形态诊断</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={secondWave.detected ? 'default' : 'outline'}>
                    {secondWave.detected ? '命中二波形态' : '未命中'}
                  </Badge>
                  <Badge variant="secondary">{swTypeLabel(secondWave.signalType)}</Badge>
                  <Badge variant="outline">强度 {Math.round(secondWave.strength)}</Badge>
                  {secondWave.pullbackLevel !== 'none' && (
                    <Badge variant="outline">回踩 {secondWave.pullbackLevel.toUpperCase()}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>60日涨幅：{(secondWave.uptrendPct60 * 100).toFixed(0)}%</span>
                  <span>20日涨幅：{(secondWave.uptrendPct20 * 100).toFixed(0)}%</span>
                  <span>最大量比：{secondWave.maxVolumeRatio.toFixed(1)}×</span>
                  <span>试盘长上影：{secondWave.hasTrialShadow ? '是' : '否'}</span>
                  <span>突破前高：{secondWave.hasBreakout ? '是' : '否'}</span>
                  <span>
                    MA5/10/20：{secondWave.maLevels.ma5.toFixed(2)}/{secondWave.maLevels.ma10.toFixed(2)}/
                    {secondWave.maLevels.ma20.toFixed(2)}
                  </span>
                </div>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {secondWave.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!result && !loading && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            选择标的并运行评估，RLES 将给出复盘启动就绪度与分流建议
          </CardContent>
        </Card>
      )}
    </div>
  )
}
