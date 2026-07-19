/**
 * @doc []
 */
import type { WidgetConfig, WidgetRuntimeState, WidgetMeta } from '@/types/modules/widget.types'

import { nanoid } from 'nanoid'
/**
 * DefaultWidgetBuilder
 */
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
      instanceId: `${widgetId}_${nanoid(8)}`,
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

/**
 * defaultWidgetBuilder
 */
export const defaultWidgetBuilder = new DefaultWidgetBuilder()