/**
 * @module WidgetFramework
 * @lifecycle @Route
 * @description Widget 框架模块，提供组件注册、实例管理、生命周期控制能力
 */

export interface WidgetModuleInput {
  widgetId: string
  config: WidgetConfig
  data?: unknown
}

export interface WidgetModuleOutput {
  instanceId: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  lastRefresh?: number
}

export interface WidgetConfig {
  instanceId: string
  widgetId: string
  size: { cols: number; rows: number }
  position?: { x: number; y: number }
  title: string
  settings: Record<string, unknown>
  visible: boolean
  collapsed: boolean
}

export interface WidgetMeta {
  id: string
  name: string
  category: string
  description: string
  defaultSize: { cols: number; rows: number }
  defaultConfig?: Record<string, unknown>
}

export interface WidgetRuntimeState {
  instanceId: string
  widgetId: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  lastRefresh?: number
}

export interface IOModule {
  input: WidgetModuleInput
  output: WidgetModuleOutput
}