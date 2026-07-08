/**
 * @module AgentFeedbackPage.test
 * @description P0-6 缺陷回归测试 — 事件绑定立即执行 bug + useEffect 死循环隐患
 * @created 2026-07-05
 *
 * 被测文件: src/pages/command/agent/AgentFeedbackPage.tsx
 * 覆盖缺陷:
 *   - P0-6: JSX 事件绑定写成 `onClick={handleSubmit()}` 导致 render 时立即执行
 *   - useEffect 依赖整个 store(refreshSummaries 内部 set() 可能触发重入死循环)
 *
 * 强制约束:
 *   - 仅新建测试文件,不修改业务代码
 *   - 不使用 ts-ignore 指令或 any 类型
 *   - 测试用 AAA 模式(Arrange/Act/Assert)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { AgentFeedback, AgentFeedbackSummary } from '@/types/modules/agent.types'

// ══════════════════════════════════════════════════════════════
// vi.hoisted:确保 mock 引用在 vi.mock 工厂执行前已就绪
// 所有 mock 函数提取为顶层变量,便于 beforeEach 重置与断言
// ══════════════════════════════════════════════════════════════
const {
  mockFeedbackStore,
  mockAgentStore,
  mockLogger,
  mockAddFeedback,
  mockRefreshSummaries,
} = vi.hoisted(() => {
  const addFeedback = vi.fn()
  const refreshSummaries = vi.fn()
  return {
    // 提取 spy 函数,供测试断言调用次数与参数
    mockAddFeedback: addFeedback,
    mockRefreshSummaries: refreshSummaries,
    mockFeedbackStore: {
      feedbacks: [] as AgentFeedback[],
      summaries: new Map<string, AgentFeedbackSummary>(),
      isLoading: false,
      addFeedback,
      refreshSummaries,
      resolveFeedback: vi.fn(),
      getSummary: vi.fn(),
    },
    mockAgentStore: {
      tasks: new Map<string, unknown>(),
      registeredAgents: [] as string[],
      stats: { total: 0, success: 0, failed: 0, running: 0 },
      triggerPayload: null,
      taskFilter: {},
      mcpCallHistory: [] as unknown[],
    },
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }
})

// ══════════════════════════════════════════════════════════════
// 模块级 vi.mock — 必须在 import 被测模块之前声明
// ══════════════════════════════════════════════════════════════

vi.mock('@/store/agentFeedbackStore', () => ({
  useAgentFeedbackStore: () => mockFeedbackStore,
}))

vi.mock('@/store/agentStore', () => ({
  useAgentStore: () => mockAgentStore,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// 避免 agentStore 顶层 initAgentSubscriptions 触发副作用
vi.mock('@/agents/agentRuntime', () => ({
  agentRuntime: {
    execute: vi.fn(),
    register: vi.fn(),
    getTask: vi.fn(),
    cancelTask: vi.fn(),
    getStats: vi.fn(() => ({})),
  },
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: vi.fn(() => () => {}),
    emit: vi.fn(),
    off: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    unsubscribe: vi.fn(),
  },
}))

// ══════════════════════════════════════════════════════════════
// 导入被测模块(必须在所有 vi.mock 之后)
// ══════════════════════════════════════════════════════════════
import AgentFeedbackPage from '@/pages/command/agent/AgentFeedbackPage'

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <AgentFeedbackPage />
    </MemoryRouter>,
  )
}

/**
 * 从容器中提取评分星按钮(button[type="button"])。
 * 提交按钮使用 <Button> 渲染为 <button type="submit">(默认),不会被此选择器命中,
 * 因此 starButtons 仅含 5 颗评分星,索引 0..4 对应 rating 1..5。
 */
function getStarButtons(container: HTMLElement): HTMLElement[] {
  const stars = container.querySelectorAll('button[type="button"]')
  expect(stars.length).toBeGreaterThanOrEqual(5)
  return Array.from(stars) as HTMLElement[]
}

/**
 * 获取提交反馈按钮(通过 Button 组件渲染)。
 *
 * 页面中 "提交反馈" 文本会出现两次:
 *   1. CardTitle <h3>提交反馈</h3>
 *   2. 提交按钮 <button>...提交反馈</button>
 * 因此不能直接用 getByText。提交按钮是页面中唯一不带 type="button" 的 button
 * (Button 组件未显式设置 type,DOM 默认 type="submit"),
 * 用 CSS 选择器 `button:not([type="button"])` 精确定位。
 */
function getSubmitButton(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector('button:not([type="button"])')
  if (!btn) {
    throw new Error('未找到提交反馈按钮(页面中不存在不带 type="button" 的 button)')
  }
  return btn as HTMLButtonElement
}

/** 获取评论 textarea */
function getCommentTextarea(): HTMLTextAreaElement {
  return screen.getByPlaceholderText('描述您的反馈...') as HTMLTextAreaElement
}

// ══════════════════════════════════════════════════════════════
// 测试套件
// ══════════════════════════════════════════════════════════════
describe('AgentFeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFeedbackStore.feedbacks = []
    mockFeedbackStore.summaries = new Map()
    mockFeedbackStore.isLoading = false
    mockAgentStore.tasks = new Map()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 1:P0-6 回归 — render 时不应立即调用 addFeedback
  // 目的:捕获 `onClick={handleSubmit()}` 这种立即执行 bug
  // ────────────────────────────────────────────────────────────
  it('P0-6 回归: render 时不应立即调用 addFeedback', async () => {
    // Arrange — render 页面,spy addFeedback(已在 hoisted 中创建)
    renderPage()

    // Act — 仅 render,不触发任何用户事件;等待 useEffect 执行完毕
    await waitFor(() => {
      expect(mockRefreshSummaries).toHaveBeenCalled()
    })

    // Assert — addFeedback 不应被调用(捕获 onClick={handleSubmit()} 立即执行 bug)
    expect(mockAddFeedback).not.toHaveBeenCalled()
    expect(mockAddFeedback).toHaveBeenCalledTimes(0)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 2:P0-6 回归 — render 时 refreshSummaries 调用次数有上限(死循环保护)
  // 目的:防护 useEffect 依赖整个 store 导致的死循环
  //   风险场景:refreshSummaries 内部 set() 改变 store 引用 →
  //   useEffect deps [feedbackStore] 变化 → 重入 → 死循环
  //   当前 mock 不改变 store 引用,期望恰好调用 1 次;额外加 150ms 等待 + 上限断言
  // ────────────────────────────────────────────────────────────
  it('P0-6 回归: render 时 refreshSummaries 调用次数有上限(死循环保护)', async () => {
    // Arrange — render 页面,spy refreshSummaries
    renderPage()

    // Act — 仅 render,等待 useEffect 触发 refreshSummaries
    await waitFor(() => {
      expect(mockRefreshSummaries).toHaveBeenCalled()
    })

    // 等待一段时间,确保即便存在异步重入也不会无限触发
    await new Promise((resolve) => setTimeout(resolve, 150))

    // Assert — 调用次数不超过 2 次(死循环防护阈值)
    expect(mockRefreshSummaries.mock.calls.length).toBeLessThanOrEqual(2)
    // 期望恰好调用 1 次(当前 mock 下 store 引用稳定,无重入)
    expect(mockRefreshSummaries).toHaveBeenCalledTimes(1)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 3:P0-6 回归 — 完整提交流程:点击星+输入评论+提交,
  // 触发 addFeedback 一次且仅一次
  // ────────────────────────────────────────────────────────────
  it('P0-6 回归: 完整提交流程(评分3+评论good)触发 addFeedback 一次且仅一次', async () => {
    // Arrange — render 页面
    const { container } = renderPage()
    await waitFor(() => expect(mockRefreshSummaries).toHaveBeenCalled())

    // Act — 1) 点击第 3 颗星(rating=3)
    const starButtons = getStarButtons(container)
    fireEvent.click(starButtons[2]!)

    // Act — 2) 输入评论 "good"
    const textarea = getCommentTextarea()
    fireEvent.change(textarea, { target: { value: 'good' } })

    // Act — 3) 点击提交按钮
    const submitButton = getSubmitButton(container)
    fireEvent.click(submitButton)

    // Assert — addFeedback 调用 1 次
    await waitFor(() => {
      expect(mockAddFeedback).toHaveBeenCalledTimes(1)
    })

    // Assert — 传入参数:rating===3, comment==='good', category 默认 'accuracy',
    //         resolved===false, id 以 'fb-' 开头
    expect(mockAddFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        rating: 3,
        comment: 'good',
        category: 'accuracy',
        resolved: false,
      }),
    )
    const callArg = mockAddFeedback.mock.calls[0]![0] as AgentFeedback
    expect(callArg.id).toMatch(/^fb-/)
    expect(callArg.taskId).toBeDefined()
    expect(callArg.agentId).toBeDefined()
    expect(callArg.createdAt).toBeGreaterThan(0)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 4:P0-6 回归 — 未选评分时提交按钮 disabled,addFeedback 未被调用
  // ────────────────────────────────────────────────────────────
  it('P0-6 回归: 未选评分时提交按钮 disabled,addFeedback 未被调用', async () => {
    // Arrange — render 页面,初始 selectedRating===0
    const { container } = renderPage()
    await waitFor(() => expect(mockRefreshSummaries).toHaveBeenCalled())

    // Act — 直接点击提交按钮(此时 selectedRating===0,按钮应 disabled)
    const submitButton = getSubmitButton(container)

    // Assert — 按钮 disabled;即便尝试点击,addFeedback 也不应被调用
    expect(submitButton).toBeDisabled()
    fireEvent.click(submitButton)
    expect(mockAddFeedback).not.toHaveBeenCalled()
    expect(mockAddFeedback).toHaveBeenCalledTimes(0)
  })

  // ────────────────────────────────────────────────────────────
  // 用例 5:P0-6 回归 — 提交后表单清空(textarea/评分星重置)
  // ────────────────────────────────────────────────────────────
  it('P0-6 回归: 提交后表单清空(textarea/评分星重置)', async () => {
    // Arrange — render 页面
    const { container } = renderPage()
    await waitFor(() => expect(mockRefreshSummaries).toHaveBeenCalled())

    // Arrange — 完成一次成功提交(评分 4 + 评论 "good")
    const starButtons = getStarButtons(container)
    fireEvent.click(starButtons[3]!) // 第 4 颗星(rating=4)

    const textarea = getCommentTextarea()
    fireEvent.change(textarea, { target: { value: 'good' } })

    const submitButton = getSubmitButton(container)
    expect(submitButton).not.toBeDisabled() // 选中评分后应可点击
    fireEvent.click(submitButton)

    // Act — 提交后查询 textarea 的 value 与提交按钮状态
    await waitFor(() => {
      expect(mockAddFeedback).toHaveBeenCalledTimes(1)
    })
    const textareaAfter = getCommentTextarea()
    const submitButtonAfter = getSubmitButton(container)

    // Assert — textarea 已清空,提交按钮恢复 disabled(selectedRating 重置为 0)
    expect(textareaAfter.value).toBe('')
    expect(submitButtonAfter).toBeDisabled()
  })

  // ────────────────────────────────────────────────────────────
  // 用例 6:P0-6 回归 — 空/非空列表渲染
  //   子用例 A:summaries 为空 + feedbacks 为空 → 显示「暂无评分数据」「暂无反馈记录」
  //   子用例 B:summaries 含 1 条 + feedbacks 含 2 条 → 显示 agentId、avg、total、列表
  // ────────────────────────────────────────────────────────────
  it('P0-6 回归: 空/非空列表渲染', async () => {
    // ═══ 子用例 A:空列表 ═══
    // Arrange
    mockFeedbackStore.summaries = new Map()
    mockFeedbackStore.feedbacks = []

    // Act
    renderPage()
    await waitFor(() => expect(mockRefreshSummaries).toHaveBeenCalled())

    // Assert — 显示空状态文案
    expect(screen.getByText('暂无评分数据')).toBeInTheDocument()
    expect(screen.getByText('暂无反馈记录')).toBeInTheDocument()

    // 清理 DOM,为子用例 B 准备干净环境
    cleanup()

    // ═══ 子用例 B:非空列表 ═══
    // Arrange — summaries 含 1 条(agent-a, avg=4.5, total=2)
    //          feedbacks 含 2 条(评论 "很好" / "不错")
    vi.clearAllMocks()
    const summary: AgentFeedbackSummary = {
      agentId: 'agent-a',
      averageRating: 4.5,
      totalFeedback: 2,
      categoryBreakdown: { accuracy: 1, speed: 1 },
    }
    mockFeedbackStore.summaries = new Map([['agent-a', summary]])
    mockFeedbackStore.feedbacks = [
      {
        id: 'fb-1',
        taskId: 'task-1',
        agentId: 'agent-a',
        rating: 5,
        comment: '很好',
        category: 'accuracy',
        createdAt: 1700000000000,
        resolved: false,
      },
      {
        id: 'fb-2',
        taskId: 'task-2',
        agentId: 'agent-a',
        rating: 4,
        comment: '不错',
        category: 'speed',
        createdAt: 1700000001000,
        resolved: false,
      },
    ]

    // Act
    renderPage()
    await waitFor(() => expect(mockRefreshSummaries).toHaveBeenCalled())

    // Assert — 汇总卡片:显示 agentId、averageRating、totalFeedback
    expect(screen.getByText('agent-a')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('(2)')).toBeInTheDocument()

    // Assert — 反馈历史列表:显示两条反馈的评论内容
    //   (列表 reverse() 后 fb-2 在前,但两者都应存在于 DOM)
    expect(screen.getByText('不错')).toBeInTheDocument()
    expect(screen.getByText('很好')).toBeInTheDocument()

    // Assert — 不应再显示空状态文案
    expect(screen.queryByText('暂无评分数据')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无反馈记录')).not.toBeInTheDocument()
  })
})
