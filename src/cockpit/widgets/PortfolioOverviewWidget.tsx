import React from 'react'
import { TrendingUp, Wallet, Target, AlertTriangle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeMaxDrawdown, computeSharpeRatio } from '@/lib/utils/portfolioMetrics'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import type { WidgetConfig, HoldingItem, RebalancePlanItem } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { COLORS } from '@/constants/cockpit.constants'
import {
  STOCK_COLOR_TOKENS,
  COLOR_TOKENS,
  COLOR_SHADES,
  twText,
  twBg,
  twBorder,
} from '@/constants/theme.tokens'

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
    <div className={cn('flex items-center justify-between py-2 border-b', twBorder('gray', 100), 'last:border-0')}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{holding.name}</span>
          <span className={cn('text-xs', COLOR_SHADES.gray[400])}>{holding.symbol}</span>
        </div>
        <div className={cn('text-xs', COLOR_SHADES.gray[500], 'mt-0.5')}>
          {holding.shares}股 · {holding.price} · {holding.marketValue}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={cn('text-sm', weightColor)}>
            {holding.weight.toFixed(1)}%
            <ArrowRight className={cn('inline h-3 w-3 mx-1', COLOR_SHADES.gray[400])} />
            <span className={COLOR_SHADES.gray[500]}>{holding.targetWeight.toFixed(1)}%</span>
          </div>
          <div className={cn('text-xs', pnlPositive ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind)}>
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
        <span className={cn('font-medium', actionColor)}>{actionLabel}</span>
        <span className="truncate">{item.name}</span>
        <span className={cn('text-xs', COLOR_SHADES.gray[400])}>{item.symbol}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('font-medium', actionColor)}>{item.shares}股</span>
        <span className={cn('text-xs', COLOR_SHADES.gray[500], 'truncate max-w-[120px]')} title={item.reason}>
          {item.reason}
        </span>
      </div>
    </div>
  )
}

/**
 * PortfolioOverviewWidget
 */
export default function PortfolioOverviewWidget({ config }: PortfolioOverviewWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const portfolio = data?.portfolio
  const loading = loadingMap?.[config.instanceId] ?? true
  const error = errorMap?.[config.instanceId]

  // B1 修复：从真实权益曲线（equityCurve）计算风险指标，缺失时显式标注「数据不足」
  const equityCurve = portfolio?.equityCurve ?? []
  const hasEquityCurve = equityCurve.length >= 2
  const maxDrawdown = hasEquityCurve ? computeMaxDrawdown(equityCurve) : NaN
  const sharpe = hasEquityCurve ? computeSharpeRatio(equityCurve) : NaN

  let visualState: 'ready' | 'loading' | 'empty' | 'error' = 'ready'
  if (error) {
    visualState = 'error'
  } else if (loading || !portfolio) {
    visualState = 'loading'
  }

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载持仓数据中…"
      skeleton={
        <div className="space-y-4">
          <Skeleton variant="text" className={cn(twBg('gray', 200), 'h-10 w-full')} />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <Skeleton variant="text" className={cn(twBg('gray', 200), 'h-4 w-16')} />
                <Skeleton variant="text" className={cn(twBg('gray', 200), 'h-6 w-20 mt-1')} />
              </div>
            ))}
          </div>
        </div>
      }
    >
      {portfolio && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={cn('text-sm', COLOR_SHADES.gray[500])}>总资产</span>
          <span className="text-xl font-bold">{portfolio.totalAssets}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className={cn('h-4 w-4', COLOR_SHADES.gray[400])} />
              <span className={cn('text-xs', COLOR_SHADES.gray[400])}>可用资金</span>
            </div>
            <span className="text-lg font-medium">{portfolio.availableFunds}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Target className={cn('h-4 w-4', COLOR_SHADES.gray[400])} />
              <span className={cn('text-xs', COLOR_SHADES.gray[400])}>持仓</span>
            </div>
            <span className="text-lg font-medium">{portfolio.holdings}只</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={cn('rounded-lg p-3 border', twBg('green', 50))}>
            <div className={cn('text-xs', COLOR_SHADES.gray[500])}>当日盈亏</div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" style={{ color: COLORS.UP }} />
              <span className="text-lg font-bold" style={{ color: COLORS.UP }}>{portfolio.todayPnL}</span>
            </div>
            <span className="text-sm" style={{ color: COLORS.UP }}>+{portfolio.todayPnLPercent}%</span>
          </div>
          <div className="rounded-lg p-3 bg-card border">
            <div className={cn('text-xs', COLOR_SHADES.gray[500])}>累计盈亏</div>
            <div className="flex items-center gap-1">
              <TrendingUp className={cn('h-4 w-4', COLOR_TOKENS.info.tailwind)} />
              <span className={cn('text-lg font-bold', COLOR_TOKENS.info.tailwind)}>{portfolio.totalPnL}</span>
            </div>
            <span className={cn('text-sm', COLOR_TOKENS.info.tailwind)}>+{portfolio.totalPnLPercent}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn('h-4 w-4', twText('red', 400))} />
              <span className={cn('text-xs', COLOR_SHADES.gray[400])}>最大回撤</span>
            </div>
            {hasEquityCurve ? (
              <span className="text-lg font-medium" style={{ color: COLORS.DOWN }}>{maxDrawdown.toFixed(1)}%</span>
            ) : (
              <span className={cn('text-sm', COLOR_SHADES.gray[400])}>数据不足</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" style={{ color: COLORS.UP }} />
              <span className={cn('text-xs', COLOR_SHADES.gray[400])}>夏普比率</span>
            </div>
            {hasEquityCurve ? (
              <span className="text-lg font-medium" style={{ color: COLORS.UP }}>{sharpe.toFixed(2)}</span>
            ) : (
              <span className={cn('text-sm', COLOR_SHADES.gray[400])}>数据不足</span>
            )}
          </div>
        </div>

        {/* 持仓列表 */}
        <div className="pt-2">
          <div className={cn('text-xs font-medium', COLOR_SHADES.gray[500], 'mb-2')}>持仓明细</div>
          {portfolio.holdingsList.length > 0 ? (
            <div data-testid="holdings-list">
              {portfolio.holdingsList.map((holding) => (
                <HoldingRow key={holding.symbol} holding={holding} />
              ))}
            </div>
          ) : (
            <div data-testid="holdings-empty" className={cn('text-center py-4 text-sm', COLOR_SHADES.gray[400])}>
              暂无持仓
            </div>
          )}
        </div>

        {/* 再平衡计划 */}
        <div className="pt-2">
          <div className={cn('text-xs font-medium', COLOR_SHADES.gray[500], 'mb-2')}>再平衡计划</div>
          {portfolio.rebalancePlan.length > 0 ? (
            <div data-testid="rebalance-plan" className="space-y-1">
              {portfolio.rebalancePlan.map((item) => (
                <RebalanceActionRow key={`${item.symbol}-${item.action}`} item={item} />
              ))}
            </div>
          ) : (
            <div data-testid="rebalance-empty" className={cn('text-center py-4 text-sm', COLOR_SHADES.gray[400])}>
              组合已平衡
            </div>
          )}
        </div>
      </div>
      )}
    </WidgetStateShell>
  )
}
