/**
 * @module riskStore
 * @lifecycle @Global
 * @description 风控网关状态管理。管理风控三态（正常/警告/阻塞）、裁决记录、
 * 回路状态（circuit breaker），提供 checkOrderRisk 调用入口、DataBridge 订阅
 * 及从 execution_plans 加载真实风控裁决记录的能力。
 *
 * @status RiskControlPage 已通过 loadRiskVerdicts 接入真实数据源。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { checkOrderRisk, type OrderRiskInput, type RiskCheckResult } from '@/services/trading/riskEngine'
import { loadRiskVerdicts, type RiskVerdict } from '@/services/riskControlService'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, type EnvelopeAction } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import type { RiskTriState, CircuitState } from '@/types/modules/risk.types'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

// 类型由 services / types 层提供，本文件仅做 re-export 以保持外部引用稳定
export type { RiskTriState, CircuitState } from '@/types/modules/risk.types'
export type { RiskVerdict } from '@/services/riskControlService'

// ============================================================
// Store 接口
// ============================================================

interface RiskState {
  /** 当前风控三态 */
  triState: RiskTriState
  /** 回路状态 */
  circuitState: CircuitState
  /** 最近裁决记录（最多保留 50 条） */
  verdicts: RiskVerdict[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后检查时间戳 */
  lastChecked: number

  // Actions
  /** 执行风控检查 */
  checkRisk: (input: OrderRiskInput) => Promise<RiskCheckResult>
  /** 从 DataBridge 加载真实风控裁决记录 */
  loadRiskVerdicts: () => Promise<void>
  /** 设置回路状态 */
  setCircuitState: (state: CircuitState) => void
  /** 清空裁决记录 */
  clearVerdicts: () => void
}

// ============================================================
// 常量
// ============================================================

const MAX_VERDICTS = 50

// ============================================================
// 辅助函数
// ============================================================

function deriveTriState(result: RiskCheckResult): RiskTriState {
  if (!result.ok || result.blocks.length > 0) return 'blocked'
  if (result.warnings.length > 0) return 'warning'
  return 'normal'
}

function generateVerdictId(): string {
  return `verdict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================
// Store
// ============================================================

/**
 * useRiskStore
 */
export const useRiskStore = create<RiskState>((set, get) => ({
  triState: 'normal',
  circuitState: 'closed',
  verdicts: [],
  loading: false,
  error: null,
  lastChecked: 0,

  checkRisk: async (input: OrderRiskInput) => {
    logger.info('[riskStore] checkRisk 开始', { symbol: input.symbol, direction: input.direction })
    set({ loading: true, error: null })

    try {
      const result = await checkOrderRisk(input)
      const triState = deriveTriState(result)

      const verdict: RiskVerdict = {
        id: generateVerdictId(),
        timestamp: Date.now(),
        symbol: input.symbol,
        direction: input.direction,
        input,
        result,
        triState,
      }

      // 追加裁决记录，超出上限则淘汰最早的
      const prevVerdicts = get().verdicts
      const nextVerdicts = [verdict, ...prevVerdicts].slice(0, MAX_VERDICTS)

      // 若为 blocked 状态，自动触发回路开路
      let nextCircuitState = get().circuitState
      if (triState === 'blocked' && nextCircuitState === 'closed') {
        nextCircuitState = 'open'
        logger.warn('[riskStore] 风控阻塞，回路状态切换为 open')
      }

      set({
        triState,
        verdicts: nextVerdicts,
        loading: false,
        lastChecked: verdict.timestamp,
        circuitState: nextCircuitState,
      })

      logger.info('[riskStore] checkRisk 完成', {
        symbol: input.symbol,
        triState,
        blocks: result.blocks.length,
        warnings: result.warnings.length,
      })

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[riskStore] checkRisk 失败: ${message}`)
      set({ loading: false, error: message })
      return { ok: false, warnings: [], blocks: [message] }
    }
  },

  loadRiskVerdicts: async () => {
    logger.info('[riskStore] loadRiskVerdicts 开始')
    set({ loading: true, error: null })

    try {
      const verdicts = await loadRiskVerdicts()
      const latest = verdicts[0]
      const triState: RiskTriState = latest?.triState ?? 'normal'

      let circuitState: CircuitState = 'closed'
      if (verdicts.some((v) => v.triState === 'blocked')) {
        circuitState = 'open'
      } else if (verdicts.some((v) => v.triState === 'warning')) {
        circuitState = 'half-open'
      }

      set({
        triState,
        circuitState,
        verdicts,
        loading: false,
        error: null,
        lastChecked: latest?.timestamp ?? Date.now(),
      })

      withBroadcast(EVENT_NAMES.RISK_CHANGED, {
        action: 'loadRiskVerdicts',
        count: verdicts.length,
        triState,
        circuitState,
      })

      logger.info('[riskStore] loadRiskVerdicts 完成', {
        count: verdicts.length,
        triState,
        circuitState,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[riskStore] loadRiskVerdicts 失败: ${message}`)
      set({ loading: false, error: message })
    }
  },

  setCircuitState: (state: CircuitState) => {
    logger.info('[riskStore] setCircuitState', { state })
    set({ circuitState: state })
    withBroadcast(EVENT_NAMES.RISK_CHANGED, { action: 'setCircuitState', state })
  },

  clearVerdicts: () => {
    logger.info('[riskStore] clearVerdicts')
    set({ verdicts: [] })
    withBroadcast(EVENT_NAMES.RISK_CHANGED, { action: 'clearVerdicts' })
  },
}))

// ============================================================
// 派生查询
// ============================================================

/** 获取最近 N 条裁决记录 */
export function recentVerdicts(limit: number = 10): RiskVerdict[] {
  return useRiskStore.getState().verdicts.slice(0, limit)
}

/** 获取指定 symbol 的裁决记录 */
export function verdictsBySymbol(symbol: string): RiskVerdict[] {
  return useRiskStore.getState().verdicts.filter((v) => v.symbol === symbol)
}

// ============================================================
// DataBridge 订阅
// ============================================================

let _unsubscribeOrders: (() => void) | null = null
let _globalSubscriptionsInitialized = false

const RISK_RELEVANT_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
])

/** 初始化 DataBridge 订阅（组件级），返回 cleanup 函数 */
export function initRiskStoreSubscriptions(): () => void {
  if (_unsubscribeOrders) {
    logger.warn('[riskStore] Subscriptions already initialized')
    return () => destroyRiskStoreSubscriptions()
  }

  setupSubscriptions()
  logger.info('[riskStore] DataBridge subscriptions initialized')
  return () => destroyRiskStoreSubscriptions()
}

/**
 * 全局初始化风控订阅（应用启动时调用）。
 * 与组件级 initRiskStoreSubscriptions 不同，全局初始化的订阅
 * 不会随组件卸载而销毁，确保风控数据在懒加载widget挂载前就已就绪。
 */
export function initRiskStoreGlobalSubscriptions(): void {
  if (_globalSubscriptionsInitialized) {
    logger.debug('[riskStore] Global subscriptions already initialized')
    return
  }

  setupSubscriptions()
  // 启动时加载一次风控裁决记录
  void useRiskStore.getState().loadRiskVerdicts()
  _globalSubscriptionsInitialized = true
  logger.info('[riskStore] Global subscriptions initialized')
}

/**
 * 测试用：重置所有订阅状态（仅在测试环境使用）
 */
export function _resetRiskStoreSubscriptionsForTest(): void {
  destroyRiskStoreSubscriptions()
  _globalSubscriptionsInitialized = false
  useRiskStore.setState({
    triState: 'normal',
    circuitState: 'closed',
    verdicts: [],
    loading: false,
    error: null,
    lastChecked: 0,
  })
  logger.info('[riskStore] Subscriptions reset for test')
}

function setupSubscriptions(): void {
  _unsubscribeOrders = dataBridge.subscribe(
    'orders',
    (envelope) => {
      if (envelope.meta.source === MODULE_ID.trading || envelope.meta.source === MODULE_ID.tradinghub) {
        return
      }
      if (RISK_RELEVANT_ACTIONS.has(envelope.meta.action)) {
        logger.info('[riskStore] DataBridge event on orders channel', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
        })
        // 订单变更时，重新加载风控裁决
        void useRiskStore.getState().loadRiskVerdicts()
      }
    },
  )
}

function destroyRiskStoreSubscriptions(): void {
  if (_globalSubscriptionsInitialized) {
    logger.debug('[riskStore] Global subscriptions, skip destroy from component')
    return
  }
  _unsubscribeOrders?.()
  _unsubscribeOrders = null
  logger.info('[riskStore] DataBridge subscriptions destroyed')
}

// ============================================================
// 派生查询（从 .derived.ts 统一导出，含 memoizeByRef 缓存优化）
// 设计原则：派生查询独立函数模式，通过 getState() 访问状态，不存入 State
// ============================================================
export * from './riskStore.derived'
