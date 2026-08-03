/**
 * @test_id V9-TEST-ST-???
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { LlmConfig } from '@/config/llmConfig'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
const mockStreamingChat = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))
vi.mock('@/services/llm/llmGateway', () => ({
  streamingChat: (...args: unknown[]) => mockStreamingChat(...args),
}))

// ============================================================
// Imports
// ============================================================

import { useChatStore } from './chatStore'

// ============================================================
// Helpers
// ============================================================

function createMockConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    baseURL: 'https://api.example.com/v1',
    apiKey: 'test-key',
    model: 'gpt-4',
    ...overrides,
  }
}

describe('useChatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.getState().clearMessages()
  })

  it('初始状态验证', () => {
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeNull()
  })

  it('clearMessages: 清空消息和错误', () => {
    // 先通过 addSystemMessage 添加一条消息
    useChatStore.getState().addSystemMessage('系统提示')
    expect(useChatStore.getState().messages).toHaveLength(1)

    useChatStore.getState().clearMessages()
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.error).toBeNull()
  })

  it('sendMessage: mock 流式响应成功', async () => {
    const config = createMockConfig()

    // 模拟 streamingChat：回调两次 chunk，最后一次 isDone=true
    mockStreamingChat.mockImplementation(async (
      _messages: unknown[],
      callback: (chunk: { content: string; isDone: boolean }) => void,
    ) => {
      callback({ content: '你好', isDone: false })
      callback({ content: '，世界', isDone: false })
      callback({ content: '', isDone: true })
    })

    await useChatStore.getState().sendMessage('你好', config)

    const state = useChatStore.getState()
    // 应有 user 消息 + assistant 消息
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0]!.role).toBe('user')
    expect(state.messages[0]!.content).toBe('你好')
    expect(state.messages[1]!.role).toBe('assistant')
    expect(state.messages[1]!.content).toBe('你好，世界')
    expect(state.messages[1]!.isStreaming).toBe(false)
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeNull()

    expect(mockStreamingChat).toHaveBeenCalledTimes(1)
  })

  it('sendMessage: 流式响应失败时设置 error', async () => {
    const config = createMockConfig()
    mockStreamingChat.mockRejectedValue(new Error('网络错误'))

    await useChatStore.getState().sendMessage('测试', config)

    const state = useChatStore.getState()
    expect(state.error).toBe('网络错误')
    expect(state.isStreaming).toBe(false)
  })

  it('addSystemMessage: 添加系统消息', () => {
    useChatStore.getState().addSystemMessage('系统初始化完成')

    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]!.role).toBe('system')
    expect(state.messages[0]!.content).toBe('系统初始化完成')
  })

  // ============================================================
  // sendMessage 边界条件
  // ============================================================
  describe('sendMessage 边界条件', () => {
    it('sendMessage: 空字符串内容应正常进入流式流程', async () => {
      const config = createMockConfig()
      mockStreamingChat.mockImplementation(async (
        _messages: unknown[],
        callback: (chunk: { content: string; isDone: boolean }) => void,
      ) => {
        callback({ content: '请输入有效内容', isDone: false })
        callback({ content: '', isDone: true })
      })

      await useChatStore.getState().sendMessage('', config)

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(2)
      expect(state.messages[0]!.content).toBe('')
      expect(state.messages[1]!.content).toBe('请输入有效内容')
      expect(state.error).toBeNull()
      expect(state.isStreaming).toBe(false)
    })

    it('sendMessage: 超长内容（10000 字符）不阻塞流式回调', async () => {
      const config = createMockConfig()
      const longContent = '测试'.repeat(5000)

      let callbackCount = 0
      mockStreamingChat.mockImplementation(async (
        messages: unknown[],
        callback: (chunk: { content: string; isDone: boolean }) => void,
      ) => {
        const msgs = messages as Array<{ role: string; content: string }>
        expect(msgs[1]!.content).toBe(longContent)
        callback({ content: '已收到长文本', isDone: false })
        callbackCount++
        callback({ content: '', isDone: true })
        callbackCount++
      })

      await useChatStore.getState().sendMessage(longContent, config)

      const state = useChatStore.getState()
      expect(callbackCount).toBe(2)
      expect(state.messages[0]!.content).toBe(longContent)
      expect(state.messages[1]!.content).toBe('已收到长文本')
      expect(state.isStreaming).toBe(false)
    })

    it('sendMessage: streamingChat 返回零个非 done chunk（仅 done）', async () => {
      const config = createMockConfig()
      mockStreamingChat.mockImplementation(async (
        _messages: unknown[],
        callback: (chunk: { content: string; isDone: boolean }) => void,
      ) => {
        callback({ content: '', isDone: true })
      })

      await useChatStore.getState().sendMessage('你好', config)

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(2)
      expect(state.messages[1]!.content).toBe('')
      expect(state.messages[1]!.isStreaming).toBe(false)
      expect(state.isStreaming).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  // ============================================================
  // sendMessage 状态转换时序
  // ============================================================
  describe('sendMessage 状态转换时序', () => {
    it('sendMessage: 调用后立即将 isStreaming 置为 true 并重置 error', async () => {
      const config = createMockConfig()
      useChatStore.setState({ error: '旧错误' })

      let streamingDuringCallback = false
      mockStreamingChat.mockImplementation(async () => {
        streamingDuringCallback = useChatStore.getState().isStreaming
      })

      await useChatStore.getState().sendMessage('测试', config)

      expect(streamingDuringCallback).toBe(true)
      expect(useChatStore.getState().isStreaming).toBe(false)
      expect(useChatStore.getState().error).toBeNull()
    })

    it('sendMessage: user message 在 streamingChat 调用前已入队', async () => {
      const config = createMockConfig()

      let messagesDuringCall: unknown[] = []
      mockStreamingChat.mockImplementation(async () => {
        messagesDuringCall = useChatStore.getState().messages
      })

      await useChatStore.getState().sendMessage('早', config)

      expect(messagesDuringCall).toHaveLength(2)
      expect((messagesDuringCall[0] as { role: string }).role).toBe('user')
      expect((messagesDuringCall[0] as { content: string }).content).toBe('早')
      expect((messagesDuringCall[1] as { role: string }).role).toBe('assistant')
      expect((messagesDuringCall[1] as { isStreaming: boolean }).isStreaming).toBe(true)
    })

    it('sendMessage: assistant 流式标记 isStreaming 在最终 set 后为 false', async () => {
      const config = createMockConfig()
      mockStreamingChat.mockImplementation(async (
        _messages: unknown[],
        callback: (chunk: { content: string; isDone: boolean }) => void,
      ) => {
        callback({ content: 'A', isDone: false })
        callback({ content: 'B', isDone: false })
        callback({ content: '', isDone: true })
      })

      await useChatStore.getState().sendMessage('hi', config)

      const assistant = useChatStore.getState().messages[1]!
      expect(assistant.isStreaming).toBe(false)
      expect(assistant.content).toBe('AB')
    })
  })

  // ============================================================
  // sendMessage 异常场景
  // ============================================================
  describe('sendMessage 异常场景', () => {
    it('sendMessage: 非 Error 异常对象（字符串）应正确转成 error', async () => {
      const config = createMockConfig()
      mockStreamingChat.mockRejectedValue('服务不可用（纯字符串异常）' as unknown as Error)

      await useChatStore.getState().sendMessage('测试', config)

      const state = useChatStore.getState()
      expect(state.error).toBe('服务不可用（纯字符串异常）')
      expect(state.isStreaming).toBe(false)
    })

    it('sendMessage: 非 Error 异常对象（plain object）应 String() 化', async () => {
      const config = createMockConfig()
      mockStreamingChat.mockRejectedValue({ code: 500, msg: '内部错误' } as unknown as Error)

      await useChatStore.getState().sendMessage('测试', config)

      const state = useChatStore.getState()
      expect(state.error).toBe('[object Object]')
      expect(state.isStreaming).toBe(false)
    })

    it('sendMessage: streamingChat callback 同步抛异常应被 catch', async () => {
      const config = createMockConfig()
      mockStreamingChat.mockImplementation(async (
        _messages: unknown[],
        callback: (chunk: { content: string; isDone: boolean }) => void,
      ) => {
        callback({ content: '部分内容', isDone: false })
        throw new Error('回调过程中网络中断')
      })

      await useChatStore.getState().sendMessage('测试', config)

      const state = useChatStore.getState()
      expect(state.error).toBe('回调过程中网络中断')
      expect(state.isStreaming).toBe(false)
      expect(state.messages).toHaveLength(2)
      expect(state.messages[1]!.content).toBe('部分内容')
    })
  })

  // ============================================================
  // 并发 / 中断场景
  // ============================================================
  describe('并发与中断场景', () => {
    it('sendMessage: streaming 过程中调用 clearMessages 应使 messages 为空且不崩溃', async () => {
      const config = createMockConfig()

      mockStreamingChat.mockImplementation(async (
        _messages: unknown[],
        callback: (chunk: { content: string; isDone: boolean }) => void,
      ) => {
        callback({ content: '第一部分', isDone: false })
        useChatStore.getState().clearMessages()
        callback({ content: '第二部分', isDone: false })
        callback({ content: '', isDone: true })
      })

      await expect(
        useChatStore.getState().sendMessage('测试', config),
      ).resolves.not.toThrow()

      const state = useChatStore.getState()
      expect(state.isStreaming).toBe(false)
      expect(state.error).toBeNull()
      expect(Array.isArray(state.messages)).toBe(true)
    })

    it('clearMessages: 存在旧 error 时应一并清空', () => {
      useChatStore.setState({ error: '旧错误消息' })
      useChatStore.getState().addSystemMessage('x')

      useChatStore.getState().clearMessages()

      const state = useChatStore.getState()
      expect(state.error).toBeNull()
      expect(state.messages).toEqual([])
    })

    it('sendMessage 失败后再次发送：error 应被清空，第二次能成功', async () => {
      const config = createMockConfig()

      mockStreamingChat.mockRejectedValueOnce(new Error('第一次失败'))
      await useChatStore.getState().sendMessage('req1', config)
      expect(useChatStore.getState().error).toBe('第一次失败')

      mockStreamingChat.mockImplementationOnce(async (
        _messages: unknown[],
        callback: (chunk: { content: string; isDone: boolean }) => void,
      ) => {
        callback({ content: '成功响应', isDone: false })
        callback({ content: '', isDone: true })
      })
      await useChatStore.getState().sendMessage('req2', config)

      const state = useChatStore.getState()
      expect(state.error).toBeNull()
      expect(state.isStreaming).toBe(false)
      expect(state.messages).toHaveLength(4)
      expect(state.messages[3]!.content).toBe('成功响应')
    })
  })

  // ============================================================
  // streamingChat 参数校验
  // ============================================================
  describe('streamingChat 参数校验', () => {
    it('sendMessage: 构造的 system prompt + user message 正确', async () => {
      const config = createMockConfig()
      let capturedMessages: Array<{ role: string; content: string }> = []

      mockStreamingChat.mockImplementation(async (
        messages: unknown[],
      ) => {
        capturedMessages = messages as Array<{ role: string; content: string }>
      })

      await useChatStore.getState().sendMessage('用户输入', config)

      expect(capturedMessages).toHaveLength(2)
      expect(capturedMessages[0]!.role).toBe('system')
      expect(capturedMessages[0]!.content).toContain('V9 智能投研复盘系统')
      expect(capturedMessages[1]!.role).toBe('user')
      expect(capturedMessages[1]!.content).toBe('用户输入')
    })

    it('sendMessage: config 应携带 caller=chatStore', async () => {
      const config = createMockConfig()
      let capturedConfig: { caller?: string; model?: string } = {}

      mockStreamingChat.mockImplementation(async (
        _messages: unknown[],
        _callback: (chunk: { content: string; isDone: boolean }) => void,
        opts: unknown,
      ) => {
        capturedConfig = opts as { caller?: string; model?: string }
      })

      await useChatStore.getState().sendMessage('hi', config)

      expect(capturedConfig.caller).toBe('chatStore')
      expect(capturedConfig.model).toBe('gpt-4')
    })
  })

  // ============================================================
  // addSystemMessage 边界条件
  // ============================================================
  describe('addSystemMessage 边界条件', () => {
    it('addSystemMessage: 空字符串应正常添加', () => {
      useChatStore.getState().addSystemMessage('')

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0]!.role).toBe('system')
      expect(state.messages[0]!.content).toBe('')
    })

    it('addSystemMessage: 超长内容应正常添加', () => {
      const longContent = '警告：'.repeat(2000)
      useChatStore.getState().addSystemMessage(longContent)

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0]!.content).toBe(longContent)
      expect(state.messages[0]!.content.length).toBe(3 * 2000)
      expect(state.messages[0]!.content.length).toBeGreaterThanOrEqual(5000)
    })

    it('addSystemMessage: 连续多次调用应按顺序入队', () => {
      useChatStore.getState().addSystemMessage('第一步')
      useChatStore.getState().addSystemMessage('第二步')
      useChatStore.getState().addSystemMessage('第三步')

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(3)
      expect(state.messages[0]!.content).toBe('第一步')
      expect(state.messages[1]!.content).toBe('第二步')
      expect(state.messages[2]!.content).toBe('第三步')
      const ids = state.messages.map(m => m.id)
      expect(new Set(ids).size).toBe(3)
    })
  })
})
