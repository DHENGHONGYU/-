/**
 * 验证 outputStore 数据导出状态管理
 *
 * 覆盖场景：
 * 1. handleExport 导出数据成功
 * 2. handleExport 导出失败（service 返回 error）
 * 3. handleExport 导出异常（网络错误）
 * 4. setExportData/clearExportData 状态更新
 * 5. setMessage/clearMessage 消息管理
 * 6. setIsExporting 导出状态控制
 * 7. 选择器订阅测试
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useOutputStore, selectExportData, selectMessage, selectIsExporting } from '@/store/outputStore'
import { exportAll } from '@/services/system/systemService'

// Mock exportAll service
vi.mock('@/services/system/systemService', () => ({
  exportAll: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // 重置 Store 状态
  useOutputStore.setState({
    exportData: '',
    message: '',
    isExporting: false,
  })
})

describe('outputStore — 数据导出状态管理', () => {
  describe('handleExport', () => {
    it('导出数据成功时更新 exportData 并清空 message', async () => {
      const mockData = {
        stocks: [{ symbol: '600519', name: '贵州茅台' }],
        orders: [],
        scores: [],
      }

      vi.mocked(exportAll).mockResolvedValueOnce({
        success: true,
        data: mockData,
      })

      await useOutputStore.getState().handleExport()

      expect(useOutputStore.getState().exportData).toContain('600519')
      expect(useOutputStore.getState().exportData).toContain('贵州茅台')
      expect(useOutputStore.getState().message).toBe('')
      expect(useOutputStore.getState().isExporting).toBe(false)

      // 验证 service 被调用
      expect(exportAll).toHaveBeenCalledTimes(1)
    })

    it('导出失败时设置 error message 并清空 exportData', async () => {
      vi.mocked(exportAll).mockResolvedValueOnce({
        success: false,
        error: '数据库连接失败',
      })

      await useOutputStore.getState().handleExport()

      expect(useOutputStore.getState().exportData).toBe('')
      expect(useOutputStore.getState().message).toBe('数据库连接失败')
      expect(useOutputStore.getState().isExporting).toBe(false)
    })

    it('导出异常时捕获错误并设置 message', async () => {
      vi.mocked(exportAll).mockRejectedValueOnce(new Error('Network request failed'))

      await useOutputStore.getState().handleExport()

      expect(useOutputStore.getState().exportData).toBe('')
      expect(useOutputStore.getState().message).toBe('Network request failed')
      expect(useOutputStore.getState().isExporting).toBe(false)
    })

    it('导出开始时设置 isExporting 为 true', async () => {
      // 模拟长时间导出
      vi.mocked(exportAll).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      const promise = useOutputStore.getState().handleExport()

      // 立即检查 isExporting 状态
      expect(useOutputStore.getState().isExporting).toBe(true)

      // 等待导出完成
      await promise
      expect(useOutputStore.getState().isExporting).toBe(false)
    })
  })

  describe('setExportData/clearExportData', () => {
    it('setExportData 更新导出数据', () => {
      const testData = JSON.stringify({ test: 'data' }, null, 2)
      useOutputStore.getState().setExportData(testData)

      expect(useOutputStore.getState().exportData).toBe(testData)
    })

    it('clearExportData 清空导出数据', () => {
      useOutputStore.getState().setExportData('some data')
      useOutputStore.getState().clearExportData()

      expect(useOutputStore.getState().exportData).toBe('')
    })
  })

  describe('setMessage/clearMessage', () => {
    it('setMessage 更新消息', () => {
      useOutputStore.getState().setMessage('测试消息')

      expect(useOutputStore.getState().message).toBe('测试消息')
    })

    it('clearMessage 清空消息', () => {
      useOutputStore.getState().setMessage('some message')
      useOutputStore.getState().clearMessage()

      expect(useOutputStore.getState().message).toBe('')
    })
  })

  describe('setIsExporting', () => {
    it('setIsExporting 更新导出状态', () => {
      useOutputStore.getState().setIsExporting(true)
      expect(useOutputStore.getState().isExporting).toBe(true)

      useOutputStore.getState().setIsExporting(false)
      expect(useOutputStore.getState().isExporting).toBe(false)
    })
  })
})

describe('outputStore — 选择器订阅测试', () => {
  it('selectExportData 返回当前导出数据', () => {
    useOutputStore.getState().setExportData('test data')

    const selectedData = selectExportData(useOutputStore.getState())
    expect(selectedData).toBe('test data')
  })

  it('selectMessage 返回当前消息', () => {
    useOutputStore.getState().setMessage('test message')

    const selectedMessage = selectMessage(useOutputStore.getState())
    expect(selectedMessage).toBe('test message')
  })

  it('selectIsExporting 返回当前导出状态', () => {
    useOutputStore.getState().setIsExporting(true)

    const selectedIsExporting = selectIsExporting(useOutputStore.getState())
    expect(selectedIsExporting).toBe(true)
  })
})

describe('outputStore — 日志输出验证', () => {
  it('handleExport 成功时输出 INFO 日志', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    vi.mocked(exportAll).mockResolvedValueOnce({
      success: true,
      data: { stocks: [], orders: [], scores: [] },
    })

    await useOutputStore.getState().handleExport()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] [outputStore] handleExport/start'),
      expect.any(Object)
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] [outputStore] handleExport/success'),
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })

  it('handleExport 失败时输出 WARN 日志', async () => {
    const consoleSpy = vi.spyOn(console, 'warn')

    vi.mocked(exportAll).mockResolvedValueOnce({
      success: false,
      error: '导出失败',
    })

    await useOutputStore.getState().handleExport()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] [outputStore] handleExport/failed'),
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })

  it('handleExport 异常时输出 ERROR 日志', async () => {
    const consoleSpy = vi.spyOn(console, 'error')

    vi.mocked(exportAll).mockRejectedValueOnce(new Error('Network error'))

    await useOutputStore.getState().handleExport()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] [outputStore] handleExport/exception'),
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })
})

describe('outputStore — JSON 格式化验证', () => {
  it('导出数据使用 JSON.stringify 格式化', async () => {
    const mockData: Record<string, unknown[]> = {
      nested: [{ key: 'value', number: 123 }],
    }

    vi.mocked(exportAll).mockResolvedValueOnce({
      success: true,
      data: mockData,
    })

    await useOutputStore.getState().handleExport()

    const exportData = useOutputStore.getState().exportData

    // 验证格式化（包含换行和缩进）
    expect(exportData).toContain('{\n')
    expect(exportData).toContain('  "nested"')

    // 验证可解析
    const parsed = JSON.parse(exportData)
    expect(parsed.nested[0].key).toBe('value')
    expect(parsed.nested[0].number).toBe(123)
  })
})