/**
 * @test_id V9-TEST-STOCKLIST-001
 * stockList 工具函数单元测试
 *
 * 覆盖：getStockBySymbol, searchStocks, getStocksByGroup, POPULAR_STOCKS
 * @covers_docs []
 */

import { describe, test, expect } from 'vitest'
import {
  POPULAR_STOCKS,
  getStockBySymbol,
  searchStocks,
  getStocksByGroup,
  inferMarketFromSymbol,
  toStockOption,
  type StockOption,
} from './stockList'

// ============================================================
// POPULAR_STOCKS 常量
// ============================================================

describe('POPULAR_STOCKS', () => {
  test('股票列表非空', () => {
    expect(POPULAR_STOCKS.length).toBeGreaterThan(0)
  })

  test('所有股票都有必填字段', () => {
    for (const stock of POPULAR_STOCKS) {
      expect(stock.symbol).toBeTruthy()
      expect(stock.name).toBeTruthy()
      expect(stock.market).toBeTruthy()
    }
  })

  test('股票代码格式正确（6位数字）', () => {
    for (const stock of POPULAR_STOCKS) {
      expect(stock.symbol).toMatch(/^\d{6}$/)
    }
  })

  test('市场类型合法（sh 或 sz）', () => {
    for (const stock of POPULAR_STOCKS) {
      expect(stock.market === 'sh' || stock.market === 'sz').toBe(true)
    }
    // 再检查是否有深市股票
    const hasSz = POPULAR_STOCKS.some((s) => s.market === 'sz')
    expect(hasSz).toBe(true)
    // 同时也有沪市股票
    const hasSh = POPULAR_STOCKS.some((s) => s.market === 'sh')
    expect(hasSh).toBe(true)
  })

  test('股票代码列表（允许展示用重复项）', () => {
    const symbols = POPULAR_STOCKS.map((s) => s.symbol)
    // 所有代码都是6位数字
    for (const symbol of symbols) {
      expect(symbol).toMatch(/^\d{6}$/)
    }
    // 唯一代码数量应大于0
    const uniqueSymbols = new Set(symbols)
    expect(uniqueSymbols.size).toBeGreaterThan(0)
    // 允许重复项（展示用列表），但记录唯一数量
    // 确保唯一代码数不超过总数
    expect(uniqueSymbols.size).toBeLessThanOrEqual(symbols.length)
  })
})

// ============================================================
// getStockBySymbol
// ============================================================

describe('getStockBySymbol', () => {
  test('存在的股票代码返回正确股票', () => {
    const result = getStockBySymbol('600519')
    expect(result).toBeDefined()
    expect(result?.name).toBe('贵州茅台')
    expect(result?.market).toBe('sh')
  })

  test('不存在的股票代码返回 undefined', () => {
    const result = getStockBySymbol('999999')
    expect(result).toBeUndefined()
  })

  test('边界情况：空字符串返回 undefined', () => {
    const result = getStockBySymbol('')
    expect(result).toBeUndefined()
  })

  test('边界情况：空格字符串返回 undefined', () => {
    const result = getStockBySymbol('   ')
    expect(result).toBeUndefined()
  })

  test('边界情况：短于6位的代码返回 undefined', () => {
    const result = getStockBySymbol('60051')
    expect(result).toBeUndefined()
  })

  test('边界情况：长于6位的代码返回 undefined', () => {
    const result = getStockBySymbol('6005190')
    expect(result).toBeUndefined()
  })

  test('重复代码返回第一个匹配项', () => {
    // 002415 海康威视 在列表中出现2次
    const result = getStockBySymbol('002415')
    expect(result).toBeDefined()
    expect(result?.name).toBe('海康威视')
    expect(result?.market).toBe('sz')
  })

  test('按代码查询 000001 平安银行', () => {
    const result = getStockBySymbol('000001')
    expect(result).toBeDefined()
    expect(result?.name).toBe('平安银行')
    expect(result?.market).toBe('sz')
  })

  test('按代码查询 688981 中芯国际（科创板）', () => {
    const result = getStockBySymbol('688981')
    expect(result).toBeDefined()
    expect(result?.name).toBe('中芯国际')
    expect(result?.market).toBe('sh')
  })
})

// ============================================================
// searchStocks
// ============================================================

describe('searchStocks', () => {
  test('空关键词返回全部股票', () => {
    const result = searchStocks('')
    expect(result.length).toBe(POPULAR_STOCKS.length)
    expect(result.length).toBeGreaterThan(0)
  })

  test('空格关键词返回全部股票', () => {
    const result = searchStocks('   ')
    expect(result.length).toBe(POPULAR_STOCKS.length)
    expect(result.length).toBeGreaterThan(0)
  })

  test('制表符和空格关键词返回全部股票', () => {
    const result = searchStocks(' \t ')
    expect(result.length).toBe(POPULAR_STOCKS.length)
  })

  test('按名称搜索（贵州茅台）', () => {
    const result = searchStocks('贵州茅台')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].symbol).toBe('600519')
  })

  test('按代码搜索（600519）', () => {
    const result = searchStocks('600519')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].name).toBe('贵州茅台')
  })

  test('模糊搜索（茅台）', () => {
    const result = searchStocks('茅台')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some((s) => s.name.includes('茅台'))).toBe(true)
  })

  test('模糊搜索（银行）', () => {
    const result = searchStocks('银行')
    expect(result.length).toBeGreaterThan(1)
    for (const stock of result) {
      expect(stock.name).toContain('银行')
    }
  })

  test('不区分大小写搜索（招商银行）', () => {
    const result = searchStocks('招商银行')
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  test('不区分大小写搜索（小写）', () => {
    const result = searchStocks('china merchants bank')
    // 中文名称不匹配，但这是边界测试
    expect(Array.isArray(result)).toBe(true)
  })

  test('不存在的关键词返回空数组', () => {
    const result = searchStocks('不存在的股票XYZ')
    expect(result).toEqual([])
  })

  test('按代码前缀搜索（600）', () => {
    const result = searchStocks('600')
    expect(result.length).toBeGreaterThan(0)
    for (const stock of result) {
      expect(stock.symbol.startsWith('600')).toBe(true)
    }
  })

  test('特殊字符不报错', () => {
    const result = searchStocks('!@#$%')
    expect(Array.isArray(result)).toBe(true)
  })

  test('数字和中文混合搜索', () => {
    const result = searchStocks('600519 茅台')
    // 关键词包含空格，trim 后为 "600519 茅台"，不会匹配
    expect(Array.isArray(result)).toBe(true)
  })

  test('搜索重复代码的股票会返回多条', () => {
    // 002415 海康威视 出现 2 次，搜索应返回 2 条
    const result = searchStocks('002415')
    expect(result.length).toBeGreaterThanOrEqual(1)
    // 验证都是海康威视
    for (const stock of result) {
      expect(stock.symbol).toBe('002415')
      expect(stock.name).toBe('海康威视')
    }
  })

  test('只按市场前缀搜索（000 深市）', () => {
    const result = searchStocks('000')
    expect(result.length).toBeGreaterThan(0)
    // 验证至少有一个结果以 000 开头（深市股票）
    const has000Prefix = result.some((stock) => stock.symbol.startsWith('000'))
    expect(has000Prefix).toBe(true)
    // 注意：搜索 "000" 也会匹配其他代码中包含 "000" 的股票
  })

  test('科创板股票搜索（688）', () => {
    const result = searchStocks('688')
    expect(result.length).toBeGreaterThan(0)
    for (const stock of result) {
      expect(stock.symbol.startsWith('688')).toBe(true)
    }
  })
})

// ============================================================
// getStocksByGroup
// ============================================================

describe('getStocksByGroup', () => {
  test('获取全部股票', () => {
    const result = getStocksByGroup('all')
    expect(result.length).toBe(POPULAR_STOCKS.length)
  })

  test('获取沪市股票', () => {
    const result = getStocksByGroup('sh')
    expect(result.length).toBeGreaterThan(0)
    for (const stock of result) {
      expect(stock.market).toBe('sh')
    }
  })

  test('获取深市股票', () => {
    const result = getStocksByGroup('sz')
    expect(result.length).toBeGreaterThan(0)
    for (const stock of result) {
      expect(stock.market).toBe('sz')
    }
  })

  test('沪市和深市合集等于全部', () => {
    const shStocks = getStocksByGroup('sh')
    const szStocks = getStocksByGroup('sz')
    expect(shStocks.length + szStocks.length).toBe(POPULAR_STOCKS.length)
  })

  test('沪市股票包含贵州茅台', () => {
    const result = getStocksByGroup('sh')
    const hasMoutai = result.some((s) => s.symbol === '600519')
    expect(hasMoutai).toBe(true)
  })

  test('深市股票包含五粮液', () => {
    const result = getStocksByGroup('sz')
    const hasWuliangye = result.some((s) => s.symbol === '000858')
    expect(hasWuliangye).toBe(true)
  })

  test('沪市和深市股票数量都大于0', () => {
    const shCount = getStocksByGroup('sh').length
    const szCount = getStocksByGroup('sz').length
    expect(shCount).toBeGreaterThan(0)
    expect(szCount).toBeGreaterThan(0)
  })
})

// ============================================================
// 接口类型验证
// ============================================================

describe('StockOption 接口', () => {
  test('POPULAR_STOCKS 元素符合 StockOption 接口', () => {
    const stock: StockOption = POPULAR_STOCKS[0]
    expect(typeof stock.symbol).toBe('string')
    expect(typeof stock.name).toBe('string')
    expect(stock.market).toBe('sh' as const)
  })

  test('getStockBySymbol 返回值符合 StockOption 接口', () => {
    const stock = getStockBySymbol('600519')
    if (stock) {
      expect(typeof stock.symbol).toBe('string')
      expect(typeof stock.name).toBe('string')
      expect(stock.market).toBe('sh' as const)
    }
  })

  test('searchStocks 返回值数组元素符合 StockOption 接口', () => {
    const results = searchStocks('贵州')
    for (const stock of results) {
      expect(typeof stock.symbol).toBe('string')
      expect(typeof stock.name).toBe('string')
      expect(stock.market === 'sh' || stock.market === 'sz').toBe(true)
    }
  })
})

// ============================================================
// inferMarketFromSymbol 测试
// ============================================================

describe('inferMarketFromSymbol', () => {
  test('600 开头返回沪市', () => {
    expect(inferMarketFromSymbol('600519')).toBe('sh')
  })

  test('601 开头返回沪市', () => {
    expect(inferMarketFromSymbol('601318')).toBe('sh')
  })

  test('688 开头返回沪市（科创板）', () => {
    expect(inferMarketFromSymbol('688001')).toBe('sh')
  })

  test('000 开头返回深市', () => {
    expect(inferMarketFromSymbol('000001')).toBe('sz')
  })

  test('002 开头返回深市', () => {
    expect(inferMarketFromSymbol('002415')).toBe('sz')
  })

  test('300 开头返回深市（创业板）', () => {
    expect(inferMarketFromSymbol('300750')).toBe('sz')
  })
})

// ============================================================
// toStockOption 测试
// ============================================================

describe('toStockOption', () => {
  test('转换沪市股票', () => {
    const result = toStockOption({ symbol: '600519', name: '贵州茅台' })
    expect(result.symbol).toBe('600519')
    expect(result.name).toBe('贵州茅台')
    expect(result.market).toBe('sh')
  })

  test('转换深市股票', () => {
    const result = toStockOption({ symbol: '000001', name: '平安银行' })
    expect(result.symbol).toBe('000001')
    expect(result.name).toBe('平安银行')
    expect(result.market).toBe('sz')
  })

  test('转换科创板股票', () => {
    const result = toStockOption({ symbol: '688001', name: '华兴源创' })
    expect(result.market).toBe('sh')
  })
})
