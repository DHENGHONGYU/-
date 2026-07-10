import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Settings, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { WidgetErrorBoundary } from '@/components/WidgetErrorBoundary'
import { GridLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { widgetEngine } from '@/cockpit/core/widgetEngine'
import { MarketDataProvider, useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP } from '@/constants/cockpit.constants'
import { getLogger } from '@/lib/logger'
import { Loading, Empty, ErrorState } from '@/components/ui/states'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'

const logger = getLogger()
const LAYOUT_STORAGE_KEY = 'v9_cockpit_layout'

/** 从 localStorage 恢复布局 */
function loadLayout(): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : null
  } catch {
    return null
  }
}

/** 持久化布局到 localStorage */
function saveLayout(layout: { i: string; x: number; y: number; w: number; h: number }[]): void {
  try {
    const positions: Record<string, { x: number; y: number }> = {}
    layout.forEach((item) => {
      positions[item.i] = { x: item.x, y: item.y }
    })
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(positions))
  } catch {
    logger.warn('[CockpitShell] Failed to save layout')
  }
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

  useEffect(() => {
    if (!config) {
      setLoading(false)
      return
    }
    const mount = async () => {
      try {
        // 使用 widgetEngine 完整生命周期管理
        const success = await widgetEngine.mountInstance(config.instanceId)
        if (success) {
          const component = await widgetEngine.loadComponent(config.widgetId)
          setComponent(component)
          logger.info('[CockpitShell] Widget mounted successfully', { instanceId: config.instanceId, widgetId: config.widgetId })
        } else {
          setError('挂载失败')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
        logger.error('[CockpitShell] Widget mount error', { instanceId: config.instanceId, error: err })
      } finally {
        setLoading(false)
      }
    }
    mount()

    // 清理：卸载实例
    return () => {
      widgetEngine.unmountInstance(config.instanceId)
      logger.info('[CockpitShell] Widget unmounted', { instanceId: config.instanceId })
    }
  }, [config?.instanceId, config?.widgetId])

  // P0-2 深度修复：用 SafeWrapper 包裹动态加载的 Widget 组件
  // 防止 widget 组件内部解构 { config } 时收到 null props 导致崩溃
  // 注意：useMemo 必须在所有条件返回之前调用（rules of hooks）
  const SafeComponent = useMemo(() => {
    if (!Component) return () => <></>
    const SafeWrapper = (wrapperProps: { config: unknown; data?: MarketData }): React.JSX.Element => {
      if (!wrapperProps?.config) {
        logger.warn('[CockpitShell] SafeWrapper: widget received null props', { widgetId: config?.widgetId })
        return <></>
      }
      return <Component {...wrapperProps} />
    }
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
              const success = await widgetEngine.refreshInstance(config.instanceId)
              if (success) {
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
        <CardContent className="p-8">
          <Empty title="组件未找到" description="该组件可能尚未注册或已被移除" />
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
  const [engineStats, setEngineStats] = useState({ cachedComponents: 0 })
  const { data, getTaskStats } = useMarketData()

  useEffect(() => {
    setInstances(widgetRegistry.getAllInstances())
    setEngineStats(widgetEngine.getStats())
    const unsubscribe = widgetRegistry.subscribe(() => {
      setInstances(widgetRegistry.getAllInstances())
      setEngineStats(widgetEngine.getStats())
    })
    return unsubscribe
  }, [])

  const handleLayoutChange = (newLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
    saveLayout([...newLayout])
    logger.info('[CockpitShell] Layout saved', { items: newLayout.length })
  }

  const layout = (() => {
    const persisted = loadLayout()
    return instances.map((instance) => {
      const saved = persisted?.[instance.instanceId]
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
            <Badge variant="outline" className="ml-2">
              {instances.length} 个 Widget
            </Badge>
            <Badge variant="secondary" className="text-xs">
              缓存: {engineStats.cachedComponents}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              采集任务: {stats.running}/{stats.total}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              添加 Widget
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/">返回首页</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        <GridLayout
          className="bg-background"
          layout={layout}
          width={1100}
          gridConfig={{
            cols: GRID_COLUMNS,
            rowHeight: GRID_ROW_HEIGHT,
            margin: [GRID_GAP, GRID_GAP],
            containerPadding: [GRID_GAP, GRID_GAP],
          }}
          dragConfig={{
            enabled: true,
          }}
          resizeConfig={{
            enabled: true,
          }}
          onLayoutChange={handleLayoutChange}
        >
          {instances.map((instance) => (
            <div key={instance.instanceId}>
              <WidgetWrapper config={instance} data={data} />
            </div>
          ))}
        </GridLayout>
      </main>
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
