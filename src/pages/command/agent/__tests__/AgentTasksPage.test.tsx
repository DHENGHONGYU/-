import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { AgentTask } from '@/agents/agentRuntime'

// ══════════════════════════════════════════════════════════════
// vi.hoisted:确保 mock 引用在 vi.mock 工厂执行前已就绪
// 所有 mock 函数提取为顶层变量,便于 beforeEach 重置与断言
// ══════════════════════════════════════════════════════════════
const { mockAgentStore, mockLogger, mockRefreshStats, mockSetTaskFilter, mockCancelTask } = vi.hoisted(() => {
  const refreshStats = vi.fn()
  const setTaskFilter = vi.fn()
  const cancelTask = vi.fn()
  return {
    mockRefreshStats: refreshStats,
    mockSetTaskFilter: setTaskFilter,
    mockCancelTask: cancelTask,
    mockAgentStore: {
      tasks: new Map<string, AgentTask>(),
      triggerPayload: null,
      taskFilter: {},
      mcpCallHistory: [],
      stats: { total: 0, success: 0, failed: 0, running: 0 },
      registeredAgents: [] as string[],
      setTriggerPayload: vi.fn(),
      setTaskFilter,
      addMCPCallRecord: vi.fn(),
      refreshStats,
    },
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }
})

vi.mock('@/store/agentStore', () => ({
  useAgentStore: () => mockAgentStore,
}))

vi.mock('@/agents/agentRuntime', () => ({
  agentRuntime: {
    execute: vi.fn(),
    register: vi.fn(),
    getTask: vi.fn(),
    cancelTask: mockCancelTask,
    getStats: vi.fn(() => ({})),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import AgentTasksPage from '@/pages/command/agent/AgentTasksPage'

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <AgentTasksPage />
    </MemoryRouter>,
  )
}

/** 构造单个 AgentTask,允许覆盖字段 */
function createTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-0001-default',
    agentId: 'v6-scoring-agent',
    type: 'score_stock',
    payload: {},
    timeout: 30000,
    status: 'completed',
    createdAt: 1700000000000,
    startedAt: 1700000000000,
    completedAt: 1700000000500,
    ...overrides,
  }
}

describe('AgentTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgentStore.tasks = new Map()
    mockAgentStore.taskFilter = {}
    mockAgentStore.triggerPayload = null
    mockAgentStore.mcpCallHistory = []
    mockAgentStore.stats = { total: 0, success: 0, failed: 0, running: 0 }
  })

  afterEach(() => {
    cleanup()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 1:空任务列表渲染
  // ────────────────────────────────────────────────────────────
  it('空任务列表渲染:显示"暂无任务记录"空状态文案', () => {
    const { container } = renderPage()
    expect(container.innerHTML).toContain('任务列表')
    expect(container.innerHTML).toContain('暂无任务记录')
    expect(screen.getByText('触发智能体任务后将在此显示')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 2:非空任务列表渲染表格行(任务 ID/智能体/类型/状态/创建时间)
  // ────────────────────────────────────────────────────────────
  it('非空任务列表渲染:表格展示任务 ID 片段、智能体、类型、状态标签', () => {
    const task = createTask({
      id: 'task-aaaabbbbcccc',
      agentId: 'fetcher-agent',
      type: 'fetch_stock_basic',
      status: 'completed',
    })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()

    // 任务 ID 片段(slice(0,12) + '...')
    expect(screen.getByText('task-aaaabbb...')).toBeInTheDocument()
    // 智能体列
    expect(screen.getByText('fetcher-agent')).toBeInTheDocument()
    // 类型列
    expect(screen.getByText('fetch_stock_basic')).toBeInTheDocument()
    // 状态标签(已完成) — 同时出现在过滤标签和状态徽章中,使用 getAllByText
    expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(1)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 3:任务排序 — 新创建的任务在前(按 createdAt 降序)
  // ────────────────────────────────────────────────────────────
  it('任务排序:按 createdAt 降序(最新任务在前)', () => {
    const oldTask = createTask({
      id: 'task-old',
      createdAt: 1700000000000,
      status: 'completed',
    })
    const newTask = createTask({
      id: 'task-new',
      createdAt: 1700000099999,
      status: 'completed',
    })
    mockAgentStore.tasks = new Map([
      [oldTask.id, oldTask],
      [newTask.id, newTask],
    ])

    const { container } = renderPage()
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)
    // 第一行应是新任务
    expect(rows[0]!.textContent).toContain('task-new')
    expect(rows[1]!.textContent).toContain('task-old')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 4:状态过滤 — 点击"执行中"过滤标签,触发 setTaskFilter 并仅显示 running 任务
  // ────────────────────────────────────────────────────────────
  it('状态过滤:点击"执行中"标签,调用 setTaskFilter({status:"running"}) 且仅显示 running 任务', () => {
    const runningTask = createTask({ id: 'task-running', status: 'running' })
    const completedTask = createTask({ id: 'task-completed', status: 'completed' })
    mockAgentStore.tasks = new Map([
      [runningTask.id, runningTask],
      [completedTask.id, completedTask],
    ])

    const { container } = renderPage()

    // 初始:两条都显示
    expect(container.querySelectorAll('tbody tr').length).toBe(2)

    // 点击"执行中"标签
    const runningTab = screen.getByRole('button', { name: '执行中' })
    fireEvent.click(runningTab)

    // setTaskFilter 被调用,filter.status === 'running'
    expect(mockSetTaskFilter).toHaveBeenCalledWith({ status: 'running' })
    // 仅显示 running 任务
    expect(container.querySelectorAll('tbody tr').length).toBe(1)
    expect(container.querySelector('tbody tr')!.textContent).toContain('task-running')
    // completed 任务不再显示
    expect(screen.queryByText('task-completed')).not.toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 5:状态过滤 — 点击"全部"重置 statusFilter 为空字符串
  // ────────────────────────────────────────────────────────────
  it('状态过滤:点击"全部"标签,调用 setTaskFilter({})', () => {
    const task = createTask({ id: 'task-x', status: 'pending' })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()

    const allTab = screen.getByRole('button', { name: '全部' })
    fireEvent.click(allTab)
    expect(mockSetTaskFilter).toHaveBeenCalledWith({})
  })

  // ────────────────────────────────────────────────────────────
  // 用例 6:其它过滤标签(已完成/失败/超时)调用 setTaskFilter
  // ────────────────────────────────────────────────────────────
  it('状态过滤:点击"已完成"/"失败"/"超时"标签,分别传入对应 status', () => {
    mockAgentStore.tasks = new Map()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '已完成' }))
    expect(mockSetTaskFilter).toHaveBeenLastCalledWith({ status: 'completed' })

    fireEvent.click(screen.getByRole('button', { name: '失败' }))
    expect(mockSetTaskFilter).toHaveBeenLastCalledWith({ status: 'failed' })

    fireEvent.click(screen.getByRole('button', { name: '超时' }))
    expect(mockSetTaskFilter).toHaveBeenLastCalledWith({ status: 'timeout' })
  })

  // ────────────────────────────────────────────────────────────
  // 用例 7:状态过滤 — 状态对应的标签文案与图标渲染(pending/running/completed/failed/timeout)
  // ────────────────────────────────────────────────────────────
  it('状态标签:不同 status 显示对应中文标签(待执行/执行中/已完成/失败/超时)', () => {
    const cases: Array<{ status: AgentTask['status']; label: string }> = [
      { status: 'pending', label: '待执行' },
      { status: 'running', label: '执行中' },
      { status: 'completed', label: '已完成' },
      { status: 'failed', label: '失败' },
      { status: 'timeout', label: '超时' },
    ]
    mockAgentStore.tasks = new Map(
      cases.map((c) => {
        const t = createTask({ id: `task-${c.status}`, status: c.status })
        return [t.id, t]
      }),
    )

    renderPage()

    for (const c of cases) {
      // '执行中'/'已完成'/'失败'/'超时' 同时出现在过滤标签按钮和状态徽章中,使用 getAllByText
      const matches = screen.getAllByText(c.label)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    }
  })

  // ────────────────────────────────────────────────────────────
  // 用例 8:状态过滤 — 状态标签缺失时回退到 task.status 原值
  // ────────────────────────────────────────────────────────────
  it('状态标签:未知 status 时回退到 task.status 原值', () => {
    // 类型断言绕过 TS,模拟"未知状态"分支
    const unknownStatus = 'unknown-status' as AgentTask['status']
    const task = createTask({ id: 'task-unknown', status: unknownStatus })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    expect(screen.getByText('unknown-status')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 9:agentId 缺失时回退到 task.id.split('-')[0]
  // ────────────────────────────────────────────────────────────
  it('智能体列:agentId 缺失时回退到 id.split("-")[0]', () => {
    const task = createTask({
      id: 'abc-def-ghi-1234',
      agentId: '',
      status: 'completed',
    })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    // id.split('-')[0] === 'abc'
    expect(screen.getByText('abc')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 10:耗时显示 — completedAt 与 startedAt 同时存在时显示 "{n}ms"
  // ────────────────────────────────────────────────────────────
  it('耗时显示:completedAt 与 startedAt 同时存在时显示 "{n}ms"', () => {
    const task = createTask({
      id: 'task-dur',
      status: 'completed',
      startedAt: 1700000000000,
      completedAt: 1700000000500,
    })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    expect(screen.getByText('500ms')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 11:耗时显示 — completedAt 或 startedAt 缺失时显示 "-"
  // ────────────────────────────────────────────────────────────
  it('耗时显示:completedAt/startedAt 缺失时显示 "-"', () => {
    const task = createTask({
      id: 'task-nodur',
      status: 'pending',
      startedAt: undefined,
      completedAt: undefined,
    })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    // 耗时单元格中存在 "-"
    const cells = screen.getAllByText('-')
    expect(cells.length).toBeGreaterThanOrEqual(1)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 12:取消按钮 — 仅 running 状态任务渲染"取消"按钮
  // ────────────────────────────────────────────────────────────
  it('取消按钮:仅 running 状态任务渲染"取消"按钮', () => {
    const runningTask = createTask({ id: 'task-r', status: 'running' })
    const completedTask = createTask({ id: 'task-c', status: 'completed' })
    mockAgentStore.tasks = new Map([
      [runningTask.id, runningTask],
      [completedTask.id, completedTask],
    ])

    renderPage()
    // 只有 1 个"取消"按钮(running 任务)
    expect(screen.getAllByText('取消').length).toBe(1)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 13:取消按钮点击 — 调用 agentRuntime.cancelTask(taskId) 并 store.refreshStats()
  // ────────────────────────────────────────────────────────────
  it('取消按钮点击:调用 agentRuntime.cancelTask(taskId) 并 store.refreshStats()', () => {
    const task = createTask({ id: 'task-cancel', status: 'running' })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    mockCancelTask.mockClear()
    mockRefreshStats.mockClear()

    fireEvent.click(screen.getByText('取消'))

    expect(mockCancelTask).toHaveBeenCalledWith('task-cancel')
    expect(mockRefreshStats).toHaveBeenCalled()
    // logger.info 应被调用(取消时打印日志)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[AgentTasksPage] Cancelling task',
      expect.objectContaining({ taskId: 'task-cancel' }),
    )
  })

  // ────────────────────────────────────────────────────────────
  // 用例 14:刷新按钮 — 点击"刷新"按钮调用 store.refreshStats()
  // ────────────────────────────────────────────────────────────
  it('刷新按钮:点击"刷新"调用 store.refreshStats()', () => {
    mockAgentStore.tasks = new Map()
    renderPage()
    mockRefreshStats.mockClear()

    // 排除"自动刷新中"按钮,精确点击"刷新"
    const refreshBtn = screen.getByRole('button', { name: '刷新' })
    fireEvent.click(refreshBtn)
    expect(mockRefreshStats).toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 15:自动刷新切换 — 点击按钮切换 autoRefresh,文案在"自动刷新中"和"已暂停"间切换
  // ────────────────────────────────────────────────────────────
  it('自动刷新切换:点击切换按钮,文案在"自动刷新中"和"已暂停"间切换', () => {
    mockAgentStore.tasks = new Map()
    renderPage()

    // 初始为"自动刷新中"
    expect(screen.getByText('自动刷新中')).toBeInTheDocument()
    expect(screen.queryByText('已暂停')).not.toBeInTheDocument()

    // 点击切换
    fireEvent.click(screen.getByRole('button', { name: '自动刷新中' }))
    expect(screen.getByText('已暂停')).toBeInTheDocument()
    expect(screen.queryByText('自动刷新中')).not.toBeInTheDocument()

    // 再次点击切回
    fireEvent.click(screen.getByRole('button', { name: '已暂停' }))
    expect(screen.getByText('自动刷新中')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 16:useEffect 副作用 — 挂载时调用 setTaskFilter({}) 与 logger.info
  // ────────────────────────────────────────────────────────────
  it('useEffect: 挂载时调用 setTaskFilter({}) 与 logger.info("[AgentTasksPage] Mounted")', () => {
    mockAgentStore.tasks = new Map()
    renderPage()

    expect(mockSetTaskFilter).toHaveBeenCalledWith({})
    expect(mockLogger.info).toHaveBeenCalledWith('[AgentTasksPage] Mounted')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 17:自动刷新定时器 — autoRefresh 开启时定期调用 store.refreshStats()
  // ────────────────────────────────────────────────────────────
  it('自动刷新定时器:开启时按 3 秒间隔调用 store.refreshStats()', () => {
    vi.useFakeTimers()
    try {
      mockAgentStore.tasks = new Map()
      mockRefreshStats.mockClear()
      renderPage()
      // 卸载前的挂载日志(避免与定时器调用计数混淆)
      expect(mockLogger.info).toHaveBeenCalledWith('[AgentTasksPage] Mounted')

      // 推进 3 秒 — 应触发 1 次定时器
      vi.advanceTimersByTime(3000)
      // refreshStats 调用次数 >= 1(定时器触发)
      const timerCalls = mockRefreshStats.mock.calls.length
      expect(timerCalls).toBeGreaterThanOrEqual(1)
    } finally {
      vi.useRealTimers()
    }
  })

  // ────────────────────────────────────────────────────────────
  // 用例 18:卸载日志 — unmount 时打印 "[AgentTasksPage] Unmounted"
  // ────────────────────────────────────────────────────────────
  it('卸载日志: unmount 时打印 "[AgentTasksPage] Unmounted" 并清理定时器', () => {
    vi.useFakeTimers()
    try {
      mockAgentStore.tasks = new Map()
      const { unmount } = renderPage()
      mockLogger.info.mockClear()

      unmount()

      expect(mockLogger.info).toHaveBeenCalledWith('[AgentTasksPage] Unmounted')
      // 卸载后再推进定时器,refreshStats 不应再被调用
      mockRefreshStats.mockClear()
      vi.advanceTimersByTime(6000)
      expect(mockRefreshStats).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  // ────────────────────────────────────────────────────────────
  // 用例 19:statusFilter 变化时 — setTaskFilter 收到对应的 filter
  // ────────────────────────────────────────────────────────────
  it('statusFilter 变化:点击过滤标签后,setTaskFilter 收到对应 status', () => {
    mockAgentStore.tasks = new Map()
    renderPage()
    mockSetTaskFilter.mockClear()

    fireEvent.click(screen.getByRole('button', { name: '执行中' }))
    expect(mockSetTaskFilter).toHaveBeenCalledWith({ status: 'running' })

    // 切回"全部"
    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    expect(mockSetTaskFilter).toHaveBeenLastCalledWith({})
  })

  // ────────────────────────────────────────────────────────────
  // 用例 20:过滤后空列表 — 选中过滤但无匹配任务时显示空状态
  // ────────────────────────────────────────────────────────────
  it('过滤后空列表:选中过滤但无匹配任务时显示"暂无任务记录"', () => {
    const task = createTask({ id: 'task-c', status: 'completed' })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    // 切换到"执行中"过滤 → 无匹配 → 显示空状态
    fireEvent.click(screen.getByRole('button', { name: '执行中' }))
    expect(screen.getByText('暂无任务记录')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 21:面包屑渲染 — 显示首页/总控舱/智能体/任务列表
  // ────────────────────────────────────────────────────────────
  it('面包屑: 渲染首页 → 总控舱 → 智能体 → 任务列表', () => {
    mockAgentStore.tasks = new Map()
    renderPage()
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('总控舱')).toBeInTheDocument()
    expect(screen.getByText('智能体')).toBeInTheDocument()
    // '任务列表' 同时出现在面包屑页面和 h1 标题中
    expect(screen.getAllByText('任务列表').length).toBeGreaterThanOrEqual(1)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 22:挂载时若已存在 statusFilter,则 setTaskFilter 收到 {status}
  //  通过重渲染场景验证 useEffect 依赖 [statusFilter, autoRefresh, store] 触发
  // ────────────────────────────────────────────────────────────
  it('useEffect 依赖: statusFilter 变化触发 setTaskFilter 重置', async () => {
    mockAgentStore.tasks = new Map()
    renderPage()
    // 初始挂载调用一次 setTaskFilter({})
    expect(mockSetTaskFilter).toHaveBeenCalledWith({})

    mockSetTaskFilter.mockClear()
    // 点击"失败"标签 → useEffect 重新执行,传入 {status: 'failed'}
    fireEvent.click(screen.getByRole('button', { name: '失败' }))
    await waitFor(() => {
      expect(mockSetTaskFilter).toHaveBeenCalledWith({ status: 'failed' })
    })
  })

  // ────────────────────────────────────────────────────────────
  // 用例 23:autoRefresh=false 时不启动定时器,refreshStats 不被周期性调用
  // ────────────────────────────────────────────────────────────
  it('autoRefresh 关闭:不启动定时器,推进时间后 refreshStats 不被调用', () => {
    vi.useFakeTimers()
    try {
      mockAgentStore.tasks = new Map()
      renderPage()
      mockRefreshStats.mockClear()

      // 关闭自动刷新
      fireEvent.click(screen.getByRole('button', { name: '自动刷新中' }))
      expect(screen.getByText('已暂停')).toBeInTheDocument()

      // 推进 6 秒 — 定时器不应触发
      vi.advanceTimersByTime(6000)
      expect(mockRefreshStats).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  // ────────────────────────────────────────────────────────────
  // 用例 24:多个 running 任务每个都渲染取消按钮
  // ────────────────────────────────────────────────────────────
  it('多个 running 任务:每个都渲染取消按钮,点击各调用 cancelTask', () => {
    const r1 = createTask({ id: 'task-r1', status: 'running' })
    const r2 = createTask({ id: 'task-r2', status: 'running' })
    mockAgentStore.tasks = new Map([
      [r1.id, r1],
      [r2.id, r2],
    ])

    renderPage()
    // 两个取消按钮
    const cancelBtns = screen.getAllByText('取消')
    expect(cancelBtns.length).toBe(2)

    // 点击第一个取消按钮
    mockCancelTask.mockClear()
    mockRefreshStats.mockClear()
    fireEvent.click(cancelBtns[0]!)
    expect(mockCancelTask).toHaveBeenCalledTimes(1)

    // 点击第二个取消按钮
    fireEvent.click(cancelBtns[1]!)
    expect(mockCancelTask).toHaveBeenCalledTimes(2)
    // refreshStats 被调用 2 次
    expect(mockRefreshStats).toHaveBeenCalledTimes(2)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 25:任务 ID 片段正确截取(slice 12 字符 + '...')
  // ────────────────────────────────────────────────────────────
  it('任务 ID 片段:正确截取前 12 字符并追加 "...', () => {
    const task = createTask({
      id: 'abcdefghij0123456789',
      status: 'completed',
    })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    // slice(0, 12) = 'abcdefghij01' + '...'
    expect(screen.getByText('abcdefghij01...')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 26:completedAt 存在但 startedAt 缺失时耗时显示 "-"
  // ────────────────────────────────────────────────────────────
  it('耗时显示:startedAt 缺失但 completedAt 存在时显示 "-"', () => {
    const task = createTask({
      id: 'task-partial',
      status: 'completed',
      startedAt: undefined,
      completedAt: 1700000000500,
    })
    mockAgentStore.tasks = new Map([[task.id, task]])

    renderPage()
    // 条件 task.completedAt && task.startedAt 为 false,应显示 "-"
    const dashCells = screen.getAllByText('-')
    expect(dashCells.length).toBeGreaterThanOrEqual(1)
  })
})
