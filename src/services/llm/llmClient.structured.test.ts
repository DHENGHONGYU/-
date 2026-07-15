/**
 * @module services/llm/llmClient.structured.test
 * @description llmClient 结构化输出单元测试
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { chat, LlmApiError } from './llmClient'

const mockMessages = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'user' as const, content: 'Hello' },
]

describe('llmClient structured output', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should inject response_format into request body', async () => {
    const schema = z.object({ rating: z.enum(['buy', 'sell']), confidence: z.number() })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"rating":"buy","confidence":0.9}' } }],
        model: 'test-model',
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
    })
    global.fetch = fetchMock

    await chat(mockMessages, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    }, {
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'test', schema: {} },
      },
      zodSchema: schema,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const body = JSON.parse((call?.[1] as { body?: string }).body ?? '{}')
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'test', schema: {} },
    })
  })

  test('should parse and validate structured response', async () => {
    const schema = z.object({ rating: z.enum(['buy', 'sell']), confidence: z.number() })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"rating":"buy","confidence":0.9}' } }],
        model: 'test-model',
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
    })

    const response = await chat(mockMessages, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    }, {
      responseFormat: { type: 'json_object' },
      zodSchema: schema,
    })

    expect(response.parsed).toEqual({ rating: 'buy', confidence: 0.9 })
  })

  test('should throw when structured JSON is invalid', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'not-json' } }],
        model: 'test-model',
      }),
    })

    await expect(chat(mockMessages, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    }, {
      responseFormat: { type: 'json_object' },
    })).rejects.toThrow(LlmApiError)
  })

  test('should throw when structured response violates zod schema', async () => {
    const schema = z.object({ rating: z.enum(['buy', 'sell']) })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"rating":"hold"}' } }],
        model: 'test-model',
      }),
    })

    await expect(chat(mockMessages, {
      baseURL: 'http://localhost:8000',
      apiKey: 'test-key',
      model: 'test-model',
    }, {
      responseFormat: { type: 'json_object' },
      zodSchema: schema,
    })).rejects.toThrow(LlmApiError)
  })
})
