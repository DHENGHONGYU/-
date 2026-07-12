import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ElicitationManager } from '@/mcp/core/elicitation'

describe('ElicitationManager', () => {
  let manager: ElicitationManager

  beforeEach(() => {
    manager = new ElicitationManager()
  })

  it('应该抛出 when no handler registered', async () => {
    await expect(
      manager.request({ message: 'Please confirm' }),
    ).rejects.toThrow('handler not configured')
  })

  it('应该调用 handler and return response', async () => {
    const mockResponse = { action: 'accept' as const, content: { type: 'text' as const, text: 'OK' } }
    manager.setHandler(vi.fn().mockResolvedValue(mockResponse))

    const result = await manager.request({ message: 'Please confirm' })
    expect(result).toEqual(mockResponse)
  })

  it('应该处理超时', async () => {
    manager.setHandler(() => new Promise(() => {})) // never resolves

    await expect(
      manager.request({ message: 'Please confirm', timeout: 100 }),
    ).rejects.toThrow('timed out')
  }, 5000)

  it('应该track pending requests count', () => {
    expect(manager.getPendingCount()).toBe(0)
  })

  it('应该propagate handler errors', async () => {
    manager.setHandler(vi.fn().mockRejectedValue(new Error('Handler error')))

    await expect(
      manager.request({ message: 'Please confirm' }),
    ).rejects.toThrow('Handler error')
  })

  it('应该pass request data to handler', async () => {
    const handler = vi.fn().mockResolvedValue({ action: 'accept' as const })
    manager.setHandler(handler)

    await manager.request({ message: 'Test message', inputSchema: { type: 'object', properties: {} } })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test message' }),
    )
  })
})