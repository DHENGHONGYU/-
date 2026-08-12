/**
 * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
 */
import { create } from 'zustand'
import { exportAll } from '@/services/system/systemService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface OutputState {
  exportData: string
  message: string
  isExporting: boolean
}

interface OutputActions {
  setExportData: (data: string) => void
  clearExportData: () => void
  setMessage: (message: string) => void
  clearMessage: () => void
  setIsExporting: (isExporting: boolean) => void
  handleExport: () => Promise<void>
}

/**
 * useOutputStore
 */
export const useOutputStore = create<OutputState & OutputActions>((set) => ({
  exportData: '',
  message: '',
  isExporting: false,

  setExportData: (exportData) => set({ exportData }),
  clearExportData: () => set({ exportData: '' }),
  setMessage: (message) => set({ message }),
  clearMessage: () => set({ message: '' }),
  setIsExporting: (isExporting) => set({ isExporting }),

  handleExport: async () => {
    set({ isExporting: true, message: '' })
    logger.info('[outputStore] handleExport/start', { timestamp: Date.now() })

    try {
      const result = await exportAll()

      if (result.success && result.data) {
        const formatted = JSON.stringify(result.data, null, 2)
        set({ exportData: formatted, isExporting: false, message: '' })
        logger.info('[outputStore] handleExport/success', { timestamp: Date.now() })
      } else {
        const message = result.error ?? '导出失败'
        set({ exportData: '', isExporting: false, message })
        logger.warn('[outputStore] handleExport/failed', { message, timestamp: Date.now() })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ exportData: '', isExporting: false, message })
      logger.error('[outputStore] handleExport/exception', { message, timestamp: Date.now() })
    }
  },
}))

/**
 * selectExportData
 */
export const selectExportData = (state: OutputState): string => state.exportData
/**
 * selectMessage
 */
export const selectMessage = (state: OutputState): string => state.message
/**
 * selectIsExporting
 */
export const selectIsExporting = (state: OutputState): boolean => state.isExporting
