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

  // ---- P0-1 回归测试:锁定变量名混淆缺陷(result vs statsResult) ----

  it('P0-1 回归: 非零统计数据验证 statsResult.data 被正确读取', async () => {
    // Arrange: 使用非零值,确保不与 undefined/0 混淆
    mockResetAll.mockResolvedValue({ success: true })
    mockLoadSystemStats.mockResolvedValue({
      success: true,
      data: { stocks: 7, orders: 13, scores: 21 },
    })

    // Act
    await useCommandStore.getState().resetAll()

    // Assert: stats 应严格等于 statsResult.data 的非零值
    const state = useCommandStore.getState()
    expect(state.stats).toEqual({ stocks: 7, orders: 13, scores: 21 })
    expect(state.messageType).toBe('success')
    expect(mockLoadSystemStats).toHaveBeenCalledTimes(1)
  })

  it('P0-1 回归: resetAll 返回值若误带 data 字段不被采纳', async () => {
    // Arrange: result 携带 999 的 data,statsResult 携带 0 的 data
    // 若代码误用 result.data,则 stats 会变成 999 而非 0
    mockResetAll.mockResolvedValue({
      success: true,
      data: { stocks: 999, orders: 999, scores: 999 },
    })
    mockLoadSystemStats.mockResolvedValue({
      success: true,
      data: { stocks: 0, orders: 0, scores: 0 },
    })

    // Act
    await useCommandStore.getState().resetAll()

    // Assert: stats 应取自 statsResult.data(0)而非 result.data(999)
    const state = useCommandStore.getState()
    expect(state.stats).toEqual({ stocks: 0, orders: 0, scores: 0 })
    expect(state.stats).not.toEqual({ stocks: 999, orders: 999, scores: 999 })
  })

  it('P0-1 回归: 调用顺序验证(resetAll 先于 loadSystemStats)', async () => {
    // Arrange
    mockResetAll.mockResolvedValue({ success: true })
    mockLoadSystemStats.mockResolvedValue({
      success: true,
      data: { stocks: 7, orders: 13, scores: 21 },
    })

    // Act
    await useCommandStore.getState().resetAll()

    // Assert: resetAll 必须先于 loadSystemStats 调用(通过 invocationCallOrder 比较调用次序)
    // 非空断言:下方 toHaveBeenCalledTimes(1) 已确保两者各调用一次,invocationCallOrder[0] 必存在
    expect(mockResetAll.mock.invocationCallOrder[0]!).toBeLessThan(
      mockLoadSystemStats.mock.invocationCallOrder[0]!,
    )
    expect(mockResetAll).toHaveBeenCalledTimes(1)
    expect(mockLoadSystemStats).toHaveBeenCalledTimes(1)
  })

  it('P0-1 回归: resetAll 失败分支不应调用 loadSystemStats', async () => {
    // Arrange: resetAll 返回失败
    mockResetAll.mockResolvedValue({ success: false, error: '权限不足' })

    // Act
    await useCommandStore.getState().resetAll()

    // Assert: 失败分支不应触发统计刷新
    const state = useCommandStore.getState()
    expect(mockLoadSystemStats).not.toHaveBeenCalled()
    expect(state.messageType).toBe('error')
    expect(state.message).toBe('权限不足')
  })

  it('P0-1 回归: 日志参数结构断言(早期暴露 statsResult 读取缺陷)', async () => {
    // Arrange
    mockResetAll.mockResolvedValue({ success: true })
    mockLoadSystemStats.mockResolvedValue({
      success: true,
      data: { stocks: 7, orders: 13, scores: 21 },
    })

    // Act
    await useCommandStore.getState().resetAll()

    // Assert 1: statsRefresh 日志应携带来自 statsResult.data 的非零字段
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[commandStore] resetAll/statsRefresh',
      expect.objectContaining({
        statsData: expect.objectContaining({
          stocks: 7,
          orders: 13,
          scores: 21,
        }),
      }),
    )

    // Assert 2: start 与 response 日志也应被调用(前缀匹配)
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[commandStore] resetAll/start'),
      expect.anything(),
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[commandStore] resetAll/response'),
      expect.anything(),
    )
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
