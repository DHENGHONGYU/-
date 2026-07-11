import React, { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { getLogger } from '@/lib/logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { EmptyState } from '@/components/molecules/EmptyState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { useExecutionStore, initExecutionStoreSubscriptions } from '@/store/executionStore'
import { ExecutionPlanCard } from '../components/ExecutionPlanCard'
import type { ExecutionPlan } from '@/data/types'
import { RefreshCw } from 'lucide-react'

type FilterTab = 'all' | 'active' | 'completed' | 'cancelled' | 'reviewed'

const logger = getLogger()

const TAB_LABELS: Record<FilterTab, string> = {
  all: '全部',
  active: '活跃',
  completed: '已完成',
  cancelled: '已取消',
  reviewed: '已复盘',
}

function isToday(timestamp: number): boolean {
  const d = new Date(timestamp)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function filterPlans(plans: ExecutionPlan[], tab: FilterTab): ExecutionPlan[] {
  switch (tab) {
    case 'active':
      return plans.filter((p) => p.phase === 'plan' || p.phase === 'confirmed' || p.phase === 'pending')
    case 'completed':
      return plans.filter((p) => p.phase === 'executed')
    case 'cancelled':
      return plans.filter((p) => p.phase === 'cancelled')
    case 'reviewed':
      return plans.filter((p) => p.phase === 'reviewed')
    default:
      return plans
  }
}

export function ExecutionPlanPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const plans = useExecutionStore((s) => s.plans)
  const activePlans = useExecutionStore((s) => s.activePlans)
  const loading = useExecutionStore((s) => s.loading)
  const isRefreshing = useExecutionStore((s) => s.isRefreshing)
  const refresh = useExecutionStore((s) => s.refresh)
  const confirmPlan = useExecutionStore((s) => s.confirmPlan)
  const executePlan = useExecutionStore((s) => s.executePlan)
  const cancelPlan = useExecutionStore((s) => s.cancelPlan)
  const markReviewed = useExecutionStore((s) => s.markReviewed)

  useEffect(() => {
    const snapshot = useExecutionStore.getState()
    logger.info('[ExecutionPlanPanel] 挂载，开始初始化订阅', {
      planCount: snapshot.plans.length,
      activePlanCount: snapshot.activePlans.length,
    })
    const cleanup = initExecutionStoreSubscriptions()
    logger.info('[ExecutionPlanPanel] 订阅初始化完成，触发首次刷新')
    void refresh()
    return () => {
      logger.info('[ExecutionPlanPanel] 卸载，清理订阅')
      cleanup()
    }
  }, [refresh])

  const filteredPlans = useMemo(() => filterPlans(plans, activeTab), [plans, activeTab])

  const stats = useMemo(() => {
    const active = activePlans.length
    const pendingConfirm = plans.filter((p) => p.phase === 'plan').length
    const todayExecuted = plans.filter(
      (p) => p.phase === 'executed' && p.executedAt && isToday(p.executedAt)
    ).length
    return { active, pendingConfirm, todayExecuted }
  }, [plans, activePlans])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle>执行计划</CardTitle>
            {activePlans.length > 0 && (
              <Badge variant="default">{activePlans.length}</Badge>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refresh()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isRefreshing && 'animate-spin')} />
            {isRefreshing ? '刷新中...' : '刷新'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 统计栏 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">活跃</p>
            <p className="text-lg font-semibold">{stats.active}</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">待确认</p>
            <p className="text-lg font-semibold">{stats.pendingConfirm}</p>
          </div>
          <div className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">今日执行</p>
            <p className="text-lg font-semibold">{stats.todayExecuted}</p>
          </div>
        </div>

        {/* 筛选栏 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
          <TabsList className="w-full">
            {(Object.keys(TAB_LABELS) as FilterTab[]).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="flex-1">
                {TAB_LABELS[tab]}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({filterPlans(plans, tab).length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-32 rounded-md border bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredPlans.length === 0 ? (
              <>
                {logger.info('[ExecutionPlanPanel] 当前标签无执行计划', { activeTab })}
                <EmptyState
                  title="暂无执行计划"
                  description="扫描信号后将自动生成"
                  className="py-8"
                />
              </>
            ) : (
              <>
                {logger.info('[ExecutionPlanPanel] 渲染执行计划列表', {
                  activeTab,
                  filteredCount: filteredPlans.length,
                })}
                <div className="grid gap-2">
                  {filteredPlans.map((plan) => (
                    <ExecutionPlanCard
                      key={plan.id}
                      plan={plan}
                      onConfirm={confirmPlan}
                      onExecute={executePlan}
                      onCancel={cancelPlan}
                      onReview={markReviewed}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
