import React, { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, MarketData, StockPoolItem } from '@/types/modules/widget.types'
import { getStockColorClass } from '@/constants/theme.tokens'

interface StockPoolWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

/**
 * 获取涨跌幅颜色（A 股标准：红涨绿跌）
 * @remarks 颜色必须从 STOCK_COLOR_TOKENS 令牌系统读取，禁止硬编码
 */
function getChangeColorClass(changePercent: number): string {
  return getStockColorClass(changePercent)
}

/**
 * 股票池管理与监控列表 Widget
 * @description 展示股票池列表，支持分页与添加股票（Mock），数据来自 MarketData.stockPool
 * @remarks 真实数据替换：将 endpoint 切换为证券行情 API（如 /api/stock/pool）
 */
export default function StockPoolWidget({ config, data }: StockPoolWidgetProps): React.JSX.Element {
  const marketData = useMarketData()
  const sourceData = data ?? marketData.data
  const { stocks, total, page: initialPage, pageSize } = sourceData.stockPool

  const [page, setPage] = useState(initialPage)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleAddStock = () => {
    // TODO: 未来替换为真实 API 调用，打开添加股票弹窗并提交到后端
    // 当前 Mock 阶段为占位交互，点击后无实际后端调用
  }

  const formatChange = (changePercent: number) => {
    const sign = changePercent > 0 ? '+' : ''
    return `${sign}${changePercent.toFixed(2)}%`
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">{config.title}</CardTitle>
        <Button size="sm" onClick={handleAddStock}>
          <Plus className="h-4 w-4 mr-1" />
          添加股票
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto flex flex-col">
        <div className="rounded-md border flex-1 overflow-auto">
          {stocks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">股票代码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead className="text-right">最新价</TableHead>
                  <TableHead className="text-right">涨跌幅</TableHead>
                  <TableHead className="text-right">成交额</TableHead>
                  <TableHead className="text-right">换手率</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock: StockPoolItem) => (
                  <TableRow key={stock.code}>
                    <TableCell className="font-medium">{stock.code}</TableCell>
                    <TableCell>{stock.name}</TableCell>
                    <TableCell className="text-right">{stock.price.toFixed(2)}</TableCell>
                    <TableCell className={`text-right ${getChangeColorClass(stock.changePercent)}`}>
                      {formatChange(stock.changePercent)}
                    </TableCell>
                    <TableCell className="text-right">{stock.turnover}</TableCell>
                    <TableCell className="text-right">{stock.turnoverRate}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-8 rounded-full ${stock.statusColor}`} />
                        <Badge variant="outline" className="text-xs">
                          {stock.statusLabel}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              暂无股票数据
            </div>
          )}
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            共 {total} 条，第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
