/**
 * ReviewWizardPage 组件测试
 *
 * 覆盖场景：
 * 1. 页面标题渲染："复盘向导"
 * 2. 步骤指示器存在（Re viewWizard 组件 mock 含步骤名称）
 * 3. 导航按钮存在（上一步按钮）
 * 4. 面包屑导航
 * 5. 返回链接
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ReviewWizardPage from '@/pages/output/ReviewWizardPage'

// Mock ErrorBoundary（页面使用 @/components/organisms/shared/ErrorBoundary）
vi.mock('@/components/organisms/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

// Mock ReviewWizard：渲染简化的步骤指示器和导航按钮
vi.mock('@/components/organisms/output/ReviewWizard', () => ({
  default: () => (
    <div>
      {/* 步骤指示器 */}
      <div data-testid="stepper">
        <span>选择范围</span>
        <span>生成复盘</span>
        <span>逐维复盘</span>
        <span>导出成品卡</span>
      </div>
      {/* 导航按钮 */}
      <button disabled>上一步</button>
      <span>步骤 1 / 4</span>
      <button>开始复盘</button>
    </div>
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/output/wizard']}>
      <ReviewWizardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReviewWizardPage - 页面渲染', () => {
  it('渲染页面标题 "复盘向导"', () => {
    renderPage()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('复盘向导')
  })

  it('渲染面包屑（首页 → 输出舱 → 复盘向导）', () => {
    renderPage()
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('输出舱')).toBeInTheDocument()
    // "复盘向导" 同时出现在标题和面包屑中，使用 getAllByText
    const matches = screen.getAllByText('复盘向导')
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('渲染返回链接', () => {
    renderPage()
    expect(screen.getByText('返回')).toBeInTheDocument()
  })

  it('渲染步骤指示器（包含 4 个步骤名称）', () => {
    renderPage()
    expect(screen.getByText('选择范围')).toBeInTheDocument()
    expect(screen.getByText('生成复盘')).toBeInTheDocument()
    expect(screen.getByText('逐维复盘')).toBeInTheDocument()
    expect(screen.getByText('导出成品卡')).toBeInTheDocument()
  })

  it('渲染导航按钮（上一步 / 开始复盘）', () => {
    renderPage()
    expect(screen.getByText('上一步')).toBeInTheDocument()
    expect(screen.getByText('开始复盘')).toBeInTheDocument()
  })

  it('渲染步骤进度文本', () => {
    renderPage()
    expect(screen.getByText('步骤 1 / 4')).toBeInTheDocument()
  })
})
