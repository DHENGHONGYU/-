import { describe, it, expect } from 'vitest'
import { MockProvider } from '@/services/fetcher/mockProvider'
import { DataSourceRegistry } from '@/services/fetcher/dataSourceRegistry'
import type { DataSourceProvider } from '@/services/fetcher/types'

describe('DataSourceProvider', () => {
  describe('MockProvider', () => {
    it('should return healthy status immediately', async () => {
      const provider = new MockProvider()
      expect(provider.name).toBe('mock')
      const health = await provider.healthCheck()
      expect(health.status).toBe('healthy')
      expect(health.latency).toBe(0)
    })
  })

  describe('DataSourceRegistry', () => {
    it('should return mock provider when akshare is unhealthy', async () => {
      const registry = new DataSourceRegistry()
      const unhealthyProvider: DataSourceProvider = {
        name: 'unhealthy-akshare',
        healthCheck: async () => ({ status: 'unhealthy', error: 'Connection refused' }),
      }
      registry.register(new MockProvider())
      registry.register(unhealthyProvider)

      // Mock 在第一个位置且 healthy，应该返回 mock
      const active = await registry.getActiveProvider()
      expect(active.name).toBe('mock')
    })

    it('should fallback to last provider when all are unhealthy', async () => {
      const registry = new DataSourceRegistry()
      const sick1: DataSourceProvider = {
        name: 'sick1',
        healthCheck: async () => ({ status: 'unhealthy' }),
      }
      const sick2: DataSourceProvider = {
        name: 'sick2',
        healthCheck: async () => ({ status: 'unhealthy' }),
      }
      registry.register(sick1)
      registry.register(sick2)

      const active = await registry.getActiveProvider()
      expect(active.name).toBe('sick2')
    })

    it('should throw when no providers registered', async () => {
      const registry = new DataSourceRegistry()
      await expect(registry.getActiveProvider()).rejects.toThrow('No providers registered')
    })

    it('should skip duplicate registration', () => {
      const registry = new DataSourceRegistry()
      registry.register(new MockProvider())
      registry.register(new MockProvider())
      expect(registry.getAllProviders()).toHaveLength(1)
    })

    it('should return all providers status', async () => {
      const registry = new DataSourceRegistry()
      registry.register(new MockProvider())
      const statuses = await registry.getStatus()
      expect(statuses).toHaveLength(1)
      expect(statuses[0]!.status).toBe('healthy')
    })

    it('should handle healthCheck that throws', async () => {
      const registry = new DataSourceRegistry()
      const throwingProvider: DataSourceProvider = {
        name: 'throwing',
        healthCheck: async () => { throw new Error('timeout') },
      }
      registry.register(throwingProvider)
      registry.register(new MockProvider())

      const active = await registry.getActiveProvider()
      expect(active.name).toBe('mock')
    })
  })
})
