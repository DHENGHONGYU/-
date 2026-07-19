/**
 * vectorProvider — IndexedDB 向量存储实现
 *
 * 基于 IndexedDB 存储嵌入向量，使用余弦相似度进行检索。
 * 遵循 VectorProvider 接口。
 *
 * 与 localEmbeddingService 配合使用：
 * - upsertVector / upsertVectors 存入文档向量
 * - searchVectors 用余弦相似度召回 top-k
 *
 * P2-1: 集成 HNSW 近似最近邻索引（O(log n)），
 * 索引 API 对齐 Python hnswlib，以便未来无缝替换为 WASM/原生绑定。
 */

import { STORE_NAME } from '@/config/dbConfig'
import type { LocalDoc } from '@/data/types'
import { queryGet, queryList, sendWriteEnvelope } from '@/data/dataLayerHelpers'
import { getLogger } from '@/lib/logger'
import { cosineSimilarity } from '@/services/system/localEmbeddingService'
import { HNSWIndex } from './hnswIndex'
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
 * VectorProvider — 基于 IndexedDB + HNSW 内存索引的向量存储
 *
 * 存储位置：dataLayer.localDocs store（嵌入向量随文档保存）
 * 检索方式：
 * - HNSW 近似最近邻搜索（默认，O(log n)）
 * - 全量扫描回退（索引未构建时 fallback）
 */
export class VectorProviderImpl implements StorageProvider {
  readonly backend = 'vector' as const
  readonly morphologies: DataMorphology[] = ['vector', 'document']

  /** 内存 HNSW 索引（懒加载） */
  private hnsw: HNSWIndex | null = null
  private indexBuilding = false

  /** 确保 HNSW 索引已加载 */
  private async ensureIndexLoaded(): Promise<void> {
    if (this.hnsw || this.indexBuilding) return
    this.indexBuilding = true

    try {
      const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
      if (allDocs.length === 0 || !allDocs[0]?.embedding) {
        this.indexBuilding = false
        return
      }
      const dim = allDocs[0].embedding.length
      const index = new HNSWIndex('cosine', dim)
      index.initIndex(Math.max(10000, allDocs.length * 2), { M: 16, efConstruction: 200 })
      index.setEf(64)

      const vectors: number[][] = []
      const ids: string[] = []
      for (const doc of allDocs) {
        if (doc.embedding?.length === dim) {
          vectors.push(doc.embedding)
          ids.push(doc.id)
        }
      }
      index.addItems(vectors, ids)
      this.hnsw = index
      logger.info('[VectorProvider] HNSW 索引构建完成', { loaded: ids.length, total: allDocs.length, dim })
    } catch (err) {
      logger.error('[VectorProvider] HNSW 索引构建失败，将回退到全量扫描', { error: err })
    } finally {
      this.indexBuilding = false
    }
  }

  async get<T>(options: GetOptions): Promise<QueryResult<T>> {
    try {
      const result = await queryGet<LocalDoc>(STORE_NAME.localDocs, String(options.key))
      return { success: true, data: result as unknown as T }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async list<T>(_options?: ListOptions): Promise<ListResult<T>> {
    try {
      const docs = await queryList<LocalDoc>(STORE_NAME.localDocs)
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
      await queryGet<LocalDoc>(STORE_NAME.localDocs, String(options.key))
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await queryList<LocalDoc>(STORE_NAME.localDocs)
      return true
    } catch (err) { console.warn('[vectorProvider.ts]', err);
      return false
    }
  }

  // ============================================================
  // VectorProvider 专有方法
  // ============================================================

  /** 插入/更新单条向量记录 */
  async upsertVector(record: VectorRecord): Promise<QueryResult<void>> {
    try {
      const existing = await queryGet<LocalDoc>(STORE_NAME.localDocs, record.id)
      if (existing) {
        existing.embedding = record.vector
        await sendWriteEnvelope('saveLocalDocs', existing, 'system')
        // 同步更新内存索引
        if (this.hnsw) {
          this.hnsw.addItems([record.vector], [record.id])
        }
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

  /** 向量相似度搜索（HNSW 优先，索引未就绪时回退到全量扫描） */
  async searchVectors(query: VectorSearchQuery): Promise<ListResult<VectorSearchResult>> {
    try {
      await this.ensureIndexLoaded()
      const threshold = query.minScore ?? MIN_SIMILARITY

      const results: VectorSearchResult[] = []

      if (this.hnsw && this.hnsw.getCurrentCount() > 0) {
        // HNSW 路径：O(log n) 近似最近邻
        const knn = this.hnsw.searchKnn(query.vector, query.topK * 2)
        for (let i = 0; i < knn.ids.length; i++) {
          const score = 1 - knn.distances[i]! // cosine distance -> similarity
          if (score < threshold) continue
          results.push({ id: knn.ids[i]!, score, metadata: {} })
        }
        logger.info('[VectorProvider] HNSW 搜索完成', {
          queryDim: query.vector.length,
          candidates: knn.ids.length,
          results: results.length,
        })
      } else {
        // 全量扫描回退
        const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
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
        logger.info('[VectorProvider] 全量扫描回退完成', {
          queryDim: query.vector.length,
          totalCandidates: allDocs.length,
          results: results.length,
        })
      }

      const top = results.slice(0, query.topK)
      return { success: true, data: top }
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** 删除向量 */
  async deleteVector(id: string): Promise<QueryResult<void>> {
    if (this.hnsw) {
      this.hnsw.markDeleted(id)
    }
    return this.delete({ key: id })
  }
}
