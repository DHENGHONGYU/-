import React from 'react'
import { TrendingUp, Wallet, Target, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLORS } from '@/constants/cockpit.constants'

interface PortfolioOverviewWidgetProps {
  config: WidgetConfig
}

export default function PortfolioOverviewWidget({ config }: PortfolioOverviewWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap } = useMarketData()
  const portfolio = data.portfolio
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

  if (loading || !portfolio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-gray-200 rounded w-full" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-6 bg-gray-200 rounded w-20 mt-1" />
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
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">总资产</span>
          <span className="text-xl font-bold">{portfolio.totalAssets}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-400">可用资金</span>
            </div>
            <span className="text-lg font-medium">{portfolio.availableFunds}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-400">持仓</span>
            </div>
            <span className="text-lg font-medium">{portfolio.holdings}只</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">当日盈亏</div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" style={{ color: COLORS.UP }} />
              <span className="text-lg font-bold" style={{ color: COLORS.UP }}>{portfolio.todayPnL}</span>
            </div>
            <span className="text-sm" style={{ color: COLORS.UP }}>+{portfolio.todayPnLPercent}%</span>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">累计盈亏</div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-lg font-bold text-blue-500">{portfolio.totalPnL}</span>
            </div>
            <span className="text-sm text-blue-500">+{portfolio.totalPnLPercent}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-xs text-gray-400">最大回撤</span>
            </div>
            <span className="text-lg font-medium" style={{ color: COLORS.DOWN }}>0%</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: COLORS.UP }} />
              <span className="text-xs text-gray-400">夏普比率</span>
            </div>
            <span className="text-lg font-medium" style={{ color: COLORS.UP }}>0.0</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
