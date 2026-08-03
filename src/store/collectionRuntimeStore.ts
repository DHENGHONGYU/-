/**
 * @module collectionRuntimeStore
 * @description 采集运行时状态管理。
 *
 * 订阅 `COLLECTION_EVENTS` 生命周期事件，维护链路追踪、实时日志、
 * 任务进度和质量指标快照，供可视化组件消费。
 *
 * @dataflow
 * - 执行者：collectionPipeline / fetcherService → eventBus.emit(COLLECTION_EVENTS.*)
 * - 本 Store：订阅事件 → 更新 traceSpans / logs / taskStatuses / stats
 * - 展示者：CollectTask/index.tsx / DataTestPanel.tsx / FetcherConfigPage.tsx / HomePage.tsx
 *
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/

import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import type {
  CollectionLifecycleEvent,
  CollectionTraceSpan,
  CollectionTaskRuntime,
  CollectionLog,
} from '@/types/modules/collection.types'
import { getQualitySnapshot, type QualityMetrics } from '@/services/data-collector/qualityMetricsCollector'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { queryTraceRecords } from '@/services/data-collector/tracePersistenceService'

const logger = getLogger()

// ============================================================
// 状态定义
// ============================================================

interface CollectionRuntimeState {
  /** 链路追踪映射（traceId → span） */
  traceSpans: Record<string, CollectionTraceSpan>
  /** 按时间排序的实时日志 */
  logs: CollectionLog[]
  /** 任务状态映射（taskId → runtime） */
  taskStatuses: Record<string, CollectionTaskRuntime>
  /** 全局进度（0-100） */
  overallProgress: number
  /** 质量指标快照 */
  stats: QualityMetrics
  /** 是否正在运行批量任务 */
  isRunning: boolean

  // Actions
  appendLog: (log: CollectionLog) => void
  addOrUpdateSpan: (span: CollectionTraceSpan) => void
  updateTaskStatus: (taskId: string, update: Partial<CollectionTaskRuntime> & { taskId: string }) => void
  setOverallProgress: (progress: number) => void
  refreshStats: () => void
  setRunning: (running: boolean) => void
  clearLogs: () => void
  clearTraces: () => void
  loadPersistedTraces: () => Promise<void>
  reset: () => void
}

// ============================================================
// 辅助函数
// ============================================================

const MAX_LOGS = 200

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

function mapEventLevel(type: CollectionLifecycleEvent['type']): CollectionLog['level'] {
  switch (type) {
    case COLLECTION_EVENTS.SOURCE_FAIL:
    case COLLECTION_EVENTS.WRITE_FAIL:
      return 'error'
    case COLLECTION_EVENTS.FALLBACK:
      return 'warn'
    case COLLECTION_EVENTS.SOURCE_SUCCESS:
    case COLLECTION_EVENTS.WRITE_SUCCESS:
    case COLLECTION_EVENTS.COMPLETE:
      return 'success'
    default:
      return 'info'
  }
}

function createInitialStats(): QualityMetrics {
  return {
    since: Date.now(),
    totalCollects: 0,
    successCollects: 0,
    successRate: 0,
    mockCollects: 0,
    mockSuccesses: 0,
    realSuccessRate: 0,
    completeness: 0,
    sourceCounts: { tushare: 0, tencent: 0, sina: 0, netease: 0, akshare: 0, mock: 0 },
    fallbackCount: 0,
    writeSuccess: 0,
    writeTotal: 0,
    writeRate: 0,
    mockWrites: 0,
    avgLatency: 0,
    totalLatency: 0,
  }
}

// ============================================================
// Store
// ============================================================

const initialState = {
  traceSpans: {} as Record<string, CollectionTraceSpan>,
  logs: [] as CollectionLog[],
  taskStatuses: {} as Record<string, CollectionTaskRuntime>,
  overallProgress: 0,
  stats: createInitialStats(),
  isRunning: false,
}

/**
 * useCollectionRuntimeStore
 */
export const useCollectionRuntimeStore = create<CollectionRuntimeState>((set) => ({
  ...initialState,

  appendLog: (log) => {
    set((state) => {
      const logs = [log, ...state.logs].slice(0, MAX_LOGS)
      return { logs }
    })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'appendLog' })
  },

  addOrUpdateSpan: (span) => {
    set((state) => ({
      traceSpans: { ...state.traceSpans, [span.traceId]: span },
    }))
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'updateSpan', traceId: span.traceId })
  },

  updateTaskStatus: (taskId, update) => {
    set((state) => {
      const existing = state.taskStatuses[taskId]
      const next: CollectionTaskRuntime = {
        dimensionCode: existing?.dimensionCode ?? update.dimensionCode ?? '',
        symbol: existing?.symbol ?? update.symbol ?? '',
        status: existing?.status ?? 'pending',
        progress: existing?.progress ?? 0,
        ...existing,
        ...update,
        taskId,
      }
      return { taskStatuses: { ...state.taskStatuses, [taskId]: next } }
    })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'updateTaskStatus', taskId })
  },

  setOverallProgress: (overallProgress) => {
    set({ overallProgress })
  },

  refreshStats: () => {
    set({ stats: getQualitySnapshot() })
  },

  setRunning: (isRunning) => {
    set({ isRunning })
  },

  clearLogs: () => {
    set({ logs: [] })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'clearLogs' })
  },

  clearTraces: () => {
    set({ traceSpans: {} })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'clearTraces' })
  },

  loadPersistedTraces: async () => {
    try {
      const spans = await queryTraceRecords({ limit: 500 })
      set((state) => {
        const merged = { ...state.traceSpans }
        const rehydratedTasks: Record<string, CollectionTaskRuntime> = { ...state.taskStatuses }

        for (const span of spans) {
          // 合并 span，不覆盖内存中已有更新版本
          if (!merged[span.traceId]) {
            merged[span.traceId] = span
          }

          // 从 span 重建 taskStatuses（只填充内存中尚不存在的任务）
          if (span.taskId && !rehydratedTasks[span.taskId]) {
            const status: CollectionTaskRuntime['status'] =
              span.result === 'success'
                ? 'completed'
                : span.result === 'partial'
                  ? 'completed'
                  : 'error'

            rehydratedTasks[span.taskId] = {
              taskId: span.taskId,
              dimensionCode: span.dimensionCode,
              symbol: span.symbol,
              status,
              progress: span.result === 'success' || span.result === 'partial' ? 100 : 0,
              startedAt: span.startedAt,
              completedAt: span.completedAt,
              error: span.error,
            }
          }
        }

        return { traceSpans: merged, taskStatuses: rehydratedTasks }
      })
      logger.info('[collectionRuntimeStore] 已加载持久化 traces + 重建任务状态', { count: spans.length })
    } catch (err) {
      logger.error('[collectionRuntimeStore] 加载持久化 traces 失败', { error: err })
    }
  },

  reset: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'reset' })
  },
}))

// ============================================================
// 事件订阅
// ============================================================

function handleLifecycleEvent(event: CollectionLifecycleEvent): void {
  const store = useCollectionRuntimeStore.getState()

  // 刷新质量指标快照
  store.refreshStats()

  // 记录日志
  store.appendLog({
    id: `${event.traceId}-${event.timestamp}`,
    timestamp: event.timestamp,
    time: formatTime(event.timestamp),
    level: mapEventLevel(event.type),
    dimensionCode: event.dimensionCode,
    symbol: event.symbol,
    sourceId: event.sourceId,
    message: event.message,
    traceId: event.traceId,
  })

  // 更新任务状态
  if (event.taskId) {
    const payload = event.payload
    const progress = typeof payload?.progress === 'number' ? payload.progress : undefined
    const statusFromPayload = typeof payload?.status === 'string' ? payload.status : undefined
    const status: CollectionTaskRuntime['status'] =
      statusFromPayload === 'running'
        ? 'running'
        : statusFromPayload === 'completed'
          ? 'completed'
          : statusFromPayload === 'error'
            ? 'error'
            : statusFromPayload === 'paused'
              ? 'paused'
              : 'pending'

    store.updateTaskStatus(event.taskId, {
      taskId: event.taskId,
      dimensionCode: event.dimensionCode,
      symbol: event.symbol,
      status,
      progress,
    })
  }

  // 更新 trace span（当事件携带完整 span 时）
  if (event.type === COLLECTION_EVENTS.COMPLETE && event.payload && typeof event.payload === 'object') {
    const span = event.payload.span as CollectionTraceSpan | undefined
    if (span) {
      store.addOrUpdateSpan(span)
    }
  }

  // 更新全局进度
  if (event.type === COLLECTION_EVENTS.TASK_STATUS) {
    const payload = event.payload
    if (typeof payload?.progress === 'number') {
      store.setOverallProgress(payload.progress)
    }
  }
}

function handleTraceSpan(span: CollectionTraceSpan): void {
  const store = useCollectionRuntimeStore.getState()
  store.addOrUpdateSpan(span)
}

// 全局订阅（store 生命周期与页面共存，跨 Tab 通过 withBroadcast 同步）
Object.values(COLLECTION_EVENTS).forEach((eventName) => {
  eventBus.on(eventName, (event) => {
    try {
      handleLifecycleEvent(event as CollectionLifecycleEvent)
    } catch (err) {
      logger.error('[collectionRuntimeStore] 生命周期事件处理失败', { error: err, event })
    }
  })
})

eventBus.on('collect:trace', (span) => {
  try {
    handleTraceSpan(span as CollectionTraceSpan)
  } catch (err) {
    logger.error('[collectionRuntimeStore] trace 处理失败', { error: err, span })
  }
})

// 启动时加载历史 trace（浏览器环境）
if (typeof window !== 'undefined') {
  void useCollectionRuntimeStore.getState().loadPersistedTraces()
}

logger.info('[collectionRuntimeStore] 已订阅采集生命周期事件')
