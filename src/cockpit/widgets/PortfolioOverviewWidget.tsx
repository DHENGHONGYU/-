import React from 'react'
import { TrendingUp, Wallet, Target, AlertTriangle, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { WidgetConfig, HoldingItem, RebalancePlanItem } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLORS } from '@/constants/cockpit.constants'
import { STOCK_COLOR_TOKENS, COLOR_TOKENS, COLOR_SHADES, twText, twBg, twBorder } from '@/constants/theme.tokens'

/** 权重偏离阈值（百分比），超过此值视为需要调整 */
const WEIGHT_DEVIATION_THRESHOLD = 5

interface PortfolioOverviewWidgetProps {
  config: WidgetConfig
}

/** 计算权重偏离状态：overweight（超配）/ underweight（低配）/ balanced（平衡） */
function getWeightStatus(
  weight: number,
  targetWeight: number,
): 'overweight' | 'underweight' | 'balanced' {
  const deviation = weight - targetWeight
  if (deviation > WEIGHT_DEVIATION_THRESHOLD) return 'overweight'
  if (deviation < -WEIGHT_DEVIATION_THRESHOLD) return 'underweight'
  return 'balanced'
}

/** 获取权重显示的颜色令牌 */
function getWeightColorClass(status: 'overweight' | 'underweight' | 'balanced'): string {
  if (status === 'overweight') return twText('red', 500)
  if (status === 'underweight') return twText('amber', 500)
  return COLOR_SHADES.gray[500]
}

/** 获取再平衡动作的颜色令牌 */
function getActionColorClass(action: RebalancePlanItem['action']): string {
  if (action === 'buy') return STOCK_COLOR_TOKENS.up.tailwind
  if (action === 'sell') return STOCK_COLOR_TOKENS.down.tailwind
  return COLOR_SHADES.gray[500]
}

/** 渲染单个持仓项 */
function HoldingRow({ holding }: { holding: HoldingItem }): React.JSX.Element {
  const weightStatus = getWeightStatus(holding.weight, holding.targetWeight)
  const weightColor = getWeightColorClass(weightStatus)
  const pnlPositive = holding.pnlPercent >= 0

  return (
    <div className={`flex items-center justify-between py-2 border-b ${twBorder('gray', 100)} last:border-0`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{holding.name}</span>
          <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>{holding.symbol}</span>
        </div>
        <div className={`text-xs ${COLOR_SHADES.gray[500]} mt-0.5`}>
          {holding.shares}股 · {holding.price} · {holding.marketValue}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={`text-sm ${weightColor}`}>
            {holding.weight.toFixed(1)}%
            <ArrowRight className={`inline h-3 w-3 mx-1 ${COLOR_SHADES.gray[400]}`} />
            <span className={COLOR_SHADES.gray[500]}>{holding.targetWeight.toFixed(1)}%</span>
          </div>
          <div className={`text-xs ${pnlPositive ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}`}>
            {holding.pnl} ({pnlPositive ? '+' : ''}{holding.pnlPercent}%)
          </div>
        </div>
      </div>
    </div>
  )
}

/** 渲染再平衡计划项 */
function RebalanceActionRow({ item }: { item: RebalancePlanItem }): React.JSX.Element {
  const actionColor = getActionColorClass(item.action)
  const actionLabel = item.action === 'buy' ? '买入' : item.action === 'sell' ? '卖出' : '持有'

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className={`font-medium ${actionColor}`}>{actionLabel}</span>
        <span className="truncate">{item.name}</span>
        <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>{item.symbol}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-medium ${actionColor}`}>{item.shares}股</span>
        <span className={`text-xs ${COLOR_SHADES.gray[500]} truncate max-w-[120px]`} title={item.reason}>
          {item.reason}
        </span>
      </div>
    </div>
  )
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
        <CardContent className={`text-center ${COLOR_TOKENS.danger.tailwind}`}>
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
          <div className={`h-10 ${COLOR_SHADES.gray[200]} rounded w-full`} />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className={`h-4 ${COLOR_SHADES.gray[200]} rounded w-16`} />
                <div className={`h-6 ${COLOR_SHADES.gray[200]} rounded w-20 mt-1`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasHoldings = portfolio.holdingsList.length > 0
  const hasRebalancePlan = portfolio.rebalancePlan.length > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`text-sm ${COLOR_SHADES.gray[500]}`}>总资产</span>
          <span className="text-xl font-bold">{portfolio.totalAssets}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className={`h-4 w-4 ${COLOR_SHADES.gray[400]}`} />
              <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>可用资金</span>
            </div>
            <span className="text-lg font-medium">{portfolio.availableFunds}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Target className={`h-4 w-4 ${COLOR_SHADES.gray[400]}`} />
              <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>持仓</span>
            </div>
            <span className="text-lg font-medium">{portfolio.holdings}只</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`${twBg('green', 50)} rounded-lg p-3`}>
            <div className={`text-xs ${COLOR_SHADES.gray[500]}`}>当日盈亏</div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" style={{ color: COLORS.UP }} />
              <span className="text-lg font-bold" style={{ color: COLORS.UP }}>{portfolio.todayPnL}</span>
            </div>
            <span className="text-sm" style={{ color: COLORS.UP }}>+{portfolio.todayPnLPercent}%</span>
          </div>
          <div className={`${twBg('blue', 50)} rounded-lg p-3`}>
            <div className={`text-xs ${COLOR_SHADES.gray[500]}`}>累计盈亏</div>
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-4 w-4 ${COLOR_TOKENS.info.tailwind}`} />
              <span className={`text-lg font-bold ${COLOR_TOKENS.info.tailwind}`}>{portfolio.totalPnL}</span>
            </div>
            <span className={`text-sm ${COLOR_TOKENS.info.tailwind}`}>+{portfolio.totalPnLPercent}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${twText('red', 400)}`} />
              <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>最大回撤</span>
            </div>
            <span className="text-lg font-medium" style={{ color: COLORS.DOWN }}>0%</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: COLORS.UP }} />
              <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>夏普比率</span>
            </div>
            <span className="text-lg font-medium" style={{ color: COLORS.UP }}>0.0</span>
          </div>
        </div>

        {/* 持仓列表 */}
        <div className="pt-2">
          <div className={`text-xs font-medium ${COLOR_SHADES.gray[500]} mb-2`}>持仓明细</div>
          {hasHoldings ? (
            <div data-testid="holdings-list">
              {portfolio.holdingsList.map((holding) => (
                <HoldingRow key={holding.symbol} holding={holding} />
              ))}
            </div>
          ) : (
            <div data-testid="holdings-empty" className={`text-center py-4 text-sm ${COLOR_SHADES.gray[400]}`}>
              暂无持仓
            </div>
          )}
        </div>

        {/* 再平衡计划 */}
        <div className="pt-2">
          <div className={`text-xs font-medium ${COLOR_SHADES.gray[500]} mb-2`}>再平衡计划</div>
          {hasRebalancePlan ? (
            <div data-testid="rebalance-plan" className="space-y-1">
              {portfolio.rebalancePlan.map((item) => (
                <RebalanceActionRow key={`${item.symbol}-${item.action}`} item={item} />
              ))}
            </div>
          ) : (
            <div data-testid="rebalance-empty" className={`text-center py-4 text-sm ${COLOR_SHADES.gray[400]}`}>
              组合已平衡
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
