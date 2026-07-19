/**
 * 采集任务监控页（D-1 框架）
 *
 * 容器组件：仅做 Tab 编排与状态路由
 * - 子模块：
 *   - `useCollectionTaskStats` 状态聚合
 *   - `CollectTaskStatsCards` 顶部 KPI
 *   - `TaskListTab` 任务列表
 *   - `ScoreAnalysisTab` 评分分析（含 4 子组件）
 *   - `DimHealthTab` 维度健康
 *   - `LiveLogStream` 实时日志
 *   - `CollectionTimeline` 链路时间线
 *   - `CollectionSwimlane` 泳道图
 *   - `TraceReplayPanel` 链路回放
 *
 * @module pages/input/CollectTask
 */

import {
  Activity,
  ListChecks,
  ScrollText,
  GitBranch,
  Repeat,
  BarChart3,
  LayoutDashboard,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { Badge } from '@/components/atoms'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/molecules'
import { CollectionProgressPanel } from '@/components/organisms/collection/CollectionProgressPanel'
import { CollectionReportPanel } from '@/components/organisms/collection/CollectionReportPanel'
import LiveLogStream from '@/components/organisms/input/LiveLogStream'
import CollectionTimeline from '@/components/organisms/input/CollectionTimeline'
import CollectionSwimlane from '@/components/organisms/input/CollectionSwimlane'
import TraceReplayPanel from '@/components/organisms/input/TraceReplayPanel'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@/components/atoms'
import { PageContainer, PageHeader } from '@/components/templates'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'

import { useCollectionTaskStats } from './hooks/useCollectionTaskStats'
import { CollectTaskBreadcrumb } from './components/CollectTaskBreadcrumb'
import { CollectTaskStatsCards } from './components/CollectTaskStatsCards'
import { TaskListTab } from './components/TaskListTab'
import { ScoreAnalysisTab } from './components/ScoreAnalysisTab'
import { DimHealthTab } from './components/DimHealthTab'
import { DataQualityTab } from './components/DataQualityTab'

/**
 * CollectTaskPage
 */
export default function CollectTaskPage(): React.JSX.Element {
  const {
    taskStats,
    lastSuccessAt,
    dimHealth,
    scoreStats,
    collectionReport,
    activeTab,
    setActiveTab,
    selectedTaskId,
    setSelectedTaskId,
    handleViewTask,
    clearLogs,
    logs,
    selectedTraces,
    tasks,
  } = useCollectionTaskStats()

  const stats = useCollectionRuntimeStore((s) => s.stats)
  const isLoading = false

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <CollectTaskBreadcrumb />

        <PageHeader
          title="采集任务监控"
          description="任务列表 · 维度健康度 · 采集日志 · 链路可视化"
          actions={<Badge variant="outline">D-1 框架</Badge>}
        />

        <CollectTaskStatsCards
          taskStats={taskStats}
          successRate={stats.successRate}
          avgLatency={stats.avgLatency}
          fallbackCount={stats.fallbackCount}
          writeRate={stats.writeRate}
          lastSuccessAt={lastSuccessAt}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="progress" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              进度汇报
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5">
              <ListChecks className="h-4 w-4" />
              任务列表
            </TabsTrigger>
            <TabsTrigger value="score-analysis" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              评分分析
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5">
              <Activity className="h-4 w-4" />
              维度健康
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <ScrollText className="h-4 w-4" />
              采集日志
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              时间线
            </TabsTrigger>
            <TabsTrigger value="swimlane" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              泳道图
            </TabsTrigger>
            <TabsTrigger value="replay" className="gap-1.5">
              <Repeat className="h-4 w-4" />
              回放
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-1.5">
              <Activity className="h-4 w-4" />
              数据质量
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress">
            <div className="space-y-4">
              <CollectionProgressPanel
                items={collectionReport.progressItems}
                overallProgress={collectionReport.overallProgress}
                hasRunningTask={collectionReport.hasRunningTask}
              />
              <CollectionReportPanel items={collectionReport.reportItems} />
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <TaskListTab
              tasks={tasks}
              isLoading={isLoading}
              onViewTask={handleViewTask}
            />
          </TabsContent>

          <TabsContent value="score-analysis">
            <ScoreAnalysisTab
              scoreStats={scoreStats}
              collectSuccessRate={stats.successRate}
              writeRate={stats.writeRate}
              avgLatency={stats.avgLatency}
              taskTotal={taskStats.runningCount + taskStats.successCount + taskStats.failedCount}
              lastSuccessAt={lastSuccessAt}
            />
          </TabsContent>

          <TabsContent value="health">
            <DimHealthTab isLoading={isLoading} dimHealth={dimHealth} />
          </TabsContent>

          <TabsContent value="logs">
            <LiveLogStream logs={logs} onClear={clearLogs} maxHeight="480px" />
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>采集链路时间线</CardTitle>
                    <CardDescription>
                      {selectedTaskId !== null
                        ? `任务 ${selectedTaskId} 的 trace`
                        : '全部 trace'}
                    </CardDescription>
                  </div>
                  {selectedTaskId !== null && (
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTaskId(null) }}>
                      查看全部
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CollectionTimeline spans={selectedTraces} maxHeight="480px" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="swimlane">
            <Card>
              <CardHeader>
                <CardTitle>采集链路泳道图</CardTitle>
                <CardDescription>各数据源按时间轴展开的甘特式视图</CardDescription>
              </CardHeader>
              <CardContent>
                <CollectionSwimlane spans={selectedTraces} maxHeight="480px" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="replay">
            <TraceReplayPanel spans={selectedTraces} />
          </TabsContent>

          <TabsContent value="quality">
            <DataQualityTab
              successRate={stats.successRate}
              writeRate={stats.writeRate}
              fallbackCount={stats.fallbackCount}
              totalCollects={stats.totalCollects}
              dimHealth={dimHealth}
              lastSuccessAt={lastSuccessAt}
              scoreStats={scoreStats}
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </ErrorBoundary>
  )
}
