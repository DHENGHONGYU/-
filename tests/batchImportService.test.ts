import { describe, expect, it, beforeEach } from 'vitest'
import { db } from '@/data/db'
import { parseBulkInput, importStocks } from '@/services/input/batchImportService'
import { dataLayer } from '@/data/dataLayer'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'

describe('batchImportService', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  it('parses CSV-like text with code and name', () => {
    const rows = parseBulkInput('600519,贵州茅台\n000001 平安银行\n300750,宁德时代')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ code: '600519', name: '贵州茅台', symbol: '600519.SH', status: 'valid' })
    expect(rows[1]).toEqual({ code: '000001', name: '平安银行', symbol: '000001.SZ', status: 'valid' })
    expect(rows[2]).toEqual({ code: '300750', name: '宁德时代', symbol: '300750.SZ', status: 'valid' })
  })

  it('parses fully qualified symbols', () => {
    const rows = parseBulkInput('600519.SH\n000001.sz')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ code: '600519', name: '600519', symbol: '600519.SH', status: 'valid' })
    expect(rows[1]).toEqual({ code: '000001', name: '000001', symbol: '000001.SZ', status: 'valid' })
  })

  it('imports valid rows into candidate pool', async () => {
    const rows = parseBulkInput('600519,贵州茅台\n000001,平安银行')
    const result = await importStocks(rows)

    expect(result.success).toBe(true)
    expect(result.data?.success).toBe(2)
    expect(result.data?.failed).toBe(0)

    const stock1 = await dataLayer.stocks.get('600519.SH')
    expect(stock1).toBeDefined()
    expect(stock1?.name).toBe('贵州茅台')
  })

  it('skips duplicate rows and existing stocks', async () => {
    await dataLayer.stocks.add({
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'candidate',
      source: 'manual',
    })

    const rows = parseBulkInput('600519,贵州茅台\n600519,贵州茅台\n000001,平安银行')
    const result = await importStocks(rows)

    expect(result.data?.success).toBe(1)
    expect(result.data?.failed).toBe(2)
    expect(result.data?.errors.some((e) => e.error === '股票已存在')).toBe(true)
    expect(result.data?.errors.some((e) => e.error === '重复的代码')).toBe(true)
  })

  it('returns error for empty rows', async () => {
    const result = await importStocks([])
    expect(result.success).toBe(false)
  })
})
