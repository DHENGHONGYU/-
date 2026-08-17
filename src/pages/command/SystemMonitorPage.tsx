/**
 * @module pages/command/SystemMonitorPage
 * @description 系统监控面板 — 从 CommandApp.tsx 内联组件抽取为独立页面
 *
 * 使用 PageContainer + PageHeader 统一页面模板，
 * 使用 useConfirmDialog 替代原生 confirm()。
 *
 * @compliance AGENTS.md §三 颜色令牌规范：使用语义化令牌
 * @compliance AGENTS.md §五 页面模板规范：使用 PageContainer + PageHeader
 */

import React, { useEffect } from 'react'
import { Link } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Dialog, DialogContent } from '@/components/molecules/Dialog'
import { PageContainer, PageHeader } from '@/components/templates'
import { LoadingState } from '@/components/molecules'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import MigrationPanel from '@/components/organisms/system/MigrationPanel'
import LogStreamPanel from '@/components/organisms/system/LogStreamPanel'
import AgentTaskList from '@/components/organisms/system/AgentTaskList'
import {
  useCommandStore,
  selectStats,
  selectMessage,
  selectMessageType,
  selectMigrationOpen,
  selectIsLoading,
  selectIsResetting,
} from '@/store/commandStore'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import EngineStatusWidget from '@/cockpit/widgets/EngineStatusWidget'

/**
 * SystemMonitorPage — 系统监控面板
 *
 * 展示系统统计、智能体任务队列、系统日志流三大区块。
 * 使用 PageContainer + PageHeader 统一模板。
 */
export default function SystemMonitorPage(): React.JSX.Element {
  const stats = useCommandStore(selectStats)
  const message = useCommandStore(selectMessage)
  const messageType = useCommandStore(selectMessageType)
  const migrationOpen = useCommandStore(selectMigrationOpen)
  const isLoading = useCommandStore(selectIsLoading)
  const isResetting = useCommandStore(selectIsResetting)
  const loadStats = useCommandStore((state) => state.loadStats)
  const resetAll = useCommandStore((state) => state.resetAll)
  const setMigrationOpen = useCommandStore((state) => state.setMigrationOpen)

  const { confirm, dialogProps } = useConfirmDialog()

  const handleReset = async (): Promise<void> => {
    const ok = await confirm({
      title: '清空所有数据',
      description: '确定要清空所有数据吗？此操作不可恢复。',
      variant: 'danger',
      confirmLabel: '清空',
    })
    if (!ok) return
    await resetAll()
  }

  // 挂载时自动加载统计
  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const messageClass =
    messageType === 'error'
      ? 'text-destructive'
      : messageType === 'success'
        ? COLOR_TOKENS.success.tailwind
        : 'text-muted-foreground'

  if (isLoading && !stats) {
    return (
      <PageContainer>
        <PageHeader
          title="系统监控"
          description="查看系统统计、智能体任务队列与日志流"
        />
        <Card>
          <CardContent>
            <LoadingState message="加载中..." />
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <Breadcrumb aria-label="breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/command">总控舱</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>系统监控</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title="系统监控"
        description="查看系统统计、智能体任务队列与日志流"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => void loadStats()} disabled={isLoading}>
              {isLoading ? '加载中...' : '刷新统计'}
            </Button>
            <Button variant="danger" size="sm" onClick={() => void handleReset()} disabled={isResetting}>
              {isResetting ? '重置中...' : '重置数据'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMigrationOpen(true)}>
              V6 迁移
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          {message && <p className={`text-sm ${messageClass}`}>{message}</p>}
          {stats && (
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="rounded-md border p-3 text-center">
                  <p className="text-h1 font-bold">{value}</p>
                  <Badge variant="outline">{key}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 引擎状态（从 Cockpit 移入，蓝图 Phase 2 步骤 2.2） */}
      <EngineStatusWidget
        config={{ instanceId: 'monitor-engineStatus', widgetId: 'engineStatus', size: { cols: 4, rows: 2 }, title: '引擎状态', settings: {}, visible: true, collapsed: false }}
      />

      {/* 智能体任务列表 */}
      <Card>
        <CardHeader>
          <CardTitle>智能体任务队列</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentTaskList />
        </CardContent>
      </Card>

      {/* 系统日志流 */}
      <Card>
        <CardHeader>
          <CardTitle>系统日志流</CardTitle>
        </CardHeader>
        <CardContent>
          <LogStreamPanel />
        </CardContent>
      </Card>

      <Dialog open={migrationOpen} onOpenChange={setMigrationOpen}>
        <DialogContent showCloseButton={false}>
          <MigrationPanel />
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </PageContainer>
  )
}
