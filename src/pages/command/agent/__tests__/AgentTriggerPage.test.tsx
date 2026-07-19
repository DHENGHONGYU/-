import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// ══════════════════════════════════════════════════════════════
// vi.hoisted:确保 mock 引用在 vi.mock 工厂执行前已就绪
// 所有 mock 函数提取为顶层变量,便于 beforeEach 重置与断言
// ══════════════════════════════════════════════════════════════
const {
  mockAgentStore,
  mockLogger,
  mockExecute,
  mockSetTriggerPayload,
  mockAgents,
  mockServers,
} = vi.hoisted(() => {
  return {
    mockExecute: vi.fn(),
    mockSetTriggerPayload: vi.fn(),
    mockAgentStore: {
      tasks: new Map(),
      triggerPayload: null,
      taskFilter: {},
      mcpCallHistory: [],
      stats: { total: 0, success: 0, failed: 0, running: 0 },
      registeredAgents: [] as string[],
      setTriggerPayload: vi.fn(),
      setTaskFilter: vi.fn(),
      addMCPCallRecord: vi.fn(),
      refreshStats: vi.fn(),
    },
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    // 可变数组,允许在测试中替换返回值
    mockAgents: [] as Array<{
      agentId: string
      displayName: string
      mcpServerName: string
      defaultToolName: string
    }>,
    mockServers: [] as Array<{
      server: {
        info: { name: string; version: string; description: string }
        listTools: () => Array<{ name: string; description: string; inputSchema: unknown }>
      }
      options: { enabled: boolean; priority: string }
    }>,
  }
})

vi.mock('@/components/organisms/agent/agentComponentRegistry', () => ({
  getAllAgentComponents: () => mockAgents,
  agentComponentRegistry: {
    get: () => undefined,
    getAll: () => mockAgents,
  },
}))

vi.mock('@/mcp/core/registry', () => ({
  mcpRegistry: {
    listServers: () => mockServers,
    getServer: () => null,
    setEnabled: vi.fn(),
  },
}))

vi.mock('@/agents/agentRuntime', () => ({
  agentRuntime: {
    execute: mockExecute,
    register: vi.fn(),
    getTask: vi.fn(),
    cancelTask: vi.fn(),
    getStats: vi.fn(() => ({})),
  },
}))

vi.mock('@/store/agentStore', () => ({
  useAgentStore: () => mockAgentStore,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import AgentTriggerPage from '@/pages/command/agent/AgentTriggerPage'

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <AgentTriggerPage />
    </MemoryRouter>,
  )
}

/** 默认 agent/server/tool 配置 */
function setupDefaultMocks(): void {
  mockAgents.length = 0
  mockAgents.push({
    agentId: 'test-agent',
    displayName: 'Test Agent',
    mcpServerName: 'test-server',
    defaultToolName: 'test_tool',
  })
  mockServers.length = 0
  mockServers.push({
    server: {
      info: { name: 'test-server', version: '1.0.0', description: 'Test' },
      listTools: () => [
        { name: 'test_tool', description: 'Test tool', inputSchema: { type: 'object', properties: {} } },
        { name: 'other_tool', description: 'Other tool', inputSchema: { type: 'object', properties: {} } },
      ],
    },
    options: { enabled: true, priority: 'medium' },
  })
}

describe('AgentTriggerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgentStore.tasks = new Map()
    mockAgentStore.taskFilter = {}
    mockAgentStore.triggerPayload = null
    mockAgentStore.mcpCallHistory = []
    mockAgentStore.setTriggerPayload = mockSetTriggerPayload
    mockSetTriggerPayload.mockClear()
    mockExecute.mockReset()
    setupDefaultMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 1:页面基础渲染
  // ────────────────────────────────────────────────────────────
  it('页面基础渲染:显示标题、卡片、智能体下拉、空状态文案', () => {
    const { container } = renderPage()
    expect(container.innerHTML).toContain('触发配置')
    expect(container.innerHTML).toContain('执行结果')
    // '任务触发' 同时出现在面包屑页面和 h1 标题中
    expect(screen.getAllByText('任务触发').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('手动选择智能体并触发任务执行')).toBeInTheDocument()
    // 空状态文案
    expect(screen.getByText('配置触发参数后点击执行')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 2:面包屑渲染
  // ────────────────────────────────────────────────────────────
  it('面包屑: 渲染首页 → 总控舱 → 智能体 → 任务触发', () => {
    renderPage()
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('总控舱')).toBeInTheDocument()
    // '智能体' 同时出现在面包屑链接和 select 标签中
    expect(screen.getAllByText('智能体').length).toBeGreaterThanOrEqual(1)
    // '任务触发' 同时出现在面包屑页面和 h1 标题中
    expect(screen.getAllByText('任务触发').length).toBeGreaterThanOrEqual(1)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 3:挂载/卸载日志
  // ────────────────────────────────────────────────────────────
  it('挂载/卸载日志: Mounted 与 Unmounted', () => {
    const { unmount } = renderPage()
    expect(mockLogger.info).toHaveBeenCalledWith('[AgentTriggerPage] Mounted')
    mockLogger.info.mockClear()
    unmount()
    expect(mockLogger.info).toHaveBeenCalledWith('[AgentTriggerPage] Unmounted')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 4:agent 下拉渲染所有 agent
  // ────────────────────────────────────────────────────────────
  it('agent 下拉:渲染所有 agent 选项(displayName + agentId)', () => {
    mockAgents.length = 0
    mockAgents.push(
      {
        agentId: 'agent-a',
        displayName: 'Agent A',
        mcpServerName: 'srv-a',
        defaultToolName: 'tool-a',
      },
      {
        agentId: 'agent-b',
        displayName: 'Agent B',
        mcpServerName: 'srv-b',
        defaultToolName: 'tool-b',
      },
    )
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]!
    const options = agentSelect.querySelectorAll('option')
    expect(options.length).toBe(3) // 1 placeholder + 2 agents
    expect(agentSelect.innerHTML).toContain('Agent A (agent-a)')
    expect(agentSelect.innerHTML).toContain('Agent B (agent-b)')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 5:选择 agent — 自动设置 mcpServerName 与 defaultToolName
  // ────────────────────────────────────────────────────────────
  it('handleAgentChange: 选择 agent 时自动设置 serverName 与 toolName', () => {
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    // 选中后,MCP Server 下拉应自动选中 'test-server'
    const serverSelect = container.querySelectorAll('select')[1]! as HTMLSelectElement
    expect(serverSelect.value).toBe('test-server')
    // Tool 下拉应自动选中 'test_tool'
    const toolSelect = container.querySelectorAll('select')[2]! as HTMLSelectElement
    expect(toolSelect.value).toBe('test_tool')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 6:选择 agent 无 mcpServerName — 不自动设置 server
  // ────────────────────────────────────────────────────────────
  it('handleAgentChange: 选择无 mcpServerName 的 agent 时不自动设置 server/tool', () => {
    mockAgents.length = 0
    mockAgents.push({
      agentId: 'agent-no-mcp',
      displayName: 'No MCP Agent',
      mcpServerName: '',
      defaultToolName: '',
    })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'agent-no-mcp' } })

    const serverSelect = container.querySelectorAll('select')[1]! as HTMLSelectElement
    expect(serverSelect.value).toBe('')
    // 由于 selectedServerName 为空,Tool 下拉不应渲染
    const toolSelects = container.querySelectorAll('select')
    // 只有 2 个 select(agent + server),Tool select 条件渲染不出现
    expect(toolSelects.length).toBe(2)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 7:切换 MCP Server — 重置 selectedToolName
  // ────────────────────────────────────────────────────────────
  it('MCP Server onChange: 切换 server 时重置 selectedToolName', () => {
    const { container } = renderPage()
    // 先选 agent 自动填充 server 与 tool
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })
    const toolSelect = container.querySelectorAll('select')[2]! as HTMLSelectElement
    expect(toolSelect.value).toBe('test_tool')

    // 切换 server 为空 → selectedServerName 变为空,Tool select 条件渲染消失
    const serverSelect = container.querySelectorAll('select')[1]! as HTMLSelectElement
    fireEvent.change(serverSelect, { target: { value: '' } })
    // selectedServerName 为 '' 时 Tool 下拉不渲染,只剩 2 个 select(agent + server)
    expect(container.querySelectorAll('select').length).toBe(2)

    // 重新选择 server → Tool select 重新渲染,且 selectedToolName 已被重置为空
    fireEvent.change(serverSelect, { target: { value: 'test-server' } })
    const toolSelectAfter = container.querySelectorAll('select')[2]! as HTMLSelectElement
    expect(toolSelectAfter.value).toBe('')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 8:选择 Tool
  // ────────────────────────────────────────────────────────────
  it('Tool onChange: 选择 tool 时更新 selectedToolName', () => {
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    const toolSelect = container.querySelectorAll('select')[2]! as HTMLSelectElement
    fireEvent.change(toolSelect, { target: { value: 'other_tool' } })
    expect(toolSelect.value).toBe('other_tool')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 9:超时输入变更
  // ────────────────────────────────────────────────────────────
  it('timeout onChange: 修改超时数值', () => {
    const { container } = renderPage()
    const timeoutInput = container.querySelector('input[type="number"]')! as HTMLInputElement
    expect(timeoutInput.value).toBe('30000')
    fireEvent.change(timeoutInput, { target: { value: '60000' } })
    expect(timeoutInput.value).toBe('60000')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 10:超时输入 NaN 时回退到 30000
  // ────────────────────────────────────────────────────────────
  it('timeout onChange: 输入 NaN 时回退到 30000', () => {
    const { container } = renderPage()
    const timeoutInput = container.querySelector('input[type="number"]')! as HTMLInputElement
    fireEvent.change(timeoutInput, { target: { value: 'abc' } })
    // Number('abc') === NaN, || 30000 → 30000
    expect(timeoutInput.value).toBe('30000')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 11:payload textarea 输入 — 清空 payloadError
  // ────────────────────────────────────────────────────────────
  it('payload onChange: 输入时清空 payloadError', () => {
    const { container } = renderPage()
    const textarea = container.querySelector('textarea')! as HTMLTextAreaElement
    // 初始无 payloadError
    expect(screen.queryByText('JSON 格式无效')).not.toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: '{"k":1}' } })
    expect(textarea.value).toBe('{"k":1}')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 12:执行按钮 disabled — 未选 agent 时禁用
  // ────────────────────────────────────────────────────────────
  it('执行按钮 disabled: 未选 agent 时禁用', () => {
    renderPage()
    const btn = screen.getByRole('button', { name: '执行任务' })
    expect(btn).toBeDisabled()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 13:执行按钮 enabled — 选 agent + tool 后启用
  // ────────────────────────────────────────────────────────────
  it('执行按钮 enabled: 选 agent 后自动填充 server/tool,按钮启用', () => {
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })
    const btn = screen.getByRole('button', { name: '执行任务' })
    expect(btn).not.toBeDisabled()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 14:执行 — JSON 无效时显示 payloadError,execute 不被调用
  // ────────────────────────────────────────────────────────────
  it('handleExecute: payload JSON 无效时显示错误,execute 未调用', async () => {
    const { container } = renderPage()
    // 选 agent
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })
    // 输入无效 JSON
    const textarea = container.querySelector('textarea')! as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{invalid-json' } })

    const btn = screen.getByRole('button', { name: '执行任务' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('JSON 格式无效')).toBeInTheDocument()
    })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 15:执行成功 — agentRuntime.execute 返回 task,显示成功结果与 task.id
  // ────────────────────────────────────────────────────────────
  it('handleExecute 成功: 调用 execute,显示"执行成功"与 task.id', async () => {
    mockExecute.mockResolvedValueOnce({ id: 'task-success-123', status: 'completed' })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    const btn = screen.getByRole('button', { name: '执行任务' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('执行成功')).toBeInTheDocument()
    })
    // execute 调用参数
    expect(mockExecute).toHaveBeenCalledWith('test-agent', 'test_tool', {}, 30000)
    // setTriggerPayload 调用
    expect(mockSetTriggerPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'test-agent',
        toolName: 'test_tool',
        serverName: 'test-server',
        args: {},
        timeout: 30000,
      }),
    )
    // 显示 task.id
    expect(screen.getByText(/task-success-123/)).toBeInTheDocument()
    // 错误区不应显示
    expect(screen.queryByText('执行失败')).not.toBeInTheDocument()
    // logger.info 成功日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[AgentTriggerPage] Task completed',
      expect.objectContaining({ taskId: 'task-success-123' }),
    )
  })

  // ────────────────────────────────────────────────────────────
  // 用例 16:执行失败 — execute 抛 Error,显示"执行失败"与错误信息
  // ────────────────────────────────────────────────────────────
  it('handleExecute 失败: execute 抛 Error,显示"执行失败"与错误信息', async () => {
    mockExecute.mockRejectedValueOnce(new Error('网络异常'))
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    const btn = screen.getByRole('button', { name: '执行任务' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('执行失败')).toBeInTheDocument()
    })
    expect(screen.getByText('网络异常')).toBeInTheDocument()
    // 结果区不应显示
    expect(screen.queryByText('执行成功')).not.toBeInTheDocument()
    // logger.error 调用
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[AgentTriggerPage] Task failed',
      expect.objectContaining({ error: '网络异常' }),
    )
  })

  // ────────────────────────────────────────────────────────────
  // 用例 17:执行失败 — err 不是 Error 实例,回退到 String(err)
  // ────────────────────────────────────────────────────────────
  it('handleExecute 失败: err 非 Error 实例时回退到 String(err)', async () => {
    mockExecute.mockRejectedValueOnce('string-error')
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))

    await waitFor(() => {
      expect(screen.getByText('执行失败')).toBeInTheDocument()
    })
    expect(screen.getByText('string-error')).toBeInTheDocument()
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[AgentTriggerPage] Task failed',
      expect.objectContaining({ error: 'string-error' }),
    )
  })

  // ────────────────────────────────────────────────────────────
  // 用例 18:执行中状态 — 按钮显示"执行中..."且 disable,RefreshCw spinner
  // ────────────────────────────────────────────────────────────
  it('handleExecute 执行中: 按钮显示"执行中..."且 disable', async () => {
    // 用未 resolve 的 promise 锁定 isExecuting=true
    let resolveExecute!: (v: unknown) => void
    mockExecute.mockReturnValueOnce(new Promise((r) => { resolveExecute = r }))

    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '执行中...' })).toBeDisabled()
    })

    // 解除阻塞
    resolveExecute({ id: 'task-x', status: 'completed' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '执行任务' })).not.toBeDisabled()
    })
  })

  // ────────────────────────────────────────────────────────────
  // 用例 19:payload 自定义 — 携带自定义 JSON 参数
  // ────────────────────────────────────────────────────────────
  it('handleExecute payload: 携带自定义 JSON 参数', async () => {
    mockExecute.mockResolvedValueOnce({ id: 'task-p', status: 'completed' })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })
    const textarea = container.querySelector('textarea')! as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{"code":"600519","limit":10}' } })

    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))

    await waitFor(() => {
      expect(screen.getByText('执行成功')).toBeInTheDocument()
    })
    expect(mockExecute).toHaveBeenCalledWith(
      'test-agent',
      'test_tool',
      { code: '600519', limit: 10 },
      30000,
    )
    expect(mockSetTriggerPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        args: { code: '600519', limit: 10 },
      }),
    )
  })

  // ────────────────────────────────────────────────────────────
  // 用例 20:logger.info 执行日志包含 agentId/toolName/serverName
  // ────────────────────────────────────────────────────────────
  it('handleExecute 日志: 包含 agentId/toolName/serverName', async () => {
    mockExecute.mockResolvedValueOnce({ id: 'task-log', status: 'completed' })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })
    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))

    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AgentTriggerPage] Executing trigger',
        expect.objectContaining({
          agentId: 'test-agent',
          toolName: 'test_tool',
          serverName: 'test-server',
        }),
      )
    })
  })

  // ────────────────────────────────────────────────────────────
  // 用例 21:selectedServerName 已选但 tools 为空 — Tool 下拉仍渲染(空选项)
  // ────────────────────────────────────────────────────────────
  it('selectedServer tools 空: 仍渲染 Tool 下拉但无选项', () => {
    mockServers.length = 0
    mockServers.push({
      server: {
        info: { name: 'empty-server', version: '2.0.0', description: 'Empty' },
        listTools: () => [],
      },
      options: { enabled: true, priority: 'low' },
    })
    const { container } = renderPage()
    // 直接选 server
    const serverSelect = container.querySelectorAll('select')[1]! as HTMLSelectElement
    fireEvent.change(serverSelect, { target: { value: 'empty-server' } })

    // 第三个 select(Tool)应渲染,但只有 placeholder option
    const toolSelect = container.querySelectorAll('select')[2]! as HTMLSelectElement
    const toolOptions = toolSelect.querySelectorAll('option')
    expect(toolOptions.length).toBe(1) // 仅 placeholder
  })

  // ────────────────────────────────────────────────────────────
  // 用例 22:多个 server 渲染 — 下拉显示所有 server 信息
  // ────────────────────────────────────────────────────────────
  it('server 下拉: 渲染所有 server (name + version)', () => {
    mockServers.length = 0
    mockServers.push(
      {
        server: {
          info: { name: 'srv-1', version: '1.0.0', description: 'Server 1' },
          listTools: () => [],
        },
        options: { enabled: true, priority: 'medium' },
      },
      {
        server: {
          info: { name: 'srv-2', version: '2.0.0', description: 'Server 2' },
          listTools: () => [],
        },
        options: { enabled: true, priority: 'high' },
      },
    )
    const { container } = renderPage()
    const serverSelect = container.querySelectorAll('select')[1]!
    expect(serverSelect.innerHTML).toContain('srv-1 v1.0.0')
    expect(serverSelect.innerHTML).toContain('srv-2 v2.0.0')
  })

  // ────────────────────────────────────────────────────────────
  // 用例 23:重新执行后清空上一次的 result
  // ────────────────────────────────────────────────────────────
  it('重新执行:成功后再次执行,上一次的 result 被清空并显示新结果', async () => {
    mockExecute.mockResolvedValueOnce({ id: 'task-first', status: 'completed' })
    mockExecute.mockResolvedValueOnce({ id: 'task-second', status: 'completed' })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    // 第一次执行
    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))
    await waitFor(() => {
      expect(screen.getByText('执行成功')).toBeInTheDocument()
    })
    expect(screen.getByText(/task-first/)).toBeInTheDocument()

    // 第二次执行 — result 区域应先清空再显示新结果
    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))
    await waitFor(() => {
      expect(screen.getByText(/task-second/)).toBeInTheDocument()
    })
    // 第一次的 task id 不再显示
    expect(screen.queryByText(/task-first/)).not.toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 24:重新执行后清空上一次的 error
  // ────────────────────────────────────────────────────────────
  it('重新执行:失败后再次执行成功,上一次的 error 被清空', async () => {
    mockExecute.mockRejectedValueOnce(new Error('首次失败'))
    mockExecute.mockResolvedValueOnce({ id: 'task-ok', status: 'completed' })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })

    // 第一次执行 — 失败
    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))
    await waitFor(() => {
      expect(screen.getByText('执行失败')).toBeInTheDocument()
    })
    expect(screen.getByText('首次失败')).toBeInTheDocument()

    // 第二次执行 — 成功
    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))
    await waitFor(() => {
      expect(screen.getByText('执行成功')).toBeInTheDocument()
    })
    // 错误区不再显示
    expect(screen.queryByText('执行失败')).not.toBeInTheDocument()
    expect(screen.queryByText('首次失败')).not.toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 25:agent 有 mcpServerName 但无 defaultToolName — 不自动设置 tool
  // ────────────────────────────────────────────────────────────
  it('handleAgentChange: agent 有 mcpServerName 但无 defaultToolName 时仅设置 server', () => {
    mockAgents.length = 0
    mockAgents.push({
      agentId: 'agent-no-default-tool',
      displayName: 'No Default Tool Agent',
      mcpServerName: 'test-server',
      defaultToolName: '',
    })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'agent-no-default-tool' } })

    // server 自动设置
    const serverSelect = container.querySelectorAll('select')[1]! as HTMLSelectElement
    expect(serverSelect.value).toBe('test-server')
    // Tool select 渲染(server 已选),但 selectedToolName 为空
    const toolSelect = container.querySelectorAll('select')[2]! as HTMLSelectElement
    expect(toolSelect.value).toBe('')
    // 执行按钮仍禁用(无 toolName)
    expect(screen.getByRole('button', { name: '执行任务' })).toBeDisabled()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 26:payload 输入时清空 payloadError,再次执行可成功
  // ────────────────────────────────────────────────────────────
  it('payload 流程: 先输入无效 JSON 触发错误,再修正为有效 JSON 后执行成功', async () => {
    mockExecute.mockResolvedValueOnce({ id: 'task-retry', status: 'completed' })
    const { container } = renderPage()
    const agentSelect = container.querySelectorAll('select')[0]! as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'test-agent' } })
    const textarea = container.querySelector('textarea')! as HTMLTextAreaElement

    // 输入无效 JSON 并执行
    fireEvent.change(textarea, { target: { value: '{bad-json' } })
    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))
    await waitFor(() => {
      expect(screen.getByText('JSON 格式无效')).toBeInTheDocument()
    })
    expect(mockExecute).not.toHaveBeenCalled()

    // 修正为有效 JSON
    fireEvent.change(textarea, { target: { value: '{"valid":true}' } })
    // payloadError 应被清空
    expect(screen.queryByText('JSON 格式无效')).not.toBeInTheDocument()

    // 再次执行 — 成功
    fireEvent.click(screen.getByRole('button', { name: '执行任务' }))
    await waitFor(() => {
      expect(screen.getByText('执行成功')).toBeInTheDocument()
    })
    expect(mockExecute).toHaveBeenCalledWith('test-agent', 'test_tool', { valid: true }, 30000)
  })
})
