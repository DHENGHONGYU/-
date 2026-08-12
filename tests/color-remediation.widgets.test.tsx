/**
 * @fileoverview 颜色整改验证测试 - Cockpit Widget
 * @description 验证 FundFlowWidget、SignalMonitorWidget、MarketSentimentWidget
 * 在批次 E 中的 A 股惯例修正（红涨绿跌）。
 *
 * 整改背景：
 * - FundFlowWidget: 北向资金流出图标色（红→绿）、getValueColor 涨跌色互换
 * - SignalMonitorWidget: 买入统计色（绿→红）、卖出统计色（红→绿）
 * - MarketSentimentWidget: 恐慌贪婪指数标签色（>50 绿→红，<50 红→绿）
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { WidgetConfig, SentimentData } from '@/types/modules/widget.types'
import { STOCK_COLOR_MAPPING } from '@/constants/cockpit.constants'
import { STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'
import { UI_TEXT } from '@/constants/uiText'
import type { FundFlow } from '@/cockpit/data/mockDataProvider'

// ============================================================
// Mock: MockMarketDataProvider.getFundFlows（FundFlowWidget 依赖）
// 使用 vi.hoisted 确保 mockGetFundFlows 在 vi.mock hoisting 之前定义，
// 避免 TDZ（temporal dead zone）和 unused-vars 警告。
// ============================================================
const { mockGetFundFlows } = vi.hoisted(() => ({
  mockGetFundFlows: vi.fn<() => Promise<FundFlow[]>>(() => Promise.resolve([])),
}))

vi.mock('@/cockpit/data/mockDataProvider', () => ({
  MockMarketDataProvider: {
    getFundFlows: () => mockGetFundFlows(),
  },
}))

// ============================================================
// Mock: useMarketData（MarketSentimentWidget 依赖）
// ============================================================
const mockUseMarketData = vi.fn()
vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  useMarketData: () => mockUseMarketData(),
}))

// ============================================================
// Mock: signalStore（SignalMonitorWidget 依赖）
// ============================================================
const mockUseSignalStore = vi.fn()
const mockTopSignals = vi.fn()
const mockInitSignalStoreSubscriptions = vi.fn()
vi.mock('@/store/signalStore', () => ({
  useSignalStore: mockUseSignalStore,
  topSignals: (...args: unknown[]) => mockTopSignals(...args),
  initSignalStoreSubscriptions: () => mockInitSignalStoreSubscriptions(),
}))

// 延迟导入被测组件
const FundFlowWidget = (await import('@/cockpit/widgets/FundFlowWidget')).default
const SignalMonitorWidget = (await import('@/cockpit/widgets/SignalMonitorWidget')).default
const MarketSentimentWidget = (await import('@/cockpit/widgets/MarketSentimentWidget')).default

// ============================================================
// 辅助函数
// ============================================================
function buildConfig(title = '测试'): WidgetConfig {
  return {
    instanceId: 'test-widget-1',
    widgetId: 'test-widget',
    title,
    size: { cols: 2, rows: 2 },
    settings: {},
    visible: true,
    collapsed: false,
  }
}

/** 构建 MarketData mock 返回值，loadingMap 中 instanceId 对应 false 避免 loading 状态 */
function buildMarketDataReturn(sentiment: SentimentData, instanceId = 'test-widget-1') {
  return {
    data: { sentiment },
    loadingMap: { [instanceId]: false },
    errorMap: {},
    refreshWidget: vi.fn(),
    getTaskStats: () => ({ total: 0, running: 0, error: 0 }),
    sendChatMessage: vi.fn(),
  }
}

/** 构建 FundFlow 专用的 MarketData mock 返回值 */
function buildFundFlowMarketDataReturn(flows: FundFlow[], instanceId = 'test-widget-1') {
  return {
    data: { fundFlows: flows },
    loadingMap: { [instanceId]: false },
    errorMap: {},
    refreshWidget: vi.fn(),
    getTaskStats: () => ({ total: 0, running: 0, error: 0 }),
    sendChatMessage: vi.fn(),
  }
}

function buildSentiment(overrides: Partial<SentimentData> = {}): SentimentData {
  return {
    fearGreedIndex: 65,
    fearGreedLabel: '贪婪',
    totalStocks: 4000,
    up: 2200,
    down: 1500,
    flat: 300,
    limitUp: 50,
    limitDown: 20,
    ...overrides,
  }
}

function buildFundFlow(overrides: Partial<FundFlow> = {}): FundFlow {
  return {
    type: 'north',
    name: '北向资金',
    value: 100,
    unit: '亿',
    ...overrides,
  }
}

// ============================================================
// 测试套件
// ============================================================
describe('颜色整改 - A 股惯例验证（批次 E）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInitSignalStoreSubscriptions.mockReturnValue(() => {})
  })

  // ----------------------------------------------------------
  // FundFlowWidget: 北向资金流向色（A 股惯例：红涨绿跌）
  // ----------------------------------------------------------
  describe('FundFlowWidget - 北向资金流向色', () => {
    it('STOCK_COLOR_MAPPING.UP_CLASS 应为 A 股红色（红涨）', () => {
      expect(STOCK_COLOR_MAPPING.UP_CLASS).toBe(STOCK_COLOR_TOKENS.up.tailwind)
      expect(STOCK_COLOR_TOKENS.up.tailwind).toBe('text-red-500')
    })

    it('STOCK_COLOR_MAPPING.DOWN_CLASS 应为 A 股绿色（绿跌）', () => {
      expect(STOCK_COLOR_MAPPING.DOWN_CLASS).toBe(STOCK_COLOR_TOKENS.down.tailwind)
      expect(STOCK_COLOR_TOKENS.down.tailwind).toBe('text-green-500')
    })

    it('北向资金净流入（value > 0）应渲染红色上涨图标', async () => {
      const inflow = buildFundFlow({ type: 'north', value: 100, name: '北向资金流入' })
      mockUseMarketData.mockReturnValue(buildFundFlowMarketDataReturn([inflow]))

      const { container } = render(<FundFlowWidget config={buildConfig('资金流向')} />)

      await waitFor(() => {
        expect(screen.getByText('北向资金流入')).toBeInTheDocument()
      })

      // 红色上涨箭头图标应使用 STOCK_COLOR_MAPPING.UP_CLASS
      const upIcon = container.querySelector('.text-red-500')
      expect(upIcon).not.toBeNull()
    })

    it('北向资金净流出（value < 0）应渲染绿色下跌图标（A 股惯例）', async () => {
      const outflow = buildFundFlow({ type: 'north', value: -50, name: '北向资金流出' })
      mockUseMarketData.mockReturnValue(buildFundFlowMarketDataReturn([outflow]))

      const { container } = render(<FundFlowWidget config={buildConfig('资金流向')} />)

      await waitFor(() => {
        expect(screen.getByText('北向资金流出')).toBeInTheDocument()
      })

      // 绿色下跌箭头图标应使用 STOCK_COLOR_MAPPING.DOWN_CLASS
      const downIcon = container.querySelector('.text-green-500')
      expect(downIcon).not.toBeNull()
    })

    it('净流入金额应渲染为红色（A 股惯例：红涨）', async () => {
      const inflow = buildFundFlow({ type: 'main', value: 200, name: '主力净流入', unit: '万' })
      mockUseMarketData.mockReturnValue(buildFundFlowMarketDataReturn([inflow]))

      render(<FundFlowWidget config={buildConfig('资金流向')} />)

      await waitFor(() => {
        expect(screen.getByText(/200/)).toBeInTheDocument()
      })

      // 数值应包含 STOCK_COLOR_MAPPING.UP_CLASS（text-red-500）
      const valueSpan = screen.getByText(/200/).closest('span')
      expect(valueSpan?.className).toContain(STOCK_COLOR_MAPPING.UP_CLASS)
    })

    it('净流出金额应渲染为绿色（A 股惯例：绿跌）', async () => {
      const outflow = buildFundFlow({ type: 'main', value: -150, name: '主力净流出', unit: '万' })
      mockUseMarketData.mockReturnValue(buildFundFlowMarketDataReturn([outflow]))

      render(<FundFlowWidget config={buildConfig('资金流向')} />)

      await waitFor(() => {
        expect(screen.getByText(/150/)).toBeInTheDocument()
      })

      // 数值应包含 STOCK_COLOR_MAPPING.DOWN_CLASS（text-green-500）
      const valueSpan = screen.getByText(/150/).closest('span')
      expect(valueSpan?.className).toContain(STOCK_COLOR_MAPPING.DOWN_CLASS)
    })
  })

  // ----------------------------------------------------------
  // SignalMonitorWidget: 买入/卖出统计色（A 股惯例）
  // ----------------------------------------------------------
  describe('SignalMonitorWidget - 买入/卖出统计色', () => {
    function buildSignal(direction: 'buy' | 'sell' | 'hold' | 'watch') {
      return {
        id: `sig-${direction}`,
        symbol: `TEST-${direction}`,
        direction,
        type: 'technical',
        confidence: 75,
        rationale: '测试信号',
        snapshot: {
          price: 10,
          volume: 1000,
          changePct: 1.5,
          timestamp: Date.now(),
        } as never,
        createdAt: Date.now(),
      }
    }

    function setupSignals(directions: Array<'buy' | 'sell' | 'hold' | 'watch'>) {
      const signals = directions.map(buildSignal)
      mockUseSignalStore.mockReturnValue({
        loading: false,
        error: null,
        signals,
      })
      mockTopSignals.mockReturnValue(signals)
    }

    it('当存在买入信号时，"买入"统计色应为红色（A 股惯例：买入=看涨=红）', () => {
      setupSignals(['buy', 'buy'])

      render(<SignalMonitorWidget config={buildConfig('信号监控')} />)

      // 查找包含"买入"文字的外层 span，其内部包含统计数字的 span
      const buyLabel = screen.getByText(new RegExp(UI_TEXT.errors.buy + ':'))
      const buyCountSpan = buyLabel.querySelector('span.font-medium')

      expect(buyCountSpan).not.toBeNull()
      expect(buyCountSpan?.className).toContain(STOCK_COLOR_MAPPING.UP_CLASS)
      expect(buyCountSpan?.className).toContain('text-red-500')
    })

    it('当存在卖出信号时，"卖出"统计色应为绿色（A 股惯例：卖出=看跌=绿）', () => {
      setupSignals(['sell', 'sell'])

      render(<SignalMonitorWidget config={buildConfig('信号监控')} />)

      const sellLabel = screen.getByText(new RegExp(UI_TEXT.errors.sell + ':'))
      const sellCountSpan = sellLabel.querySelector('span.font-medium')

      expect(sellCountSpan).not.toBeNull()
      expect(sellCountSpan?.className).toContain(STOCK_COLOR_MAPPING.DOWN_CLASS)
      expect(sellCountSpan?.className).toContain('text-green-500')
    })

    it('不应再使用国际惯例（买入=绿、卖出=红）', () => {
      setupSignals(['buy', 'sell'])

      render(<SignalMonitorWidget config={buildConfig('信号监控')} />)

      const buyLabel = screen.getByText(new RegExp(UI_TEXT.errors.buy + ':'))
      const buyCountSpan = buyLabel.querySelector('span.font-medium')

      // 买入不应使用绿色（国际惯例）
      expect(buyCountSpan?.className).not.toContain('text-green-500')

      const sellLabel = screen.getByText(new RegExp(UI_TEXT.errors.sell + ':'))
      const sellCountSpan = sellLabel.querySelector('span.font-medium')

      // 卖出不应使用红色（国际惯例）
      expect(sellCountSpan?.className).not.toContain('text-red-500')
    })
  })

  // ----------------------------------------------------------
  // MarketSentimentWidget: 恐慌贪婪指数标签色（A 股惯例）
  // ----------------------------------------------------------
  describe('MarketSentimentWidget - 恐慌贪婪指数标签色', () => {
    function setupSentiment(sentiment: SentimentData) {
      mockUseMarketData.mockReturnValue(buildMarketDataReturn(sentiment))
    }

    it('恐慌贪婪指数 > 50（贪婪=看涨）应渲染红色标签（A 股惯例）', () => {
      const sentiment = buildSentiment({
        fearGreedIndex: 75,
        fearGreedLabel: '贪婪',
      })
      setupSentiment(sentiment)

      render(<MarketSentimentWidget config={buildConfig('市场情绪')} />)

      // 恐慌贪婪指数标签（带 px-2 py-0.5 rounded 类名）应使用红色背景
      const labels = screen.getAllByText('贪婪')
      const sentimentLabel = labels.find((el) => el.className.includes('px-2'))
      expect(sentimentLabel).toBeDefined()
      expect(sentimentLabel?.className).toContain('bg-red-100')
      expect(sentimentLabel?.className).toContain('text-red-700')
    })

    it('恐慌贪婪指数 < 50（恐慌=看跌）应渲染绿色标签（A 股惯例）', () => {
      const sentiment = buildSentiment({
        fearGreedIndex: 25,
        fearGreedLabel: '恐慌',
      })
      setupSentiment(sentiment)

      render(<MarketSentimentWidget config={buildConfig('市场情绪')} />)

      // 恐慌贪婪指数标签应使用绿色背景（bg-green-100 text-green-700）
      const labels = screen.getAllByText('恐慌')
      const sentimentLabel = labels.find((el) => el.className.includes('px-2'))
      expect(sentimentLabel).toBeDefined()
      expect(sentimentLabel?.className).toContain('bg-green-100')
      expect(sentimentLabel?.className).toContain('text-green-700')
    })

    it('恐慌贪婪指数 = 50（边界）应渲染绿色标签（< 50 走 panic 分支）', () => {
      const sentiment = buildSentiment({
        fearGreedIndex: 50,
        fearGreedLabel: '中性',
      })
      setupSentiment(sentiment)

      render(<MarketSentimentWidget config={buildConfig('市场情绪')} />)

      // 边界值 50 不满足 > 50，走 else 分支（绿色）
      const label = screen.getByText(UI_TEXT.errors.neutral)
      expect(label.className).toContain('bg-green-100')
      expect(label.className).toContain('text-green-700')
    })

    it('不应再使用国际惯例（贪婪=绿、恐慌=红）', () => {
      const sentiment = buildSentiment({
        fearGreedIndex: 80,
        fearGreedLabel: '极度贪婪',
      })
      setupSentiment(sentiment)

      render(<MarketSentimentWidget config={buildConfig('市场情绪')} />)

      const labels = screen.getAllByText('极度贪婪')
      const sentimentLabel = labels.find((el) => el.className.includes('px-2'))
      expect(sentimentLabel).toBeDefined()
      // 贪婪不应使用绿色背景（国际惯例）
      expect(sentimentLabel?.className).not.toContain('bg-green-100')
      expect(sentimentLabel?.className).not.toContain('text-green-700')
    })
  })
})

// ============================================================
// 颜色常量一致性测试（防止 STOCK_COLOR_TOKENS 被意外修改）
// ============================================================
describe('颜色常量一致性 - A 股惯例锚点', () => {
  it('STOCK_COLOR_TOKENS.up.tailwind 应为 text-red-500（红涨）', () => {
    expect(STOCK_COLOR_TOKENS.up.tailwind).toBe('text-red-500')
    expect(STOCK_COLOR_TOKENS.up.hex).toBe('#ef4444')
  })

  it('STOCK_COLOR_TOKENS.down.tailwind 应为 text-green-500（绿跌）', () => {
    expect(STOCK_COLOR_TOKENS.down.tailwind).toBe('text-green-500')
    expect(STOCK_COLOR_TOKENS.down.hex).toBe('#22c55e')
  })

  it('STOCK_COLOR_MAPPING 应与 STOCK_COLOR_TOKENS up/down 一致', () => {
    expect(STOCK_COLOR_MAPPING.UP_CLASS).toBe(STOCK_COLOR_TOKENS.up.tailwind)
    expect(STOCK_COLOR_MAPPING.DOWN_CLASS).toBe(STOCK_COLOR_TOKENS.down.tailwind)
    expect(STOCK_COLOR_MAPPING.UP).toBe(STOCK_COLOR_TOKENS.up.hex)
    expect(STOCK_COLOR_MAPPING.DOWN).toBe(STOCK_COLOR_TOKENS.down.hex)
  })
})
