import { describe, it, expect } from 'vitest'
import {
  stockSchema,
  dataSourceSchema,
  researchStatusSchema,
  stockDataQualitySchema,
  financialReportSchema,
} from './schema.stock'

describe('schema.stock', () => {
  describe('dataSourceSchema', () => {
    it('应接受合法数据源', () => {
      expect(dataSourceSchema.parse('tencent')).toBe('tencent')
      expect(dataSourceSchema.parse('manual')).toBe('manual')
    })

    it('应拒绝非法数据源', () => {
      expect(() => dataSourceSchema.parse('invalid')).toThrow()
    })
  })

  describe('researchStatusSchema', () => {
    it('应接受合法研究状态', () => {
      expect(researchStatusSchema.parse('pending')).toBe('pending')
      expect(researchStatusSchema.parse('researched')).toBe('researched')
    })

    it('应拒绝非法研究状态', () => {
      expect(() => researchStatusSchema.parse('unknown')).toThrow()
    })
  })

  describe('stockDataQualitySchema', () => {
    it('应接受完整数据质量对象', () => {
      const result = stockDataQualitySchema.parse({
        basic: true,
        kline: false,
        finance: true,
      })
      expect(result.basic).toBe(true)
      expect(result.kline).toBe(false)
    })

    it('应拒绝缺少必填字段', () => {
      expect(() => stockDataQualitySchema.parse({ basic: true })).toThrow()
    })
  })

  describe('stockSchema', () => {
    it('应接受合法股票数据', () => {
      const result = stockSchema.parse({
        symbol: '600519.SH',
        name: '贵州茅台',
        researchStatus: 'researched',
        source: 'tencent',
        dataVersion: 1,
      })
      expect(result.symbol).toBe('600519.SH')
      expect(result.name).toBe('贵州茅台')
    })

    it('应接受含可选字段的完整数据', () => {
      const result = stockSchema.parse({
        symbol: '000001.SZ',
        name: '平安银行',
        price: 12.5,
        pe: 8.5,
        researchStatus: 'pending',
        source: 'manual',
        dataVersion: 2,
        dataQuality: { basic: true, kline: true, finance: false },
        industryCode: '801780',
        theme: ['银行', '金融'],
        group: '核心持仓',
      })
      expect(result.price).toBe(12.5)
      expect(result.theme).toEqual(['银行', '金融'])
    })

    it('应拒绝缺少 symbol', () => {
      expect(() =>
        stockSchema.parse({
          name: '贵州茅台',
          researchStatus: 'researched',
          source: 'tencent',
          dataVersion: 1,
        }),
      ).toThrow()
    })

    it('应拒绝缺少 name', () => {
      expect(() =>
        stockSchema.parse({
          symbol: '600519.SH',
          researchStatus: 'researched',
          source: 'tencent',
          dataVersion: 1,
        }),
      ).toThrow()
    })

    it('应拒绝非法 researchStatus', () => {
      expect(() =>
        stockSchema.parse({
          symbol: '600519.SH',
          name: '贵州茅台',
          researchStatus: 'invalid',
          source: 'tencent',
          dataVersion: 1,
        }),
      ).toThrow()
    })

    it('应拒绝非法 source', () => {
      expect(() =>
        stockSchema.parse({
          symbol: '600519.SH',
          name: '贵州茅台',
          researchStatus: 'researched',
          source: 'unknown_source',
          dataVersion: 1,
        }),
      ).toThrow()
    })

    it('应拒绝负数 dataVersion', () => {
      expect(() =>
        stockSchema.parse({
          symbol: '600519.SH',
          name: '贵州茅台',
          researchStatus: 'researched',
          source: 'tencent',
          dataVersion: -1,
        }),
      ).toThrow()
    })

    it('应拒绝负数 price', () => {
      expect(() =>
        stockSchema.parse({
          symbol: '600519.SH',
          name: '贵州茅台',
          price: -10,
          researchStatus: 'researched',
          source: 'tencent',
          dataVersion: 1,
        }),
      ).toThrow()
    })
  })

  describe('financialReportSchema', () => {
    it('应接受合法财务报告', () => {
      const result = financialReportSchema.parse({
        symbol: '600519.SH',
        reportDate: '2025-12-31',
        revenue: 1500000000,
        updatedAt: Date.now(),
      })
      expect(result.symbol).toBe('600519.SH')
    })

    it('应拒绝缺少必填字段', () => {
      expect(() =>
        financialReportSchema.parse({
          symbol: '600519.SH',
        }),
      ).toThrow()
    })
  })
})
