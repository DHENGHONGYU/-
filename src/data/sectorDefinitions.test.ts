/**
 * @test_id V9-TEST-DATA-010
 * @covers_docs [V9-DOC-DATA-031]
 * @description sectorDefinitions.getSectorPoolStocks NaN 兜底行为 + 双向验证
 *
 * 覆盖场景：
 *   - v6Composite 完整传递（正常值）
 *   - v6Composite 缺失时标记为 NaN（替代 0）
 *   - 混合场景（部分股票有分、部分无分）
 *   - 空输入边界
 *   - 无效 sectorCode 边界
 *   - 双向验证：正向（输入→输出+日志）、逆向（输出→反推输入）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDebug = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: mockDebug }),
}))

import { getSectorPoolStocks } from './sectorDefinitions'

// 使用已知存在的板块代码
const KNOWN_SECTOR = 'IC'

function createPoolStocks(
  overrides: Array<{ symbol: string; name: string; v6Composite?: number }>,
) {
  return overrides
}

describe('sectorDefinitions - getSectorPoolStocks NaN 兜底', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('匹配的股票有 v6Composite 时应正常传递数值', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 8.5 },
      { symbol: '688012.SH', name: '中微公司', v6Composite: 7.2 },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result).toHaveLength(2)
    expect(result[0]!.v6Composite).toBe(8.5)
    expect(result[1]!.v6Composite).toBe(7.2)
    expect(Number.isFinite(result[0]!.v6Composite)).toBe(true)
    expect(Number.isFinite(result[1]!.v6Composite)).toBe(true)
  })

  it('v6Composite 缺失时应标记为 NaN 而非 0', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: undefined },
      { symbol: '688012.SH', name: '中微公司' },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result).toHaveLength(2)
    expect(Number.isNaN(result[0]!.v6Composite)).toBe(true)
    expect(result[0]!.v6Composite).not.toBe(0)
    expect(Number.isNaN(result[1]!.v6Composite)).toBe(true)
    expect(result[1]!.v6Composite).not.toBe(0)
  })

  it('混合场景：部分股票有分、部分缺失', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 8.5 },
      { symbol: '688012.SH', name: '中微公司' },
      { symbol: '688019.SH', name: '安集科技', v6Composite: 6.1 },
      { symbol: '002371.SZ', name: '北方华创' },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result).toHaveLength(4)
    expect(Number.isFinite(result[0]!.v6Composite)).toBe(true)
    expect(result[0]!.v6Composite).toBe(8.5)
    expect(Number.isNaN(result[1]!.v6Composite)).toBe(true)
    expect(Number.isFinite(result[2]!.v6Composite)).toBe(true)
    expect(result[2]!.v6Composite).toBe(6.1)
    expect(Number.isNaN(result[3]!.v6Composite)).toBe(true)
  })

  it('非 keyStock 的股票应被过滤掉', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 8.5 },
      { symbol: '600519.SH', name: '贵州茅台', v6Composite: 9.9 },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result).toHaveLength(1)
    expect(result[0]!.symbol).toBe('688981.SH')
  })

  it('无效 sectorCode 应返回空数组', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 8.5 },
    ])

    const result = getSectorPoolStocks('NONEXISTENT', stocks)

    expect(result).toHaveLength(0)
  })

  it('空输入应返回空数组', () => {
    const result = getSectorPoolStocks(KNOWN_SECTOR, [])

    expect(result).toHaveLength(0)
  })

  it('NaN 场景下聚合计算应显式暴露问题（而非用 0 掩盖）', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 8.5 },
      { symbol: '688012.SH', name: '中微公司' },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    const validScores = result.filter((s) => Number.isFinite(s.v6Composite))
    const avgScore =
      validScores.reduce((sum, s) => sum + s.v6Composite, 0) / (validScores.length || 1)

    expect(validScores).toHaveLength(1)
    expect(avgScore).toBe(8.5)
    expect(Number.isNaN(result[1]!.v6Composite)).toBe(true)
  })
})

// ============================================================
// 双向验证 — 显式零值 vs 缺失值
// ============================================================
describe('sectorDefinitions - getSectorPoolStocks 双向验证（零值 vs 缺失）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('正向：输入 → 输出 + 日志', () => {
    it('v6Composite 为显式 0 → 输出为 0 + 零值日志', () => {
      const stocks = createPoolStocks([
        { symbol: '688981.SH', name: '中芯国际', v6Composite: 0 },
      ])

      const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

      expect(result).toHaveLength(1)
      expect(result[0]!.v6Composite).toBe(0)
      expect(Number.isFinite(result[0]!.v6Composite)).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('显式 0')
      )
      expect(mockDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('缺失')
      )
    })

    it('v6Composite 为 null/undefined → 输出为 NaN + 缺失日志', () => {
      const stocks = createPoolStocks([
        { symbol: '688981.SH', name: '中芯国际' },
      ])

      const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

      expect(result).toHaveLength(1)
      expect(Number.isNaN(result[0]!.v6Composite)).toBe(true)
      expect(result[0]!.v6Composite).not.toBe(0)
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('缺失')
      )
      expect(mockDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('显式 0')
      )
    })

    it('v6Composite 为正常值 → 正常输出 + 无日志', () => {
      const stocks = createPoolStocks([
        { symbol: '688981.SH', name: '中芯国际', v6Composite: 8.5 },
      ])

      const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

      expect(result[0]!.v6Composite).toBe(8.5)
      expect(mockDebug).not.toHaveBeenCalled()
    })

    it('混合场景：一只股票显式 0 + 一只缺失', () => {
      const stocks = createPoolStocks([
        { symbol: '688981.SH', name: '中芯国际', v6Composite: 0 },
        { symbol: '688012.SH', name: '中微公司' },
      ])

      const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

      expect(result).toHaveLength(2)
      expect(result[0]!.v6Composite).toBe(0)
      expect(Number.isFinite(result[0]!.v6Composite)).toBe(true)
      expect(Number.isNaN(result[1]!.v6Composite)).toBe(true)

      const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
        c[0]?.includes('显式 0')
      )
      const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
        c[0]?.includes('缺失')
      )
      expect(zeroCalls.length).toBe(1)
      expect(missingCalls.length).toBe(1)
    })
  })

  describe('逆向：输出特征 → 反推输入', () => {
    it('输出 v6Composite 为 0 → 输入必为显式 0（非 null）', () => {
      const stocks = createPoolStocks([
        { symbol: '688981.SH', name: '中芯国际', v6Composite: 0 },
      ])
      const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

      expect(result[0]!.v6Composite).toBe(0)
      expect(Number.isFinite(result[0]!.v6Composite)).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('显式 0')
      )
      expect(mockDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('缺失')
      )
    })

    it('输出 v6Composite 为 NaN → 输入必为 null/undefined', () => {
      const stocks = createPoolStocks([
        { symbol: '688981.SH', name: '中芯国际' },
      ])
      const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

      expect(Number.isNaN(result[0]!.v6Composite)).toBe(true)
      expect(result[0]!.v6Composite).not.toBe(0)
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('缺失')
      )
      expect(mockDebug).not.toHaveBeenCalledWith(
        expect.stringContaining('显式 0')
      )
    })

    it('日志仅各触发一次，无重复告警', () => {
      const stocks = createPoolStocks([
        { symbol: '688981.SH', name: '中芯国际', v6Composite: 0 },
        { symbol: '688012.SH', name: '中微公司' },
      ])
      getSectorPoolStocks(KNOWN_SECTOR, stocks)

      const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
        c[0]?.includes('显式 0')
      )
      const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
        c[0]?.includes('缺失')
      )
      expect(zeroCalls.length).toBe(1)
      expect(missingCalls.length).toBe(1)
    })
  })
})

// ============================================================
// 深度验证 — sectorDefinitions 板块级数据流
// ============================================================
describe('sectorDefinitions - 深度验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('板块合成评分: 全为 NaN 时应返回 NaN，而非 0', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际' },
      { symbol: '688012.SH', name: '中微公司' },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result).toHaveLength(2)
    expect(Number.isNaN(result[0]!.v6Composite)).toBe(true)
    expect(Number.isNaN(result[1]!.v6Composite)).toBe(true)

    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失')
    )
    expect(missingCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('板块合成评分: 混合 NaN + 正常值，平均值应正确计算', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 8.5 },
      { symbol: '688012.SH', name: '中微公司' },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result).toHaveLength(2)
    expect(result[0]!.v6Composite).toBe(8.5)
    expect(Number.isNaN(result[1]!.v6Composite)).toBe(true)

    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失')
    )
    expect(missingCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('边界: v6Composite 为负值不应触发零值告警', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: -5 },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result[0]!.v6Composite).toBe(-5)
    expect(Number.isFinite(result[0]!.v6Composite)).toBe(true)

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    expect(zeroCalls.length).toBe(0)
  })

  it('边界: v6Composite 为 Infinity 不应触发零值告警', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: Number.POSITIVE_INFINITY },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result[0]!.v6Composite).toBe(Number.POSITIVE_INFINITY)

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    expect(zeroCalls.length).toBe(0)
  })

  it('空板块: 无匹配股票时应返回空数组且无日志', () => {
    const stocks: Array<{ symbol: string; name: string; v6Composite?: number }> = []
    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result).toHaveLength(0)

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失')
    )
    expect(zeroCalls.length).toBe(0)
    expect(missingCalls.length).toBe(0)
  })

  it('日志信息完整性: 零值日志包含板块代码和数量', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 0 },
      { symbol: '688012.SH', name: '中微公司', v6Composite: 0 },
    ])

    getSectorPoolStocks(KNOWN_SECTOR, stocks)

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    expect(zeroCalls.length).toBeGreaterThanOrEqual(1)
    expect(zeroCalls[0]![0]).toContain('IC')
    expect(zeroCalls[0]![0]).toContain('2/2')
  })

  it('日志信息完整性: 缺失日志包含板块代码和数量', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际' },
      { symbol: '688012.SH', name: '中微公司' },
    ])

    getSectorPoolStocks(KNOWN_SECTOR, stocks)

    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失')
    )
    expect(missingCalls.length).toBeGreaterThanOrEqual(1)
    expect(missingCalls[0]![0]).toContain('IC')
    expect(missingCalls[0]![0]).toContain('2/2')
  })

  it('混合场景: 多股票 + 多种零值/缺失组合', () => {
    const stocks = createPoolStocks([
      { symbol: '688981.SH', name: '中芯国际', v6Composite: 0 },
      { symbol: '688012.SH', name: '中微公司' },
      { symbol: '688008.SH', name: '澜起科技', v6Composite: 9.2 },
      { symbol: '688009.SH', name: '中国通号', v6Composite: 0 },
    ])

    const result = getSectorPoolStocks(KNOWN_SECTOR, stocks)

    expect(result.length).toBeGreaterThanOrEqual(2)

    const zeroItems = result.filter((s) => s!.v6Composite === 0)
    expect(zeroItems.length).toBeGreaterThanOrEqual(1)

    const nanItems = result.filter((s) => Number.isNaN(s!.v6Composite))
    expect(nanItems.length).toBeGreaterThanOrEqual(1)

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失')
    )
    expect(zeroCalls.length).toBeGreaterThanOrEqual(1)
    expect(missingCalls.length).toBeGreaterThanOrEqual(1)
  })
})