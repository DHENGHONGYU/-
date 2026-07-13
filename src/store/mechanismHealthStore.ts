/**
 * @module mechanismHealthStore
 * @lifecycle @Global
 * @description 机制健康（SOP 触发 / 文档自动更新 / 日志自动更新）统一状态 Store
 *
 * 镜像 systemMonitorStore 的结构：持有最新快照 + 历史趋势（自更新记录），
 * 通过定时器实现"时刻监控"，并在告警事件触发时记录告警时间。
 * UI 层（MechanismHealthWidget）只从本 Store 读数据，不直接跑扫描。
 */

import { create } from 'zustand'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import { COLLECTION_EVENTS } from '@/types/modules/collection.types'
import {
  runMechanismScan,
  MECHANISM_ALERT_EVENT,
  type MechanismHealthSnapshot,
} from '@/services/system/mechanismMonitorService'

const logger = getLogger()

/** 历史趋势保留上限（自更新记录条数） */
const MECHANISM_HISTORY_CAP = 20
/** 默认监控轮询间隔（ms） */
const MECHANISM_MONITOR_INTERVAL = 60000

interface MechanismHealthState {
  /** 最新扫描快照 */
  latest: MechanismHealthSnapshot | null
  /** 历史趋势（自更新累积，封顶 MECHANISM_HISTORY_CAP） */
  history: MechanismHealthSnapshot[]
  /** 是否正在监控 */
  isMonitoring: boolean
  /** 最近一次错误信息 */
  lastError: string | null
  /** 最后更新时间戳 */
  lastUpdated: number
  /** 最近一次告警时间戳 */
  lastAlertAt: number
  /** 立即扫描一次 */
  runScan: () => void
  /** 启动定时监控 */
  startMonitoring: (intervalMs?: number) => void
  /** 停止定时监控 */
  stopMonitoring: () => void
}

let monitorTimer: ReturnType<typeof setInterval> | null = null

/**
 * useMechanismHealthStore
 */
export const useMechanismHealthStore = create<MechanismHealthState>((set, get) => ({
  latest: null,
  history: [],
  isMonitoring: false,
  lastError: null,
  lastUpdated: 0,
  lastAlertAt: 0,

  runScan: () => {
    try {
      const snapshot = runMechanismScan()
      set((s) => ({
        latest: snapshot,
        history: [...s.history, snapshot].slice(-MECHANISM_HISTORY_CAP),
        lastError: null,
        lastUpdated: Date.now(),
      }))
      logger.info('[MechanismHealthStore] scan completed', {
        active: snapshot.summary.active,
        total: snapshot.summary.total,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[MechanismHealthStore] scan failed', { error: message })
      set({ lastError: message })
    }
  },

  startMonitoring: (intervalMs = MECHANISM_MONITOR_INTERVAL) => {
    if (get().isMonitoring) {
      logger.warn('[MechanismHealthStore] monitoring already active')
      return
    }
    set({ isMonitoring: true })
    logger.info('[MechanismHealthStore] monitoring started', { interval: intervalMs })

    // 立即扫描一次
    void get().runScan()

    monitorTimer = setInterval(() => {
      void get().runScan()
    }, intervalMs)
  },

  stopMonitoring: () => {
    if (monitorTimer) {
      clearInterval(monitorTimer)
      monitorTimer = null
    }
    set({ isMonitoring: false })
    logger.info('[MechanismHealthStore] monitoring stopped')
  },
}))

// ============================================================
// EventBus 订阅：告警记录 + 事件驱动重扫
// ============================================================
const subscriptions: Array<() => void> = []

/**
 * initMechanismSubscriptions
 * @description 订阅两类事件（对应设计的触发来源）：
 *  1. 机制健康告警事件 → 记录最近告警时间（"时刻提醒"的 Toast 由 UI 层 Widget 订阅同一事件触发）。
 *  2. 采集完成事件 (COLLECTION_EVENTS.COMPLETE) → 顺带刷新机制健康（事件驱动触发，第三种来源）。
 */
export function initMechanismSubscriptions(): () => void {
  subscriptions.forEach((unsubscribe) => unsubscribe())
  subscriptions.length = 0

  subscriptions.push(
    eventBus.on(MECHANISM_ALERT_EVENT, () => {
      useMechanismHealthStore.setState({ lastAlertAt: Date.now() })
      logger.warn('[MechanismHealthStore] mechanism alert received')
    }),
  )

  // 事件驱动：采集一跑完就顺带刷新机制健康
  subscriptions.push(
    eventBus.on(COLLECTION_EVENTS.COMPLETE, () => {
      logger.info('[MechanismHealthStore] collection completed, re-scanning mechanism health')
      void useMechanismHealthStore.getState().runScan()
    }),
  )

  return () => {
    subscriptions.forEach((unsubscribe) => unsubscribe())
    subscriptions.length = 0
  }
}

// 自动初始化订阅
initMechanismSubscriptions()
