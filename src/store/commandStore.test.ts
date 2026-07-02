import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockLoadSystemStats = vi.hoisted(() => vi.fn())
const mockResetAll = vi.hoisted(() => vi.fn())

vi.mock('@/services/system/systemService', () => ({
  loadSystemStats: mockLoadSystemStats,
  resetAll: mockResetAll,
}))

// ============================================================
// Imports
// ============================================================

import {
  useCommandStore,
  selectStats,
  selectMessage,
  selectMessageType,
  selectMigrationOpen,
  selectIsLoading,
  selectIsResetting,
} from './commandStore'

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useCommandStore.setState({
    stats: null,
    message: '',
    messageType: '',
    migrationOpen: false,
    isLoading: false,
    isResetting: false,
  })
})

// ============================================================
// useCommandStore
// ============================================================

describe('useCommandStore', () => {
  it('初始状态验证', () => {
    const state = useCommandStore.getState()
    expect(state.stats).toBeNull()
    expect(state.message).toBe('')
    expect(state.messageType).toBe('')
    expect(state.migrationOpen).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(state.isResetting).toBe(false)
  })

  it('setStats: 设置统计数据', () => {
    const stats = { stocks: 10, orders: 20, scores: 30 }
    useCommandStore.getState().setStats(stats)

    expect(useCommandStore.getState().stats).toEqual(stats)
  })

  it('clearStats: 清空统计数据', () => {
    useCommandStore.getState().setStats({ stocks: 1, orders: 2, scores: 3 })
    useCommandStore.getState().clearStats()

    expect(useCommandStore.getState().stats).toBeNull()
  })

  it('setMessage: 设置消息和类型', () => {
    useCommandStore.getState().setMessage('操作成功', 'success')
    expect(useCommandStore.getState().message).toBe('操作成功')
    expect(useCommandStore.getState().messageType).toBe('success')

    useCommandStore.getState().setMessage('出错了', 'error')
    expect(useCommandStore.getState().message).toBe('出错了')
    expect(useCommandStore.getState().messageType).toBe('error')
  })

  it('setMessage: 默认类型为 info', () => {
    useCommandStore.getState().setMessage('提示')
    expect(useCommandStore.getState().messageType).toBe('info')
  })

  it('clearMessage: 清空消息', () => {
    useCommandStore.getState().setMessage('test', 'error')
    useCommandStore.getState().clearMessage()

    expect(useCommandStore.getState().message).toBe('')
    expect(useCommandStore.getState().messageType).toBe('')
  })

  it('setMigrationOpen: 切换迁移面板', () => {
    useCommandStore.getState().setMigrationOpen(true)
    expect(useCommandStore.getState().migrationOpen).toBe(true)

    useCommandStore.getState().setMigrationOpen(false)
    expect(useCommandStore.getState().migrationOpen).toBe(false)
  })

  it('setIsLoading: 更新加载状态', () => {
    useCommandStore.getState().setIsLoading(true)
    expect(useCommandStore.getState().isLoading).toBe(true)

    useCommandStore.getState().setIsLoading(false)
    expect(useCommandStore.getState().isLoading).toBe(false)
  })

  it('setIsResetting: 更新重置状态', () => {
    useCommandStore.getState().setIsResetting(true)
    expect(useCommandStore.getState().isResetting).toBe(true)

    useCommandStore.getState().setIsResetting(false)
    expect(useCommandStore.getState().isResetting).toBe(false)
  })

  // ---- 异步动作 ----

  it('loadStats: 成功加载统计', async () => {
    mockLoadSystemStats.mockResolvedValue({
      success: true,
      data: { stocks: 100, orders: 200, scores: 300 },
    })

    await useCommandStore.getState().loadStats()

    const state = useCommandStore.getState()
    expect(state.stats).toEqual({ stocks: 100, orders: 200, scores: 300 })
    expect(state.isLoading).toBe(false)
    expect(state.message).toBe('')
    expect(state.messageType).toBe('')
  })

  it('loadStats: 加载失败应设置错误消息', async () => {
    mockLoadSystemStats.mockResolvedValue({
      success: false,
      error: '服务不可用',
    })

    await useCommandStore.getState().loadStats()

    const state = useCommandStore.getState()
    expect(state.stats).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.message).toBe('服务不可用')
    expect(state.messageType).toBe('error')
  })

  it('loadStats: 异常应设置错误消息', async () => {
    mockLoadSystemStats.mockRejectedValue(new Error('Network error'))

    await useCommandStore.getState().loadStats()

    const state = useCommandStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.message).toBe('Network error')
    expect(state.messageType).toBe('error')
  })

  it('loadStats: 非 Error 异常应转为字符串', async () => {
    mockLoadSystemStats.mockRejectedValue('timeout')

    await useCommandStore.getState().loadStats()

    expect(useCommandStore.getState().message).toBe('timeout')
  })

  it('resetAll: 成功重置并刷新统计', async () => {
    mockResetAll.mockResolvedValue({ success: true })
    mockLoadSystemStats.mockResolvedValue({
      success: true,
      data: { stocks: 0, orders: 0, scores: 0 },
    })

    await useCommandStore.getState().resetAll()

    const state = useCommandStore.getState()
    expect(state.isResetting).toBe(false)
    expect(state.stats).toEqual({ stocks: 0, orders: 0, scores: 0 })
    expect(state.message).toBe('已重置所有数据')
    expect(state.messageType).toBe('success')
  })

  it('resetAll: resetAll 失败应设置错误消息', async () => {
    mockResetAll.mockResolvedValue({ success: false, error: '重置服务错误' })

    await useCommandStore.getState().resetAll()

    const state = useCommandStore.getState()
    expect(state.isResetting).toBe(false)
    expect(state.message).toBe('重置服务错误')
    expect(state.messageType).toBe('error')
  })

  it('resetAll: 重置成功但刷新统计失败时应保留 stats 为 null', async () => {
    mockResetAll.mockResolvedValue({ success: true })
    mockLoadSystemStats.mockResolvedValue({ success: false, error: '刷新失败' })

    await useCommandStore.getState().resetAll()

    const state = useCommandStore.getState()
    expect(state.isResetting).toBe(false)
    expect(state.stats).toBeNull()
    expect(state.message).toBe('已重置所有数据')
    expect(state.messageType).toBe('success')
  })

  it('resetAll: 异常应设置错误消息', async () => {
    mockResetAll.mockRejectedValue(new Error('Critical error'))

    await useCommandStore.getState().resetAll()

    const state = useCommandStore.getState()
    expect(state.isResetting).toBe(false)
    expect(state.message).toBe('Critical error')
    expect(state.messageType).toBe('error')
  })

  it('resetAll: 非 Error 异常应转为字符串', async () => {
    mockResetAll.mockRejectedValue('fail')

    await useCommandStore.getState().resetAll()

    expect(useCommandStore.getState().message).toBe('fail')
  })
})

// ============================================================
// Selectors
// ============================================================

describe('selectors', () => {
  it('selectStats 返回 stats', () => {
    const stats = { stocks: 1, orders: 2, scores: 3 }
    useCommandStore.setState({ stats })
    expect(selectStats(useCommandStore.getState())).toEqual(stats)
  })

  it('selectMessage 返回 message', () => {
    useCommandStore.setState({ message: 'hello' })
    expect(selectMessage(useCommandStore.getState())).toBe('hello')
  })

  it('selectMessageType 返回 messageType', () => {
    useCommandStore.setState({ messageType: 'error' })
    expect(selectMessageType(useCommandStore.getState())).toBe('error')
  })

  it('selectMigrationOpen 返回 migrationOpen', () => {
    useCommandStore.setState({ migrationOpen: true })
    expect(selectMigrationOpen(useCommandStore.getState())).toBe(true)
  })

  it('selectIsLoading 返回 isLoading', () => {
    useCommandStore.setState({ isLoading: true })
    expect(selectIsLoading(useCommandStore.getState())).toBe(true)
  })

  it('selectIsResetting 返回 isResetting', () => {
    useCommandStore.setState({ isResetting: true })
    expect(selectIsResetting(useCommandStore.getState())).toBe(true)
  })
})
