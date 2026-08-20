import { memo, useCallback, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { Wallet } from 'lucide-react'
import { useTradingStore } from '@/store/tradingStore'
import { usePortfolioStore } from '@/store/portfolioStore'
import { useIndustryScoreStore } from '@/store/industryScoreStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Currency } from '@/components/atoms/Currency'
import { Percent } from '@/components/atoms/Percent'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { PageContainer, PageHeader } from '@/components/templates'
import {
  CapitalAllocationPanel,
  DualFactorEvaluationPanel,
  evaluateDualFactor,
  EmptyState,
  ErrorState,
  Skeleton,
  type DualFactorResult,
  type TechnicalSignal,
} from '@/components/molecules'
import { DensityToggle } from '@/components/cockpit/DensityToggle'
import { useDensityConfig } from '@/components/cockpit/DensityContext'

const logger = getLogger()

function getScoreColorClass(score: number): string {
  if (score >= 4.0) return 'text-[hsl(var(--stock-up))]'
  if (score >= 3.0) return 'text-primary'
  return 'text-[hsl(var(--stock-down))]'
}

const PortfolioPage = memo(() => {
  const { spacing, padding } = useDensityConfig()

  const loadPortfolio = useTradingStore((s) => s.loadPortfolio)
  const stocks = useTradingStore((s) => s.stocks)
  const orders = useTradingStore((s) => s.orders)

  const portfolio = usePortfolioStore((s) => s.portfolio)
  const portfolioLoading = usePortfolioStore((s) => s.loading)
  const pfStrategyResult = usePortfolioStore((s) => s.strategyResult)
  const pfLoading = usePortfolioStore((s) => s.loading)
  const pfError = usePortfolioStore((s) => s.error)

  const industrySectors = useIndustryScoreStore((s) => s.sectors)

  useEffect(() => {
    logger.info('[PortfolioPage] 组件挂载，自动加载投资组合', {
      hasPortfolio: !!portfolio,
      stocksCount: stocks.length,
      ordersCount: orders.length,
    })
    void loadPortfolio()
    // loadPortfolio 为 Zustand action，引用稳定；仅在组件挂载时触发一次
     
  }, [])

  // 双因子评估：从 pfStrategyResult 获取技术信号 + 行业评分，计算共振结果
  const dualFactorResults = useMemo<DualFactorResult[]>(() => {
    if (!pfStrategyResult?.selected.length) return []

    return pfStrategyResult.selected.map((candidate) => {
      // 从 composite 综合评分推导技术信号：≥3.5 买入，<2.0 卖出，其余观望
      const composite = candidate.composite ?? 0
      let technicalSignal: TechnicalSignal
      if (composite >= 3.5) {
        technicalSignal = 'buy'
      } else if (composite < 2.0) {
        technicalSignal = 'sell'
      } else {
        technicalSignal = 'hold'
      }

      // 行业评分：优先使用 candidate 自带的 industryScore，否则从 industryScoreStore 按 sector 匹配
      const industryScore =
        candidate.industryScore ??
        (() => {
          const sector = industrySectors.find(
            (s) => s.name === candidate.sector || s.code === candidate.sector,
          )
          return sector?.skillC?.composite ?? 0
        })()

      return evaluateDualFactor(technicalSignal, industryScore)
    })
  }, [pfStrategyResult, industrySectors])

  const holdingsMarketValue = useMemo(
    () => portfolio?.holdings.reduce((s, h) => s + h.marketValue, 0) ?? 0,
    [portfolio?.holdings],
  )

  const handleLoadPortfolio = useCallback(() => {
    logger.info('[PortfolioPage] 加载投资组合')
    void loadPortfolio()
  }, [loadPortfolio])

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-4">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/trading">交易舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>投资组合</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="投资组合"
          description="资金双轨配置（30% 耐心资本 + 70% 博收益）+ 核心组合管理 + 双因子评估"
          actions={
            <div className="flex items-center gap-2">
              <DensityToggle />
              <Button variant="outline" size="sm" asChild>
                <Link to="/trading/holdings">
                  <Wallet className="mr-2 h-4 w-4" />
                  持仓明细
                </Link>
              </Button>
            </div>
          }
        />

        {/* 组合 KPI Hero 卡 */}
        {portfolio && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 transition-opacity duration-300">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">总资产</p>
                <p className="text-lg font-bold">
                  <Currency value={portfolio.totalValue} compact decimals={1} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">持仓市值</p>
                <p className="text-lg font-bold">
                  <Currency value={holdingsMarketValue} compact decimals={1} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">现金储备</p>
                <p className="text-lg font-bold">
                  <Currency value={portfolio.cashReserve} compact decimals={1} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">持仓数</p>
                <p className="text-lg font-bold">{portfolio.holdings.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">今日盈亏</p>
                <p className="text-lg font-bold text-muted-foreground">--</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">累计收益</p>
                <p className="text-lg font-bold text-muted-foreground">--</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 资金管理双轨配置（30/70 分仓 + KPI 考核 + 大跌应对纪律） */}
        <CapitalAllocationPanel />

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLoadPortfolio}
            disabled={portfolioLoading || pfLoading}
          >
            {portfolioLoading || pfLoading ? '加载中...' : '加载投资组合'}
          </Button>
        </div>

        {/* 加载/错误提示 */}
        // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
        {(pfError ?? '') !== '' && (
          <ErrorState error={pfError ?? ''} variant="inline" />
        )}

        {/* 核心组合 */}
        <Card>
          <CardHeader>
            <CardTitle>核心组合</CardTitle>
          </CardHeader>
          <CardContent>
            {portfolioLoading ? (
              <div className="space-y-3">
                <Skeleton variant="text" className="h-4 w-32" />
                <Skeleton variant="text" className="h-4 w-48" />
                <Skeleton variant="text" className="h-4 w-24" />
              </div>
            ) : !portfolio ? (
              <EmptyState
                title="暂无组合数据"
                description="请先加载观察池和持仓数据，然后点击&quot;加载投资组合&quot;构建核心组合。"
              />
            ) : (
              <div className="space-y-2 transition-opacity duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">组合名称：</span>
                    <span className="font-medium">{portfolio.name || '未命名'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">持仓数：</span>
                    <span className="font-medium">{portfolio.holdings.length}</span>
                  </div>
                </div>
                {portfolio.holdings.length > 0 && (
                  <div className={cn('mt-3 space-y-2', spacing)}>
                    {/* 表头 */}
                    <div className={cn('grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded-md bg-muted/50 text-xs text-muted-foreground', padding)}>
                      <span>名称</span>
                      <span className="text-right">当前价</span>
                      <span className="text-right">持仓市值</span>
                      <span className="text-right">仓位占比</span>
                      <span className="text-right">评分</span>
                    </div>
                    {portfolio.holdings.map((holding) => {
                      const stockInfo = stocks.find((s) => s.symbol === holding.symbol)
                      const costPrice = stockInfo?.avgCost
                      const currentPrice = stockInfo?.currentPrice ?? holding.price
                      const pnl =
                        costPrice != null && currentPrice != null
                          ? (currentPrice - costPrice) * holding.currentShares
                          : undefined
                      const pnlPct =
                        costPrice != null && costPrice !== 0 && currentPrice != null
                          ? ((currentPrice - costPrice) / costPrice) * 100
                          : undefined
                      const isProfit = pnl != null && pnl >= 0

                      return (
                        <div
                          key={holding.symbol}
                          className={cn('grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded-md border', padding)}
                        >
                          <div>
                            <span className="font-medium">{holding.symbol}</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {holding.name}
                            </span>
                          </div>
                          <div className="text-right text-sm">
                            {costPrice != null && (
                              <span className="text-xs text-muted-foreground mr-1">
                                成本 <Currency value={costPrice} decimals={2} />
                              </span>
                            )}
                            <span className="font-mono">
                              {currentPrice != null ? <Currency value={currentPrice} decimals={2} /> : '--'}
                            </span>
                            {pnl != null && (
                              <span
                                className="ml-1 text-xs"
                                style={{
                                  color: isProfit
                                    ? 'hsl(var(--stock-up))'
                                    : 'hsl(var(--stock-down))',
                                }}
                              >
                                <Currency value={pnl} decimals={0} />
                                {pnlPct != null && <> (<Percent value={pnlPct} decimals={1} />)</>}
                              </span>
                            )}
                          </div>
                          <div className="text-right text-sm font-mono">
                            <Currency value={holding.marketValue} compact decimals={1} />
                          </div>
                          <div className="text-right text-sm">
                            <Percent value={holding.currentWeight * 100} decimals={1} />
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className={cn(getScoreColorClass(holding.score))}>{holding.score.toFixed(1)}</Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 策略结果 */}
        {pfStrategyResult && (
          <Card>
            <CardHeader>
              <CardTitle>策略筛选结果</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">策略名称：</span>
                    <span className="font-medium">
                      {`策略筛选 (${pfStrategyResult.summary.total})`}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">选中数：</span>
                    <span className="font-medium">
                      {pfStrategyResult.summary.selectedCount}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 双因子评估（技术信号 × 行业景气度 → 共振才操作） */}
        {pfLoading && !pfStrategyResult ? (
          <Card>
            <CardHeader>
              <CardTitle>双因子评估</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton variant="text" className="h-4 w-40" />
                <Skeleton variant="text" className="h-4 w-56" />
                <Skeleton variant="text" className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ) : !pfStrategyResult ? (
          <EmptyState
            title="暂无策略筛选结果"
            description="请先在交易舱扫描信号并加载行业评分"
            action={{
              label: '加载投资组合',
              onClick: handleLoadPortfolio,
            }}
          />
        ) : (
          <DualFactorEvaluationPanel results={dualFactorResults} />
        )}
      </PageContainer>
    </ErrorBoundary>
  )
})

PortfolioPage.displayName = 'PortfolioPage'
export default PortfolioPage