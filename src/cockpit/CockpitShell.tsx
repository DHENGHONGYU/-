import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Settings, Plus, Target, ChevronRight } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { WidgetErrorBoundary } from '@/components/organisms/shared/WidgetErrorBoundary'
import ReactGridLayout, { type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { widgetEngine } from '@/cockpit/core/widgetEngine'
import { MarketDataProvider, useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP } from '@/constants/cockpit.constants'
import { getLogger } from '@/lib/logger'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { useTradingStore } from '@/store/tradingStore'
import { Loading, Empty, ErrorState } from '@/components/molecules/states'
import { Alert } from '@/components/molecules/Alert'
import { ComplianceDisclaimer } from '@/components/atoms/ComplianceDisclaimer'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'

const logger = getLogger()
const LAYOUT_STORAGE_KEY = 'v9_cockpit_layout'
const LAYOUT_VERSION = 2

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

/** 从 localStorage 恢复布局，带版本校验 */
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

/** 持久化布局到 localStorage，带版本号 */
function saveLayout(layout: { i: string; x: number; y: number; w: number; h: number }[]): void {
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
function sanitizeLayout(
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

  const [Component, setComponent] = useState<React.ComponentType<{ config: unknown; data?: MarketData }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const instanceId = config?.instanceId
  const widgetId = config?.widgetId

  // eslint-disable-next-line no-console
  console.log('[WidgetWrapper] render', { widgetId, loading, error, hasComponent: !!Component })

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[WidgetWrapper] useEffect mount', { widgetId, instanceId })
    if (instanceId == null || widgetId == null) {
      setLoading(false)
      return
    }
    let mounted = true
    const mount = async () => {
      // eslint-disable-next-line no-console
      console.log('[WidgetWrapper] mount start', { widgetId })
      try {
        const success = await widgetEngine.mountInstance(instanceId)
        // eslint-disable-next-line no-console
        console.log('[WidgetWrapper] mountInstance done', { widgetId, success })
        if (!mounted) return
        if (!success) {
          setError('挂载失败')
          return
        }
        const component = await widgetEngine.loadComponent(widgetId)
        // eslint-disable-next-line no-console
        console.log('[WidgetWrapper] loadComponent done', { widgetId, hasComponent: !!component })
        if (mounted) {
          setComponent(() => component)
        }
      } catch (err) {
         
        console.error('[WidgetWrapper] mount error', { widgetId, error: err })
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
      // eslint-disable-next-line no-console
      console.log('[WidgetWrapper] cleanup', { widgetId })
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
              onClick={() => {
                if (confirm('确定要重置驾驶舱布局为默认吗？')) {
                  resetLayout()
                }
              }}
            >
              重置布局
            </Button>
          </div>
        </CardContent>
      </Card>
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
  const [activeTab, setActiveTab] = useState<string>('all')
  const [showSystemZone, setShowSystemZone] = useState<boolean>(() => {
    const saved = localStorage.getItem('v9_cockpit_show_system')
    return saved === null ? false : saved === 'true'
  })
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

  const handleLayoutChange = (newLayout: Layout): void => {
    saveLayout([...newLayout])
    logger.info('[CockpitShell] Layout saved', { items: newLayout.length })
  }

  const categories = useMemo(() => {
    const cats = new Map<string, number>()
    cats.set('all', instances.length)
    instances.forEach((inst) => {
      const cat = inst.category || 'other'
      cats.set(cat, (cats.get(cat) || 0) + 1)
    })
    return Array.from(cats.entries()).map(([id, count]) => ({
      id,
      label: id === 'all' ? '全部' : 
             id === 'market' ? '市场行情' :
             id === 'portfolio' ? '投资组合' :
             id === 'ai' ? 'AI分析' :
             id === 'analysis' ? '深度分析' :
             id === 'strategy' ? '策略执行' :
             id === 'system' ? '系统监控' : id,
      count,
    }))
  }, [instances])

  const filteredInstances = useMemo(() => {
    if (activeTab === 'all') return showSystemZone ? instances : instances.filter((inst) => inst.category !== 'system')
    return instances.filter((inst) => inst.category === activeTab)
  }, [instances, activeTab, showSystemZone])

  const layout: Layout = (() => {
    const persisted = loadLayout()
    const validInstanceIds = new Set(filteredInstances.map((i) => i.instanceId))

    const sanitized = persisted ? sanitizeLayout(persisted, validInstanceIds) : null

    return filteredInstances.map((instance) => {
      const saved = sanitized?.[instance.instanceId]
      return {
        i: instance.instanceId,
        x: saved?.x ?? instance.position?.x ?? 0,
        y: saved?.y ?? instance.position?.y ?? 0,
        w: instance.size.cols,
        h: instance.size.rows,
        minW: 1,
        minH: 1,
      }
    })
  })()

  const stats = getTaskStats()

  return (
    <div className="dark min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold">驾驶舱</h1>
            <div className="flex items-center gap-1 ml-2 text-xs text-muted-foreground">
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
                <span className="font-medium text-foreground">{filteredInstances.length}</span> Widget
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              添加 Widget
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('确定要重置驾驶舱布局为默认吗？')) {
                  resetLayout()
                }
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

      <div className="sticky top-[65px] z-10 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={activeTab === cat.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.label}
              <Badge variant="outline" className="ml-1">
                {cat.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

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

      {activeTab === 'all' && (
        <div className="border-b bg-background/95 px-4 py-1">
          <div className="mx-auto flex max-w-7xl items-center">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                const next = !showSystemZone
                setShowSystemZone(next)
                localStorage.setItem('v9_cockpit_show_system', String(next))
              }}
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${showSystemZone ? 'rotate-90' : ''}`} />
              系统运维 {showSystemZone ? '(收起)' : `(${instances.filter(i => i.category === 'system').length} 个)`}
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl p-4">
        <ReactGridLayout
          className="bg-background"
          layout={layout}
          width={1100}
          gridConfig={{
            cols: GRID_COLUMNS,
            rowHeight: GRID_ROW_HEIGHT,
            margin: [GRID_GAP, GRID_GAP],
            containerPadding: [GRID_GAP, GRID_GAP],
          }}
          dragConfig={{ enabled: true }}
          resizeConfig={{ enabled: true }}
          onLayoutChange={handleLayoutChange}
        >
          {filteredInstances.map((instance) => (
            <div key={instance.instanceId}>
              <WidgetWrapper config={instance} data={data} />
            </div>
          ))}
        </ReactGridLayout>
      </main>

      {/* 合规层 — 免责声明 */}
      <footer className="mx-auto max-w-7xl px-4 pb-4">
        <ComplianceDisclaimer variant="compact" />
      </footer>
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
