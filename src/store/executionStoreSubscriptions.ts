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

const EXECUTION_STORE_SOURCE = MODULE_ID.tradinghub
const DEBOUNCE_MS = 100

let _unsubscribeSignals: (() => void) | null = null
let _unsubscribeOrders: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

const _EXECUTION_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.saveExecutionPlan,
  ENVELOPE_ACTION.updateExecutionPhase,
])

const _SIGNAL_INSERT_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertSignal,
])

const _ORDER_CHANGE_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
])

import { useExecutionStore } from './executionStore'

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
