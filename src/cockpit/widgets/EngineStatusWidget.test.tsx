/**
 * EngineStatusWidget 单元测试
 *
 * 覆盖场景：
 * 1. 默认 props 渲染不崩溃
 * 2. 渲染 EngineStatusCard 子组件
 * 3. displayName === 'EngineStatusWidget'
 * 4. 挂载时打印日志 "[EngineStatusWidget] Widget mounted"
 * 5. isMonitoring=false 时挂载调用 refreshSnapshot
 * 6. isMonitoring=true 时挂载不调用 refreshSnapshot
 * 7. 接受可选 data prop（MarketData）不崩溃
 * 8. data 为 undefined 时正常渲染（边界条件）
 * 9. config.settings 为空对象时正常渲染（边界条件）
 * 10. 卸载后无错误且 useEffect cleanup 执行
 * 11. props 变化（data 更新）不重复触发 refreshSnapshot
 * 12. isMonitoring 从 false → true 时 effect 不再调用 refreshSnapshot
 * 13. memo 包装：相同 props 重渲染不重新执行 effect
 * 14. 极端数值/边界 props（极端 size）不崩溃
 *
 * AGENTS.md §3 合规：
 * - 不使用 any
 * - 不硬编码颜色断言（本 Widget 不渲染颜色，仅做 wrapper）
 * - useEffect cleanup 验证（卸载后无残留副作用）
 * - 使用 vi.mock mock store 与子组件
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import EngineStatusWidget from '@/cockpit/widgets/EngineStatusWidget'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'

// ============================================================
// Mock 1: logger（避免真实日志输出，便于断言）
// ============================================================
const mockLoggerInfo = vi.hoisted(() => vi.fn())
const mockLoggerWarn = vi.hoisted(() => vi.fn())
const mockLoggerError = vi.hoisted(() => vi.fn())
const mockLoggerDebug = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  }),
}))

// ============================================================
// Mock 2: useSystemMonitorStore（控制 isMonitoring / refreshSnapshot）
// ============================================================
const mockRefreshSnapshot = vi.hoisted(() => vi.fn())
const mockUseSystemMonitorStore = vi.hoisted(() => vi.fn())

vi.mock('@/store/systemMonitorStore', () => ({
  useSystemMonitorStore: mockUseSystemMonitorStore,
}))

// ============================================================
// Mock 3: EngineStatusCard 子组件（验证 wrapper 转发渲染）
// ============================================================
const mockEngineStatusCardRender = vi.hoisted(() => vi.fn())

vi.mock('@/components/system/EngineStatusCard', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockEngineStatusCardRender(props)
    return <div data-testid="engine-status-card-mock" />
  },
}))

// ============================================================
// 测试辅助
// ============================================================

/** 配置 useSystemMonitorStore hook 的返回值 */
function setupStoreHook(options: {
  isMonitoring?: boolean
  refreshSnapshot?: () => void
} = {}): { refreshSnapshot: () => void } {
  const refreshSnapshot = options.refreshSnapshot ?? mockRefreshSnapshot
  mockUseSystemMonitorStore.mockImplementation((selector: (state: unknown) => unknown) => {
    const state = {
      isMonitoring: options.isMonitoring ?? false,
      refreshSnapshot,
    }
    return selector(state)
  })
  return { refreshSnapshot }
}

/** 构造最小 WidgetConfig mock */
function createMockConfig(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    instanceId: 'engineStatus_1',
    widgetId: 'engineStatus',
    size: { cols: 4, rows: 2 },
    title: '引擎状态监控',
    settings: {},
    visible: true,
    collapsed: false,
    ...overrides,
  }
}

/** 构造最小 MarketData mock（仅断言 wrapper 不读取具体字段） */
function createMockMarketData(): MarketData {
  return {
    timestamp: Date.now(),
    indices: [],
    sectors: [],
    fundFlows: [],
    sentiment: {} as MarketData['sentiment'],
    watchlist: [],
    portfolio: {} as MarketData['portfolio'],
    tradeReview: {} as MarketData['tradeReview'],
    analysisScores: {} as MarketData['analysisScores'],
    modelComparison: {} as MarketData['modelComparison'],
    stockPool: {} as MarketData['stockPool'],
    chatHistory: {} as MarketData['chatHistory'],
    hotSectors: [],
    valuePit: [],
  } as unknown as MarketData
}

// ============================================================
// 测试套件
// ============================================================

describe('EngineStatusWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 store 状态：未监控 + 提供空 refreshSnapshot
    setupStoreHook({ isMonitoring: false, refreshSnapshot: mockRefreshSnapshot })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('默认 props 渲染不崩溃', () => {
    render(<EngineStatusWidget config={createMockConfig()} />)

    expect(screen.getByTestId('engine-status-card-mock')).toBeInTheDocument()
  })

  it('渲染 EngineStatusCard 子组件（wrapper 转发）', () => {
    render(<EngineStatusWidget config={createMockConfig()} />)

    expect(mockEngineStatusCardRender).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('engine-status-card-mock')).toBeInTheDocument()
  })

  it('组件 displayName 为 "EngineStatusWidget"', () => {
    expect(EngineStatusWidget.displayName).toBe('EngineStatusWidget')
  })

  it('挂载时打印日志 "[EngineStatusWidget] Widget mounted"', () => {
    render(<EngineStatusWidget config={createMockConfig()} />)

    expect(mockLoggerInfo).toHaveBeenCalledWith('[EngineStatusWidget] Widget mounted')
  })

  it('isMonitoring=false 时挂载调用 refreshSnapshot', () => {
    setupStoreHook({ isMonitoring: false, refreshSnapshot: mockRefreshSnapshot })

    render(<EngineStatusWidget config={createMockConfig()} />)

    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)
  })

  it('isMonitoring=true 时挂载不调用 refreshSnapshot（已在监控中）', () => {
    setupStoreHook({ isMonitoring: true, refreshSnapshot: mockRefreshSnapshot })

    render(<EngineStatusWidget config={createMockConfig()} />)

    expect(mockRefreshSnapshot).not.toHaveBeenCalled()
  })

  it('接受可选 data prop（MarketData）不崩溃', () => {
    render(<EngineStatusWidget config={createMockConfig()} data={createMockMarketData()} />)

    expect(screen.getByTestId('engine-status-card-mock')).toBeInTheDocument()
  })

  it('data 为 undefined 时正常渲染（边界条件）', () => {
    render(<EngineStatusWidget config={createMockConfig()} data={undefined} />)

    expect(screen.getByTestId('engine-status-card-mock')).toBeInTheDocument()
  })

  it('config.settings 为空对象时正常渲染（边界条件）', () => {
    const config = createMockConfig({ settings: {} })

    render(<EngineStatusWidget config={config} />)

    expect(screen.getByTestId('engine-status-card-mock')).toBeInTheDocument()
  })

  it('卸载后无错误且 useEffect cleanup 执行（无残留副作用）', () => {
    const { unmount } = render(<EngineStatusWidget config={createMockConfig()} />)

    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)

    // 卸载不应抛出错误，且不应再次调用 refreshSnapshot
    expect(() => unmount()).not.toThrow()
    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)
  })

  it('props 变化（data 更新）不重复触发 refreshSnapshot', () => {
    const { rerender } = render(
      <EngineStatusWidget config={createMockConfig()} data={createMockMarketData()} />,
    )

    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)

    // 用新 data 重渲染：effect 依赖 [isMonitoring, refreshSnapshot]，不应重新触发
    rerender(
      <EngineStatusWidget config={createMockConfig()} data={createMockMarketData()} />,
    )

    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)
  })

  it('isMonitoring 从 false → true 时 effect 重新运行但不调用 refreshSnapshot', () => {
    const { rerender } = render(<EngineStatusWidget config={createMockConfig()} />)

    // 初始挂载：isMonitoring=false，调用一次 refreshSnapshot
    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)
    expect(mockLoggerInfo).toHaveBeenCalledWith('[EngineStatusWidget] Widget mounted')

    // 切换到 isMonitoring=true：effect 因依赖变化重新运行，但分支不调用 refreshSnapshot
    setupStoreHook({ isMonitoring: true, refreshSnapshot: mockRefreshSnapshot })
    rerender(<EngineStatusWidget config={createMockConfig()} />)

    // 仍是 1 次（仅在 isMonitoring=false 时调用过）
    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)
    // logger.info 会因 effect 重新运行再打印一次
    expect(mockLoggerInfo).toHaveBeenCalledTimes(2)
  })

  it('memo 包装：相同 props 重渲染不重新执行 effect', () => {
    const config = createMockConfig()
    const { rerender } = render(<EngineStatusWidget config={config} />)

    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1)

    // 用完全相同的 props 引用重渲染：memo 应跳过
    rerender(<EngineStatusWidget config={config} />)

    // effect 不应再次运行
    expect(mockRefreshSnapshot).toHaveBeenCalledTimes(1)
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1)
  })

  it('极端数值/边界 props（极端 size）不崩溃', () => {
    const extremeConfig = createMockConfig({
      size: { cols: Number.MAX_SAFE_INTEGER, rows: 0 },
      position: { x: -1, y: -1 },
    })

    render(<EngineStatusWidget config={extremeConfig} data={createMockMarketData()} />)

    expect(screen.getByTestId('engine-status-card-mock')).toBeInTheDocument()
  })
})
