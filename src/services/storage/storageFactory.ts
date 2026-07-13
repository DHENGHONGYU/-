/**
 * storageFactory — 存储提供者工厂
 *
 * 根据数据形态选择/创建对应的 StorageProvider 实例。
 * - document → IndexedDBProvider
 * - time_series → DuckDBProvider（惰性初始化，首次访问时加载 wasm）
 * - vector → VectorProvider（基于 IndexedDB 的向量存储）
 * - file → IndexedDBProvider
 *
 * 运行时可通过 `setStorageBackend()` 切换，调用方无感知。
 */

import { getLogger } from '@/lib/logger'
import type { DataMorphology, StorageProvider } from './storageProvider'
import { IndexedDBProvider } from './indexedDBProvider'

const logger = getLogger()

// ============================================================
// Provider 缓存（单例）
// ============================================================

const providerCache = new Map<string, StorageProvider>()

const INDEXEDDB_INSTANCE = new IndexedDBProvider()
providerCache.set('indexeddb', INDEXEDDB_INSTANCE)

// 惰性初始化标记
let vectorLoaded = false
let duckDbLoaded = false

async function ensureVectorProvider(): Promise<StorageProvider> {
  if (!vectorLoaded) {
    const { VectorProviderImpl } = await import('./vectorProvider')
    const instance: StorageProvider = new VectorProviderImpl()
    providerCache.set('vector', instance)
    vectorLoaded = true
    logger.info('[StorageFactory] VectorProvider 已惰性初始化')
  }
  return providerCache.get('vector')!
}

async function ensureDuckDBProvider(): Promise<StorageProvider> {
  if (!duckDbLoaded) {
    const { DuckDBProviderImpl } = await import('./duckDBProvider')
    const instance: StorageProvider = new DuckDBProviderImpl()
    providerCache.set('duckdb', instance)
    duckDbLoaded = true
    logger.info('[StorageFactory] DuckDBProvider 已惰性初始化')
  }
  return providerCache.get('duckdb')!
}

// ============================================================
// 数据形态 → 后端映射
// ============================================================

type BackendMapping = Partial<Record<DataMorphology, string>>

const defaultMapping: BackendMapping = {
  document: 'indexeddb',
  time_series: 'duckdb',
  vector: 'vector',
  file: 'indexeddb',
}

let currentMapping: BackendMapping = { ...defaultMapping }

// ============================================================
// 工厂 API
// ============================================================

/**
 * 获取指定数据形态对应的存储提供者（异步，支持惰性初始化）
 */
export async function getStorageFor(morphology: DataMorphology): Promise<StorageProvider> {
  const backendName = currentMapping[morphology] ?? 'indexeddb'

  // 惰性初始化 duckdb/vector
  if (backendName === 'duckdb' && !duckDbLoaded) {
    return ensureDuckDBProvider()
  }
  if (backendName === 'vector' && !vectorLoaded) {
    return ensureVectorProvider()
  }

  const provider = providerCache.get(backendName)
  if (!provider) {
    logger.warn('[StorageFactory] provider 未找到，回退 IndexedDB', { morphology, backendName })
    return INDEXEDDB_INSTANCE
  }
  return provider
}

/**
 * 设置指定数据形态的存储后端
 * @param morphology - 数据形态
 * @param backend - 后端名称
 */
export function setStorageBackend(morphology: DataMorphology, backend: string): void {
  if (!providerCache.has(backend) && !['duckdb', 'vector'].includes(backend)) {
    logger.warn('[StorageFactory] 未知后端，映射未生效', { morphology, backend })
    return
  }
  currentMapping[morphology] = backend
  logger.info('[StorageFactory] 后端映射已更新', { morphology, backend })
}

/**
 * 注册自定义存储提供者
 * @param name - 提供者名称
 * @param provider - 存储提供者实例
 */
export function registerProvider(name: string, provider: StorageProvider): void {
  providerCache.set(name, provider)
  logger.info('[StorageFactory] Provider 已注册', { name, backend: provider.backend })
}

/**
 * 获取当前后端映射的副本
 * @returns 只读的后端映射表
 */
export function getBackendMapping(): Readonly<BackendMapping> {
  return { ...currentMapping }
}

/**
 * 将后端映射重置为默认值
 */
export function resetBackendMapping(): void {
  currentMapping = { ...defaultMapping }
  logger.info('[StorageFactory] 后端映射已重置为默认')
}
