import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// 使用 vi.hoisted 解决 vi.mock 提升导致的 TDZ 问题
// vi.mock 会被提升到文件顶部,因此内部引用的常量必须用 vi.hoisted 包裹
const {
  mockStoreState,
  mockCallTool,
  mockListTools,
  mockLogger,
} = vi.hoisted(() => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
  return {
    mockStoreState: {
      servers: [
        {
          serverName: 'test-server',
          version: '1.0.0',
          description: 'Test MCP Server',
          priority: 'medium' as const,
          enabled: true,
          toolCount: 3,
          resourceCount: 2,
          promptCount: 1,
          registeredAt: Date.now(),
          dependencies: ['dep-a'],
        },
      ],
      isLoading: false,
      error: null as string | null,
      refreshServers: vi.fn(),
      toggleServer: vi.fn(),
    },
    mockCallTool: vi.fn(),
    mockListTools: vi.fn(() => [
      { name: 'tool-1', description: '测试工具1' },
      { name: 'tool-2', description: '测试工具2' },
    ]),
    mockLogger: logger,
  }
})

vi.mock('@/store/mcpServerStore', () => ({
  // 同时支持 hook 调用与 getState() 调用(useEffect 改用 getState 避免死循环)
  useMCPServerStore: Object.assign(() => mockStoreState, {
    getState: () => mockStoreState,
  }),
}))

vi.mock('@/mcp/core/registry', () => ({
  mcpRegistry: {
    listServers: () => [],
    getServer: () => ({
      server: {
        callTool: mockCallTool,
        listTools: mockListTools,
      },
    }),
    setEnabled: vi.fn(),
  },
}))

vi.mock('@/mcp/core/client', () => ({
  MCPClientImpl: vi.fn().mockImplementation(() => ({
    callTool: vi.fn(),
  })),
}))

vi.mock('@/mcp/bridge', () => ({
  mcpBridge: {
    callTool: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import MCPServerDashboardPage from '@/pages/command/MCPServerDashboardPage'

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <MCPServerDashboardPage />
    </MemoryRouter>,
  )
}

describe('MCPServerDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────────────────────────
  // 原有:基础渲染
  // ──────────────────────────────────────────────────────────────
  it('应该渲染 without crashing', () => {
    const { container } = renderPage()
    expect(container).toBeTruthy()
    expect(container.innerHTML).toBeTruthy()
    expect(container.innerHTML).toContain('MCP Server 管理')
    expect(container.innerHTML).toContain('test-server')
  })

  // ──────────────────────────────────────────────────────────────
  // P0-2 死循环回归测试
  // ──────────────────────────────────────────────────────────────
  it('P0-2 回归:mount 时 refreshServers 仅调用一次,不触发死循环', () => {
    renderPage()
    expect(mockStoreState.refreshServers).toHaveBeenCalledTimes(1)
  })

  it('P0-2 回归:unmount 后不再次调用 refreshServers', () => {
    const { unmount } = renderPage()
    expect(mockStoreState.refreshServers).toHaveBeenCalledTimes(1)
    unmount()
    expect(mockStoreState.refreshServers).toHaveBeenCalledTimes(1)
  })

  it('P0-2 回归:组件卸载时记录 Unmounted 日志', () => {
    const { unmount } = renderPage()
    unmount()
    expect(mockLogger.info).toHaveBeenCalledWith('[MCPServerDashboard] Unmounted')
  })

  // ──────────────────────────────────────────────────────────────
  // 状态展示
  // ──────────────────────────────────────────────────────────────
  it('loading 状态显示加载中提示', () => {
    const original = mockStoreState.isLoading
    mockStoreState.isLoading = true
    const { container } = renderPage()
    expect(container.innerHTML).toContain('加载中...')
    mockStoreState.isLoading = original
  })

  it('error 状态显示错误信息', () => {
    const originalError = mockStoreState.error
    const originalLoading = mockStoreState.isLoading
    mockStoreState.error = '连接失败'
    mockStoreState.isLoading = false
    const { container } = renderPage()
    expect(container.innerHTML).toContain('连接失败')
    mockStoreState.error = originalError
    mockStoreState.isLoading = originalLoading
  })

  it('空服务器列表显示空状态提示', () => {
    const originalServers = mockStoreState.servers
    mockStoreState.servers = []
    const { container } = renderPage()
    expect(container.innerHTML).toContain('暂无已注册的 MCP Server')
    mockStoreState.servers = originalServers
  })

  it('渲染服务器优先级 Badge', () => {
    const { container } = renderPage()
    expect(container.innerHTML).toContain('medium')
  })

  it('渲染工具/资源/Prompt 计数', () => {
    const { container } = renderPage()
    expect(container.innerHTML).toContain('>3<') // toolCount
    expect(container.innerHTML).toContain('>2<') // resourceCount
    expect(container.innerHTML).toContain('>1<') // promptCount
  })

  // ──────────────────────────────────────────────────────────────
  // 交互行为
  // ──────────────────────────────────────────────────────────────
  it('点击刷新按钮调用 store.refreshServers', () => {
    renderPage()
    const refreshButton = screen.getByText('刷新')
    fireEvent.click(refreshButton)
    // mount 时 1 次 + 点击 1 次 = 2 次
    expect(mockStoreState.refreshServers).toHaveBeenCalledTimes(2)
  })

  it('点击 toggle 按钮调用 store.toggleServer', () => {
    renderPage()
    // toggle 图标是 lucide-toggle-right
    const toggleButton = document.querySelector('.lucide-toggle-right')?.closest('button')
    expect(toggleButton).toBeTruthy()
    act(() => {
      fireEvent.click(toggleButton!)
    })
    expect(mockStoreState.toggleServer).toHaveBeenCalledTimes(1)
    expect(mockStoreState.toggleServer).toHaveBeenCalledWith('test-server', false)
  })

  it('点击展开按钮显示工具列表', () => {
    const { container } = renderPage()
    // 初始未展开,工具列表不显示
    expect(container.innerHTML).not.toContain('tool-1')

    // Eye 图标按钮 = 展开按钮(用 lucide-eye class 精确锁定)
    const expandButton = document.querySelector('.lucide-eye')?.closest('button')
    expect(expandButton).toBeTruthy()
    act(() => {
      fireEvent.click(expandButton!)
    })

    // 展开后显示 Tools 区域
    expect(container.innerHTML).toContain('Tools')
    expect(container.innerHTML).toContain('tool-1')
    expect(container.innerHTML).toContain('tool-2')
  })

  it('展开后选择工具显示测试面板', () => {
    const { container } = renderPage()
    // 先展开
    const expandButton = document.querySelector('.lucide-eye')?.closest('button')
    act(() => {
      fireEvent.click(expandButton!)
    })

    // 点击「测试」按钮(getAllByRole + filter,因为工具描述里也有"测试工具1"导致 getByText 多匹配)
    const testButtons = screen.getAllByRole('button', { name: /测试/ })
    // 第一个测试按钮(对应 tool-1 的"测试"按钮)
    expect(testButtons.length).toBeGreaterThanOrEqual(2)
    act(() => {
      fireEvent.click(testButtons[0]!)
    })

    // 应显示 textarea 和「执行」按钮
    expect(container.innerHTML).toContain('JSON arguments')
    const execButtons = screen.getAllByRole('button', { name: /执行/ })
    expect(execButtons.length).toBeGreaterThanOrEqual(1)
  })

  // ──────────────────────────────────────────────────────────────
  // 工具测试错误处理
  // ──────────────────────────────────────────────────────────────
  it('handleToolTest JSON 解析失败时显示错误', async () => {
    const { container } = renderPage()
    // 展开
    const expandButton = document.querySelector('.lucide-eye')?.closest('button')
    act(() => {
      fireEvent.click(expandButton!)
    })

    // 点击测试
    const testButtons = screen.getAllByRole('button', { name: /测试/ })
    act(() => {
      fireEvent.click(testButtons[0]!)
    })

    // 修改 textarea 为非法 JSON
    const textarea = container.querySelector('textarea')!
    act(() => {
      fireEvent.change(textarea, { target: { value: 'not-json' } })
    })

    // 点击执行
    const execButtons = screen.getAllByRole('button', { name: /执行/ })
    act(() => {
      fireEvent.click(execButtons[0]!)
    })

    // 应显示错误信息(JSON 解析错误)
    await waitFor(() => {
      expect(container.innerHTML).toMatch(/JSON|Unexpected|token/i)
    })
  })

  it('handleToolTest 成功时显示工具返回结果', async () => {
    mockCallTool.mockResolvedValueOnce({ result: 'success-data' })
    const { container } = renderPage()
    // 展开
    const expandButton = document.querySelector('.lucide-eye')?.closest('button')
    act(() => {
      fireEvent.click(expandButton!)
    })
    const testButtons = screen.getAllByRole('button', { name: /测试/ })
    act(() => {
      fireEvent.click(testButtons[0]!)
    })
    const execButtons = screen.getAllByRole('button', { name: /执行/ })
    act(() => {
      fireEvent.click(execButtons[0]!)
    })

    await waitFor(() => {
      expect(container.innerHTML).toContain('success-data')
    })
  })

  // ──────────────────────────────────────────────────────────────
  // 依赖展示
  // ──────────────────────────────────────────────────────────────
  it('展开后显示依赖项', () => {
    const { container } = renderPage()
    const expandButton = document.querySelector('.lucide-eye')?.closest('button')
    act(() => {
      fireEvent.click(expandButton!)
    })
    expect(container.innerHTML).toContain('dep-a')
    expect(container.innerHTML).toContain('依赖')
  })

  // ──────────────────────────────────────────────────────────────
  // 面包屑导航
  // ──────────────────────────────────────────────────────────────
  it('渲染面包屑导航', () => {
    const { container } = renderPage()
    expect(container.innerHTML).toContain('首页')
    expect(container.innerHTML).toContain('总控舱')
    expect(container.innerHTML).toContain('MCP Server 管理')
  })
})
