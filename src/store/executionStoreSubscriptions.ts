/**
 * @module store/executionStoreSubscriptions
 * @description executionStore DataBridge 订阅管理
 *
 * 负责订阅 DataBridge 上的 signals 和 orders 事件，实现执行计划的自动化更新。
 *
 * 交易流程事件驱动架构：
 * ┌──────────────┐    ┌──────────────────────────┐    ┌──────────────────────┐
 * │ 信号生成模块  │───▶│  _handleSignalEnvelope   │───▶│ 自动创建执行计划     │
 * │ (Signal)    │    │  - insertSignal 事件     │    │ createPlan(signal)   │
 * └──────────────┘    └──────────────────────────┘    └──────────────────────┘
 *
 * ┌──────────────┐    ┌──────────────────────────┐    ┌──────────────────────┐
 * │ 订单执行模块  │───▶│  _handleOrderEnvelope   │───▶│ 防抖刷新执行计划     │
 * │ (Order)      │    │  - insertOrder 事件     │    │ refresh()           │
 * │              │    │  - updateOrder 事件     │    │                     │
 * └──────────────┘    └──────────────────────────┘    └──────────────────────┘
 *
 * ┌──────────────┐    ┌──────────────────────────┐    ┌──────────────────────┐
 * │ 执行计划模块  │───▶│  _handleSignalEnvelope   │───▶│ 防抖刷新执行计划     │
 * │ (Execution)  │    │  - saveExecutionPlan    │    │ refresh()           │
 * │              │    │  - updateExecutionPhase │    │                     │
 * └──────────────┘    └──────────────────────────┘    └──────────────────────┘
 *
 * 核心设计原则：
 *   1. 自循环保护：通过 source 检查避免处理自身发出的事件
 *   2. 防抖机制：100ms 防抖避免频繁刷新导致性能问题
 *   3. 幂等初始化：多次调用 init 只初始化一次
 *   4. 完整清理：销毁时清除订阅和定时器
 *
 * @compliance AGENTS.md §一 分层规则：store 层仅依赖 services 和 core
 * @since v2.0.0
 */

import { getLogger } from '@/lib/logger'
import {
  ENVELOPE_ACTION,
  MODULE_ID,
  STORE_NAME,
  type EnvelopeAction,
} from '@/config/dbConfig'
import type { Signal } from '@/data/types'
import type { StandardEnvelope } from '@/core/envelope'
import { dataBridge } from '@/core/databridge'

const logger = getLogger()

/** 执行模块的来源标识符（用于自循环保护） */
const EXECUTION_STORE_SOURCE = MODULE_ID.tradinghub

/** 防抖延迟时间（毫秒），避免频繁刷新执行计划 */
const DEBOUNCE_MS = 100

/** signals store 订阅的取消函数 */
let _unsubscribeSignals: (() => void) | null = null

/** orders store 订阅的取消函数 */
let _unsubscribeOrders: (() => void) | null = null

/** 防抖定时器引用 */
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/** 执行计划变更事件集合（触发防抖刷新） */
const _EXECUTION_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.saveExecutionPlan,
  ENVELOPE_ACTION.updateExecutionPhase,
])

/** 信号插入事件集合（触发自动创建执行计划） */
const _SIGNAL_INSERT_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertSignal,
])

/** 订单变更事件集合（触发防抖刷新） */
const _ORDER_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
])

import { useExecutionStore } from './executionStore'

/**
 * 防抖刷新执行计划。
 *
 * 当多个事件在短时间内连续触发时，只执行最后一次刷新，
 * 避免频繁刷新导致的性能问题和状态抖动。
 *
 * @param envelope 触发刷新的事件信封
 */
function _debouncedRefresh(envelope: StandardEnvelope): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    logger.info('[executionStore] Debounced refresh triggered', {
      traceId: envelope.meta.traceId,
      action: envelope.meta.action,
      source: envelope.meta.source,
    })
    void useExecutionStore.getState().refresh()
  }, DEBOUNCE_MS)
}

/**
 * 处理 signals store 的事件信封。
 *
 * 事件处理流程：
 * 1. 检查来源，跳过自身发出的事件（自循环保护）
 * 2. 如果是 insertSignal 事件：
 *    - 验证信号方向（仅 buy/sell 方向触发）
 *    - 自动创建执行计划
 * 3. 如果是执行计划变更事件（saveExecutionPlan/updateExecutionPhase）：
 *    - 触发防抖刷新
 *
 * @param envelope signals store 的事件信封
 */
function _handleSignalEnvelope(envelope: StandardEnvelope): void {
  if (envelope.meta.source === EXECUTION_STORE_SOURCE) {
    return
  }

  if (_SIGNAL_INSERT_ACTIONS.has(envelope.meta.action)) {
    const signal = envelope.payload as Signal | undefined
    if (signal && (signal.direction === 'buy' || signal.direction === 'sell')) {
      logger.info('[executionStore] 收到新信号，自动创建执行计划', {
        signalId: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
        confidence: signal.confidence,
      })
      void useExecutionStore.getState().createPlan(signal)
    }
  }

  if (_EXECUTION_CHANGE_ACTIONS.has(envelope.meta.action)) {
    _debouncedRefresh(envelope)
  }
}

/**
 * 处理 orders store 的事件信封。
 *
 * 事件处理流程：
 * 1. 检查来源，跳过自身发出的事件（自循环保护）
 * 2. 如果是 insertOrder 或 updateOrder 事件：
 *    - 触发防抖刷新执行计划
 *
 * @param envelope orders store 的事件信封
 */
function _handleOrderEnvelope(envelope: StandardEnvelope): void {
  if (envelope.meta.source === EXECUTION_STORE_SOURCE) {
    return
  }

  if (_ORDER_CHANGE_ACTIONS.has(envelope.meta.action)) {
    logger.info('[executionStore] DataBridge orders event received', {
      action: envelope.meta.action,
      traceId: envelope.meta.traceId,
      source: envelope.meta.source,
    })
    _debouncedRefresh(envelope)
  }
}

/**
 * 初始化 executionStore 的 DataBridge 订阅。
 *
 * 订阅内容：
 * - signals store：监听 insertSignal 和执行计划变更事件
 * - orders store：监听 insertOrder 和 updateOrder 事件
 *
 * 注意：此函数是幂等的，多次调用只初始化一次。
 *
 * @returns 清理函数，调用后移除所有订阅和定时器
 */
export function initExecutionStoreSubscriptions(): () => void {
  if (_unsubscribeSignals || _unsubscribeOrders) {
    logger.warn('[executionStore] Subscriptions already initialized, skipping')
    return _destroySubscriptions
  }

  _unsubscribeSignals = dataBridge.subscribe(STORE_NAME.signals, _handleSignalEnvelope)
  _unsubscribeOrders = dataBridge.subscribe(STORE_NAME.orders, _handleOrderEnvelope)

  logger.info('[executionStore] DataBridge subscriptions initialized')

  return _destroySubscriptions
}

/**
 * 销毁所有订阅和定时器。
 *
 * 清理内容：
 * - 清除防抖定时器
 * - 取消 signals store 订阅
 * - 取消 orders store 订阅
 */
function _destroySubscriptions(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  _unsubscribeSignals?.()
  _unsubscribeOrders?.()
  _unsubscribeSignals = null
  _unsubscribeOrders = null
  logger.info('[executionStore] DataBridge subscriptions destroyed')
}
