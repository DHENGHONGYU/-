/**
 * @module dataTestStore
 * @description 采集测试面板状态管理（v2）。
 *
 * 支持单接口链路测试、批量采集测试，并与 `collectionPipeline` 集成，
 * 实现采集触发 → 数据源尝试 → 降级 → 写入 → 结果反馈的可视化。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import {
  runSingleTrace,
  runBatchTrace,
} from '@/services/data-collector/collectionPipeline'
import type { CollectionConfig } from '@/types/modules/collection.types'
import type { TraceResult } from '@/services/data-collector/collectionPipeline'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

export type TestTaskStatus = 'pending' | 'running' | 'success' | 'error'

export interface TestTask {
  symbol: string
  status: TestTaskStatus
  message: string
}

export type SingleTestStatus = 'idle' | 'running' | 'done'

export type TraceDimension = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08'

interface DataTestState {
  // 服务健康检查
  health: boolean | null
  checking: boolean

  // 单接口测试
  singleSymbol: string
  selectedDimension: TraceDimension
  singleResult: string
  singleStatus: SingleTestStatus

  // 批量采集测试
  batchText: string
  tasks: TestTask[]
  batchRunning: boolean
  progress: number

  // 链路测试结果
  traceResults: TraceResult[]

  // Actions
  setSingleSymbol: (symbol: string) => void
  setSelectedDimension: (dimension: TraceDimension) => void
  setSingleResult: (result: string) => void
  setSingleStatus: (status: SingleTestStatus) => void
  setBatchText: (text: string) => void
  setTasks: (tasks: TestTask[]) => void
  updateTask: (index: number, task: TestTask) => void
  setBatchRunning: (running: boolean) => void
  setProgress: (progress: number) => void
  setTraceResults: (results: TraceResult[]) => void
  reset: () => void

  // 异步操作
  checkHealth: () => Promise<void>
  runSingleTrace: (config: CollectionConfig) => Promise<void>
  runBatchTrace: (config: CollectionConfig) => Promise<void>
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
  selectedDimension: '01' as TraceDimension,
  singleResult: '',
  singleStatus: 'idle' as SingleTestStatus,
  batchText: '',
  tasks: [] as TestTask[],
  batchRunning: false,
  progress: 0,
  traceResults: [] as TraceResult[],
}

/**
 * useDataTestStore
 */
export const useDataTestStore = create<DataTestState>((set, get) => ({
  ...initialState,

  setSingleSymbol: (symbol) => set({ singleSymbol: symbol }),
  setSelectedDimension: (dimension) => set({ selectedDimension: dimension }),
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
  setTraceResults: (traceResults) => set({ traceResults }),
  reset: () => {
    set(initialState)
    withBroadcast(EVENT_NAMES.DATA_TEST_CHANGED, { action: 'reset' })
  },

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

  runSingleTrace: async (config) => {
    const { singleSymbol, selectedDimension } = get()
    const symbol = singleSymbol.trim().toUpperCase()
    if (!symbol) return

    logger.info(`[dataTestStore] 单链路测试: ${symbol} (${selectedDimension})`)
    set({ singleStatus: 'running', singleResult: '' })

    try {
      const result = await runSingleTrace({
        symbol,
        dimensionCode: selectedDimension,
        config,
      })

      set({
        singleResult: JSON.stringify(result, null, 2),
        singleStatus: 'done',
        traceResults: [result],
      })
      logger.info(`[dataTestStore] 单链路测试完成: ${symbol}`, { result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[dataTestStore] 单链路测试失败: ${message}`)
      set({
        singleResult: JSON.stringify({ error: message }, null, 2),
        singleStatus: 'done',
      })
    }
  },

  runBatchTrace: async (config) => {
    const { batchText } = get()
    const symbols = parseSymbols(batchText)
    if (symbols.length === 0) return

    logger.info(`[dataTestStore] 批量链路测试: ${symbols.length} 只股票`)
    set({
      batchRunning: true,
      progress: 0,
      tasks: symbols.map((symbol) => ({
        symbol,
        status: 'pending',
        message: '等待中',
      })),
    })

    const results = await runBatchTrace({
      symbols,
      dimensionCode: '01',
      config,
    })

    // 同步 task 状态
    results.forEach((result, index) => {
      get().updateTask(index, {
        symbol: result.symbol,
        status: result.success ? 'success' : 'error',
        message: result.success
          ? `成功${result.source ? `（${result.source}）` : ''}`
          : result.error ?? '失败',
      })
    })

    set({
      batchRunning: false,
      progress: 100,
      traceResults: results,
    })

    logger.info('[dataTestStore] 批量链路测试完成')
  },
}))
