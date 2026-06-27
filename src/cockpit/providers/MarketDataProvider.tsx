import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { getLogger } from '@/lib/logger'
import type { MarketData, CollectionResultCallback, ChatMessage } from '@/types/modules/widget.types'
import { taskScheduler } from '@/services/data-collector/TaskScheduler'
import { marketDataAdapter } from '@/services/data-collector/MarketDataAdapter'
import { widgetRegistry } from '@/cockpit/core/widgetRegistry'
import { MockStockAnalysisProvider } from '@/services/stock-analysis/mockStockAnalysisProvider'
import { streamingChat } from '@/services/llm/llmClient'
import type { LlmStreamCallback } from '@/services/llm/llmTypes'
import {
  ACTIVE_DATA_SOURCE,
  DATA_SOURCE_TYPE,
} from '@/constants/cockpit.constants'

const logger = getLogger()

interface MarketDataContextValue {
  data: MarketData
  loadingMap: Record<string, boolean>
  errorMap: Record<string, string | null>
  refreshWidget: (instanceId: string) => void
  getTaskStats: () => { total: number; running: number; error: number }
  /** 发送个股/市场分析聊天消息（新增）
   * @remarks 用户主动触发的对话行为，不走轮询 TaskScheduler，直接调用对应 Collector
   */
  sendChatMessage: (target: string, question: string) => Promise<ChatMessage>
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null)

interface MarketDataProviderProps {
  children: React.ReactNode
}

export function MarketDataProvider({ children }: MarketDataProviderProps): React.JSX.Element {
  const [data, setData] = useState<MarketData>(() => marketDataAdapter.merge())
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})

  const taskMapRef = useRef<Record<string, string>>({})
  const isMountedRef = useRef(false)
  const subscribeRef = useRef<(() => void) | null>(null)

  const handleCollectionResult: CollectionResultCallback = useCallback((taskId, rawData, error) => {
    if (!isMountedRef.current) return

    if (error) {
      const instanceId = Object.entries(taskMapRef.current).find(([, tid]) => tid === taskId)?.[0]
      if (instanceId) {
        setErrorMap((prev) => ({ ...prev, [instanceId]: error.message }))
        setLoadingMap((prev) => ({ ...prev, [instanceId]: false }))
      }
      return
    }

    if (rawData) {
      const instanceId = Object.entries(taskMapRef.current).find(([, tid]) => tid === taskId)?.[0]
      if (instanceId) {
        setErrorMap((prev) => ({ ...prev, [instanceId]: null }))
        setLoadingMap((prev) => ({ ...prev, [instanceId]: false }))
      }

      const adapted = marketDataAdapter.adapt(rawData)
      setData((prev) => marketDataAdapter.merge(prev, adapted))
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    logger.info('[MarketDataProvider] 初始化数据采集...')

    subscribeRef.current = taskScheduler.subscribe(handleCollectionResult)

    const instances = widgetRegistry.getAllInstances()
    logger.info(`[MarketDataProvider] 发现 ${instances.length} 个 Widget 实例`)

    instances.forEach((instance) => {
      const { instanceId, widgetId, dataSource } = instance

      if (!dataSource || !dataSource.enabled) {
        logger.warn(`[MarketDataProvider] Widget ${instanceId} 未配置数据源，跳过`)
        return
      }

      if (taskMapRef.current[instanceId]) {
        logger.warn(`[MarketDataProvider] Widget ${instanceId} 已有采集任务，跳过重复注册`)
        return
      }

      setLoadingMap((prev) => ({ ...prev, [instanceId]: true }))

      const taskId = taskScheduler.registerTask(widgetId, instanceId, dataSource)
      taskMapRef.current[instanceId] = taskId
      taskScheduler.startTask(taskId)
    })

    return () => {
      logger.info('[MarketDataProvider] 组件卸载，清理数据采集任务...')
      isMountedRef.current = false

      if (subscribeRef.current) {
        subscribeRef.current()
        subscribeRef.current = null
      }

      Object.values(taskMapRef.current).forEach((taskId) => {
        taskScheduler.unregisterTask(taskId)
      })
      taskMapRef.current = {}
    }
  }, [handleCollectionResult])

  const refreshWidget = useCallback((instanceId: string) => {
    const taskId = taskMapRef.current[instanceId]
    if (!taskId) {
      logger.warn(`[MarketDataProvider] 未找到实例 ${instanceId} 对应的任务`)
      return
    }

    setLoadingMap((prev) => ({ ...prev, [instanceId]: true }))
    setErrorMap((prev) => ({ ...prev, [instanceId]: null }))

    taskScheduler.stopTask(taskId)
    taskScheduler.startTask(taskId)

    logger.info(`[MarketDataProvider] 手动刷新: ${instanceId}`)
  }, [])

  const getTaskStats = useCallback(() => {
    const tasks = taskScheduler.getAllTasks()
    return {
      total: tasks.length,
      running: tasks.filter((t) => t.status === 'running').length,
      error: tasks.filter((t) => t.status === 'error').length,
    }
  }, [])

  /**
   * 发送聊天消息
   * @description Mock 模式直接调用 MockStockAnalysisProvider；REST 模式使用 SSE 流式 LLM 推理接口
   * @remarks 这是用户主动触发的行为，不经过 TaskScheduler 轮询，返回的 ChatMessage 由 Widget 自行追加到本地会话
   */
  const sendChatMessage = useCallback(async (target: string, question: string): Promise<ChatMessage> => {
    logger.info(`[MarketDataProvider] 发送聊天消息: target=${target}`)

    if (ACTIVE_DATA_SOURCE === DATA_SOURCE_TYPE.MOCK) {
      return MockStockAnalysisProvider.sendChatMessage(target, question)
    }

    const messages = [
      { role: 'system' as const, content: `你是一位专业的股票分析助手，正在分析标的：${target}。请提供详细、专业的分析。` },
      { role: 'user' as const, content: question },
    ]

    let fullContent = ''
    const startTime = Date.now()

    const chunkCallback: LlmStreamCallback = (chunk) => {
      if (!chunk.isDone) {
        fullContent += chunk.content
        logger.debug('[MarketDataProvider] LLM stream chunk received', { length: chunk.content.length, total: fullContent.length })
      }
    }

    try {
      await streamingChat(messages, chunkCallback)
      logger.info('[MarketDataProvider] LLM streaming chat completed', { contentLength: fullContent.length, duration: Date.now() - startTime })
    } catch (err) {
      logger.error('[MarketDataProvider] LLM streaming chat failed', { error: err instanceof Error ? err.message : String(err) })
      throw err
    }

    return {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: fullContent,
      timestamp: Date.now(),
    }
  }, [])

  const value: MarketDataContextValue = {
    data,
    loadingMap,
    errorMap,
    refreshWidget,
    getTaskStats,
    sendChatMessage,
  }

  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMarketData(): MarketDataContextValue {
  const context = useContext(MarketDataContext)
  if (!context) {
    throw new Error('useMarketData 必须在 MarketDataProvider 内部使用')
  }
  return context
}
