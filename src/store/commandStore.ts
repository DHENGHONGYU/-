/**
 * 总控舱状态管理 Store
 * 
 * 功能：管理系统统计数据、操作消息、V6迁移面板状态
 * 数据流：CommandApp → commandStore → systemService → DataBridge
 * 
 * 状态结构：
 * - stats: 系统统计（股票数、订单数、评分数）
 * - message: 操作消息提示
 * - messageType: 消息类型（success/error/info）
 * - migrationOpen: V6迁移面板开关
 * - isLoading: 数据加载中标志
 * - isResetting: 数据重置中标志
 * 
 * 日志策略：
 * - INFO: 正常状态变更（设置统计、打开面板、开始加载）
 * - WARN: 业务逻辑异常（加载失败、重置失败）
 * - ERROR: 技术异常（网络错误、代码异常）
 */
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { loadSystemStats, resetAll } from '@/services/system/systemService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// 类型定义
interface SystemStats {
  stocks: number
  orders: number
  scores: number
}

interface CommandState {
  // 状态
  stats: SystemStats | null
  message: string
  messageType: 'success' | 'error' | 'info' | ''
  migrationOpen: boolean
  isLoading: boolean
  isResetting: boolean
  
  // 动作
  setStats: (stats: SystemStats) => void
  clearStats: () => void
  setMessage: (message: string, type?: 'success' | 'error' | 'info') => void
  clearMessage: () => void
  setMigrationOpen: (open: boolean) => void
  setIsLoading: (isLoading: boolean) => void
  setIsResetting: (isResetting: boolean) => void
  
  // 异步动作
  loadStats: () => Promise<void>
  resetAll: () => Promise<void>
}

// 初始状态
const initialState = {
  stats: null,
  message: '',
  messageType: '' as '' | 'success' | 'error' | 'info',
  migrationOpen: false,
  isLoading: false,
  isResetting: false,
}

// Store 创建（带 DevTools 中间件，便于调试）
/**
 * useCommandStore
 */
export const useCommandStore = create<CommandState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      // 设置统计数据
      setStats: (stats) => {
        logger.info('[commandStore] setStats', {
          stocks: stats.stocks,
          orders: stats.orders,
          scores: stats.scores,
        })
        set({ stats }, false, 'setStats')
      },

      // 清空统计数据
      clearStats: () => {
        logger.info('[commandStore] clearStats', { reason: '用户清空或重置失败' })
        set({ stats: null }, false, 'clearStats')
      },

      // 设置消息（带类型）
      setMessage: (message, type = 'info') => {
        logger.info('[commandStore] setMessage', { message, messageType: type })
        set({ message, messageType: type }, false, 'setMessage')
      },

      // 清空消息
      clearMessage: () => {
        logger.info('[commandStore] clearMessage', { reason: '操作成功，清空消息' })
        set({ message: '', messageType: '' }, false, 'clearMessage')
      },

      // 设置迁移面板开关
      setMigrationOpen: (open) => {
        logger.info('[commandStore] setMigrationOpen', { open })
        set({ migrationOpen: open }, false, 'setMigrationOpen')
      },

      // 设置加载状态
      setIsLoading: (isLoading) => {
        logger.info('[commandStore] setIsLoading', { isLoading })
        set({ isLoading }, false, 'setIsLoading')
      },

      // 设置重置状态
      setIsResetting: (isResetting) => {
        logger.info('[commandStore] setIsResetting', { isResetting })
        set({ isResetting }, false, 'setIsResetting')
      },

      // 异步动作：加载统计数据
      loadStats: async () => {
        logger.info('[commandStore] loadStats/start', { timestamp: Date.now() })
        set({ isLoading: true }, false, 'loadStats/start')

        try {
          const result = await loadSystemStats()
          logger.info('[commandStore] loadSystemStats/response', {
            success: result.success,
            hasData: !!result.data,
            error: result.error,
          })

          if (result.success && result.data) {
            logger.info('[commandStore] loadStats/success', {
              stocks: result.data.stocks,
              orders: result.data.orders,
              scores: result.data.scores,
              timestamp: Date.now(),
            })
            set({
              stats: {
                stocks: result.data.stocks,
                orders: result.data.orders,
                scores: result.data.scores,
              },
              isLoading: false,
              message: '',
              messageType: '',
            }, false, 'loadStats/success')
          } else {
            logger.warn('[commandStore] loadStats/failed', {
              error: result.error ?? '加载统计失败',
              timestamp: Date.now(),
            })
            set({
              isLoading: false,
              message: result.error ?? '加载统计失败',
              messageType: 'error',
            }, false, 'loadStats/error')
          }
        } catch (err) {
          logger.error('[commandStore] loadStats/exception', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            timestamp: Date.now(),
          })
          set({
            isLoading: false,
            message: err instanceof Error ? err.message : String(err),
            messageType: 'error',
          }, false, 'loadStats/error')
        }
      },

      // 异步动作：重置所有数据
      resetAll: async () => {
        logger.info('[commandStore] resetAll/start', { timestamp: Date.now() })
        set({ isResetting: true }, false, 'resetAll/start')

        try {
          const result = await resetAll()
          logger.info('[commandStore] resetAll/response', {
            success: result.success,
            error: result.error,
          })

          if (result.success) {
            // 重置成功后自动刷新统计
            const statsResult = await loadSystemStats()
            logger.info('[commandStore] resetAll/statsRefresh', {
              statsSuccess: statsResult.success,
              statsData: statsResult.success && statsResult.data ? {
                stocks: statsResult.data.stocks,
                orders: statsResult.data.orders,
                scores: statsResult.data.scores,
              } : null,
            })

            set({
              isResetting: false,
              stats: statsResult.success && statsResult.data ? {
                stocks: statsResult.data.stocks,
                orders: statsResult.data.orders,
                scores: statsResult.data.scores,
              } : null,
              message: '已重置所有数据',
              messageType: 'success',
            }, false, 'resetAll/success')
          } else {
            logger.warn('[commandStore] resetAll/failed', {
              error: result.error ?? '重置失败',
              timestamp: Date.now(),
            })
            set({
              isResetting: false,
              message: result.error ?? '重置失败',
              messageType: 'error',
            }, false, 'resetAll/error')
          }
        } catch (err) {
          logger.error('[commandStore] resetAll/exception', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            timestamp: Date.now(),
          })
          set({
            isResetting: false,
            message: err instanceof Error ? err.message : String(err),
            messageType: 'error',
          }, false, 'resetAll/error')
        }
      },
    }),
    { name: 'command-store' }
  )
)

// 导出选择器（用于组件中只订阅需要的状态）
/**
 * selectStats
 */
export const selectStats = (state: CommandState) => state.stats
/**
 * selectMessage
 */
export const selectMessage = (state: CommandState) => state.message
/**
 * selectMessageType
 */
export const selectMessageType = (state: CommandState) => state.messageType
/**
 * selectMigrationOpen
 */
export const selectMigrationOpen = (state: CommandState) => state.migrationOpen
/**
 * selectIsLoading
 */
export const selectIsLoading = (state: CommandState) => state.isLoading
/**
 * selectIsResetting
 */
export const selectIsResetting = (state: CommandState) => state.isResetting