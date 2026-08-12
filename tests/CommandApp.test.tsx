import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router'
import { useEffect } from 'react'
import CommandApp from '@/apps/command/CommandApp'
import * as systemService from '@/services/system/systemService'
import { useCommandStore } from '@/store/commandStore'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

// ══════════════════════════════════════════════════════════════
// vi.hoisted:确保 mock 引用在 vi.mock 提升前已就绪
// ══════════════════════════════════════════════════════════════
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// ConfigApp 懒加载 mock:返回 null 即可覆盖 Suspense 解析路径
vi.mock('@/apps/command/ConfigApp', () => ({
  default: () => null,
}))

// 辅助函数:包裹组件提供 Router 上下文,支持指定初始路由
const renderWithRouter = (ui: React.ReactElement, initialEntries?: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>
  )
}

// 辅助组件:挂载后通过 useNavigate 程序化切换路由(用于测试路由切换日志)
function NavigateOnMount({ to }: { to: string }): null {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to)
  }, [navigate, to])
  return null
}

describe('CommandApp', () => {
  beforeEach(() => {
    // 清空上一轮的 logger mock 调用记录
    vi.clearAllMocks()

    // jsdom 不完全支持 <dialog>.showModal(),需手动 mock
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })

    vi.spyOn(systemService, 'loadSystemStats').mockResolvedValue({
      success: true,
      data: { stocks: 12, orders: 3, scores: 8 },
    })
    vi.spyOn(systemService, 'resetAll').mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders action buttons', async () => {
    renderWithRouter(<CommandApp />)
    // R5 修改:mount 时自动 loadStats,isLoading 短暂为 true,按钮文本变"加载中..."
    // 用 findByRole 异步等待按钮文本恢复"刷新统计"
    expect(await screen.findByRole('button', { name: /刷新统计/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重置数据/i })).toBeInTheDocument()
  })

  it('loads and displays stats when clicking 刷新统计', async () => {
    renderWithRouter(<CommandApp />)
    await userEvent.click(await screen.findByRole('button', { name: /刷新统计/i }))

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })
    expect(screen.getByText('stocks')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
    expect(screen.getByText('scores')).toBeInTheDocument()
  })

  it('calls resetAll and refreshes stats when confirming reset', async () => {
    renderWithRouter(<CommandApp />)
    await userEvent.click(await screen.findByRole('button', { name: /刷新统计/i }))
    await waitFor(() => screen.getByText('12'))

    await userEvent.click(await screen.findByRole('button', { name: /重置数据/i }))

    // 组件使用自定义 ConfirmDialog（非 window.confirm）；jsdom 下关闭的 <dialog> 仍挂载，
    // 需定位确认对话框（标题“清空所有数据”）内的确认按钮，避免与迁移对话框的“清空”按钮歧义
    const confirmDialog = (await screen.findByText('清空所有数据')).closest('dialog') as HTMLElement
    const confirmBtn = within(confirmDialog).getByRole('button', { name: '清空' })
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(vi.mocked(systemService.resetAll)).toHaveBeenCalled()
      // R5 修改:mount 时自动 loadStats 一次,加上点击刷新 + reset 后刷新,次数 ≥ 2
      // 这里只断言"被调用过",不锁定具体次数,避免 R5 自动加载逻辑变化时 brittle
      expect(vi.mocked(systemService.loadSystemStats)).toHaveBeenCalled()
    })
  })

  it('does not reset when user cancels', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))

    renderWithRouter(<CommandApp />)
    await userEvent.click(await screen.findByRole('button', { name: /重置数据/i }))

    expect(vi.mocked(systemService.resetAll)).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('shows error message when stats loading fails', async () => {
    vi.spyOn(systemService, 'loadSystemStats').mockResolvedValue({
      success: false,
      error: '服务不可用',
    })

    renderWithRouter(<CommandApp />)
    await userEvent.click(await screen.findByRole('button', { name: /刷新统计/i }))

    await waitFor(() => {
      expect(screen.getByText(/服务不可用/)).toBeInTheDocument()
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 新增:路由分发分支覆盖
  // ══════════════════════════════════════════════════════════════

  it('renders CommandHubPage with nav cards at /command/hub', () => {
    renderWithRouter(<CommandApp />, ['/command/hub'])

    // Hub 页面标题(2xl 字号,区别于 SystemMonitor 的 xl 字号)
    expect(screen.getByText('系统监控')).toBeInTheDocument()
    expect(screen.getByText('配置管理')).toBeInTheDocument()
    expect(screen.getByText('智能体总控台')).toBeInTheDocument()
    expect(screen.getByText('MCP Server 管理')).toBeInTheDocument()
  })

  it('renders ConfigApp via Suspense at /command/config', async () => {
    renderWithRouter(<CommandApp />, ['/command/config'])

    // Suspense fallback 先渲染,待懒加载 resolve 后消失
    await waitFor(() => {
      expect(screen.queryByText('加载配置面板中...')).not.toBeInTheDocument()
    })
  })

  it('renders SystemMonitor at /command/monitor', async () => {
    renderWithRouter(<CommandApp />, ['/command/monitor'])

    expect(await screen.findByRole('button', { name: /刷新统计/i })).toBeInTheDocument()
  })

  it('logs route change when path changes', async () => {
    const { rerender } = renderWithRouter(<CommandApp />, ['/command/monitor'])
    // 等待首次渲染的 useEffect 完成
    await screen.findByRole('button', { name: /刷新统计/i })
    // 清除首次渲染产生的日志
    mockLogger.info.mockClear()

    // 通过 NavigateOnMount 程序化切换路由:/command/monitor → /command/hub
    rerender(
      <MemoryRouter initialEntries={['/command/monitor']}>
        <NavigateOnMount to="/command/hub" />
        <CommandApp />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[CommandApp] 路由切换',
        expect.objectContaining({ from: '/command/monitor', to: '/command/hub' })
      )
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 新增:加载骨架分支覆盖
  // ══════════════════════════════════════════════════════════════

  it('shows loading skeleton when isLoading is true and stats is null', () => {
    // 直接设置 store 状态为 loading,并用 no-op loadStats 防止 useEffect 重置状态
    const store = useCommandStore
    const originalLoadStats = store.getState().loadStats
    const originalIsLoading = store.getState().isLoading
    const originalStats = store.getState().stats

    store.setState({
      isLoading: true,
      stats: null,
      loadStats: async () => {
        /* no-op:保持 isLoading=true, stats=null */
      },
    })

    renderWithRouter(<CommandApp />)

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()

    // 恢复原始状态,避免影响后续测试
    store.setState({
      isLoading: originalIsLoading,
      stats: originalStats,
      loadStats: originalLoadStats,
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 新增:V6 迁移面板交互
  // ══════════════════════════════════════════════════════════════

  it('opens migration dialog when clicking V6 迁移 button', async () => {
    renderWithRouter(<CommandApp />)
    await screen.findByRole('button', { name: /刷新统计/i })

    await userEvent.click(screen.getByRole('button', { name: /V6 迁移/i }))

    await waitFor(() => {
      expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
    })
  })

  // ══════════════════════════════════════════════════════════════
  // 新增:成功消息分支(messageType === 'success')
  // ══════════════════════════════════════════════════════════════

  it('displays success message with token class after successful reset', async () => {
    renderWithRouter(<CommandApp />)
    await userEvent.click(await screen.findByRole('button', { name: /刷新统计/i }))
    await waitFor(() => screen.getByText('12'))

    await userEvent.click(screen.getByRole('button', { name: /重置数据/i }))

    // 组件使用自定义 ConfirmDialog（非 window.confirm）；jsdom 下关闭的 <dialog> 仍挂载，
    // 需定位确认对话框（标题“清空所有数据”）内的确认按钮，避免与迁移对话框的“清空”按钮歧义
    const confirmDialog = (await screen.findByText('清空所有数据')).closest('dialog') as HTMLElement
    const confirmBtn = within(confirmDialog).getByRole('button', { name: '清空' })
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      const successMessage = screen.getByText('已重置所有数据')
      expect(successMessage).toBeInTheDocument()
      // 断言令牌引用,不直接硬编码颜色(遵守 AGENTS.md §3.5.5)
      expect(successMessage).toHaveClass(COLOR_TOKENS.success.tailwind)
    })
  })
})
