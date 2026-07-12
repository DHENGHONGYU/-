import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { fetchFinancial } from '@/services/fetcher/fetcherService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => response,
  } as Response)
}

const FINANCIAL_RESPONSE = {
  success: true,
  symbol: '000001.SZ',
  dimension: 'financial',
  data: {
    report_date: '2024-12-31',
    revenue: 100.5,
    revenue_yoy: 15.2,
    net_profit: 20.3,
    net_profit_yoy: 18.5,
    gross_margin: 35.6,
    net_margin: 20.1,
    operating_cf: 25.8,
    rd_ratio: 8.5,
    receivables: 12.3,
    inventory_turnover_days: 45.2,
    interest_bearing_debt: 30.5,
    goodwill: 5.2,
    net_assets: 150.8,
    shareholder_pledge: 3.5,
  },
  records: 1,
  error: null,
  fetched_at: '2026-07-07T10:00:00',
}

describe('fetcherService - 财务数据采集', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.financialReports)
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该成功采集财务数据并保存到数据库', async () => {
    // 准备：先添加股票（fetchFinancial 不强制要求股票存在，但实际场景通常存在）
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '平安银行',
      researchStatus: 'candidate',
      source: 'manual',
    })

    global.fetch = mockFetch(FINANCIAL_RESPONSE)

    // 执行
    const result = await fetchFinancial('000001.SZ')

    // 验证
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.symbol).toBe('000001.SZ')
    expect(result.data?.reportDate).toBe('2024-12-31')
    expect(result.data?.revenue).toBe(100.5)
    expect(result.data?.revenueYoY).toBe(15.2)
    expect(result.data?.netProfit).toBe(20.3)
    expect(result.data?.netProfitYoY).toBe(18.5)
    expect(result.data?.grossMargin).toBe(35.6)
    expect(result.data?.netMargin).toBe(20.1)
    expect(result.data?.operatingCF).toBe(25.8)
    expect(result.data?.rdRatio).toBe(8.5)
    expect(result.data?.updatedAt).toBeDefined()

    // 验证数据库保存成功
    const saved = await dataLayer.financialReports.get('000001.SZ')
    expect(saved).toBeDefined()
    expect(saved?.revenue).toBe(100.5)
    expect(saved?.netProfit).toBe(20.3)
  })

  it('应该在采集失败时返回错误信息', async () => {
    global.fetch = mockFetch({
      success: false,
      symbol: '000001.SZ',
      dimension: 'financial',
      data: null,
      records: 0,
      error: 'AKShare 财务接口异常',
      fetched_at: '2026-07-07T10:00:00',
    })

    const result = await fetchFinancial('000001.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('AKShare 财务接口异常')
  })

  it('应该在股票代码为空时返回错误', async () => {
    const result = await fetchFinancial('')

    expect(result.success).toBe(false)
    expect(result.error).toContain('股票代码不能为空')
  })

  it('应该在数据适配失败时返回错误', async () => {
    global.fetch = mockFetch({
      success: true,
      symbol: '000001.SZ',
      dimension: 'financial',
      data: {
        // 缺少 report_date，导致适配失败
        revenue: 100.5,
        net_profit: 20.3,
      },
      records: 1,
      error: null,
      fetched_at: '2026-07-07T10:00:00',
    })

    const result = await fetchFinancial('000001.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('财务数据为空或格式不正确')
  })

  it('应该正确处理可选字段', async () => {
    global.fetch = mockFetch({
      success: true,
      symbol: '000002.SZ',
      dimension: 'financial',
      data: {
        report_date: '2024-12-31',
        revenue: 80.0,
        // 其他字段可选
      },
      records: 1,
      error: null,
      fetched_at: '2026-07-07T10:00:00',
    })

    const result = await fetchFinancial('000002.SZ')

    expect(result.success).toBe(true)
    expect(result.data?.revenue).toBe(80.0)
    expect(result.data?.netProfit).toBeUndefined()
    expect(result.data?.grossMargin).toBeUndefined()
  })

  it('应该在保存过程中抛出异常时捕获并返回错误', async () => {
    // Mock dataBridge.forward 抛出异常
    vi.spyOn(dataBridge, 'forward').mockRejectedValueOnce(new Error('数据库写入失败'))

    global.fetch = mockFetch(FINANCIAL_RESPONSE)

    const result = await fetchFinancial('000001.SZ')

    expect(result.success).toBe(false)
    expect(result.error).toContain('数据库写入失败')
  })

  it('应该验证保存后的数据完整性', async () => {
    global.fetch = mockFetch(FINANCIAL_RESPONSE)

    const result = await fetchFinancial('000001.SZ')

    expect(result.success).toBe(true)

    // 从数据库读取并验证
    const saved = await dataLayer.financialReports.get('000001.SZ')
    expect(saved).toBeDefined()
    expect(saved?.symbol).toBe('000001.SZ')
    expect(saved?.reportDate).toBe('2024-12-31')
    expect(saved?.revenue).toBe(100.5)
    expect(saved?.revenueYoY).toBe(15.2)
    expect(saved?.netProfit).toBe(20.3)
    expect(saved?.netProfitYoY).toBe(18.5)
    expect(saved?.grossMargin).toBe(35.6)
    expect(saved?.netMargin).toBe(20.1)
    expect(saved?.operatingCF).toBe(25.8)
    expect(saved?.rdRatio).toBe(8.5)
    expect(saved?.receivables).toBe(12.3)
    expect(saved?.inventoryTurnoverDays).toBe(45.2)
    expect(saved?.interestBearingDebt).toBe(30.5)
    expect(saved?.goodwill).toBe(5.2)
    expect(saved?.netAssets).toBe(150.8)
    expect(saved?.shareholderPledge).toBe(3.5)
    expect(saved?.updatedAt).toBeGreaterThan(0)
  })

  it('应该正确处理股票代码的大小写转换', async () => {
    global.fetch = mockFetch({
      ...FINANCIAL_RESPONSE,
      symbol: '000001.sz',
    })

    const result = await fetchFinancial('000001.sz')

    expect(result.success).toBe(true)
    expect(result.data?.symbol).toBe('000001.SZ')
  })

  it('应该正确处理股票代码的空格去除', async () => {
    global.fetch = mockFetch(FINANCIAL_RESPONSE)

    const result = await fetchFinancial('  000001.SZ  ')

    expect(result.success).toBe(true)
    expect(result.data?.symbol).toBe('000001.SZ')
  })
})
