import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Select, SelectItem } from '@/components/atoms/Select'
import {
  getHotSectors,
  getHotSectorByCode,
  addHotSectorStock,
  addHotSectorStocks,
  type HotSector,
} from '@/services/input/hotSectorService'
import { useIntentionPoolStore, getIntentionPoolGroups } from '@/store/intentionPoolStore'
import { useToast } from '@/hooks/useToast'
import { getLogger } from '@/lib/logger'
import { twText, twBg } from '@/constants/theme.tokens'
import { Skeleton } from '@/components/molecules/states/Skeleton'

const logger = getLogger()

export default function HotSectorPanel(): React.JSX.Element {
  // 从 intentionPoolStore 获取状态
  const refresh = useIntentionPoolStore((s) => s.refresh)
  const items = useIntentionPoolStore((s) => s.items)
  const loading = useIntentionPoolStore((s) => s.loading)
  const allGroups = useMemo(() => getIntentionPoolGroups(), [items])
  
  const [hotSectors] = useState<HotSector[]>(() => getHotSectors())
  const [selectedHotSector, setSelectedHotSector] = useState<string>(
    getHotSectors()[0]?.code ?? '',
  )
  const [targetGroup, setTargetGroup] = useState('')
  const [addingHot, setAddingHot] = useState<Set<string>>(new Set())
  const [addingAll, setAddingAll] = useState(false)
  const [message, setMessage] = useState('')
  const { toast } = useToast()

  const existingSymbols = useMemo(
    () => new Set(items.map((s) => s.symbol)),
    [items],
  )

  const activeHotSector = useMemo(
    () => getHotSectorByCode(selectedHotSector),
    [selectedHotSector],
  )

  const addOptions = useMemo(
    () => ({ fetchBasicAfterAdd: false, group: targetGroup || undefined }),
    [targetGroup],
  )

  // 组件初始化：加载股票池数据
  useEffect(() => {
    logger.info('[HotSectorPanel] 组件初始化，加载股票池数据')
    void refresh()
  }, [refresh])

  const handleAddHotStock = async (symbolToAdd: string): Promise<void> => {
    if (!activeHotSector) {
      logger.warn('[HotSectorPanel] handleAddHotStock 中断: activeHotSector 为空', { symbol: symbolToAdd })
      return
    }

    const startTime = Date.now()
    logger.info('[HotSectorPanel] handleAddHotStock 开始', {
      symbol: symbolToAdd,
      sectorCode: activeHotSector.code,
      targetGroup: addOptions.group ?? '默认分组'
    })
    
    setAddingHot((prev) => new Set(prev).add(symbolToAdd))
    
    try {
      const result = await addHotSectorStock(
        activeHotSector.code,
        symbolToAdd,
        addOptions,
      )
      
      setAddingHot((prev) => {
        const next = new Set(prev)
        next.delete(symbolToAdd)
        return next
      })

      if (result.success) {
        logger.info('[HotSectorPanel] handleAddHotStock 成功', {
          symbol: symbolToAdd,
          elapsedMs: Date.now() - startTime,
        })
        setMessage(`已将 ${symbolToAdd} 加入意向候选池`)
        await refresh()
      } else {
        logger.error('[HotSectorPanel] handleAddHotStock 失败', {
          symbol: symbolToAdd,
          error: result.error,
          elapsedMs: Date.now() - startTime,
        })
        setMessage(result.error ?? '加入失败')
      }
    } catch (err) {
      logger.error('[HotSectorPanel] handleAddHotStock 异常', {
        symbol: symbolToAdd,
        error: err instanceof Error ? err.message : String(err),
        elapsedMs: Date.now() - startTime,
      })
      setAddingHot((prev) => {
        const next = new Set(prev)
        next.delete(symbolToAdd)
        return next
      })
      setMessage(err instanceof Error ? err.message : '加入失败')
    }
  }

  const handleAddAllHotStocks = async (): Promise<void> => {
    if (!activeHotSector || addingAll) return
    setAddingAll(true)
    setAddingHot((prev) => {
      const next = new Set(prev)
      activeHotSector.stocks.forEach((s) => next.add(s.symbol))
      return next
    })
    try {
      const result = await addHotSectorStocks(activeHotSector.code, addOptions)
      if (result.success && result.data) {
        toast({
          title: '批量加入完成',
          description: `板块 ${activeHotSector.name}：成功 ${result.data.added.length} 只，失败 ${result.data.failed.length} 只`,
          variant: 'success',
        })
        setMessage(
          `板块 ${activeHotSector.name}：成功加入 ${result.data.added.length} 只，失败 ${result.data.failed.length} 只`,
        )
        await refresh()
      } else {
        toast({ title: '批量加入失败', description: result.error ?? '未知错误', variant: 'error' })
        setMessage(result.error ?? '批量加入失败')
      }
    } finally {
      setAddingAll(false)
      setAddingHot((prev) => {
        const next = new Set(prev)
        activeHotSector.stocks.forEach((s) => next.delete(s.symbol))
        return next
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>热门板块推荐</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hotSectors.map((sector) => (
              <button
                key={sector.code}
                onClick={() => setSelectedHotSector(sector.code)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  selectedHotSector === sector.code
                    ? 'border-primary bg-primary/10'
                    : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{sector.name}</span>
                  <Badge
                    className={
                      sector.trend === 'up'
                        ? `${twBg('green', 100)} ${twText('green', 800)}`
                        : sector.trend === 'down'
                          ? `${twBg('red', 100)} ${twText('red', 800)}`
                          : `${twBg('gray', 100)} ${twText('gray', 600)}`
                    }
                  >
                    {sector.score}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  动量 {sector.factors.momentum} · 资金 {sector.factors.fundFlow}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">目标分组：</span>
            <Select
              className="h-8 w-auto min-w-[140px]"
              value={targetGroup}
              onChange={(e) => setTargetGroup(e.target.value)}
              aria-label="热门板块目标分组"
            >
              <SelectItem value="">默认分组</SelectItem>
              {allGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </Select>
          </div>

          {activeHotSector && (
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b p-3">
                <h4 className="font-medium">{activeHotSector.name} 关联股票</h4>
                <Button size="sm" variant="secondary" onClick={() => void handleAddAllHotStocks()} disabled={addingAll}>
                  {addingAll ? '加入中...' : '全部加入意向候选池'}
                </Button>
              </div>
              <div className="max-h-96 overflow-auto">
                {loading && items.length === 0 ? (
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  activeHotSector.stocks.map((stock) => {
                    const isAdded = existingSymbols.has(stock.symbol)
                    const isAdding = addingHot.has(stock.symbol)
                    return (
                      <div
                        key={stock.symbol}
                        className="flex items-center justify-between border-b p-3 last:border-b-0"
                      >
                        <div>
                          <span className="font-mono text-sm">{stock.symbol}</span>
                          <span className="ml-2 text-sm text-muted-foreground">{stock.name}</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void handleAddHotStock(stock.symbol)}
                          disabled={isAdded || isAdding}
                          variant={isAdded ? 'secondary' : 'primary'}
                        >
                          {isAdded ? '已加入' : isAdding ? '加入中...' : '加入意向候选池'}
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
