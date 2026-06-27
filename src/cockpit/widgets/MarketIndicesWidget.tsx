import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig, MarketIndexData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLORS } from '@/constants/cockpit.constants'

interface MarketIndicesWidgetProps {
  config: WidgetConfig
}

export default function MarketIndicesWidget({ config }: MarketIndicesWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap } = useMarketData()
  const indices = data.indices
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4" style={{ color: COLORS.UP }} />
    if (change < 0) return <TrendingDown className="h-4 w-4" style={{ color: COLORS.DOWN }} />
    return <Minus className="h-4 w-4" style={{ color: COLORS.NEUTRAL }} />
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return COLORS.UP
    if (change < 0) return COLORS.DOWN
    return COLORS.NEUTRAL
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-red-500">
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
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-6 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-16" />
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
            <div className="text-xs text-gray-400">
              最高:{index.high?.toFixed(0)} 最低:{index.low?.toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">成交:{index.volume}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
