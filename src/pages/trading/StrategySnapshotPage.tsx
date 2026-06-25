import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Save, History, Camera } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { StrategyGroupCard } from '@/components/strategy/StrategyGroupCard'
import { ChangeLogPanel } from '@/components/strategy/ChangeLogPanel'
import {
  classifyStocks,
  listSnapshots,
  saveStrategySnapshot,
} from '@/services/trading/strategySnapshotService'
import { listStocks } from '@/services/stockpool/stockpoolService'
import { getAllV6Scores } from '@/services/scoring/v6ScoreService'
import { listRotationScores } from '@/services/analysis/rotationScoreService'
import type { StrategySnapshot, Stock, V6Score, RotationSectorScore } from '@/data/types'
import type { StrategyGroupItem } from '@/services/trading/strategySnapshotService'

const GROUP_CONFIG: Array<{ key: 'core' | 'hot' | 'value'; title: string; color: string }> = [
  { key: 'core', title: '核心稀缺', color: 'bg-emerald-500' },
  { key: 'hot', title: '热点动量', color: 'bg-amber-500' },
  { key: 'value', title: '价值洼地', color: 'bg-blue-500' },
]

export default function StrategySnapshotPage(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('current')
  const [stocks, setStocks] = useState<Stock[]>([])
  const [v6Scores, setV6Scores] = useState<V6Score[]>([])
  const [rotationScores, setRotationScores] = useState<RotationSectorScore[]>([])
  const [items, setItems] = useState<StrategyGroupItem[]>([])
  const [snapshots, setSnapshots] = useState<StrategySnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<StrategySnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadCurrentData() {
      setLoading(true)
      setError(null)
      try {
        const [stockResult, v6Result, rotationResult] = await Promise.all([
          listStocks(),
          getAllV6Scores(),
          listRotationScores(),
        ])
        if (!stockResult.success || !v6Result.success || !rotationResult.success) {
          throw new Error(
            stockResult.error ?? v6Result.error ?? rotationResult.error ?? '加载当前数据失败',
          )
        }
        const stockList = stockResult.data ?? []
        const v6ScoreList = v6Result.data ?? []
        const rotationScoreList = rotationResult.data ?? []
        if (cancelled) return
        setStocks(stockList)
        setV6Scores(v6ScoreList)
        setRotationScores(rotationScoreList)
        const classified = classifyStocks({
          stocks: stockList,
          v6Scores: v6ScoreList,
          rotationScores: rotationScoreList,
        })
        setItems(classified)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    loadCurrentData()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  useEffect(() => {
    let cancelled = false
    async function loadSnapshots() {
      if (activeTab !== 'history') return
      setLoading(true)
      setError(null)
      try {
        const result = await listSnapshots(20)
        if (cancelled) return
        if (!result.success) {
          setError(result.error ?? '加载历史快照失败')
          return
        }
        const list = result.data ?? []
        setSnapshots(list)
        if (list.length > 0) {
          setSelectedSnapshot(list[0]!)
        } else {
          setSelectedSnapshot(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    loadSnapshots()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  const groupedItems = useMemo(() => {
    return {
      core: items.filter((item) => item.classification === 'core'),
      hot: items.filter((item) => item.classification === 'hot'),
      value: items.filter((item) => item.classification === 'value'),
    }
  }, [items])

  async function handleSaveSnapshot() {
    if (stocks.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const result = await saveStrategySnapshot({ stocks, v6Scores, rotationScores }, 'manual')
      if (!result.success) {
        setError(result.error ?? '保存失败')
        return
      }
      if (activeTab === 'history') {
        const listResult = await listSnapshots(20)
        if (listResult.success) {
          const list = listResult.data ?? []
          setSnapshots(list)
          setSelectedSnapshot(list[0] ?? null)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/trading">交易舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>策略快照</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">策略快照</h1>
          <p className="text-muted-foreground">三策略分组快照、版本管理与变更追踪</p>
        </div>
        <Badge variant="secondary">V6 Pro</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="current">当前策略</TabsTrigger>
          <TabsTrigger value="history">历史快照</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              股票 {stocks.length} / V6 评分 {v6Scores.length} / 轮动评分 {rotationScores.length}
            </div>
            <Button
              size="sm"
              onClick={handleSaveSnapshot}
              disabled={saving || stocks.length === 0}
              data-testid="save-snapshot-button"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? '保存中...' : '保存当前快照'}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {GROUP_CONFIG.map((group) => (
                <StrategyGroupCard
                  key={group.key}
                  title={group.title}
                  items={groupedItems[group.key]}
                  color={group.color}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">快照列表</CardTitle>
                  </div>
                  <CardDescription>最近 20 条策略快照</CardDescription>
                </CardHeader>
                <CardContent>
                  {snapshots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无历史快照</p>
                  ) : (
                    <ul className="space-y-2">
                      {snapshots.map((snapshot) => (
                        <li key={snapshot.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedSnapshot(snapshot)}
                            className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent ${
                              selectedSnapshot?.id === snapshot.id ? 'border-primary bg-primary/5' : ''
                            }`}
                            data-testid={`snapshot-item-${snapshot.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">版本 {snapshot.version}</span>
                              <Badge variant="outline" className="text-xs">
                                {snapshot.trigger}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {snapshot.date} {snapshot.time}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4 lg:col-span-2">
                {selectedSnapshot ? (
                  <>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-base">快照详情</CardTitle>
                        </div>
                        <CardDescription>
                          版本 {selectedSnapshot.version} · {selectedSnapshot.date} {selectedSnapshot.time} · 触发器{' '}
                          {selectedSnapshot.trigger}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="rounded-md border p-3 text-center">
                            <div className="text-2xl font-bold">{selectedSnapshot.core.count}</div>
                            <div className="text-xs text-muted-foreground">核心稀缺</div>
                          </div>
                          <div className="rounded-md border p-3 text-center">
                            <div className="text-2xl font-bold">{selectedSnapshot.hot.count}</div>
                            <div className="text-xs text-muted-foreground">热点动量</div>
                          </div>
                          <div className="rounded-md border p-3 text-center">
                            <div className="text-2xl font-bold">{selectedSnapshot.value.count}</div>
                            <div className="text-xs text-muted-foreground">价值洼地</div>
                          </div>
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground">
                          股票 {selectedSnapshot.stockCount} / 评分 {selectedSnapshot.scoreCount} / 轮动{' '}
                          {selectedSnapshot.rotationCount}
                        </div>
                      </CardContent>
                    </Card>

                    <ChangeLogPanel snapshot={selectedSnapshot} />
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      选择左侧快照查看详情
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
