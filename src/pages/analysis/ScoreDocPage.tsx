import React, { useEffect } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { StockSelector } from '@/components/organisms/input/StockSelector'
import { toStockOption } from '@/constants/stockList'
import { PageContainer, PageHeader } from '@/components/templates'
import { ErrorState, EmptyState } from '@/components/molecules'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import ScoreDocVersionTable from '@/components/organisms/scoreDoc/ScoreDocVersionTable'
import { useScoreDocStore } from '@/store/scoreDocStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * ScoreDocPage
 */
export default function ScoreDocPage(): React.JSX.Element {
  // 从 Store 获取状态
  const symbol = useScoreDocStore((s) => s.symbol)
  const stocks = useScoreDocStore((s) => s.stocks)
  const versions = useScoreDocStore((s) => s.versions)
  const loading = useScoreDocStore((s) => s.loading)
  const error = useScoreDocStore((s) => s.error)

  // 从 Store 获取 actions
  const setSymbol = useScoreDocStore((s) => s.setSymbol)
  const loadStocks = useScoreDocStore((s) => s.loadStocks)
  const loadVersions = useScoreDocStore((s) => s.loadVersions)
  const refresh = useScoreDocStore((s) => s.refresh)
  const exportAll = useScoreDocStore((s) => s.exportAll)

  // 初始化加载股票列表
  useEffect(() => {
    logger.info('[ScoreDocPage] 初始化，加载股票列表')
    void loadStocks()
  }, [loadStocks])

  // symbol 变化时加载版本列表
  useEffect(() => {
    if (!symbol) {
      logger.info('[ScoreDocPage] symbol 为空，清空版本列表')
      return
    }
    logger.info('[ScoreDocPage] symbol 变化，加载版本列表', { symbol })
    void loadVersions()
  }, [symbol, loadVersions])

  const handleRefresh = (): void => {
    if (symbol) {
      logger.info('[ScoreDocPage] 手动刷新版本列表', { symbol })
      void refresh()
    }
  }

  const handleExportAll = async (): Promise<void> => {
    if (!symbol || versions.length === 0) return
    logger.info('[ScoreDocPage] 导出全部 Markdown', { symbol, versionCount: versions.length })
    await exportAll()
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/analysis">分析舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>评分文档版本库</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="评分文档版本库"
        description="查看与管理 V6 评分文档版本"
      />

      <Card>
        <CardHeader>
          <CardTitle>评分文档版本库</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <StockSelector
                value={symbol}
                onChange={(stock) => setSymbol(stock.symbol)}
                stocks={stocks.map(toStockOption)}
                placeholder="搜索股票..."
                showIcon={false}
              />
            </div>
            <Button onClick={handleRefresh} disabled={!symbol || loading}>
              {loading ? '加载中...' : '刷新'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExportAll()}
              disabled={versions.length === 0}
            >
              导出全部 Markdown
            </Button>
          </div>

          {error && (
            <ErrorState error={error} variant="inline" />
          )}

          {!symbol ? (
            <p className="text-muted-foreground">请选择股票代码</p>
          ) : versions.length === 0 ? (
            <EmptyState title="暂无评分记录" />
          ) : (
            <ScoreDocVersionTable versions={versions} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
