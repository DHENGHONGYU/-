import type { WidgetConfig, WidgetRuntimeState, WidgetMeta } from '@/types/modules/widget.types'

export class DefaultWidgetBuilder {
  buildDefaultMeta(widgetId: string): WidgetMeta {
    return {
      id: widgetId,
      name: `Widget ${widgetId}`,
      category: 'default',
      description: '默认 Widget 元数据',
      defaultSize: { cols: 2, rows: 2 },
    }
  }

  buildDefaultConfig(widgetId: string): WidgetConfig {
    return {
      instanceId: `${widgetId}_${Date.now()}`,
      widgetId,
      size: { cols: 2, rows: 2 },
      title: `Widget ${widgetId}`,
      settings: {},
      visible: true,
      collapsed: false,
    }
  }

  buildDefaultRuntimeState(instanceId: string, widgetId: string): WidgetRuntimeState {
    return {
      instanceId,
      widgetId,
      status: 'idle',
    }
  }

  buildFallbackRuntimeState(instanceId: string, widgetId: string, error: string): WidgetRuntimeState {
    return {
      instanceId,
      widgetId,
      status: 'error',
      error,
    }
  }
}

export const defaultWidgetBuilder = new DefaultWidgetBuilder()