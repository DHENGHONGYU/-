// Widget 定义接口（V6 规范）
export type WidgetCategory = 'market' | 'portfolio' | 'strategy' | 'agent'

export interface WidgetDefinition {
  id: string
  name: string
  category: WidgetCategory
  icon: string
  defaultSize: { cols: number; rows: number }
  defaultPosition: { x: number; y: number }
  dataChannels: string[]   // 订阅的数据通道
  dependencies: string[]   // 依赖的 Widget
}

// Widget 配置接口
export interface WidgetConfig {
  id: string
  widgetId: string
  position: { x: number; y: number }
  size: { cols: number; rows: number }
  settings?: Record<string, unknown>
}

// Widget 事件
export interface WidgetEvent {
  widgetId: string
  event: string
  data?: unknown
}
