/**
 * @test_id V9-TEST-ST-146
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockExportAll = vi.hoisted(() => vi.fn())
vi.mock('@/services/system/systemService', () => ({
  exportAll: mockExportAll,
}))

// ============================================================
// Imports
// ============================================================

import { useOutputStore, selectExportData, selectMessage, selectIsExporting } from './outputStore'

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useOutputStore.setState({
    exportData: '',
    message: '',
    isExporting: false,
  })
})

// ============================================================
// useOutputStore
// ============================================================

describe('useOutputStore', () => {
  it('初始状态验证', () => {
    const state = useOutputStore.getState()
    expect(state.exportData).toBe('')
    expect(state.message).toBe('')
    expect(state.isExporting).toBe(false)
  })

  it('setExportData: 设置导出数据', () => {
    useOutputStore.getState().setExportData('{"a":1}')
    expect(useOutputStore.getState().exportData).toBe('{"a":1}')
  })

  it('clearExportData: 清空导出数据', () => {
    useOutputStore.getState().setExportData('data')
    useOutputStore.getState().clearExportData()
    expect(useOutputStore.getState().exportData).toBe('')
  })

  it('setMessage: 设置消息', () => {
    useOutputStore.getState().setMessage('已导出')
    expect(useOutputStore.getState().message).toBe('已导出')
  })

  it('clearMessage: 清空消息', () => {
    useOutputStore.getState().setMessage('test')
    useOutputStore.getState().clearMessage()
    expect(useOutputStore.getState().message).toBe('')
  })

  it('setIsExporting: 切换导出状态', () => {
    useOutputStore.getState().setIsExporting(true)
    expect(useOutputStore.getState().isExporting).toBe(true)
    useOutputStore.getState().setIsExporting(false)
    expect(useOutputStore.getState().isExporting).toBe(false)
  })

  // ---- 异步动作 ----

  it('handleExport: 成功导出并填充数据', async () => {
    mockExportAll.mockResolvedValue({
      success: true,
      data: { foo: 'bar', count: 3 },
    })

    await useOutputStore.getState().handleExport()

    const state = useOutputStore.getState()
    expect(state.isExporting).toBe(false)
    expect(state.message).toBe('')
    expect(state.exportData).toContain('"foo"')
    expect(state.exportData).toContain('"bar"')
  })

  it('handleExport: 失败应设置错误消息', async () => {
    mockExportAll.mockResolvedValue({ success: false, error: '导出服务不可用' })

    await useOutputStore.getState().handleExport()

    const state = useOutputStore.getState()
    expect(state.isExporting).toBe(false)
    expect(state.exportData).toBe('')
    expect(state.message).toBe('导出服务不可用')
  })

  it('handleExport: 异常应被捕获', async () => {
    mockExportAll.mockRejectedValue(new Error('Network timeout'))

    await useOutputStore.getState().handleExport()

    const state = useOutputStore.getState()
    expect(state.isExporting).toBe(false)
    expect(state.message).toBe('Network timeout')
  })
})

// ============================================================
// Selectors
// ============================================================

describe('selectors', () => {
  it('selectExportData 返回 exportData', () => {
    useOutputStore.setState({ exportData: 'hello' })
    expect(selectExportData(useOutputStore.getState())).toBe('hello')
  })

  it('selectMessage 返回 message', () => {
    useOutputStore.setState({ message: 'msg' })
    expect(selectMessage(useOutputStore.getState())).toBe('msg')
  })

  it('selectIsExporting 返回 isExporting', () => {
    useOutputStore.setState({ isExporting: true })
    expect(selectIsExporting(useOutputStore.getState())).toBe(true)
  })
})
