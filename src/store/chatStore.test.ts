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
})
