import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import { Checkbox } from '@/components/atoms/Checkbox'
import { Select, SelectItem } from '@/components/atoms/Select'
import { addStock } from '@/services/input/inputService'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import { fetchBasicDataUseCase } from '@/services/useCase/fetcherOrchestrator.useCase'
import { useIntentionPoolStore, getIntentionPoolGroups } from '@/store/intentionPoolStore'
import { StockSearch } from '@/components/organisms/input/StockSearch'
import type { StockSearchResult } from '@/services/input/inputService'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import { COLOR_TOKENS, twText, twBg } from '@/constants/theme.tokens'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { GaugeRing } from '@/components/chart/GaugeChart'
import { formatPrice, formatMarketCap } from '@/lib/precision'
import { cn } from '@/lib/utils'
import { findStockBySymbol } from '@/services/stock/stockDictionary'

const logger = getLogger()

/** 市场代码 → 中文标签 */
function getMarketLabel(market: string): string {
  const map: Record<string, string> = { SH: '沪市', SZ: '深市', HK: '港股', BJ: '北交所' }
  return map[market.toUpperCase()] ?? market
}

export default function InputDashboard(): React.JSX.Element {
  // 从 intentionPoolStore 获取状态
  const items = useIntentionPoolStore((s) => s.items)
  const loading = useIntentionPoolStore((s) => s.loading)
  const error = useIntentionPoolStore((s) => s.error)
  const refresh = useIntentionPoolStore((s) => s.refresh)

  // 本地 UI 状态
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [message, setMessage] = useState('')
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchMode, setSearchMode] = useState<'fill' | 'add'>('fill')
  const [collectingSymbols, setCollectingSymbols] = useState<Set<string>>(new Set())

  // 勾选状态：已选中的标的代码集合（用于批量删除）
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const selectAllRef = useRef<HTMLInputElement>(null)

  // 初始化加载
  useEffect(() => {
    logger.info('[InputDashboard] 初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  // 初始化采集服务健康检查
  useEffect(() => {
    void handleRefreshHealth()
  }, [])

  // 批量导入完成后自动刷新清单，确保页面完整覆盖所有已输入数据
  useEffect(() => {
    const off = eventBus.on('BATCH_IMPORT_COMPLETED', () => {
      logger.info('[InputDashboard] 收到 BATCH_IMPORT_COMPLETED，刷新清单')
      void refresh()
    })
    return off
  }, [refresh])

  const allGroups = useMemo(() => getIntentionPoolGroups(), [])
  const allStocks = items

  // 全选框的半选（indeterminate）状态
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedSymbols.length > 0 && selectedSymbols.length < allStocks.length
    }
  }, [selectedSymbols.length, allStocks.length])

  const handleAdd = async (fetchBasic: boolean, fetchKline: boolean): Promise<void> => {
    if (!symbol || !name) {
      setMessage('请输入代码和名称')
      return
    }

    setSubmitting(true)
    try {
      const result = await addStock(
        { symbol, name },
        {
          fetchBasicAfterAdd: fetchBasic,
          fetchKlineAfterAdd: fetchKline,
          group: group || undefined,
        },
      )

      if (result.success) {
        setMessage(
          result.error != null
            ? `已添加 ${result.data?.symbol}，${result.error}`
            : `已添加 ${result.data?.symbol}`,
        )
        setSymbol('')
        setName('')
        setGroup('')
        await refresh()
      } else {
        setMessage(result.error ?? '添加失败')
      }
    } catch (err) {
      setMessage(`添加异常：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCollectStock = async (symbol: string, name: string): Promise<void> => {
    setCollectingSymbols((prev) => new Set(prev).add(symbol))
    setMessage(`正在采集 ${symbol} ${name} 的基础数据...`)
    try {
      const result = await fetchBasicDataUseCase({ symbol })
      if (result.success) {
        setMessage(`${symbol} 基础数据采集完成`)
      } else {
        setMessage(`${symbol} 采集失败：${result.error ?? '未知错误'}`)
      }
      await refresh()
    } catch (err) {
      setMessage(`采集异常：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCollectingSymbols((prev) => {
        const next = new Set(prev)
        next.delete(symbol)
        return next
      })
    }
  }

  const handleCollectAll = async (): Promise<void> => {
    const toCollect = allStocks.filter((s) => s.price === undefined)
    if (toCollect.length === 0) {
      setMessage('所有标的数据已采集')
      return
    }
    setMessage(`开始批量采集 ${toCollect.length} 只标的...`)
    let successCount = 0
    let failCount = 0
    for (const item of toCollect) {
      setCollectingSymbols((prev) => new Set(prev).add(item.symbol))
      try {
        const result = await fetchBasicDataUseCase({ symbol: item.symbol })
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
      setCollectingSymbols((prev) => {
        const next = new Set(prev)
        next.delete(item.symbol)
        return next
      })
    }
    setMessage(`批量采集完成：成功 ${successCount} 只，失败 ${failCount} 只`)
    await refresh()
  }

  const handleDeleteStock = async (symbol: string): Promise<void> => {
    const store = useIntentionPoolStore.getState()
    try {
      const deleted = await store.deleteItem(symbol)
      if (deleted) {
        setMessage(`已移除 ${symbol}`)
        setSelectedSymbols((prev) => prev.filter((s) => s !== symbol))
        await refresh()
      } else {
        setMessage(`移除 ${symbol} 失败`)
      }
    } catch (err) {
      setMessage(`移除异常：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── 勾选 / 批量删除 ──
  const handleToggleSelect = (symbol: string): void => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    )
  }

  const handleToggleSelectAll = (checked: boolean): void => {
    setSelectedSymbols(checked ? allStocks.map((s) => s.symbol) : [])
  }

  const handleBatchDelete = async (): Promise<void> => {
    if (selectedSymbols.length === 0) return
    const store = useIntentionPoolStore.getState()
    try {
      const count = await store.deleteItems(selectedSymbols)
      setSelectedSymbols([])
      if (count > 0) {
        setMessage(`已批量删除 ${count} 条标的`)
      } else {
        setMessage('批量删除失败')
      }
    } catch (err) {
      setMessage(`批量删除异常：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRefreshHealth = async (): Promise<void> => {
    setFetcherOk(null)
    try {
      const result = await checkFetcherHealth()
      setFetcherOk(result.ok)
      if (!result.ok) {
        setMessage(result.error ?? '数据采集服务异常')
      }
    } catch (err) {
      setFetcherOk(false)
      setMessage(`采集服务检查异常：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const stats = useMemo(() => {
    const total = allStocks.length
    const withPrice = allStocks.filter((s) => s.price !== undefined).length
    const coverage = total > 0 ? Math.round((withPrice / total) * 100) : 0
    return { total, withPrice, coverage }
  }, [allStocks])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-16" /></CardContent></Card>
            <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-16" /></CardContent></Card>
            <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-6 w-20" /></CardContent></Card>
            <Card><CardContent className="p-5"><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-8 w-24" /></CardContent></Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">意向候选池标的</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  {stats.total > 0 && (
                    <span className={`text-xs ${twText('green', 600)}`}>↑ {Math.round((stats.withPrice / stats.total) * 100)}% 覆盖</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">已采行情</p>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-2xl font-bold">{stats.withPrice}</p>
                    {stats.total > 0 && stats.withPrice < stats.total && (
                      <span className={`text-xs ${twText('amber', 600)}`}>↓ {stats.total - stats.withPrice} 待采</span>
                    )}
                  </div>
                  {stats.total > 0 && (
                    <GaugeRing value={stats.coverage} max={100} size={44} thickness={4} colorMode="progress" />
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">采集服务</p>
                <div className="mt-1 flex items-center gap-2">
                  {fetcherOk === null ? (
                    <Badge variant="outline">检查中...</Badge>
                  ) : fetcherOk ? (
                    <Badge className={`${twBg('green', 100)} ${twText('green', 800)}`}>已连接</Badge>
                  ) : (
                    <Badge variant="destructive">未连接</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">快捷操作</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => window.location.hash = '#/input/bulk-import'}>
                    批量导入
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => window.location.hash = '#/input/hot-sectors'}>
                    热门板块
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => window.location.hash = '#/input/data-test'}>
                    数据测试
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => window.location.hash = '#/input/collect-tasks'}>
                    采集任务
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>录入候选股票</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">搜索模式：</span>
            <Button
              size="sm"
              variant={searchMode === 'fill' ? 'secondary' : 'ghost'}
              onClick={() => setSearchMode('fill')}
            >
              填充代码/名称
            </Button>
            <Button
              size="sm"
              variant={searchMode === 'add' ? 'secondary' : 'ghost'}
              onClick={() => setSearchMode('add')}
            >
              直接录入意向候选池
            </Button>
          </div>
          <StockSearch
            className="max-w-md"
            mode={searchMode}
            onSelect={(result: StockSearchResult): void => {
              setSymbol(result.symbol)
              setName(result.name)
              setMessage(`已选择 ${result.symbol} ${result.name}，请选择录入方式`)
            }}
            onAdded={(): void => {
              setMessage('搜索标的已录入意向候选池')
              void refresh()
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[160px] flex-1"
              placeholder="股票代码，如 600519.SH"
              aria-label="股票代码"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <Input
              className="min-w-[120px] flex-1"
              placeholder="股票名称"
              aria-label="股票名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select
              className="h-10 min-w-[140px] flex-1"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label="目标分组"
            >
              <SelectItem value="">默认分组</SelectItem>
              {allGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </Select>
            <Button onClick={() => void handleAdd(false, false)} disabled={submitting}>
              {submitting ? '处理中...' : '仅录入'}
            </Button>
            <Button variant="secondary" onClick={() => void handleAdd(true, false)} disabled={submitting}>
              {submitting ? '处理中...' : '录入并拉基础'}
            </Button>
            <Button variant="secondary" onClick={() => void handleAdd(true, true)} disabled={submitting}>
              {submitting ? '处理中...' : '录入并拉全部'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">采集服务状态：</span>
            {fetcherOk === null ? (
              <Badge variant="outline">检查中...</Badge>
            ) : fetcherOk ? (
              <Badge className={`${COLOR_TOKENS.up.bgClass} ${COLOR_TOKENS.up.tailwind}`}>已连接</Badge>
            ) : (
              <Badge variant="destructive">未连接</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => void handleRefreshHealth()} disabled={fetcherOk === null}>
              {fetcherOk === null ? '检查中...' : '刷新'}
            </Button>
          </div>
          {(message !== '' || (error ?? '') !== '') && (
            <p className="text-sm text-muted-foreground">{message !== '' ? message : (error ?? '')}</p>
          )}
        </CardContent>
      </Card>

      {/* ─── 意向候选池数据表 ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>意向候选池</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {allStocks.filter((s) => s.price !== undefined).length}/{allStocks.length} 已采
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleCollectAll()}
                disabled={collectingSymbols.size > 0 || allStocks.length === 0}
              >
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
              onChange={(e) => handleToggleSelectAll(e.target.checked)}
              disabled={allStocks.length === 0}
              aria-label="全选"
            />
            <span className="text-xs text-muted-foreground">
              已选 {selectedSymbols.length} / 共 {allStocks.length} 项
            </span>
            <Button
              size="sm"
              variant="danger"
              onClick={() => void handleBatchDelete()}
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
              <p className="text-sm">暂无候选股票，请通过上方搜索录入</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn('border-b', twText('stone', 500))}>
                    <th className="w-10 whitespace-nowrap px-3 py-2 text-center text-xs font-semibold">选择</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">代码</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">名称</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">板块</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">三级分类</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold">最新价</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold">总市值</th>
                    <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-semibold">状态</th>
                    <th className="whitespace-nowrap px-3 py-2 text-center text-xs font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y', 'divide-stone-100')}>
                  {allStocks.map((item) => {
                    const dictItem = findStockBySymbol(item.symbol)
                    const isCollecting = collectingSymbols.has(item.symbol)
                    return (
                      <tr key={item.symbol} className={cn('hover:bg-stone-50/50 transition-colors')}>
                        <td className="whitespace-nowrap px-3 py-2 text-center">
                          <Checkbox
                            checked={selectedSymbols.includes(item.symbol)}
                            onChange={() => handleToggleSelect(item.symbol)}
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
                          {item.price !== undefined ? formatPrice(item.price) : (
                            <span className="text-muted-foreground">待采集</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
                          {item.marketCap !== undefined ? formatMarketCap(item.marketCap) : (
                            <span className="text-muted-foreground">待采集</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center">
                          <Badge variant={item.price !== undefined ? 'success' : 'outline'} className="text-[10px]">
                            {item.price !== undefined ? '已采' : '待采'}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isCollecting || item.price !== undefined}
                              onClick={() => void handleCollectStock(item.symbol, item.name)}
                              className="h-7 px-2 text-xs"
                            >
                              {isCollecting ? (
                                <span className="flex items-center gap-1">
                                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  采集中
                                </span>
                              ) : item.price !== undefined ? (
                                '已采集'
                              ) : (
                                '采集'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleDeleteStock(item.symbol)}
                              disabled={isCollecting}
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            >
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
    </div>
  )
}
