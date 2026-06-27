import React from 'react'
import { Flame, TrendingUp, Smile, Activity, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { useOptionalMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, HotSectorData } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'

interface HotSectorWidgetProps {
  config: WidgetConfig
  data?: {
    hotSectors?: HotSectorData[]
  }
}

function getActionLabel(action: HotSectorData['action']): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (action) {
    case 'immediate':
      return { label: '立即跟进', variant: 'default' }
    case 'probe':
      return { label: '试探', variant: 'secondary' }
    case 'ignore':
    default:
      return { label: '不追', variant: 'outline' }
  }
}

function getScoreColor(score: number): string {
  if (score >= SCORE_LEVELS.EXCELLENT.min / 20) return SCORE_LEVELS.EXCELLENT.color
  if (score >= SCORE_LEVELS.GOOD.min / 20) return SCORE_LEVELS.GOOD.color
  if (score >= SCORE_LEVELS.AVERAGE.min / 20) return SCORE_LEVELS.AVERAGE.color
  if (score >= SCORE_LEVELS.POOR.min / 20) return SCORE_LEVELS.POOR.color
  return SCORE_LEVELS.BAD.color
}

const DIMENSION_ICONS: Record<string, React.ReactNode> = {
  momentum: <TrendingUp className="h-3 w-3" />,
  sentiment: <Smile className="h-3 w-3" />,
  technical: <Activity className="h-3 w-3" />,
  valuation: <DollarSign className="h-3 w-3" />,
  composite: <Flame className="h-3 w-3" />,
}

const DIMENSION_NAMES: Record<string, string> = {
  momentum: '动量',
  sentiment: '情绪',
  technical: '技术',
  valuation: '估值',
  composite: '综合',
}

/**
 * 热门板块策略 Widget
 * @description 展示热门板块策略评分与相关标的五维评分
 */
export default function HotSectorWidget({ config, data }: HotSectorWidgetProps): React.JSX.Element {
  const marketData = useOptionalMarketData()
  const sourceData = data ?? marketData?.data ?? { hotSectors: [] }
  const hotSectors = sourceData.hotSectors ?? []

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-4">
        {hotSectors.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无热门板块策略数据</div>
        ) : (
          <div className="space-y-3">
            {hotSectors.map((item) => {
              const action = getActionLabel(item.action)
              const scoreColor = getScoreColor(item.score)

              return (
                <div key={item.symbol} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.symbol}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold" style={{ color: scoreColor }}>
                        {item.score.toFixed(2)}
                      </span>
                      <Badge variant={action.variant}>{action.label}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(item.dimensions).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {DIMENSION_ICONS[key]}
                          <span>{DIMENSION_NAMES[key]}</span>
                        </div>
                        <Progress value={value * 20} className="h-1.5" />
                        <div className="text-xs font-medium text-right">{value.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
