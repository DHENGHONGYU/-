import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Select, SelectItem } from '@/components/ui/Select'
import { addStock } from '@/services/input/inputService'
import {
  checkFetcherHealth,
  refreshSymbolKline,
} from '@/services/fetcher/fetcherService'
import { transitionStock, updateStockGroup } from '@/services/stockpool/stockpoolService'
import { PoolBoard } from '@/components/pool/PoolBoard'
import { usePoolData } from '@/components/pool/usePoolData'
import { StockSearch } from '@/components/input/StockSearch'
import { RESEARCH_STATUS, type ResearchStatus } from '@/config/dbConfig'
import type { Stock } from '@/data/types'
import type { StockSearchResult } from '@/services/input/inputService'
import type { PoolViewMode } from '@/components/pool/PoolBoard'

const ALL_GROUPS_VALUE = '__all__'
type QualityFilter = 'all' | 'missingBasic' | 'missingKline' | 'missingFinance'

export default function InputDashboard(): React.JSX.Element {
  const navigate = useNavigate()
  const {
    groups,
    allGroups,
    selectedGroup,
    setSelectedGroup,
    loading,
    error,
    refresh,
    handleTransition,
    handleChangeGroup,
  } = usePoolData()
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [message, setMessage] = useState('')
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchMode, setSearchMode] = useState<'fill' | 'add'>('fill')
  const [viewMode, setViewMode] = useState<PoolViewMode>('kanban')
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [createdGroups, setCreatedGroups] = useState<string[]>([])

  const groupOptions = useMemo(
    () => Array.from(new Set([...allGroups, ...createdGroups])).sort(),
    [allGroups, createdGroups],
  )

  const allStocks = groups.flatMap((g) => g.stocks)

  const filteredStocks = useMemo(() => {
    if (qualityFilter === 'all') return allStocks
    return allStocks.filter((s) => {
      const q = s.dataQuality
      switch (qualityFilter) {
        case 'missingBasic':
          return q?.basic !== true
        case 'missingKline':
          return q?.kline !== true
        case 'missingFinance':
          return q?.finance !== true
        default:
          return true
      }
    })
  }, [allStocks, qualityFilter])

  const handleAdd = async (fetchBasic: boolean, fetchKline: boolean): Promise<void> => {
    if (!symbol || !name) {
      setMessage('请输入代码和名称')
      return
    }

    setSubmitting(true)
    const result = await addStock(
      { symbol, name },
      {
        fetchBasicAfterAdd: fetchBasic,
        fetchKlineAfterAdd: fetchKline,
        group: group || undefined,
      },
    )
    setSubmitting(false)

    if (result.success) {
      setMessage(
        result.error
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
  }

  const handleRefreshHealth = async (): Promise<void> => {
    setFetcherOk(null)
    const result = await checkFetcherHealth()
    setFetcherOk(result.ok)
    if (!result.ok) {
      setMessage(result.error ?? '数据采集服务异常')
    }
  }

  const handleRefreshKline = async (stock: Stock): Promise<void> => {
    const result = await refreshSymbolKline(stock.symbol)
    if (result.success) {
      setMessage(`已刷新 ${stock.symbol} 行情`)
      await refresh()
    } else {
      setMessage(result.error ?? '刷新行情失败')
    }
  }

  const handleAnalyze = (symbolToAnalyze: string): void => {
    navigate(`/analysis/stock-score/${symbolToAnalyze}`)
  }

  const handleSelectToggle = (targetSymbol: string): void => {
    setSelectedSymbols((prev) =>
      prev.includes(targetSymbol)
        ? prev.filter((s) => s !== targetSymbol)
        : [...prev, targetSymbol],
    )
  }

  const runBulkTransition = async (toStatus: ResearchStatus): Promise<void> => {
    const targets = allStocks.filter((s) => selectedSymbols.includes(s.symbol))
    const results: string[] = []
    for (const stock of targets) {
      const result = await transitionStock(stock.symbol, toStatus)
      if (!result.success) {
        results.push(`${stock.symbol}: ${result.error ?? '失败'}`)
      }
    }
    setSelectedSymbols([])
    await refresh()
    if (results.length > 0) {
      setMessage(`批量流转完成，部分失败：${results.join('；')}`)
    } else {
      setMessage(`已批量流转 ${targets.length} 只标的到 ${toStatus}`)
    }
  }

  const runBulkChangeGroup = async (targetGroup: string): Promise<void> => {
    const targets = allStocks.filter((s) => selectedSymbols.includes(s.symbol))
    const results: string[] = []
    for (const stock of targets) {
      const result = await updateStockGroup(stock.symbol, targetGroup)
      if (!result.success) {
        results.push(`${stock.symbol}: ${result.error ?? '失败'}`)
      }
    }
    setSelectedSymbols([])
    await refresh()
    if (results.length > 0) {
      setMessage(`批量移入分组完成，部分失败：${results.join('；')}`)
    } else {
      setMessage(`已批量移入 ${targets.length} 只标的到 ${targetGroup}`)
    }
  }

  const handleBulkArchive = (): Promise<void> => runBulkTransition(RESEARCH_STATUS.archived)

  const handleCreateGroup = async (): Promise<void> => {
    const trimmed = newGroupName.trim()
    if (!trimmed) {
      setMessage('分组名称不能为空')
      return
    }
    if (groupOptions.includes(trimmed)) {
      setMessage('分组名称已存在')
      return
    }
    setCreatedGroups((prev) => [...prev, trimmed])
    setGroup(trimmed)
    setSelectedGroup(trimmed)
    setNewGroupName('')
    setNewGroupDialogOpen(false)
    setMessage(`已创建分组「${trimmed}」`)
  }

  const stats = useMemo(() => {
    const total = allStocks.length
    const withPrice = allStocks.filter((s) => s.price !== undefined).length
    return { total, withPrice }
  }, [allStocks])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">候选池标的</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">已采行情</p>
            <p className="text-2xl font-bold">{stats.withPrice}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">采集服务</p>
            <div className="mt-1 flex items-center gap-2">
              {fetcherOk === null ? (
                <Badge variant="outline">检查中...</Badge>
              ) : fetcherOk ? (
                <Badge className="bg-green-500/20 text-green-400">已连接</Badge>
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
              <Button size="sm" variant="secondary" onClick={() => navigate('/input/bulk-import')}>
                批量导入
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/input/hot-sectors')}>
                热门板块
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate('/input/prototype')}>
                交互原型
              </Button>
            </div>
          </CardContent>
        </Card>
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
              直接录入候选池
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
            onAdded={async (): Promise<void> => {
              setMessage('搜索标的已录入候选池')
              await refresh()
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[160px] flex-1"
              placeholder="股票代码，如 600519.SH"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
            <Input
              className="min-w-[120px] flex-1"
              placeholder="股票名称"
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
              {groupOptions.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </Select>
            <Button onClick={() => handleAdd(false, false)} disabled={submitting}>
              {submitting ? '处理中...' : '仅录入'}
            </Button>
            <Button variant="secondary" onClick={() => handleAdd(true, false)} disabled={submitting}>
              {submitting ? '处理中...' : '录入并拉基础'}
            </Button>
            <Button variant="secondary" onClick={() => handleAdd(true, true)} disabled={submitting}>
              {submitting ? '处理中...' : '录入并拉全部'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">采集服务状态：</span>
            {fetcherOk === null ? (
              <Badge variant="outline">检查中...</Badge>
            ) : fetcherOk ? (
              <Badge className="bg-green-500/20 text-green-400">已连接</Badge>
            ) : (
              <Badge variant="destructive">未连接</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefreshHealth}>
              刷新
            </Button>
          </div>
          {(message || error) && (
            <p className="text-sm text-muted-foreground">{message || error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>股票池看板</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
              {loading ? '刷新中...' : '刷新看板'}
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              onClick={() => setViewMode('kanban')}
            >
              看板视图
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              onClick={() => setViewMode('list')}
            >
              列表视图
            </Button>
            <Select
              className="h-8 w-auto min-w-[140px]"
              value={selectedGroup || ALL_GROUPS_VALUE}
              onChange={(e) =>
                setSelectedGroup(e.target.value === ALL_GROUPS_VALUE ? '' : e.target.value)
              }
              aria-label="分组筛选"
            >
              <SelectItem value={ALL_GROUPS_VALUE}>全部组</SelectItem>
              {groupOptions.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewGroupDialogOpen(true)}
            >
              新建分组
            </Button>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value as QualityFilter)}
              aria-label="数据质量筛选"
            >
              <option value="all">全部质量状态</option>
              <option value="missingBasic">缺失基础数据</option>
              <option value="missingKline">缺失行情数据</option>
              <option value="missingFinance">缺失财务数据</option>
            </select>
            {selectedSymbols.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">
                  已选 {selectedSymbols.length} 只
                </span>
                <Button size="sm" variant="secondary" onClick={handleBulkArchive}>
                  批量归档
                </Button>
                <Select
                  className="h-8 w-auto min-w-[120px]"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      void runBulkChangeGroup(e.target.value)
                    }
                  }}
                  aria-label="批量移入分组"
                >
                  <SelectItem value="">批量移入分组</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedSymbols([])}
                >
                  清除选择
                </Button>
              </>
            )}
          </div>
          <PoolBoard
            stocks={filteredStocks}
            viewMode={viewMode}
            selectedSymbols={selectedSymbols}
            onSelectToggle={handleSelectToggle}
            onTransition={handleTransition}
            onChangeGroup={handleChangeGroup}
            onRefreshKline={handleRefreshKline}
            onAnalyze={handleAnalyze}
          />
        </CardContent>
      </Card>

      <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建股票池分组</DialogTitle>
            <DialogDescription>输入新分组名称，创建后可用于筛选与录入。</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="分组名称，如 核心持仓"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            maxLength={20}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewGroupDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleCreateGroup()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
