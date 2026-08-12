/**
 * @test_id V9-TEST-ST-140
 * inputHubStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. setActiveModule 更新当前模块
 * 3. setLoading 切换加载状态
 * 4. searchStocks: 全市场搜索返回带市场标记的结果
 * 5. searchStocks: 代码前缀匹配
 * 6. searchStocks: 名称前缀匹配
 * 7. reset: 重置所有状态
 * 8. refreshExistingSymbols: 成功路径（result.success=true + data）
 * 9. refreshExistingSymbols: 失败路径（result.success=false）
 * 10. refreshExistingSymbols: 异常静默处理
 * 11. addStockFromSearch: 成功路径
 * 12. addStockFromSearch: 失败路径（service 抛异常）
 * 13. addStockFromSearch: 非 Error 类型异常
 * @covers_docs []
 */
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { useInputHubStore } from './inputHubStore'

// ============================================================
// vi.hoisted mocks
// ============================================================

const { mockListStocks, mockAddStockFromSearchService, mockDataBridgeQuery } = vi.hoisted(() => ({
  mockListStocks: vi.fn(),
  mockAddStockFromSearchService: vi.fn(),
  mockDataBridgeQuery: vi.fn(),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { query: mockDataBridgeQuery, forward: vi.fn(), subscribe: vi.fn() },
}))
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))
// 只 mock listStocks 和 addStockFromSearch，保留 searchStocks 真实实现（依赖本地字典）
vi.mock('@/services/input/inputService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/input/inputService')>()
  return {
    ...actual,
    listStocks: mockListStocks,
    addStockFromSearch: mockAddStockFromSearchService,
  }
})

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  mockDataBridgeQuery.mockResolvedValue({ success: true, data: [] })
  mockListStocks.mockResolvedValue({ success: true, data: [] })
  useInputHubStore.getState().reset()
})

describe('inputHubStore', () => {
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

// ============================================================
// refreshExistingSymbols
// ============================================================

describe('refreshExistingSymbols', () => {
  /** @test_id V9-TEST-ST-140-refresh-01 */
  test('成功路径：result.success=true + data → 更新 existingSymbols', async () => {
    mockListStocks.mockResolvedValue({
      success: true,
      data: [
        { symbol: '600519', name: '贵州茅台' },
        { symbol: '000001', name: '平安银行' },
        { symbol: '600519', name: '贵州茅台' }, // 重复
      ],
    })

    await useInputHubStore.getState().refreshExistingSymbols()

    const existing = useInputHubStore.getState().existingSymbols
    expect(existing).toBeInstanceOf(Set)
    expect(existing.has('600519')).toBe(true)
    expect(existing.has('000001')).toBe(true)
    expect(existing.size).toBe(2) // 去重
  })

  /** @test_id V9-TEST-ST-140-refresh-02 */
  test('失败路径：result.success=false → existingSymbols 不变', async () => {
    mockListStocks.mockResolvedValue({ success: false, error: 'DB error', data: undefined })

    await useInputHubStore.getState().refreshExistingSymbols()

    const existing = useInputHubStore.getState().existingSymbols
    expect(existing).toBeInstanceOf(Set)
    expect(existing.size).toBe(0)
  })

  /** @test_id V9-TEST-ST-140-refresh-03 */
  test('异常静默处理：service 抛异常 → 不影响状态', async () => {
    mockListStocks.mockRejectedValue(new Error('网络错误'))

    // 不应抛出
    await expect(useInputHubStore.getState().refreshExistingSymbols()).resolves.toBeUndefined()

    const existing = useInputHubStore.getState().existingSymbols
    expect(existing.size).toBe(0)
  })

  /** @test_id V9-TEST-ST-140-refresh-04 */
  test('空 data → existingSymbols 为空 Set', async () => {
    mockListStocks.mockResolvedValue({ success: true, data: [] })

    await useInputHubStore.getState().refreshExistingSymbols()

    expect(useInputHubStore.getState().existingSymbols.size).toBe(0)
  })
})

// ============================================================
// addStockFromSearch
// ============================================================

describe('addStockFromSearch', () => {
  /** @test_id V9-TEST-ST-140-add-01 */
  test('成功路径：返回 service 结果 + isAddingStock 重置', async () => {
    const mockStock = { symbol: '600519', name: '贵州茅台' }
    mockAddStockFromSearchService.mockResolvedValue({
      success: true as const,
      data: mockStock,
    })

    const searchResult = { symbol: '600519', name: '贵州茅台', industry: 'SH' }
    const result = await useInputHubStore.getState().addStockFromSearch(searchResult)

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockStock)
    expect(useInputHubStore.getState().isAddingStock).toBe(false)
    expect(mockAddStockFromSearchService).toHaveBeenCalledWith(searchResult, undefined)
  })

  /** @test_id V9-TEST-ST-140-add-02 */
  test('成功路径：传递 options 参数', async () => {
    const mockStock = { symbol: '000001', name: '平安银行' }
    mockAddStockFromSearchService.mockResolvedValue({
      success: true as const,
      data: mockStock,
    })

    const searchResult = { symbol: '000001', name: '平安银行', industry: 'SZ' }
    const options = { group: 'default' }
    const result = await useInputHubStore.getState().addStockFromSearch(searchResult, options)

    expect(result.success).toBe(true)
    expect(mockAddStockFromSearchService).toHaveBeenCalledWith(searchResult, options)
  })

  /** @test_id V9-TEST-ST-140-add-03 */
  test('失败路径：service 抛 Error → 返回 fallback', async () => {
    mockAddStockFromSearchService.mockRejectedValue(new Error('已存在于股票池'))

    const searchResult = { symbol: '600519', name: '贵州茅台', industry: 'SH' }
    const result = await useInputHubStore.getState().addStockFromSearch(searchResult)

    expect(result.success).toBe(false)
    expect(result.error).toBe('已存在于股票池')
    expect(useInputHubStore.getState().isAddingStock).toBe(false)
  })

  /** @test_id V9-TEST-ST-140-add-04 */
  test('失败路径：非 Error 类型异常 → 返回字符串化错误', async () => {
    mockAddStockFromSearchService.mockRejectedValue('字符串异常')

    const searchResult = { symbol: '600519', name: '贵州茅台', industry: 'SH' }
    const result = await useInputHubStore.getState().addStockFromSearch(searchResult)

    expect(result.success).toBe(false)
    expect(result.error).toBe('字符串异常')
    expect(useInputHubStore.getState().isAddingStock).toBe(false)
  })

  /** @test_id V9-TEST-ST-140-add-05 */
  test('执行期间 isAddingStock=true', async () => {
    let resolveAdd!: (value: { success: true; data: unknown }) => void
    const addPromise = new Promise<{ success: true; data: unknown }>((r) => { resolveAdd = r })
    mockAddStockFromSearchService.mockReturnValue(addPromise)

    const searchResult = { symbol: '600519', name: '贵州茅台', industry: 'SH' }
    const promise = useInputHubStore.getState().addStockFromSearch(searchResult)

    // 执行中 isAddingStock 应为 true
    expect(useInputHubStore.getState().isAddingStock).toBe(true)

    resolveAdd!({ success: true, data: { symbol: '600519' } })
    await promise

    expect(useInputHubStore.getState().isAddingStock).toBe(false)
  })

  /** @test_id V9-TEST-ST-140-add-06 */
  test('service 返回 success=false → 直接透传', async () => {
    mockAddStockFromSearchService.mockResolvedValue({
      success: false as const,
      error: '股票已存在',
    })

    const searchResult = { symbol: '600519', name: '贵州茅台', industry: 'SH' }
    const result = await useInputHubStore.getState().addStockFromSearch(searchResult)

    expect(result.success).toBe(false)
    expect(result.error).toBe('股票已存在')
    expect(useInputHubStore.getState().isAddingStock).toBe(false)
  })
})
