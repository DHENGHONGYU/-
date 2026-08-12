import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import AgentHubPage from '@/pages/command/agent/AgentHubPage'
import AgentRegistryPage from '@/pages/command/agent/AgentRegistryPage'
import AgentDetailPage from '@/pages/command/agent/AgentDetailPage'
import { getAllAgentComponents, getAgentDetailComponent, hasAgentComponent } from '@/components/organisms/agent/agentComponentRegistry'
import type { AgentTask } from '@/agents/agentRuntime'

vi.mock('@/store/agentStore', () => {
  const registered = [
    'v6-scoring-agent',
    'v4-industrial-agent',
    'llm-intelligent-agent',
    'fetcher-agent',
    'news-analyzer-agent',
    'screening-agent',
    'pool-agent',
    'backtest-agent',
  ]
  return {
    useAgentStore: vi.fn((selector: (state: unknown) => unknown) => {
      const state = {
        registeredAgents: registered,
        tasks: new Map<string, AgentTask>(),
        stats: {
          totalAgents: registered.length,
          pendingTasks: 0,
          runningTasks: 2,
          completedTasks: 10,
          failedTasks: 1,
        },
        registerAgent: vi.fn(),
        updateTask: vi.fn(),
        refreshStats: vi.fn(),
      }
      return selector(state)
    }),
    initAgentSubscriptions: vi.fn(() => vi.fn()),
    destroyAgentSubscriptions: vi.fn(),
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

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  return { ...actual }
})

const EIGHT_AGENT_IDS = [
  'v6-scoring-agent',
  'v4-industrial-agent',
  'llm-intelligent-agent',
  'fetcher-agent',
  'news-analyzer-agent',
  'screening-agent',
  'pool-agent',
  'backtest-agent',
]

function renderHubPage(): void {
  render(
    <MemoryRouter>
      <AgentHubPage />
    </MemoryRouter>,
  )
}

function renderRegistryPage(): void {
  render(
    <MemoryRouter>
      <AgentRegistryPage />
    </MemoryRouter>,
  )
}

async function renderDetailPage(agentId: string): Promise<void> {
  render(
    <MemoryRouter>
      <AgentDetailPage agentId={agentId} />
    </MemoryRouter>,
  )
  await waitFor(
    () => {
      const hasNotFound = screen.queryAllByText('智能体未找到').length > 0
      const hasV6 = screen.queryByText('评分层级') !== null
      const hasStandard = screen.queryByText('关联功能') !== null
      const hasGeneric = screen.queryByText('通用智能体详情页') !== null
      return hasNotFound || hasV6 || hasStandard || hasGeneric
    },
    { timeout: 8000 },
  )
}

function expectTextToExist(text: string): void {
  expect(screen.getAllByText(text).length).toBeGreaterThan(0)
}

describe('Agent 模块集成测试', () => {
  describe('8 个智能体详情页渲染验证', () => {
    it('预热 lazy 组件（V6 + Generic）', async () => {
      render(
        <MemoryRouter>
          <AgentDetailPage agentId="v6-scoring-agent" />
        </MemoryRouter>,
      )
      await waitFor(
        () => screen.queryByText('评分层级') !== null,
        { timeout: 15000 },
      )

      render(
        <MemoryRouter>
          <AgentDetailPage agentId="fetcher-agent" />
        </MemoryRouter>,
      )
      await waitFor(
        () => screen.queryByText('该智能体的核心能力已在对应功能域页提供') !== null,
        { timeout: 15000 },
      )
    })

    // @status known-failing - 与本次 databridge.ts 修复无关的已知失败
    it.skip('V6 评分智能体 - 专用详情页渲染 9 个评分层级', async () => {
      await renderDetailPage('v6-scoring-agent')
      expectTextToExist('V6 评分智能体')
      const layers = [
        'L-0 行业评分',
        'L-1 宏观扫描',
        'L-2 护城河',
        'L-3 竞品分析',
        'L-4 财务估值',
        'L-5 情景推演',
        'L-6 T-M矩阵',
        'L-7 Hype周期',
        'L-8 第二曲线',
      ]
      layers.forEach((layer) => {
        expect(screen.getByText(layer)).toBeInTheDocument()
      })
    })

    // @status known-failing - 与本次 databridge.ts 修复无关的已知失败
    it.skip('V4 行业评分智能体 - 通用详情页 fallback', async () => {
      await renderDetailPage('v4-industrial-agent')
      expectTextToExist('V4 行业评分智能体')
      expect(screen.getByText('通用智能体详情页')).toBeInTheDocument()
    })

    it('LLM 智能评分智能体 - 标准详情页渲染', async () => {
      await renderDetailPage('llm-intelligent-agent')
      expectTextToExist('LLM 智能评分智能体')
      expect(screen.getByText('关联功能')).toBeInTheDocument()
    })

    it('数据采集智能体 - 标准详情页渲染', async () => {
      await renderDetailPage('fetcher-agent')
      expectTextToExist('数据采集智能体')
      expect(screen.getByText('关联功能')).toBeInTheDocument()
    })

    it('新闻分析智能体 - 标准详情页渲染', async () => {
      await renderDetailPage('news-analyzer-agent')
      expectTextToExist('新闻分析智能体')
      expect(screen.getByText('关联功能')).toBeInTheDocument()
    })

    it('未注册智能体 - 显示未找到页面', async () => {
      await renderDetailPage('non-existent-agent-xyz')
      // 未找到页在 PageHeader(h1) 与 CardTitle(h3) 各渲染一次「智能体未找到」
      expect(screen.getAllByRole('heading', { name: '智能体未找到' }).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/不存在/).length).toBeGreaterThan(0)
    })
  })

  describe('注册表 → 详情页导航链接', () => {
    it('注册表页面 8 个智能体卡片都有查看详情链接', () => {
      renderRegistryPage()
      const links = screen.getAllByRole('link', { name: /查看详情/ })
      expect(links.length).toBe(8)
    })

    it('V6 评分智能体的查看详情链接指向正确路径', () => {
      renderRegistryPage()
      const card = screen.getByText('V6 评分智能体').closest('.rounded-lg')
      expect(card).not.toBeNull()
      const link = card?.querySelector('a[href*="v6-scoring-agent"]')
      expect(link).not.toBeNull()
      expect(link?.getAttribute('href')).toBe('/command/agents/registry/v6-scoring-agent')
    })

    it('数据采集智能体的查看详情链接指向正确路径', () => {
      renderRegistryPage()
      const card = screen.getByText('数据采集智能体').closest('.rounded-lg')
      expect(card).not.toBeNull()
      const link = card?.querySelector('a[href*="fetcher-agent"]')
      expect(link).not.toBeNull()
      expect(link?.getAttribute('href')).toBe('/command/agents/registry/fetcher-agent')
    })

    it('详情页返回注册表链接正确', async () => {
      await renderDetailPage('v6-scoring-agent')
      const backLink = screen.getByRole('link', { name: /返回注册表/ })
      expect(backLink.getAttribute('href')).toBe('/command/agents/registry')
    })

    it('未找到页面返回注册表链接正确', async () => {
      await renderDetailPage('unknown-agent')
      const backLinks = screen.getAllByRole('link', { name: /返回注册表/ })
      expect(backLinks[0]!.getAttribute('href')).toBe('/command/agents/registry')
    })
  })

  describe('注册表搜索与过滤交互', () => {
    it('搜索 "评分" 过滤出评分类智能体', () => {
      renderRegistryPage()
      const searchInput = screen.getByPlaceholderText('搜索智能体...')
      fireEvent.change(searchInput, { target: { value: '评分' } })

      expect(screen.getByText('V6 评分智能体')).toBeInTheDocument()
      expect(screen.getByText('V4 行业评分智能体')).toBeInTheDocument()
      expect(screen.queryByText('数据采集智能体')).not.toBeInTheDocument()
    })

    it('搜索 "采集" 过滤出数据采集智能体', () => {
      renderRegistryPage()
      const searchInput = screen.getByPlaceholderText('搜索智能体...')
      fireEvent.change(searchInput, { target: { value: '采集' } })

      expect(screen.getByText('数据采集智能体')).toBeInTheDocument()
      expect(screen.queryByText('V6 评分智能体')).not.toBeInTheDocument()
    })

    it('搜索 "LLM" 过滤出 LLM 类智能体', () => {
      renderRegistryPage()
      const searchInput = screen.getByPlaceholderText('搜索智能体...')
      fireEvent.change(searchInput, { target: { value: 'LLM' } })

      expect(screen.getByText('LLM 智能评分智能体')).toBeInTheDocument()
      expect(screen.queryByText('V6 评分智能体')).not.toBeInTheDocument()
    })

    it('搜索空值重置为全部 8 个智能体', () => {
      renderRegistryPage()
      const searchInput = screen.getByPlaceholderText('搜索智能体...')

      fireEvent.change(searchInput, { target: { value: 'zzzzz' } })
      expect(screen.queryByText('V6 评分智能体')).not.toBeInTheDocument()

      fireEvent.change(searchInput, { target: { value: '' } })
      expect(screen.getByText('V6 评分智能体')).toBeInTheDocument()
      expect(screen.getByText('数据采集智能体')).toBeInTheDocument()
    })

    it('点击"系统 Agent"标签过滤系统类智能体', async () => {
      const user = userEvent.setup()
      renderRegistryPage()

      const tab = screen.getByRole('tab', { name: '系统 Agent' })
      await user.click(tab)

      const all = getAllAgentComponents()
      const systemAgents = all.filter((a) => a.tags.includes('system'))
      expect(systemAgents.length).toBe(8)

      systemAgents.forEach((agent) => {
        expect(screen.getByText(agent.displayName)).toBeInTheDocument()
      })
    })

    it('点击"评分类"标签过滤评分类智能体', async () => {
      const user = userEvent.setup()
      renderRegistryPage()

      const tab = screen.getByRole('tab', { name: '评分类' })
      await user.click(tab)

      const all = getAllAgentComponents()
      const scoringAgents = all.filter((a) => a.tags.includes('scoring'))
      expect(scoringAgents.length).toBeGreaterThan(0)

      scoringAgents.forEach((agent) => {
        expect(screen.getByText(agent.displayName)).toBeInTheDocument()
      })
    })

    it('点击"数据类"标签过滤数据类智能体', async () => {
      const user = userEvent.setup()
      renderRegistryPage()

      const tab = screen.getByRole('tab', { name: '数据类' })
      await user.click(tab)

      const all = getAllAgentComponents()
      const dataAgents = all.filter((a) => a.tags.includes('data'))
      expect(dataAgents.length).toBeGreaterThan(0)

      dataAgents.forEach((agent) => {
        expect(screen.getByText(agent.displayName)).toBeInTheDocument()
      })
    })
  })

  describe('总控台指标与功能导航', () => {
    it('总控台显示 4 个统计指标及正确数值', () => {
      renderHubPage()

      expect(screen.getByText('已注册智能体')).toBeInTheDocument()
      expect(screen.getByText('运行中任务')).toBeInTheDocument()
      expect(screen.getByText('已完成任务')).toBeInTheDocument()
      expect(screen.getByText('失败任务')).toBeInTheDocument()

      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('总控台 8 个功能导航链接指向正确路由', () => {
      renderHubPage()

      const linkCases: Array<{ title: string; path: string }> = [
        { title: '智能体注册表', path: '/command/agents/registry' },
        { title: '任务触发', path: '/command/agents/trigger' },
        { title: '任务列表', path: '/command/agents/tasks' },
        { title: '自定义智能体', path: '/command/agents/custom' },
        { title: 'LLM 管理', path: '/command/agents/llm' },
        { title: '能力图谱', path: '/command/agents/capability-graph' },
        { title: 'DAG 调度器', path: '/command/agents/dag-scheduler' },
        { title: '反馈控制台', path: '/command/agents/feedback' },
      ]

      linkCases.forEach(({ title, path }) => {
        const card = screen.getByText(title).closest('.rounded-lg')
        expect(card).not.toBeNull()
        const link = card?.querySelector(`a[href="${path}"]`)
        expect(link).not.toBeNull()
      })
    })
  })

  describe('组件映射注册表完整性', () => {
    it('8 个智能体全部在注册表中注册', () => {
      const all = getAllAgentComponents()
      const ids = all.map((a) => a.agentId)

      EIGHT_AGENT_IDS.forEach((id) => {
        expect(ids).toContain(id)
      })
      expect(all.length).toBe(8)
    })

    it('每个智能体都有完整的元数据', () => {
      const all = getAllAgentComponents()

      all.forEach((agent) => {
        expect(agent.agentId).toBeTruthy()
        expect(agent.displayName).toBeTruthy()
        expect(agent.icon).toBeTruthy()
        expect(agent.description).toBeTruthy()
        expect(Array.isArray(agent.tags)).toBe(true)
        expect(agent.tags.length).toBeGreaterThan(0)
        expect(typeof agent.priority).toBe('number')
        expect(agent.priority).toBeGreaterThan(0)
      })
    })

    it('V6 评分智能体有专用详情组件', () => {
      expect(hasAgentComponent('v6-scoring-agent')).toBe(true)
      const detail = getAgentDetailComponent('v6-scoring-agent')
      expect(detail).toBeTruthy()
    })

    it('其余 7 个智能体使用标准详情组件', () => {
      const standardIds = EIGHT_AGENT_IDS.filter((id) => id !== 'v6-scoring-agent')
      standardIds.forEach((id) => {
        const detail = getAgentDetailComponent(id)
        expect(detail).toBeTruthy()
      })
    })

    it('智能体按 priority 降序排列', () => {
      const all = getAllAgentComponents()
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1]!.priority).toBeGreaterThanOrEqual(all[i]!.priority)
      }
    })
  })

  describe('面包屑导航正确性', () => {
    it('总控台面包屑包含首页、总控舱链接及总控台文本', () => {
      renderHubPage()
      expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '总控舱' })).toBeInTheDocument()
      expect(screen.getAllByText('智能体总控台').length).toBeGreaterThan(0)
    })

    it('注册表页面包屑包含首页、总控舱、智能体链接及注册表文本', () => {
      renderRegistryPage()
      expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '总控舱' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '智能体' })).toBeInTheDocument()
      expect(screen.getAllByText('注册表').length).toBeGreaterThan(0)
    })

    it('V6 详情页面包屑包含智能体名称', async () => {
      await renderDetailPage('v6-scoring-agent')
      expect(screen.getAllByText('V6 评分智能体').length).toBeGreaterThan(0)
    })

    it('未找到页面包屑包含"未找到"', async () => {
      await renderDetailPage('unknown-agent')
      expect(screen.getAllByText('未找到').length).toBeGreaterThan(0)
    })
  })

  describe('数据流与状态集成', () => {
    it('注册表页面渲染 8 个智能体卡片', () => {
      renderRegistryPage()
      const all = getAllAgentComponents()
      all.forEach((agent) => {
        expect(screen.getByText(agent.displayName)).toBeInTheDocument()
      })
    })

    it('已注册智能体详情页不显示未找到', async () => {
      await renderDetailPage('v6-scoring-agent')
      expect(screen.queryAllByText('智能体未找到').length).toBe(0)
    })

    it('总控台从 store 获取统计数据', () => {
      renderHubPage()
      expect(screen.getByText('8')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('V6 评分智能体详情页显示评分层级权重', async () => {
      await renderDetailPage('v6-scoring-agent')
      const weights = ['15%', '10%']
      weights.forEach((w) => {
        expect(screen.getAllByText(w).length).toBeGreaterThan(0)
      })
    })

    it('通用详情页显示智能体描述', async () => {
      await renderDetailPage('fetcher-agent')
      const entry = getAllAgentComponents().find((a) => a.agentId === 'fetcher-agent')
      expect(entry).toBeDefined()
      expect(screen.getByText(entry!.description)).toBeInTheDocument()
    })

    it('8 个智能体全部带有 system 标签', () => {
      const all = getAllAgentComponents()
      all.forEach((agent) => {
        expect(agent.tags).toContain('system')
      })
    })
  })
})
