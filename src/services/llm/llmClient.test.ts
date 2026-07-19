/**
 * @test_id V9-TEST-ST-087
 * @covers_docs [V9-DOC-AI-017, V9-DOC-AI-033]
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamingChat, LlmApiError } from './llmClient'
import type { LlmStreamChunk } from './llmTypes'

describe('llmClient streamingChat', () => {
  const mockMessages = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Hello, who are you?' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should receive streaming chunks correctly', async () => {
    const chunks: LlmStreamChunk[] = []
    const callback = vi.fn((chunk: LlmStreamChunk) => {
      chunks.push(chunk)
    })

    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}],"model":"test-model"}',
      'data: {"choices":[{"delta":{"content":" World"}}],"model":"test-model"}',
      'data: {"choices":[{"delta":{"content":" from"}}],"model":"test-model"}',
      'data: {"choices":[{"delta":{"content":" AI"}}],"model":"test-model"}',
      'data: {"choices":[{"finish_reason":"stop"}]}',
      'data: [DONE]',
    ].join('\n') + '\n'

    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode(sseData),
      }).mockResolvedValueOnce({
        done: true,
        value: undefined,
      }),
      releaseLock: vi.fn(),
    }

    const mockResponse = {
      ok: true,
      body: {
        getReader: vi.fn().mockReturnValue(mockReader),
      },
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await streamingChat(mockMessages, callback, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })

    expect(callback).toHaveBeenCalledTimes(5)
    expect(chunks.filter(c => !c.isDone).map(c => c.content).join('')).toBe('Hello World from AI')
    expect(chunks.some(c => c.isDone)).toBe(true)
    expect(mockReader.releaseLock).toHaveBeenCalled()
  })

  test('should handle empty content chunks', async () => {
    const chunks: LlmStreamChunk[] = []
    const callback = vi.fn((chunk: LlmStreamChunk) => {
      chunks.push(chunk)
    })

    const sseData = [
      'data: {"choices":[{"delta":{}}]}',
      'data: {"choices":[{"delta":{"content":""}}]}',
      'data: {"choices":[]}',
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: [DONE]',
    ].join('\n') + '\n'

    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode(sseData),
      }).mockResolvedValueOnce({
        done: true,
        value: undefined,
      }),
      releaseLock: vi.fn(),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: vi.fn().mockReturnValue(mockReader) },
    })

    await streamingChat(mockMessages, callback, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })

    expect(callback).toHaveBeenCalledTimes(2)
    expect(chunks.filter(c => !c.isDone).map(c => c.content).join('')).toBe('Hello')
    expect(chunks.some(c => c.isDone)).toBe(true)
  })

  test('should throw error on HTTP failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: { message: 'Internal Server Error' } }),
    })

    await expect(streamingChat(mockMessages, () => {}, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })).rejects.toThrow(LlmApiError)
    await expect(streamingChat(mockMessages, () => {}, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })).rejects.toThrow('LLM 请求失败: Internal Server Error')
  })

  test('should throw error when body is null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null,
    })

    await expect(streamingChat(mockMessages, () => {}, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })).rejects.toThrow(LlmApiError)
    await expect(streamingChat(mockMessages, () => {}, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })).rejects.toThrow('LLM 流式响应 body 为空')
  })

  test('should handle malformed JSON in chunks gracefully', async () => {
    const chunks: LlmStreamChunk[] = []
    const callback = vi.fn((chunk: LlmStreamChunk) => {
      chunks.push(chunk)
    })

    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}',
      'data: invalid json here',
      'data: {"choices":[{"delta":{"content":" World"}}]}',
      'data: [DONE]',
    ].join('\n') + '\n'

    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode(sseData),
      }).mockResolvedValueOnce({
        done: true,
        value: undefined,
      }),
      releaseLock: vi.fn(),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: vi.fn().mockReturnValue(mockReader) },
    })

    await streamingChat(mockMessages, callback, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })

    expect(chunks.filter(c => !c.isDone).map(c => c.content).join('')).toBe('Hello World')
    expect(chunks.some(c => c.isDone)).toBe(true)
  })

  test('should handle finish_reason stop without usage', async () => {
    const chunks: LlmStreamChunk[] = []
    const callback = vi.fn((chunk: LlmStreamChunk) => {
      chunks.push(chunk)
    })

    const sseData = [
      'data: {"choices":[{"delta":{"content":"Test"}}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    ].join('\n') + '\n'

    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode(sseData),
      }).mockResolvedValueOnce({
        done: true,
        value: undefined,
      }),
      releaseLock: vi.fn(),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: vi.fn().mockReturnValue(mockReader) },
    })

    await streamingChat(mockMessages, callback, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })

    expect(chunks.filter(c => !c.isDone).map(c => c.content).join('')).toBe('Test')
    expect(chunks.some(c => c.isDone)).toBe(true)
  })

  test('should handle stream ending without [DONE] marker', async () => {
    const chunks: LlmStreamChunk[] = []
    const callback = vi.fn((chunk: LlmStreamChunk) => {
      chunks.push(chunk)
    })

    const sseData = [
      'data: {"choices":[{"delta":{"content":"Final"}}]}',
      'data: {"choices":[{"delta":{"content":" message"}}]}',
    ].join('\n') + '\n'

    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({
        done: false,
        value: new TextEncoder().encode(sseData),
      }).mockResolvedValueOnce({
        done: true,
        value: undefined,
      }),
      releaseLock: vi.fn(),
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: vi.fn().mockReturnValue(mockReader) },
    })

    await streamingChat(mockMessages, callback, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    })

    expect(chunks.filter(c => !c.isDone).map(c => c.content).join('')).toBe('Final message')
    expect(mockReader.releaseLock).toHaveBeenCalled()
  })
})