/**
 * @fileoverview InputDashboard 意向候选池清单表格
 * @module apps/input/components/InputDashboardPoolTable
 */

import React, { type RefObject } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Checkbox } from '@/components/atoms/Checkbox'
import { cn } from '@/lib/utils'
import { formatPrice, formatMarketCap } from '@/lib/precision'
import { findStockBySymbol } from '@/lib/stockDictionary'
import { Download, Trash2, RefreshCw, ArrowRightLeft, ArrowUpRight } from 'lucide-react'
import { getMarketLabel } from '../inputDashboard.utils'
import type { PoolItem, IntentionPoolItem } from '@/types/modules/pool.types'
import { useDensityConfig } from '@/components/cockpit/DensityContext'
import { DensityToggle } from '@/components/cockpit/DensityToggle'

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
  const { rowHeight, fontSize, padding } = useDensityConfig()

  // 双源输入来源标签（spec 2.4.15）：hot-sector=来源一/热门板块，manual=来源二/自定义检索
  const isIntentionItem = (item: PoolItem): item is IntentionPoolItem =>
    item.pool === 'intention'

  const screenSourceMeta = (item: PoolItem): { label: string; className: string } => {
    const source = isIntentionItem(item) ? item.screenSource : undefined
    if (source === 'hot-sector') {
      return { label: '热门板块', className: 'bg-info/10 text-info border-info/20' }
    }
    if (source === 'manual') {
      return { label: '自定义检索', className: 'bg-muted text-muted-foreground border-border/40' }
    }
    // 历史数据无来源标记
    return { label: '—', className: 'bg-muted text-muted-foreground border-border/40' }
  }

  const collected = allStocks.filter((s) => s.price !== undefined).length

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">
            <Link
              to="/input/intention-pool"
              className="group inline-flex items-center gap-1 transition-colors hover:text-primary"
              title="前往意向输入池独立页"
            >
              意向候选池清单
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
            </Link>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <DensityToggle />
            <span className="text-[11px] font-medium text-muted-foreground">
              {collected}/{allStocks.length} 已采
            </span>
            {/* 输入舱 → 分析舱交接：携带 scope=intention 进入分析舱默认视图，自动加载意向候选池 */}
            <Button
              size="sm"
              variant="outline"
              asChild
              disabled={allStocks.length === 0}
              className="shadow-sm"
            >
              <Link to="/analysis?scope=intention">
                <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                送入分析舱
              </Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void onCollectAll()}
              disabled={collectingSymbols.size > 0 || allStocks.length === 0}
              className="shadow-sm"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {collectingSymbols.size > 0 ? `采集中 ${collectingSymbols.size}` : '采集全部'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {/* ─── 批量操作工具条 ─── */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border/40 bg-muted/20 px-3.5 py-2.5">
          <Checkbox
            ref={selectAllRef}
            checked={allStocks.length > 0 && selectedSymbols.length === allStocks.length}
            onChange={(e) => onToggleSelectAll(e.target.checked)}
            disabled={allStocks.length === 0}
            aria-label="全选"
          />
          <span className="text-xs font-medium text-muted-foreground">
            已选 <span className="text-foreground tabular-nums">{selectedSymbols.length}</span> / 共 {allStocks.length} 项
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onBatchDelete()}
            disabled={selectedSymbols.length === 0}
            className="ml-auto h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            批量删除
          </Button>
        </div>

        {allStocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
              <svg className="h-7 w-7 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l-2.25 2.25m2.25-2.25H3.375" />
              </svg>
            </div>
            <p className="text-sm font-medium">暂无候选股票</p>
            <p className="mt-1 text-xs text-muted-foreground/70">请通过上方「逐项录入」「批量导入」或「热门板块纳入」添加标的</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/40">
            <table className={cn('w-full', fontSize)}>
              <thead>
                <tr className="border-b border-border/40 bg-muted/30 text-muted-foreground" style={{ height: rowHeight }}>
                  <th className={cn('w-10 whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-wide', padding)}>选择</th>
                  <th className={cn('whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide', padding)}>代码</th>
                  <th className={cn('whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide', padding)}>名称</th>
                  <th className={cn('whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide', padding)}>板块</th>
                  <th className={cn('whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide', padding)}>三级分类</th>
                  <th className={cn('whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-wide', padding)}>来源</th>
                  <th className={cn('whitespace-nowrap text-right text-[11px] font-semibold uppercase tracking-wide', padding)}>最新价</th>
                  <th className={cn('whitespace-nowrap text-right text-[11px] font-semibold uppercase tracking-wide', padding)}>总市值</th>
                  <th className={cn('whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-wide', padding)}>采集状态</th>
                  <th className={cn('whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-wide', padding)}>操作</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', 'divide-border/40')}>
                {allStocks.map((item) => {
                  const dictItem = findStockBySymbol(item.symbol)
                  const isCollecting = collectingSymbols.has(item.symbol)
                  const isCollected = item.price !== undefined
                  return (
                    <tr
                      key={item.symbol}
                      className={cn(
                        'transition-colors duration-200',
                        selectedSymbols.includes(item.symbol)
                          ? 'bg-primary/5'
                          : 'hover:bg-muted/30',
                      )}
                      style={{ height: rowHeight }}
                    >
                      <td className={cn('whitespace-nowrap text-center', padding)}>
                        <Checkbox
                          checked={selectedSymbols.includes(item.symbol)}
                          onChange={() => onToggleSelect(item.symbol)}
                          aria-label={`选择 ${item.symbol}`}
                        />
                      </td>
                      <td className={cn('whitespace-nowrap font-mono font-medium text-foreground/90', padding)}>
                        {item.symbol}
                      </td>
                      <td className={cn('whitespace-nowrap font-medium', padding)}>
                        {item.name}
                      </td>
                      <td className={cn('whitespace-nowrap text-muted-foreground', padding)}>
                        {item.sector ?? (dictItem ? getMarketLabel(dictItem.market) : '-')}
                      </td>
                      <td className={cn('whitespace-nowrap text-muted-foreground', padding)}>
                        {item.industryCode ?? '-'}
                      </td>
                      <td className={cn('whitespace-nowrap text-center', padding)}>
                        <Badge className={cn('border text-[10px] px-2 py-0.5 font-medium', screenSourceMeta(item).className)}>
                          {screenSourceMeta(item).label}
                        </Badge>
                      </td>
                      <td className={cn('whitespace-nowrap text-right font-mono tabular-nums', padding)}>
                        {isCollected ? (
                          <span className="text-foreground/90">{formatPrice(item.price)}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className={cn('whitespace-nowrap text-right font-mono tabular-nums', padding)}>
                        {item.marketCap !== undefined ? (
                          <span className="text-foreground/90">{formatMarketCap(item.marketCap)}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className={cn('whitespace-nowrap text-center', padding)}>
                        {isCollecting ? (
                          <Badge className="bg-info/10 text-info border-info/20 px-2 py-0.5 text-[10px]">
                            <span className="flex items-center gap-1 justify-center">
                              <span className="inline-block h-1.5 w-1.5 animate-spin rounded-full border border-current border-t-transparent" />
                              采集中
                            </span>
                          </Badge>
                        ) : isCollected ? (
                          <Badge variant="success" className="text-[10px] px-2 py-0.5">已采</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-border/50 text-muted-foreground">待采</Badge>
                        )}
                      </td>
                      <td className={cn('whitespace-nowrap text-center', padding)}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isCollecting || isCollected}
                            onClick={() => void onCollectStock(item.symbol)}
                            className="h-8 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          >
                            <RefreshCw className={cn('mr-1 h-3 w-3', isCollecting && 'animate-spin')} />
                            {isCollecting ? '采集中' : isCollected ? '已采' : '采集'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void onDeleteStock(item.symbol)}
                            disabled={isCollecting}
                            className="h-8 px-2.5 text-[11px] text-destructive/80 hover:text-destructive hover:bg-destructive/5"
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
