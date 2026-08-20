/**
 * @fileoverview 交易类 Store
 *
 * 从 dataLayer.ts 拆分而来，包含 6 个交易域 Store：
 * - orderStore: 订单 add/list
 * - signalStore: 信号 save/list/listBySymbol
 * - executionPlanStore: 执行计划 save/get/getAll/getBySymbol/list/update/delete
 * - executionLogStore: 执行日志 save/getByPlanId/listByPlan/getBySymbol/listBySymbol/list/getAll
 * - portfolioStore: 持仓 save/get/list
 * - tradeReviewStore: 交易复盘 save/getLatest
 *
 * 注意：事务内操作请使用 gateway.runInTransactionWithContext()，
 * 它提供类型安全的 ITransactionContext 进行 CRUD 操作。
 *
 *  @doc [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-DATA-031]
*/
import { STORE_NAME } from '@/config/dbConfig'
import { generateId, now } from './db'
import type {
  DataLayerResult,
  ExecutionLog,
  ExecutionPlan,
  Order,
  Portfolio,
  Signal,
  TradeReviewRecord,
} from './types'
import { sendWriteEnvelope, queryGet, queryList, queryByIndex } from './dataLayerHelpers'

export const orderStore = {
  async add(order: Omit<Order, 'id' | 'createdAt'>): Promise<DataLayerResult<Order>> {
    const fullOrder: Order = {
      ...order,
      id: generateId(),
      createdAt: now(),
    }
    const result = await sendWriteEnvelope<Order>('insertOrder', fullOrder, 'tradinghub')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: fullOrder }
  },

  async list(): Promise<Order[]> {
    return queryList<Order>(STORE_NAME.orders)
  },
}

export const signalStore = {
  async save(signal: Signal): Promise<DataLayerResult<Signal>> {
    const result = await sendWriteEnvelope<Signal>('insertSignal', signal, 'tradinghub')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: signal }
  },

  async list(): Promise<Signal[]> {
    return queryList<Signal>(STORE_NAME.signals)
  },

  async listBySymbol(symbol: string): Promise<Signal[]> {
    const all = await queryList<Signal>(STORE_NAME.signals)
    return all.filter((s) => s.symbol === symbol)
  },
}

export const executionPlanStore = {
  async save(plan: ExecutionPlan): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveExecutionPlan', plan, 'executionPlans')
  },

  async get(id: string): Promise<ExecutionPlan | undefined> {
    return queryGet<ExecutionPlan>(STORE_NAME.executionPlans, id)
  },

  async getAll(): Promise<ExecutionPlan[]> {
    return queryList<ExecutionPlan>(STORE_NAME.executionPlans)
  },

  async getBySymbol(symbol: string): Promise<ExecutionPlan[]> {
    return queryByIndex<ExecutionPlan>(STORE_NAME.executionPlans, 'by-symbol', symbol)
  },

  async list(): Promise<ExecutionPlan[]> {
    return queryList<ExecutionPlan>(STORE_NAME.executionPlans)
  },

  async update(id: string, updates: Partial<ExecutionPlan>): Promise<DataLayerResult<ExecutionPlan>> {
    const existing = await queryGet<ExecutionPlan>(STORE_NAME.executionPlans, id)
    if (!existing) return { success: false, error: 'ExecutionPlan not found' }
    const updated = { ...existing, ...updates, updatedAt: Date.now() }
    const result = await sendWriteEnvelope<ExecutionPlan>('updateExecutionPlan', updated, 'executionPlans')
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: updated }
  },

  async delete(id: string): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('deleteExecutionPlan', { id }, 'executionPlans')
  },
}

export const executionLogStore = {
  async save(log: ExecutionLog): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveExecutionLog', log, 'executionLogs')
  },

  async getByPlanId(planId: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-plan-id', planId)
  },

  async listByPlan(planId: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-plan-id', planId)
  },

  async getBySymbol(symbol: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-symbol', symbol)
  },

  async listBySymbol(symbol: string): Promise<ExecutionLog[]> {
    return queryByIndex<ExecutionLog>(STORE_NAME.executionLogs, 'by-symbol', symbol)
  },

  async list(): Promise<ExecutionLog[]> {
    return queryList<ExecutionLog>(STORE_NAME.executionLogs)
  },

  async getAll(): Promise<ExecutionLog[]> {
    return queryList<ExecutionLog>(STORE_NAME.executionLogs)
  },
}

export const portfolioStore = {
  async save(portfolio: Portfolio): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('savePortfolio', portfolio, 'tradinghub')
  },

  async get(id: string): Promise<Portfolio | undefined> {
    return queryGet<Portfolio>(STORE_NAME.portfolios, id)
  },

  async list(): Promise<Portfolio[]> {
    return queryList<Portfolio>(STORE_NAME.portfolios)
  },
}

export const tradeReviewStore = {
  async save(record: TradeReviewRecord): Promise<DataLayerResult<void>> {
    return sendWriteEnvelope('saveTradeReview', record, 'tradeReviews')
  },

  async getLatest(): Promise<TradeReviewRecord | null> {
    const all = await queryList<TradeReviewRecord>(STORE_NAME.tradeReviews)
    if (all.length === 0) return null
    return all.reduce((latest, r) => (r.generatedAt > latest.generatedAt ? r : latest))
  },
}
