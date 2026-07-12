/**
 * indexedDBProvider — IndexedDB StorageProvider 实现
 *
 * 包装现有的 dataLayer 接口，将其适配为 StorageProvider 规范。
 * 当新的存储后端就绪时，调用方仅需切换 Provider 实例，无需修改调用代码。
 */

import { dataLayer } from '@/data/dataLayer'
import { getLogger } from '@/lib/logger'
import type {
  DataMorphology,
  GetOptions,
  ListOptions,
  SaveOptions,
  DeleteOptions,
  StorageProvider,
  QueryResult,
  ListResult,
} from './storageProvider'

const logger = getLogger()

/**
 * IndexedDBProvider — 基于 dataLayer 的存储提供者
 *
 * 支持的数据形态：
 * - document: 文档/关系数据（使用现有 IndexedDB store）
 * - file: 大文件（使用 IndexedDB blob 存储）
 */
export class IndexedDBProvider implements StorageProvider {
  readonly backend = 'indexeddb' as const
  readonly morphologies: DataMorphology[] = ['document', 'file']

  /**
   * 根据 store 名称获取对应的 dataLayer store 对象
   */
  private resolveStore(store?: string): Record<string, unknown> | null {
    if (!store) return null
    const dl = dataLayer as Record<string, unknown>
    const storeObj = dl[store]
    if (!storeObj) {
      logger.warn('[IndexedDBProvider] store 不存在', { store })
      return null
    }
    return storeObj as Record<string, unknown>
  }

  async get<T>(options: GetOptions): Promise<QueryResult<T>> {
    try {
      const store = this.resolveStore(options.store)
      if (store && typeof store.get === 'function') {
        const result = await (store.get as (key: string | number) => Promise<T | undefined>)(options.key)
        return { success: true, data: result }
      }
      return { success: false, error: `Store "${options.store}" 无 get 方法` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async list<T>(options?: ListOptions): Promise<ListResult<T>> {
    try {
      if (options?.store) {
        const store = this.resolveStore(options.store)
        if (store && typeof store.list === 'function') {
          const result = await (store.list as () => Promise<T[]>)()

          let filtered = result

          // 按字段过滤
          if (options.filter) {
            for (const [key, value] of Object.entries(options.filter)) {
              filtered = filtered.filter((item) => {
                const itemRecord = item as Record<string, unknown>
                return itemRecord[key] === value
              })
            }
          }

          // 排序
          if (options.orderBy) {
            filtered = [...filtered].sort((a, b) => {
              const aVal = (a as Record<string, unknown>)[options.orderBy!]
              const bVal = (b as Record<string, unknown>)[options.orderBy!]
              if (typeof aVal === 'number' && typeof bVal === 'number') {
                return options.orderDir === 'desc' ? bVal - aVal : aVal - bVal
              }
              return 0
            })
          }

          // 限制
          if (options.limit && filtered.length > options.limit) {
            filtered = filtered.slice(0, options.limit)
          }

          return { success: true, data: filtered }
        }
      }

      return { success: true, data: [] }
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) }
    }
  }

  async save<T>(data: T, options?: SaveOptions): Promise<QueryResult<void>> {
    try {
      const store = this.resolveStore(options?.store)
      if (store && typeof store.save === 'function') {
        await (store.save as (data: T) => Promise<{ success: boolean; error?: string }>)(data)
        return { success: true }
      }
      return { success: false, error: `Store "${options?.store}" 无 save 方法` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async delete(options: DeleteOptions): Promise<QueryResult<void>> {
    try {
      const store = this.resolveStore(options.store)
      if (store && typeof store.delete === 'function') {
        await (store.delete as (key: string | number) => Promise<void>)(options.key)
        return { success: true }
      }
      return { success: false, error: `Store "${options.store}" 无 delete 方法` }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 探测 dataLayer 是否可用
      return typeof dataLayer !== 'undefined' && dataLayer !== null
    } catch {
      return false
    }
  }
}
