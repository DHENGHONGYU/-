import React from 'react'
import { Gem, Sparkles, DollarSign, Users, RotateCcw, Droplets } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { useOptionalMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, ValuePitData } from '@/types/modules/widget.types'
import { SCORE_LEVELS } from '@/constants/cockpit.constants'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { UI_TEXT } from '@/constants/uiText'

interface ValuePitWidgetProps {
  config: WidgetConfig
  data?: {
    valuePit?: ValuePitData[]
  }
}

function getActionLabel(action: ValuePitData['action']): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (action) {
    case 'immediate':
      return { label: '立即建仓', variant: 'default' }
    case 'probe':
      return { label: '试探', variant: 'secondary' }
    case 'wait':
      return { label: '等轮动', variant: 'outline' }
    case 'ignore':
    default:
      return { label: '不建', variant: 'destructive' }
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
  catalyst: <Sparkles className="h-3 w-3" />,
  valuation: <DollarSign className="h-3 w-3" />,
  chip: <Users className="h-3 w-3" />,
  rotation: <RotateCcw className="h-3 w-3" />,
  liquidity: <Droplets className="h-3 w-3" />,
  composite: <Gem className="h-3 w-3" />,
}

const DIMENSION_NAMES: Record<string, string> = {
  catalyst: '催化',
  valuation: '估值',
  chip: '筹码',
  rotation: '轮动',
  liquidity: '流动性',
  composite: '综合',
}

/**
 * 价值洼地策略 Widget
 * @description 展示价值洼地候选、五维评分与轮动信号状态
 */
export default function ValuePitWidget({ config, data }: ValuePitWidgetProps): React.JSX.Element {
  const marketData = useOptionalMarketData()
  const sourceData = data ?? marketData?.data ?? { valuePit: [] }
  const valuePit = sourceData.valuePit ?? []
  const visualState = valuePit.length === 0 ? 'empty' : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Gem className={`h-4 w-4 ${COLOR_TOKENS.info.tailwind}`} />}
      visualState={visualState}
      emptyTitle={UI_TEXT.analysis.valuePit.noData}
      emptyDescription="当前未获取到价值洼地候选与建仓信号"
      className="h-full flex flex-col"
    >
      <div className="flex-1 overflow-auto space-y-4">
        <div className="space-y-3">
          {valuePit.map((item) => {
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
                    {item.rotationSignal && (
                      <Badge variant="default" className="bg-success">
                        轮动信号
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-2">
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
      </div>
    </WidgetStateShell>
  )
}
