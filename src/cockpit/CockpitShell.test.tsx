/**
 * CockpitShell 组件单元测试
 *
 * 覆盖场景：
 * 1. 渲染不崩溃 + MarketDataProvider 包裹
 * 2. header 标题 "驾驶舱"
 * 3. "添加 Widget" 按钮 + "返回首页" 链接
 * 4. Widget 数量 Badge（空实例 0）
 * 5. 缓存统计 Badge
 * 6. 采集任务统计 Badge（running/total）
 * 7. 挂载时调用 widgetRegistry.getAllInstances
 * 8. 挂载时订阅 widgetRegistry 事件
 * 9. 卸载时调用 unsubscribe 清理订阅（AGENTS.md §3 事件监听清理）
 * 10. 非空实例时显示正确的 Widget 数量
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import CockpitShell from '@/cockpit/CockpitShell'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'

// ============================================================
// Mock 1: logger（避免真实日志输出）
// ============================================================
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// Mock 2: react-router Link（避免真实路由依赖）
// ============================================================
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children: ReactNode }) => (
      <a href={to} data-testid="router-link">
        {children}
      </a>
    ),
  }
})

// ============================================================
// Mock 3: lucide-react icons（渲染占位 SVG）
// ============================================================
vi.mock('lucide-react', () => ({
  Settings: () => <svg data-testid="icon-settings" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Target: () => <svg data-testid="icon-target" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  ChevronRight: () => <svg data-testid="icon-chevron-right" />,
}))

// ============================================================
// Mock 4: react-grid-layout（直接渲染 children，避免 jsdom 布局问题）
// ============================================================
vi.mock('react-grid-layout', () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  ),
  GridLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  ),
}))

// ============================================================
// Mock 5: WidgetErrorBoundary（直接渲染 children）
// ============================================================
vi.mock('@/components/organisms/shared/WidgetErrorBoundary', () => ({
  WidgetErrorBoundary: ({ children }: { children: ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}))

// ============================================================
// Mock 6: widgetRegistry（控制 getAllInstances / subscribe）
// ============================================================
const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockGetAllInstances = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn())

vi.mock('@/cockpit/core/widgetRegistry', () => ({
  widgetRegistry: {
    getAllInstances: mockGetAllInstances,
    subscribe: mockSubscribe,
  },
}))

// ============================================================
// Mock 7: widgetEngine（控制 mount/loadComponent/unmount/getStats）
// ============================================================
const mockMountInstance = vi.hoisted(() => vi.fn())
const mockLoadComponent = vi.hoisted(() => vi.fn())
const mockUnmountInstance = vi.hoisted(() => vi.fn())
const mockGetStats = vi.hoisted(() => vi.fn())
const mockRefreshInstance = vi.hoisted(() => vi.fn())

vi.mock('@/cockpit/core/widgetEngine', () => ({
  widgetEngine: {
    mountInstance: mockMountInstance,
    loadComponent: mockLoadComponent,
    unmountInstance: mockUnmountInstance,
    getStats: mockGetStats,
    refreshInstance: mockRefreshInstance,
  },
}))

// ============================================================
// Mock 8: MarketDataProvider（渲染占位 + 控制 useMarketData 返回值）
// ============================================================
const mockUseMarketData = vi.hoisted(() => vi.fn())

vi.mock('@/cockpit/providers/MarketDataProvider', () => ({
  MarketDataProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="market-provider">{children}</div>
  ),
  useMarketData: mockUseMarketData,
}))

// ============================================================
// 测试辅助：构造最小 MarketData mock
// ============================================================

const mockMarketData = {} as unknown as MarketData

function setupMarketDataHook(
  stats: { total: number; running: number; error: number } = {
    total: 0,
    running: 0,
    error: 0,
  },
): void {
  mockUseMarketData.mockReturnValue({
    data: mockMarketData,
    getTaskStats: () => stats,
    refreshWidget: vi.fn(),
    sendChatMessage: vi.fn(),
    loadingMap: {},
    errorMap: {},
  })
}

// ============================================================
// 测试套件
// ============================================================

describe('CockpitShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // 默认空实例 + 0 缓存
    mockGetAllInstances.mockReturnValue([])
    mockGetStats.mockReturnValue({ cachedComponents: 0 })
    mockSubscribe.mockReturnValue(mockUnsubscribe)
    setupMarketDataHook()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染不崩溃，且包裹 MarketDataProvider', () => {
    render(<CockpitShell />)

    expect(screen.getByTestId('market-provider')).toBeInTheDocument()
    expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
  })

  it('渲染 header 标题 "驾驶舱"', () => {
    render(<CockpitShell />)

    expect(screen.getByText('驾驶舱')).toBeInTheDocument()
  })

  it('渲染 "添加 Widget" 按钮和 "返回首页" 链接', () => {
    render(<CockpitShell />)

    expect(screen.getByText('添加 Widget')).toBeInTheDocument()
    expect(screen.getByText('返回首页')).toBeInTheDocument()
  })

  it('空实例时渲染 Widget 数量 Badge 显示 "0 个 Widget"', () => {
    render(<CockpitShell />)

    expect(screen.getByText('0 个 Widget')).toBeInTheDocument()
  })

  it('渲染缓存统计 Badge（显示 cachedComponents 数值）', () => {
    mockGetStats.mockReturnValue({ cachedComponents: 5 })

    render(<CockpitShell />)

    expect(screen.getByText('缓存: 5')).toBeInTheDocument()
  })

  it('渲染采集任务统计 Badge（显示 running/total）', () => {
    setupMarketDataHook({ total: 10, running: 3, error: 1 })

    render(<CockpitShell />)

    expect(screen.getByText('采集任务: 3/10')).toBeInTheDocument()
  })

  it('挂载时调用 widgetRegistry.getAllInstances 获取实例列表', () => {
    render(<CockpitShell />)

    expect(mockGetAllInstances).toHaveBeenCalledTimes(1)
  })

  it('挂载时订阅 widgetRegistry 事件（用于响应实例增删）', () => {
    render(<CockpitShell />)

    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    // 订阅回调应为函数
    const subscribeArg = mockSubscribe.mock.calls[0]?.[0]
    expect(typeof subscribeArg).toBe('function')
  })

  it('卸载时调用 unsubscribe 清理订阅（AGENTS.md §3 事件监听清理）', () => {
    const { unmount } = render(<CockpitShell />)

    // 挂载时订阅，但尚未取消订阅
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(mockUnsubscribe).not.toHaveBeenCalled()

    // 卸载后必须调用 unsubscribe（cleanup 验证）
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('非空实例时显示正确的 Widget 数量', () => {
    const mockInstances: WidgetConfig[] = [
      {
        instanceId: 'marketIndices_1',
        widgetId: 'marketIndices',
        size: { cols: 4, rows: 2 },
        title: '大盘指数',
        settings: {},
        visible: true,
        collapsed: false,
      },
      {
        instanceId: 'fundFlow_1',
        widgetId: 'fundFlow',
        size: { cols: 2, rows: 2 },
        title: '资金流向',
        settings: {},
        visible: true,
        collapsed: false,
      },
    ]

    mockGetAllInstances.mockReturnValue(mockInstances)
    mockMountInstance.mockResolvedValue(true)
    mockLoadComponent.mockResolvedValue(() => null)

    render(<CockpitShell />)

    expect(screen.getByText('2 个 Widget')).toBeInTheDocument()
  })

  // ============================================================
  // 边界条件测试（v1.x 新增）
  // ============================================================

  it('loadLayout: localStorage 存储无效 JSON 时返回 null 不崩溃', () => {
    // 设置无效 JSON（loadLayout 的 catch 块应吞掉错误）
    localStorage.setItem('v9_cockpit_layout', '{invalid json')

    render(<CockpitShell />)

    // 验证：header "驾驶舱" 仍能渲染（说明 loadLayout 已吞掉错误）
    expect(screen.getByText('驾驶舱')).toBeInTheDocument()
    // 验证：组件正常加载（mockGetAllInstances 仍被调用）
    expect(mockGetAllInstances).toHaveBeenCalled()
  })

  it('WidgetWrapper: mountInstance 返回 false 时显示 "挂载失败" 错误', async () => {
    // 重置以清除前序测试可能残留的 mockResolvedValue 默认值
    mockMountInstance.mockReset()

    mockGetAllInstances.mockReturnValue([
      {
        instanceId: 'test_1',
        widgetId: 'marketIndices',
        size: { cols: 4, rows: 2 },
        title: '测试',
        settings: {},
        visible: true,
        collapsed: false,
      },
    ])
    mockMountInstance.mockResolvedValueOnce(false)

    const { unmount } = render(<CockpitShell />)

    // 验证错误显示
    expect(await screen.findByText('挂载失败')).toBeInTheDocument()

    // cleanup 验证：卸载时调用 unmountInstance
    unmount()
    expect(mockUnmountInstance).toHaveBeenCalledWith('test_1')
  })

  it('WidgetWrapper: mountInstance 抛异常时显示错误消息', async () => {
    mockMountInstance.mockReset()

    mockGetAllInstances.mockReturnValue([
      {
        instanceId: 'test_2',
        widgetId: 'marketIndices',
        size: { cols: 4, rows: 2 },
        title: '测试异常',
        settings: {},
        visible: true,
        collapsed: false,
      },
    ])
    mockMountInstance.mockRejectedValueOnce(new Error('网络异常'))

    render(<CockpitShell />)

    // 验证错误消息显示
    expect(await screen.findByText('网络异常')).toBeInTheDocument()
  })

  it('WidgetWrapper: error 状态下点击 "重试" 按钮应调用 refreshInstance + loadComponent', async () => {
    mockMountInstance.mockReset()
    mockRefreshInstance.mockReset()
    mockLoadComponent.mockReset()

    mockGetAllInstances.mockReturnValue([
      {
        instanceId: 'test_3',
        widgetId: 'marketIndices',
        size: { cols: 4, rows: 2 },
        title: '测试重试',
        settings: {},
        visible: true,
        collapsed: false,
      },
    ])
    // 首次挂载失败
    mockMountInstance.mockResolvedValueOnce(false)
    // 重试成功
    mockRefreshInstance.mockResolvedValueOnce(true)
    // 加载组件
    mockLoadComponent.mockResolvedValueOnce(() => null)

    render(<CockpitShell />)

    // 等待错误出现
    expect(await screen.findByText('挂载失败')).toBeInTheDocument()

    // 点击重试按钮
    fireEvent.click(screen.getByText('重试'))

    // 验证 refreshInstance + loadComponent 被调用
    await waitFor(() => {
      expect(mockRefreshInstance).toHaveBeenCalledWith('test_3')
      expect(mockLoadComponent).toHaveBeenCalledWith('marketIndices')
    })
  })

  it('WidgetWrapper: loadComponent 返回 null 时显示 "组件未找到"', async () => {
    mockMountInstance.mockReset()
    mockLoadComponent.mockReset()

    mockGetAllInstances.mockReturnValue([
      {
        instanceId: 'test_4',
        widgetId: 'marketIndices',
        size: { cols: 4, rows: 2 },
        title: '测试未找到',
        settings: {},
        visible: true,
        collapsed: false,
      },
    ])
    // mountInstance 成功
    mockMountInstance.mockResolvedValueOnce(true)
    // loadComponent 返回 null（组件未找到场景）
    mockLoadComponent.mockResolvedValueOnce(null)

    render(<CockpitShell />)

    // 验证 "组件未找到" 出现
    expect(await screen.findByText('组件未找到')).toBeInTheDocument()
  })
})
