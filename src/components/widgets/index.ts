// Widget 架构导出
// V6 规范要求的驾驶舱 Widget 体系

export { WidgetShell } from './WidgetShell'

// Widget 相关类型从 core 和 types 导出
export { WidgetContext, useWidgetContext, useWidgetData } from '../../core/WidgetContext'
export { widgetEventBus } from '../../core/widgetEventBus'
export type {
  WidgetCategory,
  WidgetDefinition,
  WidgetConfig,
  WidgetEvent,
} from '../../types/widget'
