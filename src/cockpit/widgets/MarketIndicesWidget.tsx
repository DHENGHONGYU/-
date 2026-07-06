import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig, MarketIndexData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLOR_TOKENS, twText } from '@/constants/theme.tokens'

interface MarketIndicesWidgetProps {
  config: WidgetConfig
}

export default function MarketIndicesWidget(props: MarketIndicesWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap } = useMarketData()
  // P0-2 防御性 guard：防止 props 为 null 时解构崩溃（hooks 之后条件返回）
  if (!props?.config) return <div className={`p-4 text-sm ${twText('gray', 400)}`}>配置未就绪</div>
  const { config } = props
  const indices = data.indices
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className={`h-4 w-4 ${COLOR_TOKENS.up.tailwind}`} />
    if (change < 0) return <TrendingDown className={`h-4 w-4 ${COLOR_TOKENS.down.tailwind}`} />
    return <Minus className={`h-4 w-4 ${twText('gray', 400)}`} />
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return COLOR_TOKENS.up.hex
    if (change < 0) return COLOR_TOKENS.down.hex
    return COLOR_TOKENS.neutral.hex
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className={`text-center ${COLOR_TOKENS.danger.tailwind}`}>
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className={`h-4 ${COLOR_TOKENS.neutral.bgClass} rounded w-24`} />
              <div className={`h-6 ${COLOR_TOKENS.neutral.bgClass} rounded w-20`} />
              <div className={`h-4 ${COLOR_TOKENS.neutral.bgClass} rounded w-16`} />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {indices.map((index: MarketIndexData) => (
          <div key={index.code} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{index.name}</span>
              {getChangeIcon(index.change)}
            </div>
            <div className="text-lg font-bold">{index.price.toFixed(2)}</div>
            <div className="text-sm" style={{ color: getChangeColor(index.changePercent) }}>
              {index.changePercent > 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
            </div>
            <div className={`text-xs ${COLOR_TOKENS.textMuted.tailwind}`}>
              最高:{index.high?.toFixed(0)} 最低:{index.low?.toFixed(0)}
            </div>
            <div className={`text-xs ${COLOR_TOKENS.textMuted.tailwind}`}>成交:{index.volume}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
