import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useInputHubStore } from './inputHubStore'

// vi.mock 工厂内不能引用外部变量（会被 hoist）→ 用 vi.hoisted
const { mockDataBridgeQuery } = vi.hoisted(() => ({
  mockDataBridgeQuery: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { query: mockDataBridgeQuery, forward: vi.fn(), subscribe: vi.fn() },
}))
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

describe('inputHubStore', () => {
  beforeEach(() => {
    mockDataBridgeQuery.mockReset()
    mockDataBridgeQuery.mockResolvedValue({ success: true, data: [] })
    useInputHubStore.getState().reset()
  })

  test('初始状态', () => {
    const state = useInputHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
    expect(state.searchResults).toEqual([])
    expect(state.isAddingStock).toBe(false)
  })

  test('setActiveModule 更新当前模块', () => {
    useInputHubStore.getState().setActiveModule('/input/hub')
    expect(useInputHubStore.getState().activeModule).toBe('/input/hub')
  })

  test('setLoading 切换加载状态', () => {
    useInputHubStore.getState().setLoading(true)
    expect(useInputHubStore.getState().loading).toBe(true)
    useInputHubStore.getState().setLoading(false)
    expect(useInputHubStore.getState().loading).toBe(false)
  })

  test('searchStocks: 全市场搜索返回带市场标记的结果', async () => {
    // 即使 DB 为空，本地字典也能返回结果
    mockDataBridgeQuery.mockResolvedValueOnce({ success: true, data: [] })

    const results = await useInputHubStore.getState().searchStocks('600519')
    expect(results).toBeInstanceOf(Array)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.symbol).toBe('600519')
    expect(results[0]!.name).toBe('贵州茅台')
    // industry 字段现在携带市场标记
    expect(results[0]!.industry).toBe('SH')
    expect(useInputHubStore.getState().searchResults).toEqual(results)
  })

  test('searchStocks: 代码前缀匹配', async () => {
    mockDataBridgeQuery.mockResolvedValueOnce({ success: true, data: [] })
    const results = await useInputHubStore.getState().searchStocks('6005')
    expect(results.length).toBeGreaterThan(0)
    // 所有结果应为 6005xx 开头的股票
    results.forEach((r) => {
      expect(r.symbol.startsWith('6005')).toBe(true)
    })
  })

  test('searchStocks: 名称前缀匹配', async () => {
    mockDataBridgeQuery.mockResolvedValueOnce({ success: true, data: [] })
    const results = await useInputHubStore.getState().searchStocks('贵州')
    expect(results.length).toBeGreaterThan(0)
    // 应匹配到贵州茅台
    const maotai = results.find((r) => r.symbol === '600519')
    expect(maotai).toBeDefined()
    expect(maotai!.name).toBe('贵州茅台')
  })

  test('reset: 重置所有状态', () => {
    useInputHubStore.getState().setActiveModule('/x')
    useInputHubStore.getState().setLoading(true)
    useInputHubStore.getState().reset()
    const state = useInputHubStore.getState()
    expect(state.activeModule).toBe('')
    expect(state.loading).toBe(false)
    expect(state.searchResults).toEqual([])
    expect(state.isAddingStock).toBe(false)
  })
})