import { describe, it, expect, vi } from 'vitest'
import { SamplingHandler } from '@/mcp/core/sampling'

describe('SamplingHandler', () => {
  it('should throw when no model provider registered', async () => {
    const handler = new SamplingHandler()
    await expect(
      handler.createMessage({ messages: [], maxTokens: 100 }),
    ).rejects.toThrow('not configured')
  })

  it('should call provider and return response', async () => {
    const handler = new SamplingHandler()
    const mockResponse = {
      model: 'test-model',
      role: 'assistant' as const,
      content: { type: 'text' as const, text: 'Hello' },
    }
    handler.setModelProvider(vi.fn().mockResolvedValue(mockResponse))

    const result = await handler.createMessage({ messages: [], maxTokens: 100 })
    expect(result).toEqual(mockResponse)
  })

  it('should propagate provider errors', async () => {
    const handler = new SamplingHandler()
    handler.setModelProvider(vi.fn().mockRejectedValue(new Error('Provider error')))
    await expect(
      handler.createMessage({ messages: [], maxTokens: 100 }),
    ).rejects.toThrow('Provider error')
  })

  it('should pass model preferences to provider', async () => {
    const handler = new SamplingHandler()
    const provider = vi.fn().mockResolvedValue({
      model: 'gpt-4',
      role: 'assistant' as const,
      content: { type: 'text' as const, text: 'Response' },
    })
    handler.setModelProvider(provider)

    const request = {
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text: 'Hi' } }],
      maxTokens: 500,
      modelPreferences: {
        hints: [{ name: 'gpt-4' }],
        costPriority: 0.3,
        speedPriority: 0.7,
      },
      systemPrompt: 'Be helpful',
      temperature: 0.5,
    }

    await handler.createMessage(request)
    expect(provider).toHaveBeenCalledWith(request)
  })
})