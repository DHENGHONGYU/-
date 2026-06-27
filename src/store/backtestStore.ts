import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
  BacktestCurve,
  BacktestTrade,
  DataLayerResult,
} from '@/data/types'
import {
  runBacktestEngineService,
  getBacktestHistoryService,
  deleteBacktestService,
} from '@/services/trading/backtestEngine'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 状态接口定义
// ============================================================

interface BacktestState {
  config: BacktestConfig | null
  result: BacktestResult | null
  metrics: BacktestMetrics | null
  curve: BacktestCurve | null
  trades: BacktestTrade[]
  history: BacktestResult[]
  isRunning: boolean
  progress: number
  message: string
}

interface BacktestActions {
  setConfig: (config: BacktestConfig) => void
  resetConfig: () => void
  runBacktest: () => Promise<void>
  cancelBacktest: () => void
  setResult: (result: BacktestResult) => void
  clearResult: () => void
  loadHistory: () => Promise<void>
  deleteHistoryItem: (backtestId: string) => Promise<void>
  setProgress: (progress: number) => void
  setMessage: (message: string) => void
  clearMessage: () => void
  setIsRunning: (isRunning: boolean) => void
  resetAll: () => void
}

// ============================================================
// 默认配置
// ============================================================

const defaultConfig: BacktestConfig = {
  strategyId: 'dual_strategy',
  strategyName: '双策略组合',
  startDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
  endDate: Date.now(),
  initialCapital: 100000,
  commissionRate: 0.0003,
  stampDutyRate: 0.001,
  minCommission: 5,
  slippageRate: 0.001,
  maxPositions: 5,
  positionSize: 0.2,
}

const initialState: BacktestState = {
  config: null,
  result: null,
  metrics: null,
  curve: null,
  trades: [],
  history: [],
  isRunning: false,
  progress: 0,
  message: '',
}

// ============================================================
// Store 实现（含完整日志覆盖）
// ============================================================

export const useBacktestStore = create<BacktestState & BacktestActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 配置管理
      setConfig: (config) => {
        // 配置验证
        if (config.initialCapital <= 0) {
          logger.warn('setConfig/validationFailed', {
            reason: 'initialCapital 必须大于 0',
            value: config.initialCapital,
            timestamp: Date.now(),
          })
          set({ message: '初始资金必须大于 0' }, false, 'setConfig/validationFailed')
          return
        }

        if (config.startDate >= config.endDate) {
          logger.warn('setConfig/validationFailed', {
            reason: 'startDate 必须小于 endDate',
            startDate: config.startDate,
            endDate: config.endDate,
            timestamp: Date.now(),
          })
          set({ message: '起始日期必须小于结束日期' }, false, 'setConfig/validationFailed')
          return
        }

        logger.info('setConfig', { strategyId: config.strategyId, strategyName: config.strategyName })
        set({ config }, false, 'setConfig')
      },

      resetConfig: () => {
        logger.info('resetConfig', { timestamp: Date.now() })
        set({ config: null }, false, 'resetConfig')
      },

      // 运行回测
      runBacktest: async () => {
        const { config } = get()
        if (!config) {
          logger.warn('runBacktest/noConfig', { timestamp: Date.now() })
          set({ message: '请先配置回测参数' }, false, 'runBacktest/noConfig')
          return
        }

        logger.info('runBacktest/start', { strategyId: config.strategyId, timestamp: Date.now() })
        set({ isRunning: true, progress: 0, message: '' }, false, 'runBacktest/start')

        try {
          set({ progress: 20 }, false, 'runBacktest/progress')

          // 调用真实回测引擎
          const result = await runBacktestEngineService({
            config,
            persistResult: true,
            onProgress: (progress) => {
              // 映射引擎进度到 Store 进度（引擎进度 0-100，Store 显示 20-90）
              const storeProgress = 20 + Math.floor(progress * 0.7)
              set({ progress: storeProgress }, false, 'runBacktest/progress')
            },
          })

          set({ progress: 50 }, false, 'runBacktest/progress')
          set({ progress: 80 }, false, 'runBacktest/progress')

          if (result.success && result.data) {
            logger.info('runBacktest/success', {
              totalReturn: result.data.metrics.totalReturn,
              winRate: result.data.metrics.winRate,
              timestamp: Date.now(),
            })
            set(
              {
                result: result.data,
                metrics: result.data.metrics,
                curve: result.data.curve,
                trades: result.data.trades,
                isRunning: false,
                progress: 100,
                message: '',
              },
              false,
              'runBacktest/success'
            )
          } else {
            logger.warn('runBacktest/failed', { error: result.error ?? '回测失败', timestamp: Date.now() })
            set(
              {
                isRunning: false,
                progress: 0,
                message: result.error ?? '回测失败',
              },
              false,
              'runBacktest/error'
            )
          }
        } catch (err) {
          logger.error('runBacktest/exception', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          })
          set(
            {
              isRunning: false,
              progress: 0,
              message: err instanceof Error ? err.message : String(err),
            },
            false,
            'runBacktest/exception'
          )
        }
      },

      cancelBacktest: () => {
        const { isRunning } = get()
        if (!isRunning) {
          logger.warn('cancelBacktest/notRunning', { timestamp: Date.now() })
          set({ message: '当前无正在运行的回测' }, false, 'cancelBacktest/notRunning')
          return
        }

        logger.info('cancelBacktest/success', { timestamp: Date.now() })
        set({ isRunning: false, progress: 0, message: '回测已取消' }, false, 'cancelBacktest')
      },

      // 结果管理
      setResult: (result) => {
        logger.info('setResult', { totalTrades: result.trades.length, timestamp: Date.now() })
        set(
          {
            result,
            metrics: result.metrics,
            curve: result.curve,
            trades: result.trades,
          },
          false,
          'setResult'
        )
      },

      clearResult: () => {
        logger.info('clearResult', { timestamp: Date.now() })
        set(
          {
            result: null,
            metrics: null,
            curve: null,
            trades: [],
          },
          false,
          'clearResult'
        )
      },

      // 历史管理
      loadHistory: async () => {
        logger.info('loadHistory/start', { timestamp: Date.now() })
        set({ message: '' }, false, 'loadHistory/start')

        try {
          // 调用真实历史记录服务
          const result = await getBacktestHistoryService()

          if (result.success && result.data) {
            if (result.data.length === 0) {
              logger.info('loadHistory/empty', { count: 0, timestamp: Date.now() })
              set({ history: [], message: '暂无历史回测记录' }, false, 'loadHistory/empty')
            } else {
              logger.info('loadHistory/success', { count: result.data.length, timestamp: Date.now() })
              set({ history: result.data }, false, 'loadHistory/success')
            }
          } else {
            logger.warn('loadHistory/failed', { error: result.error ?? '加载历史失败', timestamp: Date.now() })
            set({ message: result.error ?? '加载历史失败' }, false, 'loadHistory/error')
          }
        } catch (err) {
          logger.error('loadHistory/exception', {
            error: err instanceof Error ? err.message : String(err),
          })
          set({ message: err instanceof Error ? err.message : String(err) }, false, 'loadHistory/exception')
        }
      },

      deleteHistoryItem: async (backtestId) => {
        const { history } = get()

        // 使用 executionTime 作为删除键
        const record = history.find((h) => h.summary.executionTime === Number(backtestId))
        if (!record) {
          logger.warn('deleteHistoryItem/notFound', {
            backtestId,
            historyCount: history.length,
            timestamp: Date.now(),
          })
          set({ message: '回测记录不存在' }, false, 'deleteHistoryItem/notFound')
          return
        }

        logger.info('deleteHistoryItem/start', { backtestId, timestamp: Date.now() })

        try {
          // 调用真实删除服务
          const result = await deleteBacktestService(record.summary.executionTime)

          if (result.success) {
            const updatedHistory = history.filter((h) => h.summary.executionTime !== record.summary.executionTime)
            logger.info('deleteHistoryItem/success', { backtestId, remaining: updatedHistory.length })
            set({ history: updatedHistory }, false, 'deleteHistoryItem/success')
          } else {
            logger.warn('deleteHistoryItem/failed', { error: result.error ?? '删除失败' })
            set({ message: result.error ?? '删除失败' }, false, 'deleteHistoryItem/error')
          }
        } catch (err) {
          logger.error('deleteHistoryItem/exception', { error: err instanceof Error ? err.message : String(err) })
          set({ message: err instanceof Error ? err.message : String(err) }, false, 'deleteHistoryItem/exception')
        }
      },

      // 状态更新
      setProgress: (progress) => {
        if (progress === 25 || progress === 50 || progress === 75 || progress === 100) {
          logger.info('setProgress/milestone', { progress, timestamp: Date.now() })
        }
        set({ progress }, false, 'setProgress')
      },

      setMessage: (message) => set({ message }, false, 'setMessage'),
      clearMessage: () => set({ message: '' }, false, 'clearMessage'),
      setIsRunning: (isRunning) => set({ isRunning }, false, 'setIsRunning'),

      // 重置全部
      resetAll: () => {
        logger.info('resetAll', { timestamp: Date.now() })
        set(initialState, false, 'resetAll')
      },
    }),
    { name: 'backtest-store' }
  )
)

// ============================================================
// 选择器导出
// ============================================================

export const selectConfig = (state: BacktestState): BacktestConfig | null => state.config
export const selectResult = (state: BacktestState): BacktestResult | null => state.result
export const selectMetrics = (state: BacktestState): BacktestMetrics | null => state.metrics
export const selectCurve = (state: BacktestState): BacktestCurve | null => state.curve
export const selectTrades = (state: BacktestState): BacktestTrade[] => state.trades
export const selectHistory = (state: BacktestState): BacktestResult[] => state.history
export const selectIsRunning = (state: BacktestState): boolean => state.isRunning
export const selectProgress = (state: BacktestState): number => state.progress
export const selectMessage = (state: BacktestState): string => state.message