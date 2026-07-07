import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig, WatchlistData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLOR_TOKENS, COLOR_SHADES, getStockColorHex } from '@/constants/theme.tokens'

interface WatchlistWidgetProps {
  config: WidgetConfig
}

export default function WatchlistWidget({ config }: WatchlistWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap } = useMarketData()
  const watchlist = data.watchlist
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getChangeIcon = (change: number) => {
    const color = getStockColorHex(change)
    if (change > 0) return <TrendingUp className="h-4 w-4" style={{ color }} />
    if (change < 0) return <TrendingDown className="h-4 w-4" style={{ color }} />
    return <Minus className="h-4 w-4" style={{ color }} />
  }

  const getChangeColor = (change: number) => {
    return getStockColorHex(change)
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
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className={`h-4 ${COLOR_SHADES.gray[200]} rounded w-32`} />
                <div className="flex gap-2">
                  <div className={`h-6 ${COLOR_SHADES.gray[200]} rounded w-20`} />
                  <div className={`h-6 ${COLOR_SHADES.gray[200]} rounded w-12`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {watchlist.map((stock: WatchlistData) => (
            <div key={stock.code} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{stock.name}</span>
                {getChangeIcon(stock.changePercent)}
              </div>
              <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>{stock.code}</div>
              <div className="text-lg font-bold">{stock.price.toFixed(2)}</div>
              <div className="text-sm font-medium" style={{ color: getChangeColor(stock.changePercent) }}>
                {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
