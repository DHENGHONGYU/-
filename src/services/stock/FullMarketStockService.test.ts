import { describe, test, expect, beforeEach, vi } from 'vitest'

// 隔离网络调用：mock Smartbox API 客户端
const { searchViaSmartbox } = vi.hoisted(() => ({
  searchViaSmartbox: vi.fn(),
}))
vi.mock('./stockSearchClient', () => ({
  searchViaSmartbox: (q: string, max: number) => searchViaSmartbox(q, max),
}))

import { searchFullMarket } from './FullMarketStockService'
import { findStockBySymbol, toExchangeSymbol } from './stockDictionary'

describe('stockDictionary helpers', () => {
  test('findStockBySymbol: 按代码精确查找', () => {
    const item = findStockBySymbol('600519')
    expect(item).toBeDefined()
    expect(item!.name).toBe('贵州茅台')
    expect(item!.market).toBe('SH')
  })

  test('findStockBySymbol: 大小写与 .SH 后缀容错', () => {
    expect(findStockBySymbol('600519.SH')?.name).toBe('贵州茅台')
    expect(findStockBySymbol('600519.sh')?.name).toBe('贵州茅台')
  })

  test('findStockBySymbol: 未找到返回 undefined', () => {
    expect(findStockBySymbol('999999')).toBeUndefined()
  })

  test('toExchangeSymbol: 构造腾讯风格交易所代码', () => {
    // 腾讯 API 使用 sh/sz/bj 前缀；港股不加前缀
    expect(toExchangeSymbol('600519', 'SH')).toBe('sh600519')
    expect(toExchangeSymbol('000001', 'SZ')).toBe('sz000001')
    expect(toExchangeSymbol('00700', 'HK')).toBe('00700')
  })
})

describe('searchFullMarket - 本地字典匹配', () => {
  beforeEach(() => {
    searchViaSmartbox.mockReset()
  })

  test('代码精确匹配：输入完整代码返回该股票', async () => {
    searchViaSmartbox.mockResolvedValue([])
    const results = await searchFullMarket('600519', new Set(), 20)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.symbol).toBe('600519')
    expect(results[0]!.name).toBe('贵州茅台')
    expect(results[0]!.source).toBe('dict')
  })

  test('名称精确匹配：输入完整名称返回该股票', async () => {
    searchViaSmartbox.mockResolvedValue([])
    const results = await searchFullMarket('贵州茅台', new Set(), 20)
    expect(results[0]!.symbol).toBe('600519')
  })

  test('代码前缀匹配：输入 6005 返回 6005xx 系列', async () => {
    searchViaSmartbox.mockResolvedValue([])
    const results = await searchFullMarket('6005', new Set(), 20)
    expect(results.length).toBeGreaterThan(0)
    results.forEach((r) => expect(r.symbol.startsWith('6005')).toBe(true))
  })

  test('名称前缀匹配：输入「贵州」优先匹配贵州茅台', async () => {
    searchViaSmartbox.mockResolvedValue([])
    const results = await searchFullMarket('贵州', new Set(), 20)
    const maotai = results.find((r) => r.symbol === '600519')
    expect(maotai).toBeDefined()
    expect(maotai!.name).toBe('贵州茅台')
  })

  test('名称模糊包含：输入「茅台」命中贵州茅台', async () => {
    searchViaSmartbox.mockResolvedValue([])
    const results = await searchFullMarket('茅台', new Set(), 20)
    const maotai = results.find((r) => r.symbol === '600519')
    expect(maotai).toBeDefined()
  })

  test('空查询返回空数组', async () => {
    searchViaSmartbox.mockResolvedValue([])
    expect(await searchFullMarket('   ', new Set(), 20)).toEqual([])
  })
})

describe('searchFullMarket - 已导入优先排序', () => {
  test('已导入标的排在结果前面', async () => {
    searchViaSmartbox.mockResolvedValue([])
    const existing = new Set<string>(['600519'])
    const results = await searchFullMarket('600', existing, 20)
    // 贵州茅台（已导入）应排在第一位
    expect(results[0]!.symbol).toBe('600519')
    expect(results[0]!.source).toBe('dict')
  })
})

describe('searchFullMarket - Smartbox API 回退', () => {
  test('本地不足时合并 API 结果并去重', async () => {
    // 返回一个本地字典没有的标的，验证 API 层合并
    searchViaSmartbox.mockResolvedValue([
      { symbol: '300999', name: '测试新股', market: 'SZ' },
    ])
    const results = await searchFullMarket('测试新股', new Set(), 20)
    const hit = results.find((r) => r.symbol === '300999')
    expect(hit).toBeDefined()
    expect(hit!.source).toBe('smartbox')
  })

  test('API 失败时仅返回本地结果（不抛错）', async () => {
    searchViaSmartbox.mockRejectedValue(new Error('network unreachable'))
    const results = await searchFullMarket('600519', new Set(), 20)
    // 兜底返回本地字典命中
    expect(results[0]!.symbol).toBe('600519')
    expect(results[0]!.source).toBe('dict')
  })
})
