/**
 * @module multiFactorScreeningEngine.test
 * @description 多因子筛选引擎单元测试。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  runScreening,
  generateScreeningCsv,
  createTemplateFromGroups,
  loadScreenableStocks,
} from './multiFactorScreeningEngine'
import type { ScreeningConditionGroup, ScreenableStockData } from '@/types/modules/screening.types'

const listMock = vi.fn()
const getUnifiedStockViewsMock = vi.fn()

vi.mock('@/data/dataLayer', () => ({
  dataLayer: {
    stocks: {
      list: () => listMock(),
    },
  },
}))

vi.mock('@/services/unifiedStockService', () => ({
  getUnifiedStockViews: (symbols: string[], options: unknown) => getUnifiedStockViewsMock(symbols, options),
}))

function makeStock(overrides: Partial<ScreenableStockData> = {}): ScreenableStockData {
  return {
    symbol: '000001',
    name: '平安银行',
    sector: '银行',
    pe: 5,
    pb: 0.8,
    roe: 10,
    marketCap: 2000,
    revenueGrowth: 5,
    profitGrowth: 5,
    ...overrides,
  }
}

describe('multiFactorScreeningEngine', () => {
  it('runScreening 执行单条件组且逻辑', () => {
    const stocks = [
      makeStock({ symbol: 'A', pe: 10 }),
      makeStock({ symbol: 'B', pe: 25 }),
      makeStock({ symbol: 'C', pe: 8 }),
    ]
    const groups: ScreeningConditionGroup[] = [
      {
        id: 'g1',
        logic: 'and',
        criteria: [{ id: 'c1', factor: 'pe', operator: 'lt', value: 15 }],
      },
    ]
    const result = runScreening(stocks, groups)
    expect(result.total).toBe(2)
    expect(result.items.map((i) => i.symbol)).toEqual(['A', 'C'])
  })

  it('runScreening 执行条件组或逻辑', () => {
    const stocks = [
      makeStock({ symbol: 'A', pe: 10, pb: 2 }),
      makeStock({ symbol: 'B', pe: 25, pb: 1 }),
      makeStock({ symbol: 'C', pe: 25, pb: 3 }),
    ]
    const groups: ScreeningConditionGroup[] = [
      {
        id: 'g1',
        logic: 'or',
        criteria: [
          { id: 'c1', factor: 'pe', operator: 'lt', value: 15 },
          { id: 'c2', factor: 'pb', operator: 'lt', value: 1.5 },
        ],
      },
    ]
    const result = runScreening(stocks, groups)
    expect(result.items.map((i) => i.symbol)).toEqual(['A', 'B'])
  })

  it('runScreening 支持 between 操作符', () => {
    const stocks = [
      makeStock({ symbol: 'A', pe: 8 }),
      makeStock({ symbol: 'B', pe: 12 }),
      makeStock({ symbol: 'C', pe: 20 }),
    ]
    const groups: ScreeningConditionGroup[] = [
      {
        id: 'g1',
        logic: 'and',
        criteria: [{ id: 'c1', factor: 'pe', operator: 'between', value: 5, value2: 15 }],
      },
    ]
    const result = runScreening(stocks, groups)
    expect(result.items.map((i) => i.symbol)).toEqual(['A', 'B'])
  })

  it('runScreening 缺失因子值视为不匹配', () => {
    const stocks = [makeStock({ symbol: 'A', pe: null })]
    const groups: ScreeningConditionGroup[] = [
      {
        id: 'g1',
        logic: 'and',
        criteria: [{ id: 'c1', factor: 'pe', operator: 'gt', value: 0 }],
      },
    ]
    const result = runScreening(stocks, groups)
    expect(result.total).toBe(0)
  })

  it('runScreening 多条件组全部命中', () => {
    const stocks = [
      makeStock({ symbol: 'A', pe: 10, pb: 1 }),
      makeStock({ symbol: 'B', pe: 10, pb: 3 }),
    ]
    const groups: ScreeningConditionGroup[] = [
      { id: 'g1', logic: 'and', criteria: [{ id: 'c1', factor: 'pe', operator: 'lt', value: 15 }] },
      { id: 'g2', logic: 'and', criteria: [{ id: 'c2', factor: 'pb', operator: 'lt', value: 2 }] },
    ]
    const result = runScreening(stocks, groups)
    expect(result.total).toBe(1)
    expect(result.items[0]!.symbol).toBe('A')
    expect(result.items[0]!.matchedGroups).toContain('g1')
    expect(result.items[0]!.matchedGroups).toContain('g2')
  })

  it('generateScreeningCsv 生成带 BOM 的 CSV', () => {
    const items = [{ ...makeStock({ symbol: 'A', name: 'A公司', sector: '科技', pe: 10 }), matchedGroups: [] }]
    const csv = generateScreeningCsv(items)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('代码,名称,行业,PE,PB,ROE,总市值(亿),营收增速(%),净利润增速(%)')
    expect(csv).toContain('A,A公司,科技,10,')
  })

  it('createTemplateFromGroups 生成模板', () => {
    const groups: ScreeningConditionGroup[] = [
      { id: 'g1', logic: 'and', criteria: [{ id: 'c1', factor: 'pe', operator: 'lt', value: 15 }] },
    ]
    const template = createTemplateFromGroups('低 PE 模板', groups, '示例')
    expect(template.name).toBe('低 PE 模板')
    expect(template.groups).toEqual(groups)
    expect(template.description).toBe('示例')
    expect(template.id.startsWith('template_')).toBe(true)
  })

  it('loadScreenableStocks 从 dataLayer 与 unifiedStockService 加载', async () => {
    listMock.mockResolvedValue([{ symbol: 'A' }, { symbol: 'B' }])
    getUnifiedStockViewsMock.mockResolvedValue({
      data: [
        { stock: { symbol: 'A', name: 'A公司', sector: '科技', pe: 10, pb: 1, roe: 10, marketCap: 100 } },
        { stock: { symbol: 'B', name: 'B公司', industryCode: '银行', pe: 5, pb: 0.8, roe: 8, marketCap: 200 } },
      ],
    })

    const stocks = await loadScreenableStocks()
    expect(stocks).toHaveLength(2)
    expect(stocks[0]).toMatchObject({ symbol: 'A', name: 'A公司', sector: '科技', pe: 10 })
    expect(stocks[1]).toMatchObject({ symbol: 'B', sector: '银行' })
    expect(getUnifiedStockViewsMock).toHaveBeenCalledWith(
      ['A', 'B'],
      expect.objectContaining({ includeQuotes: false, includeV6Score: false }),
    )
  })
})
