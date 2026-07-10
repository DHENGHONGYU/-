/**
 * PortalShell 日志埋点单元测试
 *
 * 验证 4 个核心埋点是否在正确时机触发：
 *   1. [PortalShell] 路径匹配 (info) — pathname 匹配舱室时
 *   2. [PortalShell] 路径未匹配 (warn) — pathname 不匹配时
 *   3. [PortalShell] 切换舱室 (info) — 顶栏点击舱室按钮
 *   4. [PortalShell] 侧边栏导航 (info) — 侧边栏点击导航项
 *
 * 参考: docs/11-logging-standards.md 第三章核心埋点清单
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ============================================================================
// Mock 依赖
// ============================================================================

// Mock logger — 捕获所有日志调用
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// Mock react-router — 提供可控的 location 和 navigate
const mockNavigate = vi.fn()
let mockLocation = { pathname: '/input' }

vi.mock('react-router', () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} data-testid="link">
      {children}
    </a>
  ),
}))

// Mock workflowStore — 提供可控的 activeCabin 和 setActiveCabin
const mockSetActiveCabin = vi.fn()
let mockActiveCabin = 'input'

vi.mock('@/store/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeCabin: mockActiveCabin,
    setActiveCabin: mockSetActiveCabin,
  }),
  CabinType: {},
}))

// Mock fetcherService
vi.mock('@/services/fetcher/fetcherService', () => ({
  checkFetcherHealth: vi.fn().mockResolvedValue({ ok: true }),
}))

// Mock ErrorBoundary — 透传 children
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}))

// Mock PageSkeleton
vi.mock('@/components/PageSkeleton', () => ({
  PageSkeleton: () => <div data-testid="page-skeleton">Loading...</div>,
}))

// Mock UI 组件
vi.mock('@/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
  }: {
    children: React.ReactNode
    onClick?: () => void
    variant?: string
    size?: string
  }) => (
    <button onClick={onClick} data-testid="button" data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// ============================================================================
// 动态导入被测组件（在所有 mock 之后）
// ============================================================================
const PortalShellModule = await import('@/portal/PortalShell')
const PortalShell = PortalShellModule.default

// ============================================================================
// 测试
// ============================================================================
describe('PortalShell 日志埋点', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation = { pathname: '/input' }
    mockActiveCabin = 'input'
    mockNavigate.mockClear()
    mockSetActiveCabin.mockClear()
  })

  // --------------------------------------------------------------------------
  // 埋点 1: [PortalShell] 路径匹配 (info)
  // --------------------------------------------------------------------------
  describe('埋点 1: [PortalShell] 路径匹配', () => {
    it('pathname 匹配舱室时打印 info 日志', () => {
      mockLocation = { pathname: '/trading' }

      render(<PortalShell />)

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PortalShell] 路径匹配',
        expect.objectContaining({
          pathname: '/trading',
          cabin: 'trading',
        }),
      )
    })

    it('pathname 匹配子路径时也打印 info 日志', () => {
      mockLocation = { pathname: '/analysis/stock-score' }

      render(<PortalShell />)

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PortalShell] 路径匹配',
        expect.objectContaining({
          pathname: '/analysis/stock-score',
          cabin: 'analysis',
        }),
      )
    })

    it('context 对象包含 pathname 和 cabin 字段', () => {
      mockLocation = { pathname: '/command' }

      render(<PortalShell />)

      const call = mockLogger.info.mock.calls.find(
        ([msg]) => msg === '[PortalShell] 路径匹配',
      )
      expect(call).toBeDefined()
      expect(call![1]).toHaveProperty('pathname')
      expect(call![1]).toHaveProperty('cabin')
    })
  })

  // --------------------------------------------------------------------------
  // 埋点 2: [PortalShell] 路径未匹配 (warn)
  // --------------------------------------------------------------------------
  describe('埋点 2: [PortalShell] 路径未匹配', () => {
    it('pathname 不匹配任何舱室时打印 warn 日志', () => {
      mockLocation = { pathname: '/__unknown_path__' }

      render(<PortalShell />)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[PortalShell] 路径未匹配',
        expect.objectContaining({
          pathname: '/__unknown_path__',
        }),
      )
    })

    it('context 对象包含 pathname 字段', () => {
      mockLocation = { pathname: '/nonexistent' }

      render(<PortalShell />)

      const call = mockLogger.warn.mock.calls.find(
        ([msg]) => msg === '[PortalShell] 路径未匹配',
      )
      expect(call).toBeDefined()
      expect(call![1]).toHaveProperty('pathname')
    })
  })

  // --------------------------------------------------------------------------
  // 埋点 3: [PortalShell] 切换舱室 (info)
  // --------------------------------------------------------------------------
  describe('埋点 3: [PortalShell] 切换舱室', () => {
    it('点击顶栏舱室按钮时打印 info 日志', () => {
      mockLocation = { pathname: '/input' }
      mockActiveCabin = 'input'

      render(<PortalShell />)

      // 找到交易舱按钮（顶栏 nav 中的按钮）
      const buttons = screen.getAllByRole('button')
      const tradingButton = buttons.find(
        (btn) => btn.textContent?.includes('交易舱'),
      )

      expect(tradingButton).toBeDefined()
      fireEvent.click(tradingButton!)

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PortalShell] 切换舱室',
        expect.objectContaining({
          from: 'input',
          to: 'trading',
          path: '/trading',
        }),
      )
    })

    it('context 对象包含 from、to、path 字段', () => {
      mockLocation = { pathname: '/trading' }
      mockActiveCabin = 'trading'

      render(<PortalShell />)

      const buttons = screen.getAllByRole('button')
      const analysisButton = buttons.find(
        (btn) => btn.textContent?.includes('分析舱'),
      )

      fireEvent.click(analysisButton!)

      const call = mockLogger.info.mock.calls.find(
        ([msg]) => msg === '[PortalShell] 切换舱室',
      )
      expect(call).toBeDefined()
      expect(call![1]).toHaveProperty('from')
      expect(call![1]).toHaveProperty('to')
      expect(call![1]).toHaveProperty('path')
    })

    it('切换舱室后调用 setActiveCabin 和 navigate', () => {
      mockLocation = { pathname: '/input' }
      mockActiveCabin = 'input'

      render(<PortalShell />)

      const buttons = screen.getAllByRole('button')
      const analysisButton = buttons.find(
        (btn) => btn.textContent?.includes('分析舱'),
      )

      fireEvent.click(analysisButton!)

      expect(mockSetActiveCabin).toHaveBeenCalledWith('analysis')
      expect(mockNavigate).toHaveBeenCalledWith('/analysis')
    })
  })

  // --------------------------------------------------------------------------
  // 埋点 4: [PortalShell] 侧边栏导航 (info)
  // --------------------------------------------------------------------------
  describe('埋点 4: [PortalShell] 侧边栏导航', () => {
    it('点击侧边栏导航项时打印 info 日志', () => {
      mockLocation = { pathname: '/input' }
      mockActiveCabin = 'input'

      render(<PortalShell />)

      // 侧边栏用原生 <button>，按文本查找
      const sidebarButton = screen.getByText('录入看板').closest('button')

      expect(sidebarButton).not.toBeNull()
      fireEvent.click(sidebarButton!)

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[PortalShell] 侧边栏导航',
        expect.objectContaining({
          item: expect.any(String),
          label: expect.any(String),
          path: expect.any(String),
          cabin: expect.any(String),
        }),
      )
    })

    it('context 对象包含 item、label、path、cabin 字段', () => {
      mockLocation = { pathname: '/input' }
      mockActiveCabin = 'input'

      render(<PortalShell />)

      const sidebarButton = screen.getByText('批量导入').closest('button')

      expect(sidebarButton).not.toBeNull()
      fireEvent.click(sidebarButton!)

      const call = mockLogger.info.mock.calls.find(
        ([msg]) => msg === '[PortalShell] 侧边栏导航',
      )
      expect(call).toBeDefined()
      expect(call![1]).toHaveProperty('item')
      expect(call![1]).toHaveProperty('label')
      expect(call![1]).toHaveProperty('path')
      expect(call![1]).toHaveProperty('cabin')
    })

    it('点击侧边栏后调用 navigate', () => {
      mockLocation = { pathname: '/input' }
      mockActiveCabin = 'input'

      render(<PortalShell />)

      const sidebarButton = screen.getByText('批量导入').closest('button')

      fireEvent.click(sidebarButton!)

      expect(mockNavigate).toHaveBeenCalledWith('/input/bulk-import')
    })
  })

  // --------------------------------------------------------------------------
  // 综合验证：所有 4 个埋点不会被遗漏
  // --------------------------------------------------------------------------
  describe('综合验证', () => {
    it('渲染时至少触发一次路径匹配埋点', () => {
      mockLocation = { pathname: '/input' }
      render(<PortalShell />)

      const pathMatchCalls = mockLogger.info.mock.calls.filter(
        ([msg]) => msg === '[PortalShell] 路径匹配',
      )
      expect(pathMatchCalls.length).toBeGreaterThan(0)
    })

    it('未知路径时触发路径未匹配 warn 埋点', () => {
      mockLocation = { pathname: '/__unknown__' }
      render(<PortalShell />)

      const warnMessages = mockLogger.warn.mock.calls.map(([msg]) => msg)
      expect(warnMessages).toContain('[PortalShell] 路径未匹配')
    })

    it('日志消息字面量与规范文档完全一致', () => {
      mockLocation = { pathname: '/input' }
      render(<PortalShell />)

      // 验证 info 埋点消息字面量
      const infoMessages = mockLogger.info.mock.calls.map(([msg]) => msg)
      expect(infoMessages).toContain('[PortalShell] 路径匹配')
      // 埋点 3 和 4 需要用户交互才会触发
    })
  })
})
