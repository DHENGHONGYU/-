import React, { useEffect, useRef, Suspense } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTradingStore } from '@/store/tradingStore'
import { CoreResourcePanel } from './panels/CoreResourcePanel'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

// 子页面懒加载
const StrategySnapshotPage = React.lazy(() => import('@/pages/trading/StrategySnapshotPage'))
const HoldingsPage = React.lazy(() => import('@/pages/trading/HoldingsPage'))
const ExecutionPlanPanel = React.lazy(() =>
  import('./panels/ExecutionPlanPanel').then((m) => ({ default: m.ExecutionPlanPanel })),
)
const PortfolioPage = React.lazy(() => import('@/pages/trading/PortfolioPage'))
const RiskControlPage = React.lazy(() => import('@/pages/trading/RiskControlPage'))
const TradingFlowPage = React.lazy(() => import('@/pages/trading/TradingFlowPage'))

interface TradingRoute {
  path: string
  branch: string
  componentName: string
  exact?: boolean
  component: React.ReactNode
  fallback: string
}

const TRADING_ROUTES: TradingRoute[] = [
  { path: '/trading/strategy-snapshots', branch: 'strategy-snapshots', componentName: 'StrategySnapshotPage', component: <StrategySnapshotPage />, fallback: '加载策略快照中...' },
  { path: '/trading/holdings', branch: 'holdings', componentName: 'HoldingsPage', component: <HoldingsPage />, fallback: '加载持仓管理中...' },
  { path: '/trading/execution-plans', branch: 'execution-plans', componentName: 'ExecutionPlanPanel', component: <ExecutionPlanPanel />, fallback: '加载执行计划中...' },
  { path: '/trading/execution', branch: 'execution', componentName: 'ExecutionPlanPanel', component: <ExecutionPlanPanel />, fallback: '加载执行管理中...' },
  { path: '/trading/portfolio', branch: 'portfolio', componentName: 'PortfolioPage', component: <PortfolioPage />, fallback: '加载投资组合中...' },
  { path: '/trading/risk', branch: 'risk', componentName: 'RiskControlPage', component: <RiskControlPage />, fallback: '加载风险控制中...' },
  { path: '/trading/flow', branch: 'flow', componentName: 'TradingFlowPage', component: <TradingFlowPage />, fallback: '加载交易流程中...' },
]

function matchTradingRoute(path: string): TradingRoute {
  for (const route of TRADING_ROUTES) {
    if (route.exact === false) {
      if (path === route.path || path.startsWith(route.path + '/')) return route
    } else if (path === route.path) {
      return route
    }
  }
  return { path: '', branch: 'default', componentName: 'TradingDashboard', component: null, fallback: '' }
}

const logger = getLogger()

// ---------- 默认交易看板 ----------

function TradingDashboard(): React.JSX.Element {
  const stocks = useTradingStore((s) => s.stocks)
  const orders = useTradingStore((s) => s.orders)
  const signals = useTradingStore((s) => s.signals)
  const adviceMap = useTradingStore((s) => s.adviceMap)
  const portfolio = useTradingStore((s) => s.portfolio)
  const strategyResult = useTradingStore((s) => s.strategyResult)
  const portfolioLoading = useTradingStore((s) => s.portfolioLoading)
  const processingSymbols = useTradingStore((s) => s.processingSymbols)
  const message = useTradingStore((s) => s.message)

  const loadStocks = useTradingStore((s) => s.loadStocks)
  const loadOrders = useTradingStore((s) => s.loadOrders)
  const scanSignals = useTradingStore((s) => s.scanSignals)
  const loadPortfolio = useTradingStore((s) => s.loadPortfolio)
  const handleBuy = useTradingStore((s) => s.handleBuy)
  const handleSell = useTradingStore((s) => s.handleSell)

  const signalColor = (direction: string): string => {
    switch (direction) {
      case 'buy':
        return `${COLOR_TOKENS.up.bgClass} ${COLOR_TOKENS.up.tailwind}`
      case 'sell':
        return `${COLOR_TOKENS.down.bgClass} ${COLOR_TOKENS.down.tailwind}`
      case 'watch':
        return `${COLOR_TOKENS.warning.bgClass} ${COLOR_TOKENS.warning.tailwind}`
      case 'hold':
        return `${COLOR_TOKENS.neutral.bgClass} ${COLOR_TOKENS.neutral.tailwind}`
      default:
        return `${COLOR_TOKENS.neutral.bgClass} ${COLOR_TOKENS.neutral.tailwind}`
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>交易舱 · 模拟盘</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={loadStocks}>
            加载观察池
          </Button>
          <Button variant="secondary" size="sm" onClick={loadOrders}>
            加载持仓
          </Button>
          <Button variant="secondary" size="sm" onClick={scanSignals}>
            扫描信号
          </Button>
          <Button variant="secondary" size="sm" onClick={loadPortfolio}>
            构建核心组合
          </Button>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <h3 className="text-sm font-semibold">观察池交易建议</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.map((stock) => {
            const advice = adviceMap[stock.symbol]
            const signal = advice?.signal
            return (
              <div
                key={stock.symbol}
                className="rounded-md border p-3 hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{stock.symbol}</span>
                  <Badge>{stock.researchStatus}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{stock.name}</p>
                {signal && (
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 font-medium ${signalColor(signal.direction)}`}>
                        {signal.direction.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">{signal.type}</span>
                      <span>置信 {(signal.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-muted-foreground">{signal.rationale}</p>
                    {advice.sizing && advice.sizing.action !== 'hold' && (
                      <p>
                        建议：{advice.sizing.action} {advice.sizing.targetShares} 股
                        （仓位 {(advice.sizing.positionPct * 100).toFixed(1)}%）
                      </p>
                    )}
                    {advice.risk && !advice.risk.ok && (
                      <p className={COLOR_TOKENS.danger.tailwind}>
                        风控阻塞：{advice.risk.blocks.join('；')}
                      </p>
                    )}
                    {advice.risk && advice.risk.ok && advice.risk.warnings.length > 0 && (
                      <p className={COLOR_TOKENS.warning.tailwind}>
                        风控提示：{advice.risk.warnings.join('；')}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => handleBuy(stock)} disabled={processingSymbols.has(stock.symbol)}>
                    {processingSymbols.has(stock.symbol) ? '执行中...' : '买入'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleSell(stock)} disabled={processingSymbols.has(stock.symbol)}>
                    {processingSymbols.has(stock.symbol) ? '执行中...' : '卖出'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <CoreResourcePanel
          portfolio={portfolio}
          strategyResult={strategyResult}
          loading={portfolioLoading}
          onRefresh={loadPortfolio}
        />

        {signals.length > 0 && (
          <>
            <h3 className="text-sm font-semibold">全部信号 ({signals.length})</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {signals.map((signal) => (
                <div key={signal.id} className="rounded-md border p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{signal.symbol}</span>
                    <span className={`rounded px-1.5 py-0.5 font-medium ${signalColor(signal.direction)}`}>
                      {signal.direction.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{signal.rationale}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <h3 className="text-sm font-semibold">持仓订单</h3>
        <div className="space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <span>
                {order.symbol} · {order.direction} · {order.quantity}股
              </span>
              <Badge variant="outline">{order.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 交易舱子路由分发
 *
 * @description
 * 使用 useLocation + 条件渲染实现子路由分发。
 * 新增子页面仅需在 TRADING_ROUTES 中追加条目并添加对应 React.lazy 导入。
 *
 * 路由映射：
 * - /trading/strategy-snapshots → StrategySnapshotPage
 * - /trading/holdings          → HoldingsPage
 * - /trading/execution-plans   → ExecutionPlanPanel
 * - /trading（默认）           → 交易看板（TradingDashboard）
 */
export default function TradingApp(): React.JSX.Element {
  const location = useLocation()
  const path = location.pathname
  const prevPathRef = useRef<string | null>(null)

  // 从 tradingStore 获取初始化日志所需状态
  const stocks = useTradingStore((s) => s.stocks)
  const orders = useTradingStore((s) => s.orders)
  const signals = useTradingStore((s) => s.signals)

  // 路由切换检测：仅在 pathname 变化时记录切换事件与渲染状态
  useEffect(() => {
    const prevPath = prevPathRef.current
    const isRouteChange = prevPath !== null && prevPath !== path

    if (isRouteChange) {
      logger.info('[TradingApp] 路由切换', { from: prevPath, to: path })
    }

    // 计算命中的分支与组件名
    const { branch, componentName } = matchTradingRoute(path)

    logger.info('[TradingApp] 渲染交易舱', {
      path,
      branch,
      component: componentName,
      isRouteChange,
    })

    prevPathRef.current = path
  }, [path])

  // 组件初始化日志
  useEffect(() => {
    logger.info('[TradingApp] 组件初始化', {
      stocksCount: stocks.length,
      ordersCount: orders.length,
      signalsCount: signals.length,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const matched = matchTradingRoute(path)

  return (
    <div className="space-y-4 p-4">
      {matched.component ? (
        <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{matched.fallback}</div>}>
          {matched.component}
        </Suspense>
      ) : (
        <TradingDashboard />
      )}
    </div>
  )
}
