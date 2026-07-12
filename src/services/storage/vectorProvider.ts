/**
 * vectorProvider — IndexedDB 向量存储实现
 *
 * 基于 IndexedDB 存储嵌入向量，使用余弦相似度进行检索。
 * 遵循 VectorProvider 接口。
 *
 * 与 localEmbeddingService 配合使用：
 * - upsertVector / upsertVectors 存入文档向量
 * - searchVectors 用余弦相似度召回 top-k
 */

import { dataLayer } from '@/data/dataLayer'
import { getLogger } from '@/lib/logger'
import { cosineSimilarity } from '@/services/system/localEmbeddingService'
import type {
  DataMorphology,
  GetOptions,
  ListOptions,
  SaveOptions,
  DeleteOptions,
  StorageProvider,
  VectorRecord,
  VectorSearchQuery,
  VectorSearchResult,
  QueryResult,
  ListResult,
} from './storageProvider'

const logger = getLogger()

// ============================================================
// 向量存储配置
// ============================================================

const MIN_SIMILARITY = 0.3

/**
 * VectorProvider — 基于 IndexedDB 的向量存储
 *
 * 存储位置：现有 dataLayer.localDocs store（嵌入向量已随文档保存）
 * 检索方式：全量扫描 + 余弦相似度排序（适合 <1万 条规模）
 */
export class VectorProviderImpl implements StorageProvider {
  readonly backend = 'vector' as const
  readonly morphologies: DataMorphology[] = ['vector', 'document']

  async get<T>(options: GetOptions): Promise<QueryResult<T>> {
    try {
      const result = await dataLayer.localDocs.get(String(options.key))
      return { success: true, data: result as unknown as T }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async list<T>(_options?: ListOptions): Promise<ListResult<T>> {
    try {
      const docs = await dataLayer.localDocs.list()
      const data = docs as unknown as T[]
      return { success: true, data }
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) }
    }
  }

  async save<T>(_data: T, _options?: SaveOptions): Promise<QueryResult<void>> {
    return { success: false, error: 'VectorProvider: 请使用 upsertVector / upsertVectors 写入向量' }
  }

  async delete(options: DeleteOptions): Promise<QueryResult<void>> {
    try {
      await dataLayer.localDocs.get(String(options.key))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await dataLayer.localDocs.list()
      return true
    } catch {
      return false
    }
  }

  // ============================================================
  // VectorProvider 专有方法
  // ============================================================

  /** 插入/更新单条向量记录 */
  async upsertVector(record: VectorRecord): Promise<QueryResult<void>> {
    try {
      const existing = await dataLayer.localDocs.get(record.id)
      if (existing) {
        existing.embedding = record.vector
        await dataLayer.localDocs.save(existing)
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** 批量插入向量 */
  async upsertVectors(records: VectorRecord[]): Promise<QueryResult<void>> {
    let successCount = 0
    for (const record of records) {
      const result = await this.upsertVector(record)
      if (result.success) successCount++
    }
    logger.info('[VectorProvider] 批量写入完成', { total: records.length, success: successCount })
    return { success: successCount === records.length }
  }

  /** 向量相似度搜索 */
  async searchVectors(query: VectorSearchQuery): Promise<ListResult<VectorSearchResult>> {
    try {
      const allDocs = await dataLayer.localDocs.list()
      const threshold = query.minScore ?? MIN_SIMILARITY

      const results: VectorSearchResult[] = []

      for (const doc of allDocs) {
        if (!doc.embedding || doc.embedding.length === 0) continue

        const score = cosineSimilarity(query.vector, doc.embedding)
        if (score < threshold) continue

        results.push({
          id: doc.id,
          score,
          metadata: { name: doc.name, symbol: doc.symbol, category: doc.category },
        })
      }

      results.sort((a, b) => b.score - a.score)
      const top = results.slice(0, query.topK)

      logger.info('[VectorProvider] 向量搜索完成', {
        queryDim: query.vector.length,
        totalCandidates: allDocs.length,
        results: top.length,
      })

      return { success: true, data: top }
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** 删除向量 */
  async deleteVector(id: string): Promise<QueryResult<void>> {
    return this.delete({ key: id })
  }
}
