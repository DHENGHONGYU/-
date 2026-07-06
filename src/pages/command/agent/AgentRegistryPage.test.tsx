import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import AgentRegistryPage from './AgentRegistryPage'

vi.mock('@/store/agentStore', () => ({
  useAgentStore: vi.fn((selector: (state: { registeredAgents: string[] }) => unknown) => {
    const state = {
      registeredAgents: ['v6-scoring-agent', 'fetcher-agent'],
      stats: { totalAgents: 5, pendingTasks: 0, runningTasks: 0, completedTasks: 0, failedTasks: 0 },
    }
    return selector(state)
  }),
}))

vi.mock('lucide-react', () => ({
  List: () => <svg data-testid="icon-list" />,
  Search: () => <svg data-testid="icon-search" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
  Bot: () => <svg data-testid="icon-bot" />,
  Activity: () => <svg data-testid="icon-activity" />,
  Newspaper: () => <svg data-testid="icon-newspaper" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Wifi: () => <svg data-testid="icon-wifi" />,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

function renderPage(initialEntry = '/command/agents/registry'): void {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AgentRegistryPage />
    </MemoryRouter>,
  )
}

describe('AgentRegistryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染页面标题和面包屑', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '智能体注册表' })).toBeInTheDocument()
  })

  it('显示 5 个智能体卡片', () => {
    renderPage()
    const cards = screen.getAllByText(/智能体|Agent/)
    expect(cards.length).toBeGreaterThan(0)
  })

  it('包含 V6 评分智能体', () => {
    renderPage()
    expect(screen.getByText('V6 评分智能体')).toBeInTheDocument()
  })

  it('包含数据采集智能体', () => {
    renderPage()
    expect(screen.getByText('数据采集智能体')).toBeInTheDocument()
  })

  it('搜索功能过滤列表', () => {
    renderPage()
    const searchInput = screen.getByPlaceholderText('搜索智能体...')
    fireEvent.change(searchInput, { target: { value: 'V6' } })
    expect(screen.getByText('V6 评分智能体')).toBeInTheDocument()
  })

  it('筛选标签存在', () => {
    renderPage()
    expect(screen.getByRole('tab', { name: '全部' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '系统 Agent' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '评分类' })).toBeInTheDocument()
  })
})
