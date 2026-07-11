import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import WatchlistWidget from './WatchlistWidget'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

/**
 * 将 HEX 颜色转换为 RGB 格式（jsdom 会自动转换）
 * @example hexToRgb('#ef4444') => 'rgb(239, 68, 68)'
 */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * 创建模拟 MarketData（仅需 watchlist 字段，其余用空值填充）
 * 测试中 useMarketData 被 mock，组件仅读取 watchlist
 */
function createMockMarketData(watchlist: MarketData['watchlist'] = []): MarketData {
  return { watchlist } as unknown as MarketData
}

/**
 * 创建模拟 useMarketData 返回值（包含完整的 MarketDataContextValue）
 */
function createMockContextValue(
  watchlist: MarketData['watchlist'] = [],
  loading: Record<string, boolean> = {},
  errors: Record<string, string | null> = {},
) {
  return {
    data: createMockMarketData(watchlist),
    loadingMap: loading,
    errorMap: errors,
    refreshWidget: vi.fn(),
    getTaskStats: () => ({ total: 0, running: 0, error: 0 }),
    sendChatMessage: vi.fn().mockResolvedValue({}),
  }
}

// Mock MarketDataProvider
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  MarketDataProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMarketData: vi.fn(),
}))

const { useMarketData } = await import('@/cockpit/providers/MarketDataProvider')
const mockUseMarketData = vi.mocked(useMarketData)

const defaultConfig: WidgetConfig = {
  instanceId: 'watchlist-1',
  widgetId: 'watchlist',
  title: '自选股',
  size: { cols: 1, rows: 1 },
  settings: {},
  visible: true,
  collapsed: false,
}

function renderWithProvider(ui: React.ReactElement) {
  return render(ui)
}

describe('WatchlistWidget 颜色逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loading 状态显示骨架屏', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      { 'watchlist-1': true },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)
    // 自定义骨架屏使用 Skeleton 组件（animate-pulse rounded-sm）
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('error 状态显示错误信息', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      { 'watchlist-1': false },
      { 'watchlist-1': '数据加载失败' },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)
    expect(screen.getByText('数据加载失败')).toBeTruthy()
  })

  it('空列表不渲染股票项', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [],
      { 'watchlist-1': false },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)
    expect(screen.queryByText('贵州茅台')).toBeNull()
  })

  it('上涨股票使用红色（A股标准）', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{
        code: '600519',
        name: '贵州茅台',
        price: 1800.00,
        changePercent: 3.25,
      } as MarketData['watchlist'][number]],
      { 'watchlist-1': false },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)
    expect(screen.getByText('贵州茅台')).toBeTruthy()
    expect(screen.getByText('+3.25%')).toBeTruthy()
    // 验证颜色使用 A 股红色（jsdom 会将 HEX 转换为 RGB）
    const changeEl = screen.getByText('+3.25%')
    expect(changeEl.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.up.hex))
  })

  it('下跌股票使用绿色（A股标准）', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{
        code: '000001',
        name: '平安银行',
        price: 12.50,
        changePercent: -1.80,
      } as MarketData['watchlist'][number]],
      { 'watchlist-1': false },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)
    expect(screen.getByText('-1.80%')).toBeTruthy()
    const changeEl = screen.getByText('-1.80%')
    expect(changeEl.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.down.hex))
  })

  it('平盘股票使用灰色', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{
        code: '601398',
        name: '工商银行',
        price: 5.20,
        changePercent: 0,
      } as MarketData['watchlist'][number]],
      { 'watchlist-1': false },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)
    expect(screen.getByText('0.00%')).toBeTruthy()
    const changeEl = screen.getByText('0.00%')
    expect(changeEl.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.neutral.hex))
  })

  it('多只股票各自使用正确的涨跌颜色', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [
        { code: '600519', name: '贵州茅台', price: 1800, changePercent: 2.5 },
        { code: '000001', name: '平安银行', price: 12.5, changePercent: -1.0 },
        { code: '601398', name: '工商银行', price: 5.2, changePercent: 0 },
      ] as MarketData['watchlist'],
      { 'watchlist-1': false },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)

    const upEl = screen.getByText('+2.50%')
    const downEl = screen.getByText('-1.00%')
    const flatEl = screen.getByText('0.00%')

    expect(upEl.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.up.hex))
    expect(downEl.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.down.hex))
    expect(flatEl.style.color).toBe(hexToRgb(STOCK_COLOR_TOKENS.neutral.hex))
  })

  it('颜色不依赖 cockpit.constants.COLORS（美股标准已废弃）', () => {
    mockUseMarketData.mockReturnValue(createMockContextValue(
      [{
        code: '600519',
        name: '贵州茅台',
        price: 1800.00,
        changePercent: 5.0,
      } as MarketData['watchlist'][number]],
      { 'watchlist-1': false },
    ))
    renderWithProvider(<WatchlistWidget config={defaultConfig} />)
    const changeEl = screen.getByText('+5.00%')
    // A 股上涨 = 红色 #ef4444，不是美股绿色 #22c55e（jsdom 转换为 RGB）
    expect(changeEl.style.color).toBe(hexToRgb('#ef4444'))
    expect(changeEl.style.color).not.toBe(hexToRgb('#22c55e'))
  })
})
