import React, { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Settings, RefreshCw, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { GridLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { widgetEngine } from '@/cockpit/core/widgetEngine'
import { MarketDataProvider, useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP } from '@/constants/cockpit.constants'
import { getLogger } from '@/lib/logger'
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

function WidgetWrapper({ config, data }: WidgetWrapperProps): React.JSX.Element {
  const [Component, setComponent] = useState<React.ComponentType<{ config: unknown; data?: MarketData }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const component = await widgetEngine.loadComponent(config.widgetId)
        setComponent(component)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [config.widgetId])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
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
          <div className="text-center text-red-500">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => setLoading(true)} className="mt-2">
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!Component) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center text-gray-400">
          组件未找到
        </CardContent>
      </Card>
    )
  }

  // 将统一的 MarketData 注入到每个 Widget 组件
  // 组件既可通过 props.data 获取，也可通过 useMarketData() 消费
  return <Component config={config} data={data} />
}

function CockpitContent(): React.JSX.Element {
  const [instances, setInstances] = useState<WidgetConfig[]>([])
  const { data, getTaskStats } = useMarketData()

  useEffect(() => {
    setInstances(widgetRegistry.getAllInstances())
    const unsubscribe = widgetRegistry.subscribe(() => {
      setInstances(widgetRegistry.getAllInstances())
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
    <div className="min-h-screen bg-background">
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

export default function CockpitShell(): React.JSX.Element {
  return (
    <MarketDataProvider>
      <CockpitContent />
    </MarketDataProvider>
  )
}
