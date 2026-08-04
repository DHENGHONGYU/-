import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import WatchlistWidget from './WatchlistWidget'
import MarketIndicesWidget from './MarketIndicesWidget'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'

// ── Mock MarketDataProvider ─────────────────────────────────────────
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  MarketDataProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMarketData: vi.fn(),
}))

const { useMarketData } = await import('@/cockpit/providers/MarketDataProvider')
const mockUseMarketData = vi.mocked(useMarketData)

const watchlistConfig: WidgetConfig = {
  instanceId: 'watchlist-1',
  widgetId: 'watchlist',
  title: '自选股',
  size: { cols: 1, rows: 1 },
  settings: {},
  visible: true,
  collapsed: false,
}

const indicesConfig: WidgetConfig = {
  instanceId: 'indices-1',
  widgetId: 'market-indices',
  title: '大盘指数',
  size: { cols: 1, rows: 1 },
  settings: {},
  visible: true,
  collapsed: false,
}

function createMockContextValue(
  watchlist: MarketData['watchlist'] = [],
  indices: MarketData['indices'] = [],
  loading: Record<string, boolean> = {},
  errors: Record<string, string | null> = {},
) {
  return {
    data: { watchlist, indices } as unknown as MarketData,
    loadingMap: loading,
    errorMap: errors,
    refreshWidget: vi.fn(),
    getTaskStats: () => ({ total: 0, running: 0, error: 0 }),
    sendChatMessage: vi.fn().mockResolvedValue({}),
  }
}

describe('WatchlistWidget 空值回归测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('price 为 undefined 时显示 -- 而非 0.00', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{ code: '600519', name: '贵州茅台', price: undefined, changePercent: 3.25 } as MarketData['watchlist'][number]],
      [],
      { 'watchlist-1': false },
    ))
    render(<WatchlistWidget config={watchlistConfig} />)
    expect(screen.getByText('--')).toBeTruthy()
    expect(screen.queryByText('0.00')).toBeNull()
  })

  it('changePercent 为 undefined 时显示 -- 而非 0.00%', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{ code: '600519', name: '贵州茅台', price: 1800, changePercent: undefined } as MarketData['watchlist'][number]],
      [],
      { 'watchlist-1': false },
    ))
    render(<WatchlistWidget config={watchlistConfig} />)
    expect(screen.getByText('--')).toBeTruthy()
    expect(screen.queryByText('0.00%')).toBeNull()
  })

  it('price 和 changePercent 同时为 undefined 时不崩溃', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{ code: '600519', name: '贵州茅台', price: undefined, changePercent: undefined } as MarketData['watchlist'][number]],
      [],
      { 'watchlist-1': false },
    ))
    expect(() => render(<WatchlistWidget config={watchlistConfig} />)).not.toThrow()
    const dashes = screen.getAllByText('--')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('正常值仍然正确渲染（无回归）', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{ code: '600519', name: '贵州茅台', price: 1800.5, changePercent: 3.25 } as MarketData['watchlist'][number]],
      [],
      { 'watchlist-1': false },
    ))
    render(<WatchlistWidget config={watchlistConfig} />)
    expect(screen.getByText('1800.50')).toBeTruthy()
    expect(screen.getByText('+3.25%')).toBeTruthy()
  })

  it('混合数据：正常和 undefined 并存时各自正确显示', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [
        { code: '600519', name: '贵州茅台', price: 1800, changePercent: 3.25 } as MarketData['watchlist'][number],
        { code: '000001', name: '平安银行', price: undefined, changePercent: undefined } as MarketData['watchlist'][number],
      ],
      [],
      { 'watchlist-1': false },
    ))
    render(<WatchlistWidget config={watchlistConfig} />)
    expect(screen.getByText('1800.00')).toBeTruthy()
    expect(screen.getByText('+3.25%')).toBeTruthy()
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2)
  })
})

describe('MarketIndicesWidget 空值回归测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('price 为 undefined 时显示 -- 而非 0.00', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      [{ code: 'SH000001', name: '上证指数', price: undefined, change: 10.5, changePercent: 0.32 } as MarketData['indices'][number]],
      { 'indices-1': false },
    ))
    render(<MarketIndicesWidget config={indicesConfig} />)
    expect(screen.getByText('--')).toBeTruthy()
    expect(screen.queryByText('0.00')).toBeNull()
  })

  it('changePercent 为 undefined 时显示 -- 而非 0.00%', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      [{ code: 'SH000001', name: '上证指数', price: 3200, change: undefined, changePercent: undefined } as MarketData['indices'][number]],
      { 'indices-1': false },
    ))
    render(<MarketIndicesWidget config={indicesConfig} />)
    expect(screen.getByText('--')).toBeTruthy()
    expect(screen.queryByText('0.00%')).toBeNull()
  })

  it('high 和 low 为 undefined 时显示 -- 而非 0', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      [{ code: 'SH000001', name: '上证指数', price: 3200, change: 10, changePercent: 0.3, high: undefined, low: undefined } as MarketData['indices'][number]],
      { 'indices-1': false },
    ))
    const { container } = render(<MarketIndicesWidget config={indicesConfig} />)
    // high/low 嵌入在 "最高: -- 最低: --" 文本中，检查整段文本
    const highLowText = container.textContent ?? ''
    expect(highLowText).toContain('最高:')
    expect(highLowText).toContain('最低:')
    expect(highLowText).not.toContain('最高: 0')
    expect(highLowText).not.toContain('最低: 0')
  })

  it('所有字段为 undefined 时不崩溃', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      [{ code: 'SH000001', name: '上证指数', price: undefined, change: undefined, changePercent: undefined, high: undefined, low: undefined } as MarketData['indices'][number]],
      { 'indices-1': false },
    ))
    expect(() => render(<MarketIndicesWidget config={indicesConfig} />)).not.toThrow()
    // price 和 changePercent 各产生一个独立的 -- 元素
    const dashes = screen.getAllByText('--')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('正常值仍然正确渲染（无回归）', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      [{ code: 'SH000001', name: '上证指数', price: 3200.5, change: 10.5, changePercent: 0.32, high: 3250, low: 3180, volume: '100亿' } as MarketData['indices'][number]],
      { 'indices-1': false },
    ))
    render(<MarketIndicesWidget config={indicesConfig} />)
    expect(screen.getByText('3200.50')).toBeTruthy()
    expect(screen.getByText('+0.32%')).toBeTruthy()
  })

  it('volume 为 undefined 时显示 --', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      [{ code: 'SH000001', name: '上证指数', price: 3200, change: 10, changePercent: 0.3, volume: undefined } as MarketData['indices'][number]],
      { 'indices-1': false },
    ))
    render(<MarketIndicesWidget config={indicesConfig} />)
    expect(screen.getByText(/成交.*--/)).toBeTruthy()
  })
})
