import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import { Select, SelectItem } from '@/components/atoms/Select'
import { addStock } from '@/services/input/inputService'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import { usePoolStore, getAllGroups } from '@/store/poolStore'
import { StockSearch } from '@/components/input/StockSearch'
import type { StockSearchResult } from '@/services/input/inputService'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS, twText, twBg } from '@/constants/theme.tokens'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { GaugeRing } from '@/components/chart/GaugeChart'

const logger = getLogger()

export default function InputDashboard(): React.JSX.Element {
  // 从 poolStore 获取状态
  const stocks = usePoolStore((s) => s.stocks)
  const loading = usePoolStore((s) => s.loading)
  const error = usePoolStore((s) => s.error)
  const refresh = usePoolStore((s) => s.refresh)

  // 本地 UI 状态
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [message, setMessage] = useState('')
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchMode, setSearchMode] = useState<'fill' | 'add'>('fill')

  // 初始化加载
  useEffect(() => {
    logger.info('[InputDashboard] 初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  const allGroups = useMemo(() => getAllGroups(), [])
  const allStocks = stocks

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
                <p className="text-xs text-muted-foreground">候选池标的</p>
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
              <Badge className={`${COLOR_TOKENS.up.bgClass} ${COLOR_TOKENS.up.tailwind}`}>已连接</Badge>
            ) : (
              <Badge variant="destructive">未连接</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => void handleRefreshHealth()}>
              刷新
            </Button>
          </div>
          {(message || error) && (
            <p className="text-sm text-muted-foreground">{message || error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
