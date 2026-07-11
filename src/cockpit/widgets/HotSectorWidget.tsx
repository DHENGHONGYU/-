import React, { memo } from 'react'
import { Flame, TrendingUp, Smile, Activity, DollarSign, Globe } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { useDualStrategyStore } from '@/store/dualStrategyStore'
import type { WidgetConfig, HotSectorData } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

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
  marketEnv: <Globe className="h-3 w-3" />,
}

const DIMENSION_NAMES: Record<string, string> = {
  momentum: '动量',
  sentiment: '情绪',
  technical: '技术',
  valuation: '估值',
  marketEnv: '环境',
}

/**
 * 热门板块策略 Widget
 * @description 展示热门板块策略评分与相关标的五维评分
 */
const HotSectorWidget = memo(function HotSectorWidget({ config, data }: HotSectorWidgetProps): React.JSX.Element {
  const storeHotSectors = useDualStrategyStore((s) => s.hotSectorScores)
  const hotSectors = (data?.hotSectors ?? storeHotSectors) ?? []
  const visualState = hotSectors.length === 0 ? 'empty' : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Flame className={`h-4 w-4 ${COLOR_TOKENS.orange.tailwind}`} />}
      visualState={visualState}
      emptyTitle="暂无热门板块策略"
      emptyDescription="当前未获取到热门板块评分与跟进建议"
      className="h-full flex flex-col"
    >
      <div className="flex-1 overflow-auto space-y-4">
        <div className="space-y-3">
          {hotSectors.map((item) => {
            const action = getActionLabel(item.action ?? 'ignore')
            const scoreColor = getScoreColor(item.score ?? 0)
            const dimensions = item.dimensions ?? {}

            return (
              <div key={item.symbol} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.symbol}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: scoreColor }}>
                      {(item.score ?? 0).toFixed(2)}
                    </span>
                    <Badge variant={action.variant}>{action.label}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(dimensions).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {DIMENSION_ICONS[key]}
                        <span>{DIMENSION_NAMES[key]}</span>
                      </div>
                      <Progress value={(value || 0) * 20} className="h-1.5" />
                      <div className="text-xs font-medium text-right">{(value || 0).toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </WidgetStateShell>
  )
})

export default HotSectorWidget
