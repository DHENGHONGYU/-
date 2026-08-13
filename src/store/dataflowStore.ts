/**
 * @internal - 已实现但当前无 UI 层消费者，待产品规划接入（建议接入点：SystemMonitor / EngineStatus 健康仪表盘）
 * @doc [V9-DOC-DATA-018, V9-DOC-DATA-002, V9-DOC-DATA-021, V9-DOC-DATA-008, V9-DOC-DATA-006]
 */
import { create } from 'zustand'
import { dataFlowEngine } from '@/core/dataflow/dataflowEngine'
import { eventBus } from '@/lib/eventBus'

interface DataflowState {
  /**
   * KPI-01: 数据引擎通道连接状态
   *  - 口径：dataFlowEngine 是否已建立并可用（WebSocket / LocalChannel 至少 1 条活连接）
   *  - 事件：DATAFLOW_CONNECTED → true，DATAFLOW_DISCONNECTED → false
   *  - UI 建议：StatusBadge（绿点连接 / 红点断开）
   */
  connected: boolean
  /**
   * KPI-02: 通道订阅明细（channelName → {订阅者数, 最后发布时间戳}）
   *  - 用途：检测订阅泄漏（subscribers 持续增长且从未 drop）
   *  - 监控建议：lastPublish - Date.now() > 60s 且 subscribers>0 → 通道疑似卡死
   */
  channels: Map<string, { subscribers: number; lastPublish: number }>
  /**
   * KPI-03: 最近一次 publish 的 payload 缓存（按 channel）
   *  - 供开发调试面板查看：避免反复触发事件即可检查数据新鲜度
   *  - 仅保留最近一次值，不做历史队列
   */
  cache: Map<string, unknown>
  /**
   * KPI-04: DataFlow 引擎统计（调用 dataFlowEngine.getStats()）
   *  - 字段（来自 core/dataflow/types）：
   *    · publishes          — 累计发布次数
   *    · publishesPerSecond — 最近 5s 滑动窗口 TPS
   *    · dropped            — 因订阅者处理异常被丢弃的消息数（> 0 → warn）
   *    · subscribers        — 当前全部 channel 的订阅者数组（可与 channels Map 交叉校验）
   *    · avgLatencyMs       — publish → onNext 平均调度延迟（> 16ms 掉帧阈值）
   *    · queueSize          — 发布队列积压（> 0 持续增加 → backpressure 警告）
   */
  stats: ReturnType<typeof dataFlowEngine.getStats>
  setConnected: (connected: boolean) => void
  updateChannelSubscribers: (channel: string, count: number) => void
  updateCache: (channel: string, data: unknown) => void
  refreshStats: () => void
  /** 重置 Store 到初始状态（调试面板 / 自动化测试） */
  reset: () => void
}

/**
 * @example （规划中 UI）：引擎健康仪表盘展示 dataflow 四卡
 * ```tsx
 * import { useDataflowStore } from '@/store/dataflowStore'
 * import { MetricCard } from '@/components/molecules/MetricCard'
 *
 * function DataflowHealthStrip() {
 *   const { connected, channels, stats } = useDataflowStore()
 *   const activeChannels = Array.from(channels.values()).filter(c => c.subscribers > 0).length
 *
 *   return (
 *     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 *       <MetricCard
 *         title="数据引擎状态"
 *         value={connected ? "已连接" : "已断开"}
 *         color={connected ? "scoreHigh" : "scoreLow"}
 *         border
 *       />
 *       <MetricCard
 *         title="活跃通道 / 总通道"
 *         value={`${activeChannels} / ${channels.size}`}
 *         color={stats.dropped === 0 ? "scoreHigh" : "scoreMid"}
 *         change={`丢弃消息 ${stats.dropped}`}
 *         border
 *       />
 *       <MetricCard
 *         title="发布吞吐（最近 5s）"
 *         value={stats.publishesPerSecond.toFixed(0)}
 *         unit="msg/s"
 *         color={stats.queueSize === 0 ? "scoreHigh" : "warning"}
 *         change={`累计 ${stats.publishes}`}
 *         border
 *       />
 *       <MetricCard
 *         title="平均调度延迟"
 *         value={stats.avgLatencyMs.toFixed(0)}
 *         unit="ms"
 *         color={stats.avgLatencyMs <= 8 ? "scoreHigh" : stats.avgLatencyMs <= 16 ? "scoreMid" : "scoreLow"}
 *         change={stats.queueSize > 0 ? `队列积压 ${stats.queueSize}` : "队列空闲"}
 *         border
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export const useDataflowStore = create<DataflowState>((set) => ({
  connected: false,
  channels: new Map(),
  cache: new Map(),
  stats: dataFlowEngine.getStats(),
  setConnected: (connected) => set({ connected }),
  updateChannelSubscribers: (channel, count) => set((state) => {
    const channels = new Map(state.channels)
    channels.set(channel, { ...channels.get(channel), subscribers: count, lastPublish: Date.now() })
    return { channels }
  }),
  updateCache: (channel, data) => set((state) => {
    const cache = new Map(state.cache)
    cache.set(channel, data)
    return { cache }
  }),
  refreshStats: () => set({ stats: dataFlowEngine.getStats() }),
  reset: () => set({
    connected: false,
    channels: new Map(),
    cache: new Map(),
    stats: dataFlowEngine.getStats(),
  }),
}))

const dataflowSubscriptions: Array<() => void> = []

/**
 * initDataflowSubscriptions
 */
export function initDataflowSubscriptions(): () => void {
  destroyDataflowSubscriptions()
  dataflowSubscriptions.push(
    eventBus.on('DATAFLOW_CONNECTED', () => {
      useDataflowStore.getState().setConnected(true)
      useDataflowStore.getState().refreshStats()
    }),
    eventBus.on('DATAFLOW_DISCONNECTED', () => {
      useDataflowStore.getState().setConnected(false)
      useDataflowStore.getState().refreshStats()
    }),
    eventBus.on('DATAFLOW_PACKET_PUBLISHED', (payload) => {
      const { channel } = payload as { channel: string }
      const cached = dataFlowEngine.getStats().subscribers.find((s) => s.channel === channel)
      if (cached) {
        useDataflowStore.getState().updateChannelSubscribers(channel, cached.count)
      }
    }),
  )
  return () => destroyDataflowSubscriptions()
}

/**
 * destroyDataflowSubscriptions
 * @returns void
 */
export function destroyDataflowSubscriptions(): void {
  dataflowSubscriptions.forEach((unsubscribe) => unsubscribe())
  dataflowSubscriptions.length = 0
}

initDataflowSubscriptions()