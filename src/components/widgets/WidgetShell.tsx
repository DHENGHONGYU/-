
import React, { useCallback } from 'react'
import type { ReactNode } from 'react'
import { WidgetContext } from '../../core/WidgetContext'
import { widgetEventBus } from '../../core/widgetEventBus'
import type { WidgetConfig } from '../../types/widget'
import { THEME_TOKENS } from '@/constants/theme.tokens'
import { Loading, Empty, ErrorState } from '@/components/molecules/states'

/**
 * Widget 视觉状态：控制 Loading/Empty/Error 占位，默认 ready 渲染 children。
 * 由宿主 widget 根据数据加载情况传入，实现全站统一的交互状态呈现（P3）。
 */
export type WidgetVisualState = 'ready' | 'loading' | 'empty' | 'error'

/** 状态占位文案配置 */
export interface WidgetStateConfig {
  loadingLabel?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  errorTitle?: string
  errorDescription?: string
  onRetry?: () => void
  skeletonVariant?: 'text' | 'rect' | 'circle'
}

// 每个 Widget 的外层包装器
// 提供：ErrorBoundary、数据订阅管理、生命周期控制

interface WidgetShellProps {
  widgetId: string
  config: WidgetConfig
  children: React.ReactNode
  onError?: (error: Error) => void
  /** 视觉状态，默认 ready */
  state?: WidgetVisualState
  /** 状态占位配置 */
  stateConfig?: WidgetStateConfig
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  State
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error) => void }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[WidgetShell] ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="组件渲染出错"
          description={this.state.error?.message}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }

    return this.props.children
  }
}

/**
 * WidgetShell
 */
export function WidgetShell({
  widgetId,
  config,
  children,
  onError,
  state = 'ready',
  stateConfig,
}: WidgetShellProps): React.ReactElement {
  const visualState: WidgetVisualState = state

  const renderContent = (): React.ReactNode => {
    if (visualState === 'loading') {
      return <Loading label={stateConfig?.loadingLabel ?? '加载中…'} />
    }
    if (visualState === 'empty') {
      return (
        <Empty
          title={stateConfig?.emptyTitle}
          description={stateConfig?.emptyDescription}
          action={stateConfig?.emptyAction}
        />
      )
    }
    if (visualState === 'error') {
      return (
        <ErrorState
          title={stateConfig?.errorTitle}
          description={stateConfig?.errorDescription}
          onRetry={stateConfig?.onRetry}
        />
      )
    }
    return children
  }
  const subscribe = useCallback(
    (channel: string, callback: (data: unknown) => void) => {
      // 事件名格式：`widget:{widgetId}:{event}` 或数据通道
      const eventName = channel.startsWith('widget:') ? channel : `widget:${widgetId}:${channel}`
      return widgetEventBus.subscribe(eventName, callback)
    },
    [widgetId]
  )

  const publish = useCallback(
    (event: string, data: unknown) => {
      const eventName = event.startsWith('widget:') ? event : `widget:${widgetId}:${event}`
      widgetEventBus.publish(eventName, data)
    },
    [widgetId]
  )

  const contextValue = {
    widgetId,
    config,
    subscribe,
    publish,
  }

  return (
    <WidgetContext.Provider value={contextValue}>
      <ErrorBoundary onError={onError}>
        <div
          data-widget-id={widgetId}
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            border: `1px solid ${THEME_TOKENS.color.borderRaw}`,
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Widget 标题栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: THEME_TOKENS.color.mutedBackground.replace('bg-', '#').replace('gray-100', 'f3f4f6'),
              borderBottom: `1px solid ${THEME_TOKENS.color.borderRaw}`,
            }}
          >
            <span style={{ fontWeight: 500, fontSize: '14px' }}>
              {(config.settings?.title as string | undefined) || widgetId}
            </span>
            <button
              onClick={() => {
                // 预留：打开设置面板
                console.log('[WidgetShell] Settings clicked for', widgetId)
              }}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: `1px solid ${THEME_TOKENS.color.borderRaw}`,
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              设置
            </button>
          </div>

          {/* Widget 内容区 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>{renderContent()}</div>
        </div>
      </ErrorBoundary>
    </WidgetContext.Provider>
  )
}
