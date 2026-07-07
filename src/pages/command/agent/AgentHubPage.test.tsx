import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import AgentHubPage from './AgentHubPage'

vi.mock('@/store/agentStore', () => ({
  useAgentStore: vi.fn((selector: (state: { stats: { totalAgents: number; runningTasks: number; completedTasks: number; failedTasks: number } }) => unknown) => {
    const state = {
      stats: { totalAgents: 5, pendingTasks: 0, runningTasks: 2, completedTasks: 10, failedTasks: 1 },
      registeredAgents: [],
    }
    return selector(state)
  }),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const icon = (testid: string) => () => <svg data-testid={testid} />
  return {
    ...actual,
    Bot: icon('icon-bot'),
    Activity: icon('icon-activity'),
    List: icon('icon-list'),
    Zap: icon('icon-zap'),
    GitBranch: icon('icon-git-branch'),
    Settings: icon('icon-settings'),
    ArrowRight: icon('icon-arrow-right'),
    Sparkles: icon('icon-sparkles'),
    MessageSquare: icon('icon-message-square'),
    Tag: icon('icon-tag'),
    Key: icon('icon-key'),
    ArrowUpCircle: icon('icon-arrow-up-circle'),
    Search: icon('icon-search'),
    Lightbulb: icon('icon-lightbulb'),
    Gift: icon('icon-gift'),
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

function renderPage(): void {
  render(
    <MemoryRouter>
      <AgentHubPage />
    </MemoryRouter>,
  )
}

describe('AgentHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染页面标题和面包屑', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '智能体总控台' })).toBeInTheDocument()
  })

  it('显示 4 个统计卡片', () => {
    renderPage()
    expect(screen.getByText('已注册智能体')).toBeInTheDocument()
    expect(screen.getByText('运行中任务')).toBeInTheDocument()
    expect(screen.getByText('已完成任务')).toBeInTheDocument()
    expect(screen.getByText('失败任务')).toBeInTheDocument()
  })

  it('显示正确的统计数值', () => {
    renderPage()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('显示功能导航卡片', () => {
    renderPage()
    expect(screen.getByText('智能体注册表')).toBeInTheDocument()
    expect(screen.getByText('任务触发')).toBeInTheDocument()
    expect(screen.getByText('能力图谱')).toBeInTheDocument()
  })
})
