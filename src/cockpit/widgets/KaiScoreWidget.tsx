import React from 'react'
import { Activity, Smile, TrendingUp, Droplets } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import { Badge } from '@/components/atoms/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms/Table'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, MarketData, KaiDimension, KaiDetailItem } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'

interface KaiScoreWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

/**
 * 根据评分从 SCORE_LEVELS 常量获取等级
 */
function getScoreLevel(score: number) {
  if (score >= SCORE_LEVELS.EXCELLENT.min) return SCORE_LEVELS.EXCELLENT
  if (score >= SCORE_LEVELS.GOOD.min) return SCORE_LEVELS.GOOD
  if (score >= SCORE_LEVELS.AVERAGE.min) return SCORE_LEVELS.AVERAGE
  if (score >= SCORE_LEVELS.POOR.min) return SCORE_LEVELS.POOR
  return SCORE_LEVELS.BAD
}

/**
 * KAI 选股综合评分图谱 Widget
 * @description 展示综合评分、情绪/趋势/流量指标、维度评分横向柱状图与细项分布表
 * @remarks 数据来自 MarketData.analysisScores.kai；未来可替换为量化评分模型 API
 */
export default function KaiScoreWidget({ config, data }: KaiScoreWidgetProps): React.JSX.Element {
  const { data: marketData, loadingMap, errorMap, refreshWidget } = useMarketData()
  const sourceData = data ?? marketData
  const kai = sourceData?.analysisScores?.kai

  const loading = !!loadingMap?.[config.instanceId]
  const error = errorMap?.[config.instanceId] ?? null
  const visualState = error
    ? 'error'
    : loading
      ? 'loading'
      : !kai || kai.dimensions.length === 0
        ? 'empty'
        : 'ready'

  const topMetrics = [
    { name: '综合评分', value: kai.totalScore, icon: <Activity className="h-4 w-4" /> },
    { name: '情绪值', value: kai.sentiment, icon: <Smile className="h-4 w-4" /> },
    { name: '趋势值', value: kai.trend, icon: <TrendingUp className="h-4 w-4" /> },
    { name: '流量值', value: kai.flow, icon: <Droplets className="h-4 w-4" /> },
  ]

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载 KAI 评分…"
      emptyTitle="暂无 KAI 评分数据"
      emptyDescription="当前未获取到 KAI 选股综合评分与维度分布"
      skeleton={
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rect" className="h-20" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="text" className="h-2 w-full" />
            ))}
          </div>
          <Skeleton variant="rect" className="h-32" />
        </div>
      }
      className="h-full flex flex-col"
    >
      <div className="flex-1 overflow-auto space-y-4">
        {/* 顶部指标卡 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {topMetrics.map((metric) => {
            const level = getScoreLevel(metric.value)
            return (
              <div key={metric.name} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  {metric.icon}
                  <span className="text-xs">{metric.name}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold" style={{ color: level.color }}>
                    {metric.value}
                  </span>
                  <Badge variant="outline" className="text-xs" style={{ borderColor: level.color, color: level.color }}>
                    {level.label}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>

        {/* 维度横向柱状图 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">维度评分</h4>
          <div className="space-y-2">
            {kai.dimensions.map((dim: KaiDimension) => (
              <div key={dim.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{dim.name}</span>
                  <span className="font-medium">{dim.score}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${dim.color}`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 细项分布表 */}
        <div className="space-y-2 flex-1 overflow-auto">
          <h4 className="text-sm font-medium text-muted-foreground">维度细项分布</h4>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>维度</TableHead>
                  <TableHead>细项</TableHead>
                  <TableHead className="text-right">得分</TableHead>
                  <TableHead className="text-right">权重</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kai.detailDistribution.map((item: KaiDetailItem) => (
                  <TableRow key={`${item.dimensionName}-${item.itemName}`}>
                    <TableCell className="text-xs">{item.dimensionName}</TableCell>
                    <TableCell className="text-xs">{item.itemName}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className={`text-xs ${item.color} text-white`}>
                        {item.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {(item.weight * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </WidgetStateShell>
  )
}
