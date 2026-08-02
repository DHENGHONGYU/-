import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Settings, Plus, Target } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { WidgetErrorBoundary } from '@/components/organisms/shared/WidgetErrorBoundary'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { widgetEngine } from '@/cockpit/core/widgetEngine'
import { MarketDataProvider, useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { CockpitCrossLayout } from '@/cockpit/layout/CockpitCrossLayout'
import { getLogger } from '@/lib/logger'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { useTradingStore } from '@/store/tradingStore'
import { Loading, Empty, ErrorState } from '@/components/molecules/states'
import { Alert } from '@/components/molecules/Alert'
import { ComplianceDisclaimer } from '@/components/atoms/ComplianceDisclaimer'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'

const logger = getLogger()
const LAYOUT_STORAGE_KEY = 'v9_cockpit_layout'
const LAYOUT_VERSION = 3

interface LayoutStorageData {
  version: number
  positions: Record<string, { x: number; y: number }>
}

interface LayoutMigrationLog {
  timestamp: number
  fromVersion: number | string
  toVersion: number
  removedInstanceIds: string[]
  reason: string
}

const LAYOUT_MIGRATION_LOG_KEY = 'v9_cockpit_layout_migration_log'

function saveMigrationLog(log: LayoutMigrationLog): void {
  try {
    const existing = localStorage.getItem(LAYOUT_MIGRATION_LOG_KEY)
    const logs = existing ? JSON.parse(existing) as LayoutMigrationLog[] : []
    logs.push(log)
    localStorage.setItem(LAYOUT_MIGRATION_LOG_KEY, JSON.stringify(logs.slice(-10)))
  } catch {
    logger.warn('[CockpitShell] Failed to save migration log')
  }
}

function getLastMigrationLog(): LayoutMigrationLog | null {
  try {
    const existing = localStorage.getItem(LAYOUT_MIGRATION_LOG_KEY)
    if (!existing) return null
    const logs = JSON.parse(existing) as LayoutMigrationLog[]
    return logs[logs.length - 1] ?? null
  } catch {
    return null
  }
}

/** 从 localStorage 恢复布局，带版本校验（Phase 1 纵横交叉布局后仅用于 resetLayout） */
function loadLayout(): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as LayoutStorageData | Record<string, { x: number; y: number }>

    if ('version' in parsed && parsed.version === LAYOUT_VERSION) {
      return (parsed as LayoutStorageData).positions
    }

    const storedVersion = 'version' in parsed ? parsed.version : 'legacy'
    logger.warn('[CockpitShell] Layout version mismatch, resetting to default', {
      storedVersion,
      currentVersion: LAYOUT_VERSION,
    })

    const safeVersion = typeof storedVersion === 'string' ? storedVersion : JSON.stringify(storedVersion)

    saveMigrationLog({
      timestamp: Date.now(),
      fromVersion: storedVersion as string | number,
      toVersion: LAYOUT_VERSION,
      removedInstanceIds: [],
      reason: `布局版本升级：${safeVersion} -> ${LAYOUT_VERSION}`,
    })

    return null
  } catch {
    logger.warn('[CockpitShell] Failed to parse layout, resetting to default')
    
    saveMigrationLog({
      timestamp: Date.now(),
      fromVersion: 'unknown',
      toVersion: LAYOUT_VERSION,
      removedInstanceIds: [],
      reason: '布局解析失败，重置为默认',
    })

    return null
  }
}

void loadLayout // Phase 1: 函数保留用于未来布局恢复，当前通过 void 消除 unused 警告

/** 持久化布局到 localStorage，带版本号（Phase 1 纵横交叉布局后保留用于未来恢复） */
export function saveLayout(layout: { i: string; x: number; y: number; w: number; h: number }[]): void {
  try {
    const positions: Record<string, { x: number; y: number }> = {}
    layout.forEach((item) => {
      positions[item.i] = { x: item.x, y: item.y }
    })
    const data: LayoutStorageData = {
      version: LAYOUT_VERSION,
      positions,
    }
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    logger.warn('[CockpitShell] Failed to save layout')
  }
}


/** 重置布局为默认 */
function resetLayout(): void {
  try {
    localStorage.removeItem(LAYOUT_STORAGE_KEY)
    logger.info('[CockpitShell] Layout reset to default')
    window.location.reload()
  } catch {
    logger.warn('[CockpitShell] Failed to reset layout')
  }
}

/**
 * 清理布局中的失效引用（已不存在的 instanceId）。
 * 如果清理了失效项，将清理后的布局重新保存到 localStorage。
 */
export function sanitizeLayout(
  positions: Record<string, { x: number; y: number }>,
  validInstanceIds: Set<string>,
): Record<string, { x: number; y: number }> {
  const valid: Record<string, { x: number; y: number }> = {}
  const removedInstanceIds: string[] = []

  for (const [id, pos] of Object.entries(positions)) {
    if (validInstanceIds.has(id)) {
      valid[id] = pos
    } else {
      removedInstanceIds.push(id)
      logger.debug('[CockpitShell] Removing invalid layout reference', { instanceId: id })
    }
  }

  if (removedInstanceIds.length > 0) {
    const removedCount = removedInstanceIds.length
    logger.info(`[CockpitShell] Sanitized layout: removed ${removedCount} invalid references`)
    
    saveMigrationLog({
      timestamp: Date.now(),
      fromVersion: LAYOUT_VERSION,
      toVersion: LAYOUT_VERSION,
      removedInstanceIds,
      reason: '清理失效的widget实例引用',
    })

    const data: LayoutStorageData = {
      version: LAYOUT_VERSION,
      positions: valid,
    }
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(data))
    } catch {
      logger.warn('[CockpitShell] Failed to save sanitized layout')
    }
  }

  return valid
}


interface WidgetWrapperProps {
  config: WidgetConfig
  data: MarketData
}

function WidgetWrapper(props: WidgetWrapperProps): React.JSX.Element {
  // P0-2 修复：hooks 必须在所有条件分支之前调用（React Rules of Hooks）
  // 使用可选链安全访问 config，避免 null 解构崩溃
  const config = props?.config ?? null
  const data = props?.data

  const { confirm, dialogProps: wrapperDialogProps } = useConfirmDialog()
  const [Component, setComponent] = useState<React.ComponentType<{ config: unknown; data?: MarketData }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const instanceId = config?.instanceId
  const widgetId = config?.widgetId

  useEffect(() => {
    if (instanceId == null || widgetId == null) {
      setLoading(false)
      return
    }
    let mounted = true
    const mount = async () => {
      try {
        const success = await widgetEngine.mountInstance(instanceId)
        if (!mounted) return
        if (!success) {
          setError('挂载失败')
          return
        }
        const component = await widgetEngine.loadComponent(widgetId)
        if (mounted) {
          setComponent(() => component)
        }
      } catch (err) {
        logger.error('[WidgetWrapper] mount error', { widgetId, error: err })
        if (mounted) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    void mount()

    return () => {
      mounted = false
      if (instanceId != null) {
        widgetEngine.unmountInstance(instanceId)
      }
    }
  }, [instanceId, widgetId])

  // P0-2 深度修复：用 SafeWrapper 包裹动态加载的 Widget 组件
  // 防止 widget 组件内部解构 { config } 时收到 null props 导致崩溃
  // 注意：useMemo 必须在所有条件返回之前调用（rules of hooks）
  const SafeComponent = useMemo(() => {
    if (!Component) return null
    const SafeWrapper = (wrapperProps: { config: unknown; data?: MarketData }): React.JSX.Element => {
      if (!wrapperProps?.config) {
        logger.warn('[CockpitShell] SafeWrapper: widget received null props', { widgetId: config?.widgetId })
        return <></>
      }
      return <Component {...wrapperProps} />
    }
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    SafeWrapper.displayName = `Safe(${Component.displayName || Component.name || 'Widget'})`
    return SafeWrapper
  }, [Component, config?.widgetId])

  // 空值守卫：所有 hooks 之后安全返回
  if (!config) {
    logger.warn('[WidgetWrapper] config is null/undefined, rendering fallback')
    return (
      <Card>
        <CardContent className="flex h-full items-center justify-center">
          <Empty title="组件配置未就绪" description="请稍后重试，或重新添加该组件" />
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <Loading size="lg" label="组件加载中…" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <ErrorState
            title="组件加载失败"
            description={error}
            onRetry={async () => {
              setLoading(true)
              setError(null)
              const refreshed = await widgetEngine.refreshInstance(config.instanceId)
              if (refreshed) {
                const component = await widgetEngine.loadComponent(config.widgetId)
                setComponent(component)
              } else {
                setError('刷新失败')
              }
              setLoading(false)
            }}
          />
        </CardContent>
      </Card>
    )
  }

  if (!SafeComponent) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{config.title}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Empty
              title="组件未找到"
              description={`widgetId: ${widgetId} | loading: ${loading} | error: ${error} | hasComponent: ${!!Component}`}
            />
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const ok = await confirm({
                    title: '重置驾驶舱布局',
                    description: '确定要重置驾驶舱布局为默认吗？此操作将清除所有自定义布局。',
                    variant: 'danger',
                    confirmLabel: '重置',
                  })
                  if (ok) resetLayout()
                }}
              >
                重置布局
              </Button>
            </div>
          </CardContent>
        </Card>
        <ConfirmDialog {...wrapperDialogProps} />
      </>
    )
  }

  // 将统一的 MarketData 注入到每个 Widget 组件
  // 组件既可通过 props.data 获取，也可通过 useMarketData() 消费
  // WidgetErrorBoundary 捕获子组件渲染异常，避免单个 Widget 崩溃影响全局
  return (
    <WidgetErrorBoundary
      widgetId={config.widgetId}
      instanceId={config.instanceId}
      errorTitle={`${config.title} 加载异常`}
    >
      <SafeComponent config={config} data={data} />
    </WidgetErrorBoundary>
  )
}

function CockpitContent(): React.JSX.Element {
  const [instances, setInstances] = useState<WidgetConfig[]>([])
  // 移动端降级：禁用纵横布局，改为简单纵向堆叠
  const isMobile = useMediaQuery('(max-width: 767px)')

  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog()

  const [migrationLog, setMigrationLog] = useState<LayoutMigrationLog | null>(null)
  const { data, getTaskStats } = useMarketData()
  const poolItems = useIntentionPoolStore((s) => s.items)
  const signals = useTradingStore((s) => s.signals)

  useEffect(() => {
    setInstances(widgetRegistry.getAllInstances())
    setMigrationLog(getLastMigrationLog())

    const unsubscribe = widgetRegistry.subscribe(() => {
      setInstances(widgetRegistry.getAllInstances())
    })
    return unsubscribe
  }, [])

  const handleResetLayout = (): void => {
    resetLayout()
  }

  // 补齐尚未添加的优先 Widget（按 cockpit.constants 优先级），为顶部添加面板提供真实接线
  const handleAddWidget = (): void => {
    const priority = [
      'kaiScore', 'poolBoard', 'aiTradeReview', 'hotSector',
      'valuePit', 'signalQuality', 'pnlAnalysis', 'riskMonitor',
    ]
    const existing = new Set(instances.map((i) => i.widgetId))
    const next = priority.find((id) => !existing.has(id))
    if (!next) {
      logger.info('[CockpitShell] handleAddWidget: 无更多可添加的优先 Widget')
      return
    }
    try {
      const created = widgetRegistry.createInstance(next)
      if (created) {
        setInstances([...instances, created])
        logger.info(`[CockpitShell] handleAddWidget: 已添加 ${next}`)
      }
    } catch (err) {
      logger.warn(`[CockpitShell] handleAddWidget 失败: ${next}`, { error: err })
    }
  }

  const stats = getTaskStats()

  /** Widget 渲染回调 — 传给 CockpitCrossLayout */
  const renderWidget = (instance: WidgetConfig): React.ReactNode => (
    <WidgetWrapper config={instance} data={data} />
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold">驾驶舱</h1>
            <div className="hidden items-center gap-1 ml-2 text-xs text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 border-muted-foreground/20">
                <span className="font-medium text-foreground">{poolItems.length}</span> 跟踪标的
              </span>
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 border-muted-foreground/20">
                <span className="font-medium text-foreground">{signals.length}</span> 待处理信号
              </span>
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 border-muted-foreground/20">
                <span className="font-medium text-foreground">{stats.running}/{stats.total}</span> 采集任务
              </span>
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 border-muted-foreground/20">
                <span className="font-medium text-foreground">{instances.length}</span> Widget
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleAddWidget}>
              <Plus className="h-4 w-4 mr-1" />
              添加 Widget
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const ok = await confirm({
                  title: '重置驾驶舱布局',
                  description: '确定要重置驾驶舱布局为默认吗？此操作将清除所有自定义布局。',
                  variant: 'danger',
                  confirmLabel: '重置',
                })
                if (ok) handleResetLayout()
              }}
            >
              <Settings className="h-4 w-4 mr-1" />
              重置布局
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </header>

      {migrationLog && (
        <div className="border-b bg-background/95 px-4 py-2">
          <div className="mx-auto max-w-7xl">
            <Alert variant="info" closable onClose={() => setMigrationLog(null)}>
              <div className="text-sm">
                <strong>布局已自动迁移：</strong>
                {migrationLog.reason}
                {migrationLog.removedInstanceIds.length > 0 && (
                  <span className="ml-2">
                    已清理 {migrationLog.removedInstanceIds.length} 个失效组件
                  </span>
                )}
              </div>
            </Alert>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl p-4">
        {isMobile ? (
          /* 移动端降级：简单纵向堆叠 */
          <div className="flex flex-col gap-4">
            {instances.map((instance) => (
              <div key={instance.instanceId}>
                <WidgetWrapper config={instance} data={data} />
              </div>
            ))}
          </div>
        ) : (
          /* 桌面端：纵横交叉布局 */
          <CockpitCrossLayout
            instances={instances}
            renderWidget={renderWidget}
            showMatrixOverview={true}
          />
        )}
      </main>

      {/* 合规层 — 免责声明 */}
      <footer className="mx-auto max-w-7xl px-4 pb-4">
        <ComplianceDisclaimer variant="compact" />
      </footer>

      {/* 确认对话框（替代原生 confirm） */}
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  )
}

/**
 * CockpitShell
 */
export default function CockpitShell(): React.JSX.Element {
  return (
    <MarketDataProvider>
      <CockpitContent />
    </MarketDataProvider>
  )
}
