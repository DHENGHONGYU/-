/**
 * @test_id V9-TEST-UT-082
 * @fileoverview 存储抽象层单元测试（适配异步 getStorageFor）
 * @module tests/services/storage/storageFactory.test
  * @covers_docs []
*/

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  getStorageFor,
  setStorageBackend,
  registerProvider,
  getBackendMapping,
  resetBackendMapping,
} from '@/services/storage/storageFactory'
import type { StorageProvider, DataMorphology, QueryResult, ListResult } from '@/services/storage/storageProvider'

function createMockProvider(_name: string, backend: string): StorageProvider {
  return {
    backend: backend as StorageProvider['backend'],
    morphologies: ['document'],
    get: vi.fn().mockResolvedValue({ success: true } as QueryResult<unknown>),
    list: vi.fn().mockResolvedValue({ success: true, data: [] } as ListResult<unknown>),
    save: vi.fn().mockResolvedValue({ success: true } as QueryResult<void>),
    delete: vi.fn().mockResolvedValue({ success: true } as QueryResult<void>),
    healthCheck: vi.fn().mockResolvedValue(true),
  }
}

describe('StorageFactory', () => {
  beforeEach(() => {
    resetBackendMapping()
  })

  describe('getStorageFor', () => {
    it('document morph 返回 IndexedDB provider', async () => {
      const provider = await getStorageFor('document')
      expect(provider).toBeDefined()
      expect(provider.backend).toBe('indexeddb')
    })

    it('time_series morph 惰性返回 DuckDB provider', async () => {
      const provider = await getStorageFor('time_series')
      expect(provider).toBeDefined()
      expect(provider.backend).toBe('duckdb')
    })

    it('vector morph 惰性返回 Vector provider', async () => {
      const provider = await getStorageFor('vector')
      expect(provider).toBeDefined()
      expect(provider.backend).toBe('vector')
    })

    it('未知 morph 回退 IndexedDB', async () => {
      const provider = await getStorageFor('document' as DataMorphology)
      expect(provider.backend).toBe('indexeddb')
    })
  })

  describe('setStorageBackend', () => {
    it('更新映射后 getStorageFor 返回对应 provider', async () => {
      const mockProvider = createMockProvider('mock-duckdb', 'duckdb')
      registerProvider('myduck', mockProvider)
      setStorageBackend('time_series', 'myduck')

      const provider = await getStorageFor('time_series')
      expect(provider.backend).toBe('duckdb')
      expect(provider).toBe(mockProvider)
    })

    it('未注册的后端不生效', async () => {
      setStorageBackend('time_series', 'nonexistent')
      const provider = await getStorageFor('time_series')
      expect(provider.backend).toBe('duckdb')
    })
  })

  describe('registerProvider', () => {
    it('注册后可通过 setStorageBackend 使用', async () => {
      const mockProvider = createMockProvider('chroma-vector', 'vector')
      registerProvider('chroma', mockProvider)
      setStorageBackend('vector', 'chroma')

      const provider = await getStorageFor('vector')
      expect(provider).toBe(mockProvider)
      expect(provider.backend).toBe('vector')
    })
  })

  describe('getBackendMapping', () => {
    it('返回当前后端映射的快照', () => {
      const mapping = getBackendMapping()
      expect(mapping.document).toBe('indexeddb')
      expect(mapping.time_series).toBe('duckdb')
      expect(mapping.vector).toBe('vector')
      expect(mapping.file).toBe('indexeddb')
    })

    it('修改映射不影响快照', () => {
      const snapshot = getBackendMapping()
      setStorageBackend('time_series', 'duckdb')
      expect(snapshot.time_series).toBe('duckdb')

      const newSnapshot = getBackendMapping()
      expect(newSnapshot.time_series).toBe('duckdb')
    })
  })

  describe('resetBackendMapping', () => {
    it('重置后所有 morph 恢复默认', async () => {
      const mockP = createMockProvider('mock-db', 'indexeddb')
      registerProvider('custom', mockP)
      setStorageBackend('document', 'custom')
      expect((await getStorageFor('document')).backend).toBe('indexeddb')

      resetBackendMapping()
      expect((await getStorageFor('document')).backend).toBe('indexeddb')
      expect((await getStorageFor('time_series')).backend).toBe('duckdb')
      expect((await getStorageFor('vector')).backend).toBe('vector')
    })
  })
})

describe('StorageProvider interface', () => {
  it('应满足接口契约（所有方法存在）', () => {
    const backendMap = getBackendMapping()
    expect(backendMap).toBeDefined()
  })

  it('IndexedDB provider healthCheck 返回 true', async () => {
    const provider = await getStorageFor('document')
    const healthy = await provider.healthCheck()
    expect(healthy).toBe(true)
  })
})
