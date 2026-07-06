import { useEffect, useMemo } from 'react'
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
import { useStrategySnapshotStore } from '@/store/strategySnapshotStore'
import { getLogger } from '@/lib/logger'
import { twBg } from '@/constants/theme.tokens'

const logger = getLogger()

const GROUP_CONFIG: Array<{ key: 'core' | 'hot' | 'value'; title: string; color: string }> = [
  { key: 'core', title: '核心稀缺', color: twBg('emerald', 500) },
  { key: 'hot', title: '热点动量', color: twBg('amber', 500) },
  { key: 'value', title: '价值洼地', color: twBg('blue', 500) },
]

export default function StrategySnapshotPage(): React.JSX.Element {
  // 从 Store 获取状态
  const activeTab = useStrategySnapshotStore((s) => s.activeTab)
  const stocks = useStrategySnapshotStore((s) => s.stocks)
  const v6Scores = useStrategySnapshotStore((s) => s.v6Scores)
  const rotationScores = useStrategySnapshotStore((s) => s.rotationScores)
  const items = useStrategySnapshotStore((s) => s.items)
  const snapshots = useStrategySnapshotStore((s) => s.snapshots)
  const selectedSnapshot = useStrategySnapshotStore((s) => s.selectedSnapshot)
  const loading = useStrategySnapshotStore((s) => s.loading)
  const saving = useStrategySnapshotStore((s) => s.saving)
  const error = useStrategySnapshotStore((s) => s.error)

  // 从 Store 获取 actions
  const setActiveTab = useStrategySnapshotStore((s) => s.setActiveTab)
  const loadCurrentStrategy = useStrategySnapshotStore((s) => s.loadCurrentStrategy)
  const loadHistorySnapshots = useStrategySnapshotStore((s) => s.loadHistorySnapshots)
  const saveSnapshot = useStrategySnapshotStore((s) => s.saveSnapshot)
  const selectSnapshot = useStrategySnapshotStore((s) => s.selectSnapshot)

  // 监听 activeTab 变化，加载对应数据
  useEffect(() => {
    logger.info('[StrategySnapshotPage] activeTab 切换', { activeTab })
    if (activeTab === 'current') {
      void loadCurrentStrategy()
    } else if (activeTab === 'history') {
      void loadHistorySnapshots()
    }
  }, [activeTab, loadCurrentStrategy, loadHistorySnapshots])

  // 构建分类后的 items（Store 中已经是分类后的结构）
  const groupedItems = useMemo(() => {
    logger.info('[StrategySnapshotPage] 构建分类数据', {
      core: items.core.length,
      hot: items.hot.length,
      value: items.value.length,
    })
    return items
  }, [items])

  // 保存快照处理
  async function handleSaveSnapshot() {
    logger.info('[StrategySnapshotPage] 开始保存快照', {
      stockCount: stocks.length,
      v6ScoreCount: v6Scores.length,
      rotationScoreCount: rotationScores.length,
      activeTab,
    })
    if (stocks.length === 0) {
      logger.warn('[StrategySnapshotPage] 跳过保存：股票池为空')
      return
    }
    await saveSnapshot('manual')
    logger.info('[StrategySnapshotPage] 快照保存完成')
  }

  // 选择快照处理
  function handleSelectSnapshot(id: string) {
    logger.info('[StrategySnapshotPage] 选择快照', { snapshotId: id })
    selectSnapshot(id)
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'current' | 'history')}>
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
              onClick={() => void handleSaveSnapshot()}
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
                            onClick={() => handleSelectSnapshot(snapshot.id)}
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
