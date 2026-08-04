import React from 'react'
import { TrendingUp, TrendingDown, Minus, Eye } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import type { WidgetConfig, WatchlistData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { getStockColorHex, twText, twBg } from '@/constants/theme.tokens'
import { safeFormatNumber, safeFormatPercent, isValidNumber } from '@/lib/format'

interface WatchlistWidgetProps {
  config: WidgetConfig
}

/**
 * WatchlistWidget
 */
export default function WatchlistWidget({ config }: WatchlistWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const watchlist = data.watchlist
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const getChangeIcon = (change: number | undefined) => {
    if (!isValidNumber(change)) return <Minus className="h-4 w-4" style={{ color: twText('gray', 400) }} />
    const color = getStockColorHex(change)
    if (change > 0) return <TrendingUp className="h-4 w-4" style={{ color }} />
    if (change < 0) return <TrendingDown className="h-4 w-4" style={{ color }} />
    return <Minus className="h-4 w-4" style={{ color }} />
  }

  const getChangeColor = (change: number | undefined) => {
    if (!isValidNumber(change)) return twText('gray', 400)
    return getStockColorHex(change)
  }

  let visualState: 'ready' | 'loading' | 'empty' | 'error' = 'ready'
  if (error) {
    visualState = 'error'
  } else if (loading) {
    visualState = 'loading'
  } else if (watchlist.length === 0) {
    visualState = 'empty'
  }

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Eye className={twText('emerald', 500)} />}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载自选行情…"
      emptyTitle="暂无自选标的"
      emptyDescription="当前观察池为空，添加股票后将自动展示行情"
      skeleton={
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="text" className={twBg('gray', 200)} />
              <div className="flex gap-2">
                <Skeleton variant="text" className={twBg('gray', 200)} />
                <Skeleton variant="text" className={twBg('gray', 200)} />
              </div>
            </div>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-4 gap-4">
        {watchlist.map((stock: WatchlistData) => (
            <div key={stock.code} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{stock.name}</span>
                {getChangeIcon(stock.changePercent)}
              </div>
              <div className={twText('gray', 400)}>{stock.code}</div>
              <div className="text-lg font-bold">{safeFormatNumber(stock.price, 2)}</div>
              <div className="text-sm font-medium" style={{ color: getChangeColor(stock.changePercent) }}>
                {safeFormatPercent(stock.changePercent, 2)}
              </div>
            </div>
        ))}
      </div>
    </WidgetStateShell>
  )
}
