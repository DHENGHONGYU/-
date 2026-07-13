import React, { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms/Table'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import type { WidgetConfig, MarketData, PoolBoardItem } from '@/types/modules/widget.types'
import { getStockColorClass } from '@/constants/theme.tokens'

interface PoolBoardWidgetProps {
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
 * 股票池看板 Widget
 * @description 展示股票池列表，支持分页与添加股票（Mock），数据来自 MarketData.poolBoard
 * @remarks 真实数据替换：将 endpoint 切换为证券行情 API（如 /api/stock/pool）
 */
export default function PoolBoardWidget({ config, data }: PoolBoardWidgetProps): React.JSX.Element {
  const { data: marketData, loadingMap, errorMap, refreshWidget } = useMarketData()
  const sourceData = data ?? marketData
  const { items, total, page: initialPage, pageSize } = sourceData.poolBoard

  const [page, setPage] = useState(initialPage)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const loading = !!loadingMap[config.instanceId]
  const error = errorMap[config.instanceId] ?? null
  const visualState = error
    ? 'error'
    : loading
      ? 'loading'
      : items.length === 0
        ? 'empty'
        : 'ready'

  const handleAddItem = () => {
    // TODO[阻塞·UI]: 需弹窗收集 symbol 后调 inputService.addStock；Widget 不内嵌弹窗，待 onAddItem 回调或全局弹窗方案。关联 #7 接真实数据源。
    // 当前 Mock 阶段为占位交互，点击后无实际后端调用
  }

  const formatChange = (changePercent: number) => {
    const sign = changePercent > 0 ? '+' : ''
    return `${sign}${changePercent.toFixed(2)}%`
  }

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载股票池…"
      emptyTitle="暂无股票数据"
      emptyDescription="当前股票池为空，可点击右上角添加股票"
      skeleton={
        <div className="space-y-3">
          <div className="rounded-md border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 border-b last:border-b-0">
                <Skeleton variant="text" className="h-4 w-20" />
                <Skeleton variant="text" className="h-4 w-24" />
                <Skeleton variant="text" className="h-4 flex-1" />
                <Skeleton variant="text" className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      }
      titleAction={
        <Button size="sm" onClick={handleAddItem}>
          <Plus className="h-4 w-4 mr-1" />
          添加股票
        </Button>
      }
      className="h-full flex flex-col"
    >
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="rounded-md border flex-1 overflow-auto">
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
              {items.map((item: PoolBoardItem) => (
                <TableRow key={item.code}>
                  <TableCell className="font-medium">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">{item.price.toFixed(2)}</TableCell>
                  <TableCell className={`text-right ${getChangeColorClass(item.changePercent)}`}>
                    {formatChange(item.changePercent)}
                  </TableCell>
                  <TableCell className="text-right">{item.turnover}</TableCell>
                  <TableCell className="text-right">{item.turnoverRate}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-8 rounded-full ${item.statusColor}`} />
                      <Badge variant="outline" className="text-xs">
                        {item.statusLabel}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
      </div>
    </WidgetStateShell>
  )
}
