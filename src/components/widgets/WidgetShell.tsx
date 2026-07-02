import React, { useCallback } from 'react'
import { WidgetContext } from '../../core/WidgetContext'
import { widgetEventBus } from '../../core/widgetEventBus'
import type { WidgetConfig } from '../../types/widget'

// 每个 Widget 的外层包装器
// 提供：ErrorBoundary、数据订阅管理、生命周期控制

interface WidgetShellProps {
  widgetId: string
  config: WidgetConfig
  children: React.ReactNode
  onError?: (error: Error) => void
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
        <div style={{ padding: '16px', color: 'red' }}>
          <h3>Widget 渲染错误</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export function WidgetShell({ widgetId, config, children, onError }: WidgetShellProps): React.ReactElement {
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
            border: '1px solid #e5e7eb',
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
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
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
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              设置
            </button>
          </div>

          {/* Widget 内容区 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>{children}</div>
        </div>
      </ErrorBoundary>
    </WidgetContext.Provider>
  )
}
