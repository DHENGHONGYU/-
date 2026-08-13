/**
 * @fileoverview InputDashboard 意向候选池清单表格
 * @module apps/input/components/InputDashboardPoolTable
 */

import React, { type RefObject } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Checkbox } from '@/components/atoms/Checkbox'
import { cn } from '@/lib/utils'
import { formatPrice, formatMarketCap } from '@/lib/precision'
import { findStockBySymbol } from '@/services/stock/stockDictionary'
import { Download, Trash2, RefreshCw } from 'lucide-react'
import { getMarketLabel } from '../inputDashboard.utils'
import type { PoolItem } from '@/types/modules/pool.types'

interface InputDashboardPoolTableProps {
  allStocks: PoolItem[]
  collectingSymbols: Set<string>
  selectedSymbols: string[]
  selectAllRef: RefObject<HTMLInputElement | null>
  onCollectAll: () => Promise<void>
  onToggleSelectAll: (checked: boolean) => void
  onBatchDelete: () => Promise<void>
  onToggleSelect: (symbol: string) => void
  onCollectStock: (symbol: string) => Promise<void>
  onDeleteStock: (symbol: string) => Promise<void>
}

/**
 * 意向候选池清单：批量操作工具条 + 表格（含采集状态展示）
 */
export default function InputDashboardPoolTable({
  allStocks,
  collectingSymbols,
  selectedSymbols,
  selectAllRef,
  onCollectAll,
  onToggleSelectAll,
  onBatchDelete,
  onToggleSelect,
  onCollectStock,
  onDeleteStock,
}: InputDashboardPoolTableProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>意向候选池清单</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {allStocks.filter((s) => s.price !== undefined).length}/{allStocks.length} 已采
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onCollectAll()}
              disabled={collectingSymbols.size > 0 || allStocks.length === 0}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {collectingSymbols.size > 0 ? `采集中 ${collectingSymbols.size}` : '采集全部'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* ─── 批量操作工具条 ─── */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Checkbox
            ref={selectAllRef}
            checked={allStocks.length > 0 && selectedSymbols.length === allStocks.length}
            onChange={(e) => onToggleSelectAll(e.target.checked)}
            disabled={allStocks.length === 0}
            aria-label="全选"
          />
          <span className="text-xs text-muted-foreground">
            已选 {selectedSymbols.length} / 共 {allStocks.length} 项
          </span>
          <Button
            size="sm"
            variant="danger"
            onClick={() => void onBatchDelete()}
            disabled={selectedSymbols.length === 0}
          >
            批量删除
          </Button>
        </div>
        {allStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <svg className="mb-2 h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l-2.25 2.25m2.25-2.25H3.375" />
            </svg>
            <p className="text-sm">暂无候选股票，请通过上方录入或热门板块纳入</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="w-10 whitespace-nowrap px-3 py-2 text-center text-xs font-semibold">选择</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">代码</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">名称</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">板块</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">三级分类</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold">最新价</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold">总市值</th>
                  <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-semibold">采集状态</th>
                  <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', 'divide-border')}>
                {allStocks.map((item) => {
                  const dictItem = findStockBySymbol(item.symbol)
                  const isCollecting = collectingSymbols.has(item.symbol)
                  const isCollected = item.price !== undefined
                  return (
                    <tr key={item.symbol} className={cn('hover:bg-muted/40 transition-colors duration-200')}>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        <Checkbox
                          checked={selectedSymbols.includes(item.symbol)}
                          onChange={() => onToggleSelect(item.symbol)}
                          aria-label={`选择 ${item.symbol}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium">
                        {item.symbol}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                        {item.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {item.sector ?? (dictItem ? getMarketLabel(dictItem.market) : '-')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {item.industryCode ?? '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
                        {isCollected ? formatPrice(item.price) : (
                          <span className="text-muted-foreground">待采集</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
                        {item.marketCap !== undefined ? formatMarketCap(item.marketCap) : (
                          <span className="text-muted-foreground">待采集</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        {isCollecting ? (
                          <Badge className={cn('bg-info/10', 'text-info')}>
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                              采集中
                            </span>
                          </Badge>
                        ) : isCollected ? (
                          <Badge variant="success" className="text-[10px]">已采</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">待采</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isCollecting || isCollected}
                            onClick={() => void onCollectStock(item.symbol)}
                            className="h-8 px-3 text-xs"
                          >
                            <RefreshCw className={cn('mr-1 h-3 w-3', isCollecting && 'animate-spin')} />
                            {isCollecting ? '采集中' : isCollected ? '已采集' : '采集'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void onDeleteStock(item.symbol)}
                            disabled={isCollecting}
                            className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
