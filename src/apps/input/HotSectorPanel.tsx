import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select, SelectItem } from '@/components/ui/Select'
import {
  getHotSectors,
  getHotSectorByCode,
  addHotSectorStock,
  addHotSectorStocks,
  type HotSector,
} from '@/services/input/hotSectorService'
import { usePoolData } from '@/components/pool/usePoolData'
import { useToast } from '@/hooks/useToast'

export default function HotSectorPanel(): React.JSX.Element {
  const { groups, allGroups, refresh } = usePoolData()
  const [hotSectors] = useState<HotSector[]>(() => getHotSectors())
  const [selectedHotSector, setSelectedHotSector] = useState<string>(
    getHotSectors()[0]?.code ?? '',
  )
  const [targetGroup, setTargetGroup] = useState('')
  const [addingHot, setAddingHot] = useState<Set<string>>(new Set())
  const [addingAll, setAddingAll] = useState(false)
  const [message, setMessage] = useState('')
  const { toast } = useToast()

  const allStocks = groups.flatMap((g) => g.stocks)
  const existingSymbols = useMemo(
    () => new Set(allStocks.map((s) => s.symbol)),
    [allStocks],
  )

  const activeHotSector = useMemo(
    () => getHotSectorByCode(selectedHotSector),
    [selectedHotSector],
  )

  const addOptions = useMemo(
    () => ({ fetchBasicAfterAdd: false, group: targetGroup || undefined }),
    [targetGroup],
  )

  const handleAddHotStock = async (symbolToAdd: string): Promise<void> => {
    if (!activeHotSector) return
    setAddingHot((prev) => new Set(prev).add(symbolToAdd))
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
      setMessage(`已将 ${symbolToAdd} 加入候选池`)
      await refresh()
    } else {
      setMessage(result.error ?? '加入失败')
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
                        ? 'bg-green-500/20 text-green-400'
                        : sector.trend === 'down'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
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
                  {addingAll ? '加入中...' : '全部加入候选池'}
                </Button>
              </div>
              <div className="max-h-96 overflow-auto">
                {activeHotSector.stocks.map((stock) => {
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
                        {isAdded ? '已加入' : isAdding ? '加入中...' : '加入候选池'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
