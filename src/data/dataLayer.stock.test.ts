/**
 * @fileoverview dataLayer — stockStore 单元测试（从原 dataLayer.test.ts 拆分）
 *
 * 覆盖：add / get / list / listByStatus / listByGroup / listGroups
 *       updateStatus / updateGroup / remove 的 16 个测试用例
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mockQueryGetSuccess,
  mockQueryListSuccess,
  mockQueryFail,
  mockForwardSuccess,
  mockForwardFail,
  makeStock,
} from './dataLayer.test-utils'
import { stockStore } from './dataLayer'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('stockStore', () => {
  it('add: 成功添加新股票', async () => {
    mockQueryGetSuccess(undefined) // 查询不存在
    mockForwardSuccess()

    const result = await stockStore.add(makeStock())
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      symbol: '600519',
      name: '贵州茅台',
      dataVersion: 1,
    })
  })

  it('add: 股票已存在时返回失败', async () => {
    mockQueryGetSuccess({ symbol: '600519', name: '贵州茅台' }) // 已存在

    const result = await stockStore.add(makeStock())
    expect(result.success).toBe(false)
    expect(result.error).toContain('已存在')
  })

  it('add: forward 失败时返回错误', async () => {
    mockQueryGetSuccess(undefined)
    mockForwardFail('写入失败')

    const result = await stockStore.add(makeStock())
    expect(result.success).toBe(false)
    expect(result.error).toBe('写入失败')
  })

  it('get: 查询到股票', async () => {
    const stock = makeStock()
    mockQueryGetSuccess(stock)

    const result = await stockStore.get('600519')
    expect(result).toEqual(stock)
  })

  it('get: 查询失败返回 undefined', async () => {
    mockQueryFail('查询失败')

    const result = await stockStore.get('600519')
    expect(result).toBeUndefined()
  })

  it('list: 返回全部股票', async () => {
    const stocks = [makeStock(), makeStock({ symbol: '000001', name: '平安银行' })]
    mockQueryListSuccess(stocks)

    const result = await stockStore.list()
    expect(result).toHaveLength(2)
  })

  it('list: 查询失败返回空数组', async () => {
    mockQueryFail('查询失败')

    const result = await stockStore.list()
    expect(result).toEqual([])
  })

  it('listByStatus: 按状态查询', async () => {
    mockQueryGetSuccess(undefined)

    const result = await stockStore.listByStatus('watching')
    expect(result).toHaveLength(0)
  })

  it('listByGroup: 按分组查询', async () => {
    mockQueryListSuccess([makeStock()])

    const result = await stockStore.listByGroup('默认分组')
    expect(result).toHaveLength(1)
  })

  it('listGroups: 返回去重排序的分组列表', async () => {
    const stocks = [
      makeStock({ group: 'B组' }),
      makeStock({ symbol: '000001', group: 'A组' }),
      makeStock({ symbol: '000002', group: 'B组' }),
    ]
    mockQueryListSuccess(stocks)

    const result = await stockStore.listGroups()
    expect(result).toEqual(['A组', 'B组', '默认分组'])
  })

  it('updateStatus: 成功更新状态', async () => {
    mockQueryGetSuccess(makeStock()) // 查询存在
    mockForwardSuccess()

    const result = await stockStore.updateStatus('600519', 'watching' as any)
    expect(result.success).toBe(true)
  })

  it('updateStatus: 股票不存在时返回失败', async () => {
    mockQueryGetSuccess(undefined)

    const result = await stockStore.updateStatus('600519', 'watching' as any)
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('updateGroup: 成功更新分组', async () => {
    mockQueryGetSuccess(makeStock()) // 查询存在
    mockForwardSuccess()
    mockQueryGetSuccess({ ...makeStock(), group: '新分组' }) // 更新后再查

    const result = await stockStore.updateGroup('600519', '新分组')
    expect(result.success).toBe(true)
    expect(result.data?.group).toBe('新分组')
  })

  it('updateGroup: 空分组名返回失败', async () => {
    const result = await stockStore.updateGroup('600519', '   ')
    expect(result.success).toBe(false)
    expect(result.error).toContain('不能为空')
  })

  it('updateGroup: 股票不存在返回失败', async () => {
    mockQueryGetSuccess(undefined)

    const result = await stockStore.updateGroup('600519', '新分组')
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('remove: 成功删除', async () => {
    mockForwardSuccess()

    const result = await stockStore.remove('600519')
    expect(result.success).toBe(true)
  })

  it('remove: forward 失败返回错误', async () => {
    mockForwardFail('删除失败')

    const result = await stockStore.remove('600519')
    expect(result.success).toBe(false)
    expect(result.error).toBe('删除失败')
  })

  it('listGroups: 空列表返回默认分组', async () => {
    mockQueryListSuccess([])

    const result = await stockStore.listGroups()
    expect(result).toEqual(['默认分组'])
  })
})
