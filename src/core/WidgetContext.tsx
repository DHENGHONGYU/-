import { createContext, useContext, useState, useEffect } from 'react'
import type { WidgetConfig } from '../types/widget'

// 为 Widget 提供统一的上下文环境
// - Widget ID 和配置
// - EventBus 访问
// - 数据订阅/取消订阅
// - 生命周期管理

interface WidgetContextValue {
  widgetId: string
  config: WidgetConfig | null
  subscribe: (channel: string, callback: (data: unknown) => void) => () => void
  publish: (event: string, data: unknown) => void
}

export const WidgetContext = createContext<WidgetContextValue | null>(null)

export function useWidgetContext(): WidgetContextValue {
  const context = useContext(WidgetContext)
  if (!context) {
    throw new Error('useWidgetContext must be used within a WidgetProvider')
  }
  return context
}

export function useWidgetData<T>(channel: string): { data: T | null; loading: boolean } {
  const { subscribe } = useWidgetContext()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribe(channel, (newData) => {
      setData(newData as T)
      setLoading(false)
    })

    return unsubscribe
  }, [channel, subscribe])

  return { data, loading }
}
