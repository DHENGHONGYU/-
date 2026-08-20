import React, { useCallback, useEffect, useMemo, useRef, Suspense } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Percent } from '@/components/atoms/Percent'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { useTradingStore } from '@/store/tradingStore'
import { CoreResourcePanel } from './panels/CoreResourcePanel'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/molecules/EmptyState'
import { Skeleton } from '@/components/molecules'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageContainer, PageHeader } from '@/components/templates'
import { useToast } from '@/hooks/useToast'
import { AlertTriangle } from 'lucide-react'

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
  const isRefreshing = useTradingStore((s) => s.isRefreshing)

  const loadStocks = useTradingStore((s) => s.loadStocks)
  const loadOrders = useTradingStore((s) => s.loadOrders)
  const scanSignals = useTradingStore((s) => s.scanSignals)
  const loadPortfolio = useTradingStore((s) => s.loadPortfolio)
  const handleBuy = useTradingStore((s) => s.handleBuy)
  const handleSell = useTradingStore((s) => s.handleSell)

  const { toast } = useToast()

  // 信号方向中文化映射
  const signalDirectionLabel = (direction: string): string => {
    switch (direction) {
      case 'buy': return '买入'
      case 'sell': return '卖出'
      case 'watch': return '观望'
      case 'hold': return '持有'
      default: return direction.toUpperCase()
    }
  }

  const signalDirectionClass = (direction: string): string => {
    switch (direction) {
      case 'buy':
        return 'text-stock-up bg-stock-up/15'
      case 'sell':
        return 'text-stock-down bg-stock-down/15'
      case 'watch':
        return 'text-warning bg-warning/15'
      case 'hold':
        return 'text-muted-foreground bg-muted'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  const onBuy = useCallback(async (stock: Parameters<typeof handleBuy>[0]) => {
    await handleBuy(stock)
    toast({ title: '买入成功', variant: 'success' })
  }, [handleBuy, toast])

  const onSell = useCallback(async (stock: Parameters<typeof handleSell>[0]) => {
    await handleSell(stock)
    toast({ title: '卖出成功', variant: 'success' })
  }, [handleSell, toast])

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">交易舱 · 模拟盘</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadStocks()}>
            加载观察池
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void loadOrders()}>
            加载持仓
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void scanSignals()}>
            扫描信号
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void loadPortfolio()}>
            构建核心组合
          </Button>
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <h3 className="text-sm font-semibold">观察池交易建议</h3>
        {stocks.length === 0 && isRefreshing ? (
          <div className="space-y-5">
            <Skeleton variant="text" className="h-16 w-full" />
            <Skeleton variant="text" className="h-16 w-full" />
            <Skeleton variant="text" className="h-16 w-full" />
          </div>
        ) : stocks.length === 0 ? (
          <EmptyState
            title="暂无观察池标的"
            description="请先在输入舱录入股票，或加载观察池"
            action={{ label: '加载观察池', onClick: () => void loadStocks() }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300">
            {stocks.map((stock) => {
              const advice = adviceMap[stock.symbol]
              const signal = advice?.signal
              const isRiskBlocked = advice?.risk != null && !advice.risk.ok
              return (
                <div
                  key={stock.symbol}
                  className={cn(
                    'rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30',
                    isRiskBlocked ? 'border-l-4 border-destructive' : undefined,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {isRiskBlocked && (
                        <AlertTriangle className="mr-1 inline-block h-4 w-4 text-destructive" />
                      )}
                      {stock.symbol}
                    </span>
                    <Badge>{stock.researchStatus}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{stock.name}</p>
                  {isRiskBlocked && (
                    <p className="mt-1 text-xs font-medium text-destructive">
                      ⚠️ 风控阻塞
                    </p>
                  )}
                  {signal && (
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${signalDirectionClass(signal.direction)}`}>
                          {signalDirectionLabel(signal.direction)}
                        </span>
                        <span className="text-muted-foreground">{signal.type}</span>
                        <span>置信 <Percent value={signal.confidence * 100} decimals={0} showSign={false} /></span>
                      </div>
                      <p className="text-muted-foreground">{signal.rationale}</p>
                      {advice.sizing != null && advice.sizing.action !== 'hold' && (
                        <p>
                          建议：{advice.sizing.action} {advice.sizing.targetShares} 股
                          （仓位 <Percent value={advice.sizing.positionPct * 100} decimals={1} showSign={false} />）
                        </p>
                      )}
                      {advice.risk != null && !advice.risk.ok && (
                        <p className="text-destructive text-xs font-medium">
                          风控阻塞：{advice.risk.blocks.join('；')}
                        </p>
                      )}
                      {advice.risk != null && advice.risk.ok && advice.risk.warnings.length > 0 && (
                        <p className="text-warning text-xs">
                          风控提示：{advice.risk.warnings.join('；')}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="min-w-[80px] bg-stock-up hover:bg-stock-up/90 text-white"
                      onClick={() => void onBuy(stock)}
                      disabled={processingSymbols.has(stock.symbol)}
                    >
                      {processingSymbols.has(stock.symbol) ? '执行中...' : '买入'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-[80px] border-stock-down text-stock-down"
                      onClick={() => void onSell(stock)}
                      disabled={processingSymbols.has(stock.symbol)}
                    >
                      {processingSymbols.has(stock.symbol) ? '执行中...' : '卖出'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <CoreResourcePanel
          portfolio={portfolio}
          strategyResult={strategyResult}
          loading={portfolioLoading}
          onRefresh={() => void loadPortfolio()}
        />

        {signals.length === 0 ? (
          <EmptyState title="暂无交易信号" />
        ) : (
          <>
            <h3 className="text-sm font-semibold">全部信号 ({signals.length})</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {signals.map((signal) => (
                <div key={signal.id} className="rounded-lg border border-border/40 p-3 text-xs transition-colors hover:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{signal.symbol}</span>
                    <span className={`rounded px-1.5 py-0.5 font-medium ${signalDirectionClass(signal.direction)}`}>
                      {signalDirectionLabel(signal.direction)}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{signal.rationale}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <h3 className="text-sm font-semibold">持仓订单</h3>
        {orders.length === 0 ? (
          <EmptyState title="暂无持仓记录" />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30"
              >
                <span>
                  {order.symbol} · {order.direction} · {order.quantity}股
                </span>
                <Badge variant="outline">{order.status}</Badge>
              </div>
            ))}
          </div>
        )}
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
  const loadStocks = useTradingStore((s) => s.loadStocks)
  const loadOrders = useTradingStore((s) => s.loadOrders)

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
  }, [])  

  // 首屏自动加载数据
  useEffect(() => {
    void loadStocks()
    void loadOrders()
  }, [])  

  const matched = useMemo(() => matchTradingRoute(path), [path])

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>交易舱</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeader
          title="交易舱"
          description="模拟盘交易与信号管理"
          actions={
            <Button onClick={() => void loadStocks()} className="shadow-sm">加载观察池</Button>
          }
        />
        {matched.component != null ? (
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{matched.fallback}</div>}>
            {matched.component}
          </Suspense>
        ) : (
          <TradingDashboard />
        )}
      </PageContainer>
    </ErrorBoundary>
  )
}
