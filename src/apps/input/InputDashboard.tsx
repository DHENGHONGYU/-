import React, { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import { Checkbox } from '@/components/atoms/Checkbox'
import { Select, SelectItem } from '@/components/atoms/Select'
import { useStockAdd } from '@/hooks/useStockAdd'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import { fetchBasicDataUseCase } from '@/services/useCase/fetcherOrchestrator.useCase'
import { useIntentionPoolStore, getIntentionPoolGroups } from '@/store/intentionPoolStore'
import { StockSearch } from '@/components/organisms/input/StockSearch'
import type { StockSearchResult } from '@/services/input/inputService'
import { getLogger } from '@/lib/logger'
import { createDebugLogger } from '@/lib/debugToolkit'
import { eventBus } from '@/lib/eventBus'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { GaugeRing } from '@/components/chart/GaugeChart'
import { formatPrice, formatMarketCap } from '@/lib/precision'
import { cn } from '@/lib/utils'
import { findStockBySymbol } from '@/services/stock/stockDictionary'
import { Download, Trash2, RefreshCw } from 'lucide-react'
import HotSectorSection from './HotSectorSection'

// 批量导入区块懒加载（整合自原 BulkImportPanel 独立页）
const BulkImportPanel = lazy(() => import('./BulkImportPanel'))

const logger = getLogger()
/** 采集状态 Badge 三态切换的 Debug 日志（控制台筛选 [CollectBadge]） */
const debug = createDebugLogger('CollectBadge')

/** 市场代码 → 中文标签 */
function getMarketLabel(market: string): string {
  const map: Record<string, string> = { SH: '沪市', SZ: '深市', HK: '港股', BJ: '北交所' }
  return map[market.toUpperCase()] ?? market
}

// Tab 与分段控件样式常量 — 柔性 pill 风格
const TAB_BASE = 'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-300 ease-out'
const TAB_ACTIVE = cn('bg-card text-foreground shadow-sm shadow-primary/5')
const TAB_INACTIVE = cn('text-muted-foreground hover:text-foreground hover:bg-muted/50')

type InputTab = 'manual' | 'hot-sector'
type ManualMode = 'single' | 'bulk'

export default function InputDashboard(): React.JSX.Element {
  // 从 intentionPoolStore 获取状态
  const items = useIntentionPoolStore((s) => s.items)
  const loading = useIntentionPoolStore((s) => s.loading)
  const error = useIntentionPoolStore((s) => s.error)
  const refresh = useIntentionPoolStore((s) => s.refresh)

  // 通过 useStockAdd Hook 管理股票添加流程的表单状态与提交逻辑
  const {
    symbol, name, group,
    setSymbol, setName, setGroup,
    submitting, message, setMessage,
    handleAdd,
  } = useStockAdd()

  // 本地 UI 状态
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [searchMode, setSearchMode] = useState<'fill' | 'add'>('fill')
  const [collectingSymbols, setCollectingSymbols] = useState<Set<string>>(new Set())

  // Tab 与录入模式状态
  const [activeTab, setActiveTab] = useState<InputTab>('manual')
  const [manualMode, setManualMode] = useState<ManualMode>('single')

  // 勾选状态：已选中的标的代码集合（用于批量删除）
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const selectAllRef = useRef<HTMLInputElement>(null)

  // 初始化加载
  useEffect(() => {
    logger.info('[InputDashboard] 初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  // 批量导入完成后自动刷新清单，确保页面完整覆盖所有已输入数据
  useEffect(() => {
    const off = eventBus.on('BATCH_IMPORT_COMPLETED', () => {
      logger.info('[InputDashboard] 收到 BATCH_IMPORT_COMPLETED，刷新清单')
      void refresh()
    })
    return off
  }, [refresh])

  // 分组列表：依赖 items，items 变化时重新计算
  const allGroups = useMemo(() => getIntentionPoolGroups(), [items])
  const allStocks = items

  // 全选框的半选（indeterminate）状态
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedSymbols.length > 0 && selectedSymbols.length < allStocks.length
    }
  }, [selectedSymbols.length, allStocks.length])

  const handleCollectStock = useCallback(async (symbol: string): Promise<void> => {
    debug.log('handleCollectStock 开始', {
      symbol,
      timestamp: Date.now(),
      currentCollecting: Array.from(collectingSymbols),
    })
    setCollectingSymbols((prev) => {
      const next = new Set(prev).add(symbol)
      debug.log('setCollectingSymbols ADD', {
        symbol,
        newSet: Array.from(next),
        size: next.size,
      })
      return next
    })
    try {
      const result = await fetchBasicDataUseCase({ symbol })
      debug.log('handleCollectStock 采集结果', {
        symbol,
        success: result.success,
        error: result.error,
        hasPrice: result.data?.price,
        elapsedMs: result.data ? 'completed' : 'n/a',
      })
      if (!result.success) {
        logger.warn('[InputDashboard] 采集失败', { symbol, error: result.error })
      }
      debug.log('handleCollectStock 刷新前', { symbol })
      await refresh()
      const updated = useIntentionPoolStore.getState().items.find((s) => s.symbol === symbol)
      debug.log('handleCollectStock 刷新后', {
        symbol,
        hasPrice: updated?.price !== undefined,
        price: updated?.price,
      })
    } catch (err) {
      logger.error('[InputDashboard] 采集异常', {
        symbol,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setCollectingSymbols((prev) => {
        const next = new Set(prev)
        next.delete(symbol)
        debug.log('setCollectingSymbols REMOVE', {
          symbol,
          newSet: Array.from(next),
          size: next.size,
        })
        return next
      })
    }
  }, [refresh, collectingSymbols])

  const handleCollectAll = useCallback(async (): Promise<void> => {
    const toCollect = allStocks.filter((s) => s.price === undefined)
    if (toCollect.length === 0) {
      debug.log('handleCollectAll 无待采集标的')
      return
    }

    const symbolsToCollect = toCollect.map((s) => s.symbol)
    debug.log('handleCollectAll 开始并发采集', {
      totalToCollect: toCollect.length,
      symbols: symbolsToCollect,
      timestamp: Date.now(),
    })

    // 并行采集：使用 Promise.allSettled 并发执行
    setCollectingSymbols(new Set(symbolsToCollect))
    debug.log('handleCollectAll 已设置 collectingSymbols', {
      count: symbolsToCollect.length,
    })

    try {
      const results = await Promise.allSettled(
        toCollect.map(async (item, idx) => {
          debug.log('并发采集子任务启动', {
            symbol: item.symbol,
            taskIndex: idx,
            timestamp: Date.now(),
          })
          const result = await fetchBasicDataUseCase({ symbol: item.symbol })
          debug.log('并发采集子任务完成', {
            symbol: item.symbol,
            taskIndex: idx,
            success: result.success,
            elapsedMs: Date.now(),
          })
          // 立即移除该 symbol，让 Badge 从「采集中」及时切换为「已采/待采」，
          // 避免先完成的股票被卡在「采集中」状态等待最慢的子任务。
          setCollectingSymbols((prev) => {
            const next = new Set(prev)
            next.delete(item.symbol)
            debug.log('子任务完成即移除 collectingSymbol', {
              symbol: item.symbol,
              remaining: next.size,
            })
            return next
          })
          return { symbol: item.symbol, result }
        }),
      )
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.result.success,
      ).length
      const failCount = results.length - successCount
      const detail = results.map((r, i) => ({
        symbol: symbolsToCollect[i],
        status: r.status,
        success: r.status === 'fulfilled' ? r.value.result.success : false,
        error: r.status === 'rejected' ? String(r.reason) : r.status === 'fulfilled' ? r.value.result.error : null,
      }))
      debug.log('handleCollectAll 并发采集汇总', {
        total: toCollect.length,
        successCount,
        failCount,
        detail,
      })
      logger.info('[InputDashboard] 批量采集完成', { successCount, failCount, total: toCollect.length })
      debug.log('handleCollectAll 刷新前候选池', {
        poolSize: allStocks.length,
      })
      await refresh()
      debug.log('handleCollectAll 刷新后候选池', {
        poolSize: useIntentionPoolStore.getState().items.length,
        withPrice: useIntentionPoolStore.getState().items.filter((s) => s.price !== undefined).length,
      })
    } catch (err) {
      logger.error('[InputDashboard] 批量采集异常', {
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setCollectingSymbols(new Set())
      debug.log('handleCollectAll 已清除 collectingSymbols')
    }
  }, [allStocks, refresh])

  const handleDeleteStock = useCallback(async (symbol: string): Promise<void> => {
    const store = useIntentionPoolStore.getState()
    try {
      const deleted = await store.deleteItem(symbol)
      if (deleted) {
        setSelectedSymbols((prev) => prev.filter((s) => s !== symbol))
        await refresh()
      }
    } catch (err) {
      logger.error('[InputDashboard] 移除异常', {
        symbol,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [refresh])

  // ── 勾选 / 批量删除 ──
  const handleToggleSelect = useCallback((symbol: string): void => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    )
  }, [])

  const handleToggleSelectAll = useCallback((checked: boolean): void => {
    setSelectedSymbols(checked ? allStocks.map((s) => s.symbol) : [])
  }, [allStocks])

  const handleBatchDelete = useCallback(async (): Promise<void> => {
    if (selectedSymbols.length === 0) return
    const store = useIntentionPoolStore.getState()
    try {
      const count = await store.deleteItems(selectedSymbols)
      setSelectedSymbols([])
      if (count === 0) {
        logger.warn('[InputDashboard] 批量删除失败', { symbols: selectedSymbols })
      }
    } catch (err) {
      logger.error('[InputDashboard] 批量删除异常', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [selectedSymbols])

  const handleRefreshHealth = useCallback(async (): Promise<void> => {
    setFetcherOk(null)
    try {
      const result = await checkFetcherHealth()
      setFetcherOk(result.ok)
    } catch (err) {
      setFetcherOk(false)
      logger.error('[InputDashboard] 采集服务检查异常', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [])

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
                    <span className="text-xs text-success">↑ {Math.round((stats.withPrice / stats.total) * 100)}% 覆盖</span>
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
                      <span className="text-xs text-warning">↓ {stats.total - stats.withPrice} 待采</span>
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
                    <Badge className="bg-success/10 text-success">已连接</Badge>
                  ) : (
                    <Badge variant="destructive">未连接</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">待采集标的</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stats.total - stats.withPrice}</p>
                  {stats.total - stats.withPrice > 0 && (
                    <span className="text-xs text-warning">点击「采集全部」开始</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ─── 录入 Tab 切换区 ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>录入候选股票</CardTitle>
            <div className={cn('inline-flex rounded-xl bg-muted/60 p-1')}>
              <button
                onClick={() => setActiveTab('manual')}
                className={`${TAB_BASE} ${activeTab === 'manual' ? TAB_ACTIVE : TAB_INACTIVE}`}
              >
                自行意向输入
              </button>
              <button
                onClick={() => setActiveTab('hot-sector')}
                className={`${TAB_BASE} ${activeTab === 'hot-sector' ? TAB_ACTIVE : TAB_INACTIVE}`}
              >
                热门板块纳入
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Tab 1: 自行意向输入 ── */}
          {activeTab === 'manual' && (
            <>
              {/* 子分段：逐项 / 批量 */}
              <div className={cn('inline-flex rounded-xl bg-muted/60 p-1')}>
                <button
                  onClick={() => setManualMode('single')}
                  className={`${TAB_BASE} ${manualMode === 'single' ? TAB_ACTIVE : TAB_INACTIVE}`}
                >
                  逐项输入
                </button>
                <button
                  onClick={() => setManualMode('bulk')}
                  className={`${TAB_BASE} ${manualMode === 'bulk' ? TAB_ACTIVE : TAB_INACTIVE}`}
                >
                  批量导入
                </button>
              </div>

              {manualMode === 'single' ? (
                <>
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
                  {(message !== '' || (error != null && error !== '')) && (
                    <p className="text-sm text-muted-foreground">
                      {message !== ''
                        ? message
                        : (() => {
                            // 安全兜底：仅当 error 确为非字符串类型时打日志，
                            // 避免上游塞了 Error 对象却被静默渲染成 [object Object]
                            if (error != null && typeof error !== 'string') {
                              logger.warn('[InputDashboard] error 非字符串类型，请核对上游写入', {
                                type: typeof error,
                                keys: typeof error === 'object' ? Object.keys(error) : undefined,
                              })
                              return String(error)
                            }
                            return error as string
                          })()}
                    </p>
                  )}
                </>
              ) : (
                // 批量导入区块（整合自原独立页）
                <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载批量导入...</div>}>
                  <BulkImportPanel />
                </Suspense>
              )}
            </>
          )}

          {/* ── Tab 2: 热门板块纳入 ── */}
          {activeTab === 'hot-sector' && (
            <HotSectorSection />
          )}
        </CardContent>
      </Card>

      {/* ─── 意向候选池清单（合并采集任务状态展示） ─── */}
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
                onClick={() => void handleCollectAll()}
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
                              onClick={() => void handleCollectStock(item.symbol)}
                              className="h-8 px-3 text-xs"
                            >
                              <RefreshCw className={cn('mr-1 h-3 w-3', isCollecting && 'animate-spin')} />
                              {isCollecting ? '采集中' : isCollected ? '已采集' : '采集'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleDeleteStock(item.symbol)}
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
    </div>
  )
}
