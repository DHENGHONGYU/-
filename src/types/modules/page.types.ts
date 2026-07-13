/**
 * @module PageLifecycle
 * @lifecycle @Route
 * @description 页面生命周期模块，提供数据加载、状态管理、交互守卫能力
 */

export interface PageModuleInput {
  routeParams: Record<string, string>
  dataSources: Array<{
    key: string
    fetcher: () => Promise<unknown>
  }>
}

export interface PageModuleOutput {
  data: Map<string, unknown>
  loading: boolean
  error: string | null
  isVisible: boolean
  isClickable: boolean
}

export interface PageGuard {
  isVisible: boolean
  isClickable: boolean
  tooltipText: string
}

export interface IOModule {
  input: PageModuleInput
  output: PageModuleOutput
}