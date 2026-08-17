/**
 * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
 */
// 跨 Widget 通信事件总线
// V6 规范：事件名格式 `widget:{widgetId}:{event}`
// 支持数据同步与状态同步

import { getLogger } from '@/lib/logger'

type WidgetEventCallback = (data: unknown) => void

class WidgetEventBusImpl {
  private listeners = new Map<string, Set<WidgetEventCallback>>()

  // 订阅事件
  subscribe(event: string, callback: WidgetEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // 返回取消订阅函数
    return () => {
      this.unsubscribe(event, callback)
    }
  }

  // 发布事件
  publish(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          getLogger().error(`[WidgetEventBus] Error in callback for event "${event}":`, { error })
        }
      })
    }
  }

  // 取消订阅
  unsubscribe(event: string, callback: WidgetEventCallback): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  // 清空所有事件
  clear(): void {
    this.listeners.clear()
  }
}

/**
 * widgetEventBus
 */
export const widgetEventBus = new WidgetEventBusImpl()
