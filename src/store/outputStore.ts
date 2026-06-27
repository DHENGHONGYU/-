/**
 * 输出舱状态管理 Store
 * 
 * 功能：管理数据导出状态、消息提示、导出进度
 * 数据流：OutputApp → outputStore → systemService → DataBridge
 * 
 * 状态结构：
 * - exportData: 导出的 JSON 数据（字符串格式）
 * - message: 操作消息提示
 * - isExporting: 导出进行中标志
 * 
 * 日志策略：
 * - INFO: 正常状态变更（开始导出、设置数据、清空数据）
 * - WARN: 业务逻辑异常（导出失败）
 * - ERROR: 技术异常（网络错误、代码异常）
 */
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { exportAll } from '@/services/system/systemService'

// 日志工具函数
const logger = {
  info: (action: string, detail: Record<string, unknown>) => {
    console.log(`[outputStore] INFO: ${action}`, detail)
  },
  warn: (action: string, detail: Record<string, unknown>) => {
    console.warn(`[outputStore] WARN: ${action}`, detail)
  },
  error: (action: string, detail: Record<string, unknown>) => {
    console.error(`[outputStore] ERROR: ${action}`, detail)
  },
}

interface OutputState {
  // 状态
  exportData: string
  message: string
  isExporting: boolean
  
  // 动作
  setExportData: (data: string) => void
  clearExportData: () => void
  setMessage: (message: string) => void
  clearMessage: () => void
  setIsExporting: (isExporting: boolean) => void
  
  // 异步动作（封装 service 调用）
  handleExport: () => Promise<void>
}

const initialState = {
  exportData: '',
  message: '',
  isExporting: false,
}

export const useOutputStore = create<OutputState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      // 设置导出数据
      setExportData: (data) => {
        logger.info('setExportData', { 
          dataLength: data.length,
          preview: data.substring(0, 100) + '...' 
        })
        set({ exportData: data }, false, 'setExportData')
      },
      
      // 清空导出数据
      clearExportData: () => {
        logger.info('clearExportData', { reason: '用户清空或导出失败' })
        set({ exportData: '' }, false, 'clearExportData')
      },
      
      // 设置消息
      setMessage: (message) => {
        logger.info('setMessage', { message })
        set({ message }, false, 'setMessage')
      },
      
      // 清空消息
      clearMessage: () => {
        logger.info('clearMessage', { reason: '导出成功，清空错误消息' })
        set({ message: '' }, false, 'clearMessage')
      },
      
      // 设置导出状态
      setIsExporting: (isExporting) => {
        logger.info('setIsExporting', { isExporting })
        set({ isExporting }, false, 'setIsExporting')
      },
      
      // 异步动作：导出全部数据
      handleExport: async () => {
        logger.info('handleExport/start', { timestamp: Date.now() })
        set({ isExporting: true }, false, 'handleExport/start')
        
        try {
          const result = await exportAll()
          logger.info('exportAll/response', { 
            success: result.success,
            hasData: !!result.data,
            error: result.error 
          })
          
          if (result.success && result.data) {
            const jsonStr = JSON.stringify(result.data, null, 2)
            logger.info('handleExport/success', { 
              dataLength: jsonStr.length,
              keysCount: Object.keys(result.data).length,
              preview: jsonStr.substring(0, 200) + '...' 
            })
            set({
              exportData: jsonStr,
              message: '',
              isExporting: false,
            }, false, 'handleExport/success')
          } else {
            logger.warn('handleExport/failed', { 
              error: result.error ?? '导出失败',
              timestamp: Date.now() 
            })
            set({
              exportData: '',
              message: result.error ?? '导出失败',
              isExporting: false,
            }, false, 'handleExport/error')
          }
        } catch (err) {
          logger.error('handleExport/exception', { 
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            timestamp: Date.now() 
          })
          set({
            exportData: '',
            message: err instanceof Error ? err.message : String(err),
            isExporting: false,
          }, false, 'handleExport/error')
        }
      },
    }),
    { name: 'output-store' }
  )
)

// 导出选择器（用于组件中只订阅需要的状态）
export const selectExportData = (state: OutputState) => state.exportData
export const selectMessage = (state: OutputState) => state.message
export const selectIsExporting = (state: OutputState) => state.isExporting