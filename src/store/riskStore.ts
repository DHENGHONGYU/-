/**
 * @module riskStore
 * @lifecycle @Global
 * @description 风控网关状态管理。管理风控三态（正常/警告/阻塞）、裁决记录、
 * 回路状态（circuit breaker），提供 checkOrderRisk 调用入口及 DataBridge 订阅。
 *
 * @status 当前无 UI 消费方，但含完整风控逻辑（三态/回路/裁决记录）。
 * 保留以备未来风控面板（如 SystemMonitor 或 RiskDashboard）展示风控状态。
 * 删除前需确认未来无风控可视化需求。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { checkOrderRisk, type OrderRiskInput, type RiskCheckResult } from '@/services/trading/riskEngine'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, type EnvelopeAction } from '@/config/dbConfig'
import type { SignalDirection } from '@/config/tradingConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 风控三态 */
export type RiskTriState = 'normal' | 'warning' | 'blocked'

/** 裁决记录 */
export interface RiskVerdict {
  id: string
  timestamp: number
  symbol: string
  direction: SignalDirection
  input: OrderRiskInput
  result: RiskCheckResult
  triState: RiskTriState
}

/** 回路状态 */
export type CircuitState = 'closed' | 'open' | 'half-open'

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

const RISK_RELEVANT_ACTIONS = new Set<EnvelopeAction>([
  ENVELOPE_ACTION.insertOrder,
  ENVELOPE_ACTION.updateOrder,
])

/** 初始化 DataBridge 订阅，返回 cleanup 函数 */
export function initRiskStoreSubscriptions(): () => void {
  if (_unsubscribeOrders) {
    logger.warn('[riskStore] Subscriptions already initialized')
    return () => destroyRiskStoreSubscriptions()
  }

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
        // 订单变更时，可考虑重新评估当前风控状态
      }
    },
  )

  logger.info('[riskStore] DataBridge subscriptions initialized')
  return () => destroyRiskStoreSubscriptions()
}

function destroyRiskStoreSubscriptions(): void {
  _unsubscribeOrders?.()
  _unsubscribeOrders = null
  logger.info('[riskStore] DataBridge subscriptions destroyed')
}

// ============================================================
// 派生查询（从 .derived.ts 统一导出，含 memoizeByRef 缓存优化）
// 设计原则：派生查询独立函数模式，通过 getState() 访问状态，不存入 State
// ============================================================
export * from './riskStore.derived'
