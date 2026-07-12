/**
 * @fileoverview 测试工具函数验证
 * @description 验证 resetDbWithCache 和 createCacheResetHook 工具函数的正确性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetDbWithCache, createCacheResetHook } from './testHelpers'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { db } from '@/data/db'

describe('testHelpers - 缓存清理工具', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('resetDbWithCache', () => {
    it('应清理所有已知 store 的缓存', async () => {
      const invalidateCacheSpy = vi.spyOn(dataBridge, 'invalidateCache')

      await resetDbWithCache()

      // 验证所有 STORE_NAME 中的 store 都被清理
      const allStores = Object.values(STORE_NAME) as string[]
      expect(invalidateCacheSpy).toHaveBeenCalledTimes(allStores.length)
      
      // 验证每个 store 都被调用
      for (const store of allStores) {
        expect(invalidateCacheSpy).toHaveBeenCalledWith(store)
      }
    })

    it('应支持额外指定的 store', async () => {
      const invalidateCacheSpy = vi.spyOn(dataBridge, 'invalidateCache')
      const additionalStores = ['custom_store_1', 'custom_store_2']

      await resetDbWithCache(additionalStores)

      // 验证基础 store + 额外 store 都被清理
      const allStores = Object.values(STORE_NAME) as string[]
      expect(invalidateCacheSpy).toHaveBeenCalledTimes(allStores.length + additionalStores.length)
      
      // 验证额外 store 也被调用
      for (const store of additionalStores) {
        expect(invalidateCacheSpy).toHaveBeenCalledWith(store)
      }
    })
  })

  describe('createCacheResetHook', () => {
    it('应返回可执行的异步函数', () => {
      const hook = createCacheResetHook()
      expect(typeof hook).toBe('function')
    })

    it('执行返回的函数应清理缓存', async () => {
      const invalidateCacheSpy = vi.spyOn(dataBridge, 'invalidateCache')
      const hook = createCacheResetHook()

      await hook()

      const allStores = Object.values(STORE_NAME) as string[]
      expect(invalidateCacheSpy).toHaveBeenCalledTimes(allStores.length)
    })

    it('应支持额外指定的 store', async () => {
      const invalidateCacheSpy = vi.spyOn(dataBridge, 'invalidateCache')
      const additionalStores = ['extra_store']
      const hook = createCacheResetHook(additionalStores)

      await hook()

      const allStores = Object.values(STORE_NAME) as string[]
      expect(invalidateCacheSpy).toHaveBeenCalledTimes(allStores.length + additionalStores.length)
      expect(invalidateCacheSpy).toHaveBeenCalledWith('extra_store')
    })
  })
})
