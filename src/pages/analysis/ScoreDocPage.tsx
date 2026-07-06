import React, { useEffect } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import ScoreDocVersionTable from '@/components/scoreDoc/ScoreDocVersionTable'
import { useScoreDocStore } from '@/store/scoreDocStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

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
    if (!symbol) return
    logger.info('[ScoreDocPage] 手动刷新版本列表', { symbol })
    void refresh()
  }

  const handleExportAll = async (): Promise<void> => {
    if (!symbol || versions.length === 0) return
    logger.info('[ScoreDocPage] 导出全部 Markdown', { symbol, versionCount: versions.length })
    await exportAll()
  }

  return (
    <div className="space-y-6">
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

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">评分文档版本库</h1>
          <p className="text-muted-foreground">查看与管理 V6 评分文档版本</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>评分文档版本库</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              aria-label="股票代码"
              className="w-64"
            >
              <option value="">请选择股票代码</option>
              {stocks.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} - {stock.name}
                </option>
              ))}
            </Select>
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
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!symbol ? (
            <p className="text-muted-foreground">请选择股票代码</p>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground">暂无评分记录</p>
          ) : (
            <ScoreDocVersionTable versions={versions} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
