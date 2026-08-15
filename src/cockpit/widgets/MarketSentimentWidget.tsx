import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Progress } from '@/components/atoms/Progress'
import { Skeleton } from '@/components/molecules/states'
import { WidgetStateShell } from './components/WidgetStateShell'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { STOCK_COLOR_TOKENS, COLOR_SHADES } from '@/constants/theme.tokens'

interface MarketSentimentWidgetProps {
  config: WidgetConfig
}

/**
 * MarketSentimentWidget
 */
export default function MarketSentimentWidget({ config }: MarketSentimentWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const sentiment = data.sentiment
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const visualState = (error ?? '') !== ''
    ? 'error'
    : (loading ?? false) === true
      ? 'loading'
      : sentiment == null
        ? 'empty'
        : 'ready'

  const content = (() => {
    if (sentiment == null) return null

    const upPercent = ((sentiment.up / sentiment.totalStocks) * 100).toFixed(0)
    const downPercent = ((sentiment.down / sentiment.totalStocks) * 100).toFixed(0)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-sm ${COLOR_SHADES.gray[500]}`}>恐慌贪婪指数</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-h1 font-bold">{sentiment.fearGreedIndex}</span>
              {/* 恐慌贪婪指数标签色（A股惯例：贪婪=看涨=红，恐慌=看跌=绿；语义对应 STOCK_COLOR_TOKENS.up/down） */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sentiment.fearGreedIndex > 50 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                {sentiment.fearGreedLabel}
              </span>
            </div>
          </div>
          <div className="w-24">
            <Progress value={sentiment.fearGreedIndex} max={100} className="h-2" />
            <div className={`flex justify-between text-xs ${COLOR_SHADES.gray[400]} mt-1`}>
              <span>恐惧</span>
              <span>贪婪</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" style={{ color: STOCK_COLOR_TOKENS.up.hex }} />
            <div>
              <div className="text-lg font-bold" style={{ color: STOCK_COLOR_TOKENS.up.hex }}>{upPercent}%</div>
              <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>涨 {sentiment.up}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" style={{ color: STOCK_COLOR_TOKENS.down.hex }} />
            <div>
              <div className="text-lg font-bold" style={{ color: STOCK_COLOR_TOKENS.down.hex }}>{downPercent}%</div>
              <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>跌 {sentiment.down}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold" style={{ color: STOCK_COLOR_TOKENS.up.hex }}>{sentiment.limitUp}</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>涨停</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: STOCK_COLOR_TOKENS.down.hex }}>{sentiment.limitDown}</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>跌停</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: STOCK_COLOR_TOKENS.up.hex }}>0</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>涨幅&gt;5%</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: STOCK_COLOR_TOKENS.down.hex }}>0</div>
            <div className={`text-xs ${COLOR_SHADES.gray[400]}`}>跌幅&gt;5%</div>
          </div>
        </div>
      </div>
    )
  })()

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton variant="text" className="h-6 w-12 mx-auto" />
                <Skeleton variant="text" className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton variant="text" className="h-6 w-10 mx-auto" />
                <Skeleton variant="text" className="h-4 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      {content}
    </WidgetStateShell>
  )
}
