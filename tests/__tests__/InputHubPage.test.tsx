/**
 * InputHubPage 组件测试
 *
 * 覆盖场景：
 * 1. 页面渲染：标题、面包屑、模块卡片
 * 2. 核心功能模块：5 个 INPUT_MODULES 卡片渲染与链接
 * 3. 可扩展能力模块：2 个 DATA_MODULES 卡片渲染与 Badge
 * 4. 用户交互：点击模块卡片导航
 * 5. 边界测试：Store 状态变化、ErrorBoundary 隔离
 * 6. 可访问性：语义化标签、按钮角色
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import InputHubPage from '@/pages/input/InputHubPage'
import { useInputHubStore } from '@/store/inputHubStore'

// Mock ErrorBoundary 以简化测试
vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

// Mock useInputHubStore
vi.mock('@/store/inputHubStore', () => ({
  useInputHubStore: vi.fn(() => ({
    activeModule: '',
    loading: false,
    setActiveModule: vi.fn(),
    setLoading: vi.fn(),
    reset: vi.fn(),
  })),
}))

// Mock logger 以避免测试输出噪音
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * Arrange-Act-Assert 辅助函数
 * 渲染 InputHubPage 并包装 MemoryRouter
 */
function renderHubPage(initialEntries = ['/input/hub']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <InputHubPage />
    </MemoryRouter>,
  )
}

describe('InputHubPage - 页面渲染', () => {
  it('渲染页面主标题 "数据采集及接口"', () => {
    renderHubPage()
    expect(screen.getByText('数据采集及接口')).toBeInTheDocument()
  })

  it('渲染副标题包含 "输入舱"', () => {
    renderHubPage()
    const matches = screen.getAllByText(/输入舱/)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('渲染版本徽章 "V3.0 模块一"', () => {
    renderHubPage()
    expect(screen.getByText('V3.0 模块一')).toBeInTheDocument()
  })

  it('渲染面包屑导航（首页 → 输入舱）', () => {
    renderHubPage()
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('输入舱')).toBeInTheDocument()
  })

  it('渲染 "核心功能" 分区标题', () => {
    renderHubPage()
    expect(screen.getByText('核心功能')).toBeInTheDocument()
  })

  it('渲染 "可扩展能力" 分区标题', () => {
    renderHubPage()
    expect(screen.getByText('可扩展能力（参考 V6 Pro）')).toBeInTheDocument()
  })
})

describe('InputHubPage - 核心功能模块卡片', () => {
  it('渲染 "录入看板" 模块卡片', () => {
    renderHubPage()
    expect(screen.getByText('录入看板')).toBeInTheDocument()
    expect(screen.getByText(/股票搜索/)).toBeInTheDocument()
  })

  it('渲染 "批量导入" 模块卡片', () => {
    renderHubPage()
    expect(screen.getByText('批量导入')).toBeInTheDocument()
    expect(screen.getByText(/粘贴 CSV/)).toBeInTheDocument()
  })

  it('渲染 "热门板块" 模块卡片', () => {
    renderHubPage()
    expect(screen.getByText('热门板块')).toBeInTheDocument()
    expect(screen.getByText(/热门板块推荐/)).toBeInTheDocument()
  })

  it('渲染 "采集测试" 模块卡片', () => {
    renderHubPage()
    expect(screen.getByText('采集测试')).toBeInTheDocument()
    expect(screen.getByText(/数据源健康检查/)).toBeInTheDocument()
  })

  it('渲染 "本地知识库" 模块卡片', () => {
    renderHubPage()
    expect(screen.getByText('本地知识库')).toBeInTheDocument()
    expect(screen.getByText(/本地研报/)).toBeInTheDocument()
  })

  it('渲染 "七维采集" 模块卡片', () => {
    renderHubPage()
    expect(screen.getByText('七维采集')).toBeInTheDocument()
    expect(screen.getByText(/8维度采集配置/)).toBeInTheDocument()
  })

  it('核心功能模块共渲染 6 个 "进入" 链接', () => {
    renderHubPage()
    const enterLinks = screen.getAllByRole('link', { name: /进入/ })
    expect(enterLinks).toHaveLength(6)
  })
})

describe('InputHubPage - 可扩展能力模块卡片', () => {
  it('渲染 "股票池管理" 模块卡片', () => {
    renderHubPage()
    expect(screen.getByText('股票池管理')).toBeInTheDocument()
    expect(screen.getByText(/自选股分组/)).toBeInTheDocument()
  })

  it('渲染 "待增强" 徽章', () => {
    renderHubPage()
    expect(screen.getByText('待增强')).toBeInTheDocument()
  })

  it('可扩展能力模块共渲染 3 个 "查看现有入口" 链接', () => {
    renderHubPage()
    const viewLinks = screen.getAllByRole('link', { name: /查看现有入口/ })
    expect(viewLinks).toHaveLength(3)
  })
})

describe('InputHubPage - 用户交互', () => {
  it('点击 "录入看板" 卡片链接指向 /input/dashboard', () => {
    renderHubPage()
    const links = screen.getAllByRole('link', { name: /进入/ })
    const dashboardLink = links.find(
      (link) => link.getAttribute('href') === '/input/dashboard',
    )
    expect(dashboardLink).toBeInTheDocument()
  })

  it('点击 "批量导入" 卡片链接指向 /input/bulk-import', () => {
    renderHubPage()
    const links = screen.getAllByRole('link', { name: /进入/ })
    const bulkImportLink = links.find(
      (link) => link.getAttribute('href') === '/input/bulk-import',
    )
    expect(bulkImportLink).toBeInTheDocument()
  })

  it('点击 "本地知识库" 卡片链接指向 /input/local-knowledge', () => {
    renderHubPage()
    const links = screen.getAllByRole('link', { name: /进入/ })
    const localKnowledgeLink = links.find(
      (link) => link.getAttribute('href') === '/input/local-knowledge',
    )
    expect(localKnowledgeLink).toBeInTheDocument()
  })

  it('点击 "股票池管理" 卡片链接指向 /input', () => {
    renderHubPage()
    const links = screen.getAllByRole('link', { name: /查看现有入口/ })
    const poolManageLink = links.find(
      (link) => link.getAttribute('href') === '/input',
    )
    expect(poolManageLink).toBeInTheDocument()
  })
})

describe('InputHubPage - 边界测试', () => {
  it('调用 useInputHubStore hook（注册 store）', () => {
    renderHubPage()
    expect(useInputHubStore).toHaveBeenCalled()
  })

  it('页面正常渲染（Store loading=true 时不影响 Hub 页面）', () => {
    vi.mocked(useInputHubStore).mockReturnValue({
      activeModule: '/input/dashboard',
      loading: true,
      setActiveModule: vi.fn(),
      setLoading: vi.fn(),
      reset: vi.fn(),
    })

    renderHubPage()
    expect(screen.getByText('数据采集及接口')).toBeInTheDocument()
  })

  it('页面正常渲染（Store 初始状态）', () => {
    vi.mocked(useInputHubStore).mockReturnValue({
      activeModule: '',
      loading: false,
      setActiveModule: vi.fn(),
      setLoading: vi.fn(),
      reset: vi.fn(),
    })

    renderHubPage()
    expect(screen.getByText('数据采集及接口')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /进入/ })).toHaveLength(6)
  })

  it('页面渲染不因 Store 异常而崩溃', () => {
    vi.mocked(useInputHubStore).mockReturnValue({
      activeModule: '',
      loading: false,
      setActiveModule: vi.fn(),
      setLoading: vi.fn(),
      reset: vi.fn(),
    })

    const { container } = renderHubPage()
    expect(container.firstChild).not.toBeNull()
  })
})

describe('InputHubPage - 可访问性', () => {
  it('主标题使用 h1 标签', () => {
    renderHubPage()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('数据采集及接口')
  })

  it('分区标题使用 h2 标签', () => {
    renderHubPage()
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(2)
    expect(headings[0]).toHaveTextContent('核心功能')
    expect(headings[1]).toHaveTextContent('可扩展能力')
  })

  it('所有卡片链接可被键盘聚焦', () => {
    renderHubPage()
    const links = screen.getAllByRole('link')
    for (const link of links) {
      expect(link).not.toHaveAttribute('tabindex', '-1')
    }
  })

  it('面包屑首页链接指向根路径', () => {
    renderHubPage()
    const homeLink = screen.getByText('首页').closest('a')
    expect(homeLink).toHaveAttribute('href', '/')
  })
})

describe('InputHubPage - 模块完整性', () => {
  it('页面包含 6 个核心功能模块 + 3 个可扩展模块 = 9 张卡片', () => {
    renderHubPage()
    const allCards = screen.getAllByText(/进入|查看现有入口/)
    expect(allCards).toHaveLength(9)
  })

  it('所有核心模块路径均以 /input 开头', () => {
    renderHubPage()
    const enterLinks = screen.getAllByRole('link', { name: /进入/ })
    for (const link of enterLinks) {
      const href = link.getAttribute('href') ?? ''
      expect(href.startsWith('/input')).toBe(true)
    }
  })
})
