import { memo, useEffect } from 'react'
import { Link } from 'react-router'
import { useTradingStore } from '@/store/tradingStore'
import { usePortfolioStore } from '@/store/portfolioStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
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
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { PageContainer, PageHeader } from '@/components/templates'

const logger = getLogger()

const PortfolioPage = memo(() => {
  const loadPortfolio = useTradingStore((s) => s.loadPortfolio)
  const stocks = useTradingStore((s) => s.stocks)
  const orders = useTradingStore((s) => s.orders)

  const portfolio = usePortfolioStore((s) => s.portfolio)
  const portfolioLoading = usePortfolioStore((s) => s.loading)
  const pfStrategyResult = usePortfolioStore((s) => s.strategyResult)
  const pfLoading = usePortfolioStore((s) => s.loading)
  const pfError = usePortfolioStore((s) => s.error)

  useEffect(() => {
    logger.info('[PortfolioPage] 组件挂载，自动加载投资组合', {
      hasPortfolio: !!portfolio,
      stocksCount: stocks.length,
      ordersCount: orders.length,
    })
    void loadPortfolio()
    // loadPortfolio 为 Zustand action，引用稳定；仅在组件挂载时触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          description="核心组合管理与策略筛选结果"
        />

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              logger.info('[PortfolioPage] 加载投资组合')
              void loadPortfolio()
            }}
            disabled={portfolioLoading || pfLoading}
          >
            {portfolioLoading || pfLoading ? '加载中...' : '加载投资组合'}
          </Button>
        </div>

        {/* 加载/错误提示 */}
        {pfError && (
          <p className={`text-sm ${COLOR_TOKENS.danger.tailwind}`}>错误：{pfError}</p>
        )}

        {/* 核心组合 */}
        <Card>
          <CardHeader>
            <CardTitle>核心组合</CardTitle>
          </CardHeader>
          <CardContent>
            {portfolioLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : !portfolio ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">暂无组合数据</p>
                <p className="text-xs text-muted-foreground">
                  请先加载观察池和持仓数据，然后点击"加载投资组合"构建核心组合。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">组合名称：</span>
                    <span className="font-medium">{portfolio.name || '未命名'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">持仓数：</span>
                    <span className="font-medium">{portfolio.holdings?.length ?? 0}</span>
                  </div>
                </div>
                {portfolio.holdings && portfolio.holdings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {portfolio.holdings.map((holding, i) => (
                      <div
                        key={holding.symbol ?? i}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div>
                          <span className="font-medium">{holding.symbol}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {holding.name}
                          </span>
                        </div>
                        <Badge variant="secondary">
                          {holding.currentShares ?? holding.currentWeight ?? '-'}
                        </Badge>
                      </div>
                    ))}
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
                      {pfStrategyResult.summary ? `策略筛选 (${pfStrategyResult.summary.total})` : '未命名'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">选中数：</span>
                    <span className="font-medium">
                      {pfStrategyResult.summary?.selectedCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </ErrorBoundary>
  )
})

PortfolioPage.displayName = 'PortfolioPage'
export default PortfolioPage