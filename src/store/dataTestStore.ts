/**
 * @module dataTestStore
 * @lifecycle @Route
 * @description 采集测试面板状态管理。
 * 管理单接口测试、批量采集测试、服务健康检查等状态。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  checkFetcherHealth,
  fetchStockBasic,
  fetchStockKline,
} from '@/services/input/inputService'
import type { DataLayerResult, Stock, DailyQuotes } from '@/data/types'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export interface TestTask {
  symbol: string
  status: 'pending' | 'running' | 'success' | 'error'
  message: string
}

export type SingleTestStatus = 'idle' | 'running' | 'done'

interface DataTestState {
  // 服务健康检查
  health: boolean | null
  checking: boolean

  // 单接口测试
  singleSymbol: string
  singleResult: string
  singleStatus: SingleTestStatus

  // 批量采集测试
  batchText: string
  tasks: TestTask[]
  batchRunning: boolean
  progress: number

  // Actions
  setHealth: (health: boolean | null) => void
  setChecking: (checking: boolean) => void
  setSingleSymbol: (symbol: string) => void
  setSingleResult: (result: string) => void
  setSingleStatus: (status: SingleTestStatus) => void
  setBatchText: (text: string) => void
  setTasks: (tasks: TestTask[]) => void
  updateTask: (index: number, task: TestTask) => void
  setBatchRunning: (running: boolean) => void
  setProgress: (progress: number) => void
  reset: () => void

  // 异步操作
  checkHealth: () => Promise<void>
  runSingleTest: (dimension: 'basic' | 'kline') => Promise<void>
  runBatchTest: () => Promise<void>
}

// ============================================================
// 辅助函数
// ============================================================

function parseSymbols(text: string): string[] {
  return text
    .split(/[\n,;、]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

// ============================================================
// Store
// ============================================================

const initialState = {
  health: null as boolean | null,
  checking: false,
  singleSymbol: '',
  singleResult: '',
  singleStatus: 'idle' as SingleTestStatus,
  batchText: '',
  tasks: [] as TestTask[],
  batchRunning: false,
  progress: 0,
}

export const useDataTestStore = create<DataTestState>((set, get) => ({
  ...initialState,

  // 同步 Actions
  setHealth: (health) => {
    set({ health })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'setHealth', health })
  },
  setChecking: (checking) => set({ checking }),
  setSingleSymbol: (symbol) => set({ singleSymbol: symbol }),
  setSingleResult: (result) => {
    set({ singleResult: result })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'setSingleResult' })
  },
  setSingleStatus: (status) => set({ singleStatus: status }),
  setBatchText: (text) => set({ batchText: text }),
  setTasks: (tasks) => {
    set({ tasks })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'setTasks', count: tasks.length })
  },
  updateTask: (index, task) => {
    const tasks = [...get().tasks]
    tasks[index] = task
    set({ tasks })
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'updateTask', index, status: task.status })
  },
  setBatchRunning: (running) => set({ batchRunning: running }),
  setProgress: (progress) => set({ progress }),
  reset: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'reset' })
  },

  // 异步操作
  checkHealth: async () => {
    logger.info('[dataTestStore] 检查采集服务健康状态')
    set({ checking: true, health: null })
    try {
      const result = await checkFetcherHealth()
      logger.info(`[dataTestStore] 健康检查完成: ok=${result.ok}`)
      set({ health: result.ok, checking: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[dataTestStore] 健康检查失败: ${message}`)
      set({ health: false, checking: false })
    }
  },

  runSingleTest: async (dimension) => {
    const { singleSymbol } = get()
    const symbol = singleSymbol.trim().toUpperCase()
    if (!symbol) return

    logger.info(`[dataTestStore] 单接口测试: ${symbol} (${dimension})`)
    set({ singleStatus: 'running', singleResult: '' })

    try {
      let result: DataLayerResult<Stock> | DataLayerResult<DailyQuotes>
      if (dimension === 'basic') {
        result = await fetchStockBasic(symbol)
      } else {
        result = await fetchStockKline(symbol)
      }

      set({
        singleResult: JSON.stringify(result, null, 2),
        singleStatus: 'done',
      })
      logger.info(`[dataTestStore] 单接口测试完成: ${symbol}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[dataTestStore] 单接口测试失败: ${message}`)
      set({
        singleResult: JSON.stringify({ error: message }, null, 2),
        singleStatus: 'done',
      })
    }
  },

  runBatchTest: async () => {
    const { batchText } = get()
    const symbols = parseSymbols(batchText)
    if (symbols.length === 0) return

    logger.info(`[dataTestStore] 批量采集测试: ${symbols.length} 只股票`)
    set({
      batchRunning: true,
      progress: 0,
      tasks: symbols.map((symbol) => ({
        symbol,
        status: 'pending',
        message: '等待中',
      })),
    })

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i]!
      get().updateTask(i, { symbol, status: 'running', message: '采集中...' })

      try {
        const basicResult = await fetchStockBasic(symbol)
        let message: string
        let status: TestTask['status']

        if (!basicResult.success) {
          message = `基础数据失败：${basicResult.error ?? '未知错误'}`
          status = 'error'
        } else {
          const klineResult = await fetchStockKline(symbol)
          if (!klineResult.success) {
            message = `K线失败：${klineResult.error ?? '未知错误'}`
            status = 'error'
          } else {
            message = `成功：price=${klineResult.data?.price ?? basicResult.data?.price ?? '-'}, K线=${klineResult.data ? '有' : '无'}`
            status = 'success'
          }
        }

        get().updateTask(i, { symbol, status, message })
        set({ progress: Math.round(((i + 1) / symbols.length) * 100) })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error(`[dataTestStore] 批量测试异常: ${symbol}, ${errorMsg}`)
        get().updateTask(i, { symbol, status: 'error', message: `异常：${errorMsg}` })
      }
    }

    set({ batchRunning: false })
    logger.info('[dataTestStore] 批量采集测试完成')
  },
}))
