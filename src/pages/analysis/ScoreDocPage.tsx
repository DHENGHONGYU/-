import React, { useEffect, useState } from 'react'
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
import {
  exportSymbolMd,
  getRecentVersions,
} from '@/services/analysis/scoreDocService'
import { listStocks } from '@/services/stockpool/stockpoolService'
import ScoreDocVersionTable from '@/components/scoreDoc/ScoreDocVersionTable'
import type { ScoreDocVersion, Stock } from '@/data/types'

function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ScoreDocPage(): React.JSX.Element {
  const [symbol, setSymbol] = useState('')
  const [stocks, setStocks] = useState<Stock[]>([])
  const [versions, setVersions] = useState<ScoreDocVersion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void listStocks().then((result) => {
      if (result.success && result.data) {
        setStocks(result.data)
      }
    })
  }, [])

  useEffect(() => {
    if (!symbol) {
      setVersions([])
      return
    }

    setLoading(true)
    void getRecentVersions(symbol)
      .then((result) => {
        if (result.success && result.data) {
          setVersions(result.data)
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [symbol])

  const handleRefresh = (): void => {
    if (!symbol) return
    setLoading(true)
    void getRecentVersions(symbol)
      .then((result) => {
        if (result.success && result.data) {
          setVersions(result.data)
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleExportAll = async (): Promise<void> => {
    if (!symbol || versions.length === 0) return
    const result = await exportSymbolMd(symbol)
    if (result.success && result.data) {
      downloadFile(result.data, `${symbol}_score_docs.md`)
    }
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
