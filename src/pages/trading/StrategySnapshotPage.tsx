import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Save, History, Camera, Download, FileJson, CheckSquare, Square } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Checkbox } from '@/components/atoms/Checkbox'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { StrategyGroupCard } from '@/components/organisms/strategy/StrategyGroupCard'
import { ChangeLogPanel } from '@/components/organisms/strategy/ChangeLogPanel'
import { useStrategySnapshotStore } from '@/store/strategySnapshotStore'
import { getLogger } from '@/lib/logger'
import { PageContainer, PageHeader } from '@/components/templates'
import { useStrategyExport } from './hooks/useStrategyExport'


const logger = getLogger()

const GROUP_CONFIG: Array<{ key: 'core' | 'hot' | 'value'; title: string; color: string }> = [
  { key: 'core', title: '核心稀缺', color: 'bg-success' },
  { key: 'hot', title: '热点动量', color: 'bg-warning' },
  { key: 'value', title: '价值洼地', color: 'bg-info' },
]

/**
 * StrategySnapshotPage
 */
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

  // 组件挂载与卸载日志
  useEffect(() => {
    logger.info('[StrategySnapshotPage] 挂载，初始化策略快照页面')
    return () => {
      logger.info('[StrategySnapshotPage] 卸载，清理策略快照页面')
    }
  }, [])


  // 监听 activeTab 变化，加载对应数据
  useEffect(() => {
    logger.info('[StrategySnapshotPage] activeTab 切换', { activeTab })
    if (activeTab === 'current') {
      logger.info('[StrategySnapshotPage] 开始加载当前策略数据')
      void loadCurrentStrategy().then(() => {
        const state = useStrategySnapshotStore.getState()
        logger.info('[StrategySnapshotPage] 当前策略数据加载完成', {
          stockCount: state.stocks.length,
          v6ScoreCount: state.v6Scores.length,
          rotationScoreCount: state.rotationScores.length,
          coreItems: state.items.core.length,
          hotItems: state.items.hot.length,
          valueItems: state.items.value.length,
          error: state.error,
        })
      })
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (activeTab === 'history') {
      logger.info('[StrategySnapshotPage] 开始加载历史快照数据')
      void loadHistorySnapshots().then(() => {
        const state = useStrategySnapshotStore.getState()
        logger.info('[StrategySnapshotPage] 历史快照数据加载完成', {
          snapshotCount: state.snapshots.length,
          selectedSnapshotId: state.selectedSnapshot?.id,
          error: state.error,
        })
      })
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

  // 批量选中的快照 id 集合
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<Set<string>>(new Set())
  const {
    exporting,
    handleExportGroup: exportGroup,
    handleExportAll: exportAll,
    handleExportSnapshotJson: exportSnapshotJson,
    handleExportBatchSnapshots: exportBatchSnapshots,
  } = useStrategyExport()

  // 导出核心稀缺组合到 Excel
  async function handleExportCoreExcel() {
    const clickedAt = new Date().toISOString()
    logger.info(`[StrategySnapshotPage][CLICK] 导出核心稀缺按钮点击 @${clickedAt}`, {
      coreCount: items.core.length,
      hotCount: items.hot.length,
      valueCount: items.value.length,
      stockCount: stocks.length,
    })
    const result = await exportGroup(items.core, '核心稀缺组合')
    if (!result.success) {
      alert(`导出核心稀缺失败：${result.error}`)
    }
  }

  // 导出全部三策略分组到 Excel
  async function handleExportAllExcel() {
    const clickedAt = new Date().toISOString()
    logger.info(`[StrategySnapshotPage][CLICK] 导出全部按钮点击 @${clickedAt}`, {
      core: items.core.length,
      hot: items.hot.length,
      value: items.value.length,
    })
    const result = await exportAll(items)
    if (!result.success) {
      alert(`导出全部失败：${result.error}`)
    }
  }

  // 导出选中快照为 JSON
  // eslint-disable-next-line @typescript-eslint/require-await
  async function handleExportSnapshotJson() {
    if (!selectedSnapshot) {
      logger.warn('[StrategySnapshotPage][CLICK] 导出JSON跳过：未选中快照')
      return
    }
    const result = exportSnapshotJson(selectedSnapshot)
    if (!result.success) {
      alert(`导出JSON失败：${result.error}`)
    }
  }

  // 批量导出选中的快照到 Excel
  async function handleExportBatchSnapshots() {
    const selected = snapshots.filter((s) => selectedSnapshotIds.has(s.id))
    if (selected.length === 0) {
      alert('请先在左侧勾选要导出的快照')
      return
    }
    const result = await exportBatchSnapshots(selected)
    if (!result.success) {
      alert(`批量导出失败：${result.error}`)
    }
  }

  // 切换单个快照的选中状态
  function toggleSnapshotSelected(id: string) {
    const next = new Set(selectedSnapshotIds)
    if (next.has(id)) {
      next.delete(id)
      logger.debug('[StrategySnapshotPage] 取消勾选快照', { snapshotId: id })
    } else {
      next.add(id)
      logger.debug('[StrategySnapshotPage] 勾选快照', { snapshotId: id })
    }
    setSelectedSnapshotIds(next)
  }

  // 全选/取消全选
  function toggleSelectAll() {
    if (selectedSnapshotIds.size === snapshots.length) {
      setSelectedSnapshotIds(new Set())
      logger.info('[StrategySnapshotPage] 取消全选快照')
    } else {
      const next = new Set(snapshots.map((s) => s.id))
      setSelectedSnapshotIds(next)
      logger.info('[StrategySnapshotPage] 全选快照', { count: next.size })
    }
  }

  return (
    <PageContainer className="space-y-6">
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

      <PageHeader
        title="策略快照"
        description="三策略分组快照、版本管理与变更追踪"
        actions={<Badge variant="secondary">V6 Pro</Badge>}
      />

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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleExportCoreExcel()}
                disabled={items.core.length === 0 || exporting === 'core'}
                data-testid="export-core-excel-button"
                aria-label="导出核心稀缺 Excel"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting === 'core' ? '导出中...' : '导出核心稀缺'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleExportAllExcel()}
                disabled={
                  (items.core.length === 0 && items.hot.length === 0 && items.value.length === 0) ||
                  exporting === 'all'
                }
                data-testid="export-all-excel-button"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting === 'all' ? '导出中...' : '导出全部'}
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSaveSnapshot()}
                disabled={saving || stocks.length === 0}
                data-testid="save-snapshot-button"
                aria-label="保存当前策略快照"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? '保存中...' : '保存当前快照'}
              </Button>
            </div>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">快照列表</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="h-7 px-2 text-xs"
                        data-testid="select-all-snapshots-button"
                        aria-label="全选快照"
                      >
                        {selectedSnapshotIds.size === snapshots.length && snapshots.length > 0 ? (
                          <CheckSquare className="mr-1 h-3 w-3" />
                        ) : (
                          <Square className="mr-1 h-3 w-3" />
                        )}
                        全选 ({selectedSnapshotIds.size}/{snapshots.length})
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    最近 20 条策略快照 · 勾选后可<span className="text-primary font-medium">批量导出</span>
                  </CardDescription>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => void handleExportBatchSnapshots()}
                      disabled={selectedSnapshotIds.size === 0 || exporting === 'batch'}
                      data-testid="export-batch-excel-button"
                      className="w-full"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {exporting === 'batch'
                        ? `批量导出中 (${selectedSnapshotIds.size})...`
                        : `批量导出 Excel (${selectedSnapshotIds.size})`}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {snapshots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无历史快照</p>
                  ) : (
                    <ul className="space-y-2">
                      {snapshots.map((snapshot) => (
                        <li key={snapshot.id}>
                          <div className="flex items-start gap-2">
                            <div className="pt-3">
                              <Checkbox
                                checked={selectedSnapshotIds.has(snapshot.id)}
                                onChange={() => toggleSnapshotSelected(snapshot.id)}
                                data-testid={`snapshot-checkbox-${snapshot.id}`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectSnapshot(snapshot.id)}
                              className={`flex-1 rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent ${
                                selectedSnapshot?.id === snapshot.id
                                  ? 'border-primary bg-primary/5'
                                  : ''
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
                              <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                                <span>核心{snapshot.core.count}</span>
                                <span>热点{snapshot.hot.count}</span>
                                <span>价值{snapshot.value.count}</span>
                              </div>
                            </button>
                          </div>
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Camera className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">快照详情</CardTitle>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleExportSnapshotJson()}
                            disabled={exporting === 'json'}
                            data-testid="export-snapshot-json-button"
                            aria-label="导出快照 JSON"
                          >
                            <FileJson className="mr-2 h-4 w-4" />
                            {exporting === 'json' ? '导出中...' : '导出 JSON'}
                          </Button>
                        </div>
                        <CardDescription>
                          版本 {selectedSnapshot.version} · {selectedSnapshot.date} {selectedSnapshot.time} · 触发器{' '}
                          {selectedSnapshot.trigger}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="rounded-md border p-3 text-center">
                            <div className="text-h1 font-bold">{selectedSnapshot.core.count}</div>
                            <div className="text-xs text-muted-foreground">核心稀缺</div>
                          </div>
                          <div className="rounded-md border p-3 text-center">
                            <div className="text-h1 font-bold">{selectedSnapshot.hot.count}</div>
                            <div className="text-xs text-muted-foreground">热点动量</div>
                          </div>
                          <div className="rounded-md border p-3 text-center">
                            <div className="text-h1 font-bold">{selectedSnapshot.value.count}</div>
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
                      选择左侧快照查看详情（可勾选多个快照进行批量导出）
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
