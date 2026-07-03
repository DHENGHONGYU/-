import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLORS } from '@/constants/cockpit.constants'

interface MarketSentimentWidgetProps {
  config: WidgetConfig
}

export default function MarketSentimentWidget({ config }: MarketSentimentWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap } = useMarketData()
  const sentiment = data.sentiment
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

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

  if (loading || !sentiment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-16 bg-gray-200 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center">
                <div className="h-6 bg-gray-200 rounded w-12 mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-16 mx-auto mt-1" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center">
                <div className="h-6 bg-gray-200 rounded w-10 mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-8 mx-auto mt-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const upPercent = ((sentiment.up / sentiment.totalStocks) * 100).toFixed(0)
  const downPercent = ((sentiment.down / sentiment.totalStocks) * 100).toFixed(0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">恐慌贪婪指数</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">{sentiment.fearGreedIndex}</span>
              {/* 恐慌贪婪指数标签色（A股惯例：贪婪=看涨=红，恐慌=看跌=绿；语义对应 COLOR_TOKENS.up/down） */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sentiment.fearGreedIndex > 50 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {sentiment.fearGreedLabel}
              </span>
            </div>
          </div>
          <div className="w-24">
            <Progress value={sentiment.fearGreedIndex} max={100} className="h-2" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>恐惧</span>
              <span>贪婪</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" style={{ color: COLORS.UP }} />
            <div>
              <div className="text-lg font-bold" style={{ color: COLORS.UP }}>{upPercent}%</div>
              <div className="text-xs text-gray-400">涨 {sentiment.up}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" style={{ color: COLORS.DOWN }} />
            <div>
              <div className="text-lg font-bold" style={{ color: COLORS.DOWN }}>{downPercent}%</div>
              <div className="text-xs text-gray-400">跌 {sentiment.down}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold" style={{ color: COLORS.UP }}>{sentiment.limitUp}</div>
            <div className="text-xs text-gray-400">涨停</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: COLORS.DOWN }}>{sentiment.limitDown}</div>
            <div className="text-xs text-gray-400">跌停</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: COLORS.UP }}>0</div>
            <div className="text-xs text-gray-400">涨幅&gt;5%</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: COLORS.DOWN }}>0</div>
            <div className="text-xs text-gray-400">跌幅&gt;5%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
