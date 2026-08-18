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
  /** 链路追踪映射（traceId → span），供 DataTestPanel 瀑布图消费；与 tracePersistenceService 持久化记录同源 */
  traceSpans: Record<string, CollectionTraceSpan>
  /** 按时间排序的实时日志（最大 200 条，超过自动截断最早记录） */
  logs: CollectionLog[]
  /** 任务状态映射（taskId → runtime），用于 CollectionTask 卡片实时渲染 */
  taskStatuses: Record<string, CollectionTaskRuntime>
  /**
   * KPI-01: 批量采集总体进度
   *  - 单位：百分比 [0, 100]
   *  - 口径：(∑ 已完成子任务进度权重) / (∑ 全部子任务权重) × 100
   *  - 刷新：事件 COLLECTION_EVENTS.BATCH_PROGRESS → setOverallProgress()
   *  - 展示：HomePage 环形进度 + CollectionReportPanel 总进度条
   */
  overallProgress: number
  /**
   * KPI-02: 采集链路质量指标快照（六维数据质量核心指标）
   *  - 子 KPI 详细口径：
   *
   *  ┌──────────────────┬──────────────────────────────────────────────────────────────┬───────────────┬────────────────────┐
   *  │ 子 KPI 字段      │ 计算口径                                                   │ 取值范围      │ 刷新时机          │
   *  ├──────────────────┼──────────────────────────────────────────────────────────────┼───────────────┼────────────────────┤
   *  │ totalCollects    │ 启动 qualityMetricsCollector 以来累计采集请求数              │ ≥0           │ 每次 SOURCE_* 事件│
   *  │ successCollects  │ 累计成功请求数（SOURCE_SUCCESS 或 FALLBACK 成功）             │ ≥0           │ 同上              │
   *  │ successRate      │ successCollects / totalCollects × 100（含 Mock 数据）        │ [0, 100] %   │ 同上              │
   *  │ mockCollects     │ 使用 mock 源（akshare/local/MockService）作为请求数          │ ≥0           │ 同上              │
   *  │ mockSuccesses    │ mock 源成功写入数                                           │ ≥0           │ 同上              │
   *  │ realSuccessRate  │ (successCollects - mockSuccesses) / (totalCollects - mockCollects) × 100 │ [0, 100] % 或 0 │ 仅当 total>mock 时有效 │
   *  │ completeness     │ 字段级完整率（成功返回的字段数 ÷ 目标 schema 字段数）× 100    │ [0, 100] %   │ SOURCE_SUCCESS 后 │
   *  │ sourceCounts     │ 各数据源调用次数分布：{tushare, tencent, sina, netease, akshare, mock, westock, tencentnews} │ 每项 ≥0   │ 每次请求结束      │
   *  │ fallbackCount    │ 主源失败后走 Fallback 链路的成功 / 失败总次数                │ ≥0           │ FALLBACK / FALLBACK_FAIL │
   *  │ writeSuccess     │ DataBridge.forward() 写入 IndexedDB 成功次数                │ ≥0           │ WRITE_SUCCESS     │
   *  │ writeTotal       │ 尝试写入总数（含 WRITE_FAIL）                                │ ≥0           │ WRITE_* 事件      │
   *  │ writeRate        │ writeSuccess / writeTotal × 100                              │ [0, 100] %   │ WRITE_* 事件      │
   *  │ mockWrites       │ mock 源写入次数（用于计算真实数据写入占比）                   │ ≥0           │ WRITE_* 事件      │
   *  │ avgLatency       │ 平均端到端延迟（请求发出→DataBridge.writeSuccess 返回）       │ ≥0 毫秒      │ 每次任务 COMPLETE │
   *  │ totalLatency     │ 累计延迟（avgLatency 的分子）                                │ ≥0 毫秒      │ 每次任务 COMPLETE │
   *  └──────────────────┴──────────────────────────────────────────────────────────────┴───────────────┴────────────────────┘
   *
   *  - 质量报警阈值（建议在 UI 层展示）：
   *    · successRate < 80  → danger 红
   *    · completeness < 70 → warning 琥珀
   *    · writeRate < 95    → warning 琥珀
   *    · avgLatency > 2000 → warning 琥珀（> 3000 danger）
   *    · fallbackCount > successRate × 2 → 提示主源不稳定，建议切换 SourcePriority
   */
  stats: QualityMetrics
  /** 是否正在运行批量采集任务（按钮 loading 态依据，与 sevenDimConfigStore.isCollecting 同源） */
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

/**
 * @example 消费六维质量 KPI 构造采集仪表盘质量四卡（建议用在 /collection/task 与 /data/test 面板）
 * ```tsx
 * import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
 * import { MetricCard } from '@/components/molecules/MetricCard'
 *
 * function QualityMetricStrip() {
 *   const { stats, isRunning } = useCollectionRuntimeStore()
 *
 *   return (
 *     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 *       <MetricCard
 *         title="采集成功率"
 *         value={`${stats.successRate.toFixed(1)}%`}
 *         color={stats.successRate >= 90 ? 'scoreHigh' : stats.successRate >= 70 ? 'scoreMid' : 'scoreLow'}
 *         change={`实 ${stats.realSuccessRate.toFixed(1)}%（剔除 mock）`}
 *         border
 *         loading={isRunning}
 *       />
 *       <MetricCard
 *         title="字段完整率"
 *         value={`${stats.completeness.toFixed(1)}%`}
 *         color={stats.completeness >= 85 ? 'scoreHigh' : stats.completeness >= 60 ? 'scoreMid' : 'scoreLow'}
 *         change={`${stats.mockCollects > 0 ? `含 mock ${stats.mockCollects} 次` : '全真实源'}`}
 *         border
 *       />
 *       <MetricCard
 *         title="写入成功率"
 *         value={`${stats.writeRate.toFixed(1)}%`}
 *         color={stats.writeRate >= 95 ? 'scoreHigh' : stats.writeRate >= 85 ? 'scoreMid' : 'scoreLow'}
 *         change={`${stats.writeSuccess}/${stats.writeTotal}（fallback=${stats.fallbackCount}）`}
 *         border
 *       />
 *       <MetricCard
 *         title="平均端到端延迟"
 *         value={stats.avgLatency}
 *         unit="ms"
 *         color={stats.avgLatency <= 800 ? 'scoreHigh' : stats.avgLatency <= 2000 ? 'scoreMid' : 'scoreLow'}
 *         change={`主源优先：${Object.entries(stats.sourceCounts)
 *           .filter(([, v]) => v > 0)
 *           .sort((a, b) => b[1] - a[1])
 *           .slice(0, 2)
 *           .map(([k, v]) => `${k} ${v}`)
 *           .join(' / ')}`}
 *         border
 *       />
 *     </div>
 *   )
 * }
 * ```
 */

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
    sourceCounts: { tushare: 0, tencent: 0, sina: 0, netease: 0, akshare: 0, mock: 0, westock: 0, tencentnews: 0, ifind_mcp: 0, tencent_mcp: 0 },
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
          merged[span.traceId] ??= span

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
