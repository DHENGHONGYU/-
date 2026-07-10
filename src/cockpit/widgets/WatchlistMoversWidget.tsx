import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/states'
import { WidgetStateShell } from './components/WidgetStateShell'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { getStockColorHex, twText, twBorder, DARK } from '@/constants/theme.tokens'
import { computeWatchlistMovers } from '@/services/trading/watchlistMoversService'
import { cn } from '@/lib/utils'

interface WatchlistMoversWidgetProps {
  config: WidgetConfig
}

/**
 * WatchlistMoversWidget
 */
export default function WatchlistMoversWidget({ config }: WatchlistMoversWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const watchlist = data.watchlist
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const movers = useMemo(() => computeWatchlistMovers(watchlist, 5), [watchlist])

  const visualState = error
    ? 'error'
    : loading
      ? 'loading'
      : watchlist.length === 0
        ? 'empty'
        : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Activity className={cn('h-4 w-4', twText('emerald', 500))} />}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      skeleton={
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="text" />
              <Skeleton variant="text" className="h-6" />
              <Skeleton variant="text" />
            </div>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MoverList
          title="涨幅榜"
          icon={<TrendingUp className={cn('h-4 w-4', twText('red', 500))} />}
          stocks={movers.gainers}
          emptyText="暂无上涨标的"
        />
        <MoverList
          title="跌幅榜"
          icon={<TrendingDown className={cn('h-4 w-4', twText('green', 500))} />}
          stocks={movers.losers}
          emptyText="暂无下跌标的"
        />
        <MoverList
          title="振幅榜"
          icon={<Activity className={cn('h-4 w-4', twText('amber', 500))} />}
          stocks={movers.mostActive}
          emptyText="暂无活跃标的"
        />
      </div>
    </WidgetStateShell>
  )
}

interface MoverListProps {
  title: string
  icon: React.ReactNode
  stocks: { name: string; code: string; price: number; changePercent: number }[]
  emptyText: string
}

function MoverList({ title, icon, stocks, emptyText }: MoverListProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        <span>{title}</span>
      </div>
      {stocks.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {stocks.map((stock) => {
            const color = getStockColorHex(stock.changePercent)
            return (
              <li
                key={stock.code}
                className={cn(
                  'flex items-center justify-between rounded-md border px-2.5 py-1.5',
                  'bg-card',
                  twBorder('stone', 200),
                  DARK.borderNeutral700,
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{stock.name}</p>
                  <p className="text-xs text-muted-foreground">{stock.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{stock.price.toFixed(2)}</p>
                  <p className="text-xs font-medium" style={{ color }}>
                    {stock.changePercent > 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}%
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
