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
 *
 * P0-3: HNSW 索引持久化——启动时优先从 IndexedDB 恢复索引，
 * 避免每次冷启动全量重建；写入后自动回写持久化。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { STORE_NAME } from '@/config/dbConfig'
import type { LocalDoc } from '@/data/types'
import { queryGet, queryList, sendWriteEnvelope } from '@/data/dataLayerHelpers'
import { getLogger } from '@/lib/logger'
import { cosineSimilarity } from '@/services/system/localEmbeddingService'
import { HNSWIndex } from './hnswIndex'
import type { SerializedHNSW } from './hnswIndex'
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

/** HNSW 索引持久化专用 Key（存入 localDocs store） */
const HNSW_INDEX_DOC_ID = '__hnsw_index_v1__'

/** HNSW 结果按阈值过滤为向量搜索结果（扁平化） */
function collectKnnResults(
  ids: string[],
  distances: number[],
  threshold: number,
): VectorSearchResult[] {
  const results: VectorSearchResult[] = []
  for (let i = 0; i < ids.length; i++) {
    const score = 1 - distances[i]! // cosine distance -> similarity
    if (score < threshold) continue
    results.push({ id: ids[i]!, score, metadata: {} })
  }
  return results
}

/** 全量扫描候选按阈值过滤为向量搜索结果（扁平化） */
function collectScanResults(
  allDocs: LocalDoc[],
  vector: number[],
  threshold: number,
): VectorSearchResult[] {
  const results: VectorSearchResult[] = []
  for (const doc of allDocs) {
    if (!doc.embedding || doc.embedding.length === 0) continue
    const score = cosineSimilarity(vector, doc.embedding)
    if (score < threshold) continue
    results.push({ id: doc.id, score, metadata: { name: doc.name, symbol: doc.symbol, category: doc.category } })
  }
  return results
}

/**
 * VectorProvider — 基于 IndexedDB + HNSW 内存索引的向量存储
 *
 * 存储位置：dataLayer.localDocs store（嵌入向量随文档保存）
 * 检索方式：
 * - HNSW 近似最近邻搜索（默认，O(log n)）
 * - 全量扫描回退（索引未构建时 fallback）
 *
 * P0-3: 索引持久化——启动时优先从 IndexedDB 恢复 HNSW 索引，
 * 避免每次冷启动全量重建；写入/删除后自动回写持久化。
 */
export class VectorProviderImpl implements StorageProvider {
  readonly backend = 'vector' as const
  readonly morphologies: DataMorphology[] = ['vector', 'document']

  /** 内存 HNSW 索引（懒加载） */
  private hnsw: HNSWIndex | null = null
  private indexBuilding = false

  /** 确保 HNSW 索引已加载（P0-3：优先从 IndexedDB 恢复，避免每次冷启动重建） */
  private async ensureIndexLoaded(): Promise<void> {
    if (this.hnsw || this.indexBuilding) return
    this.indexBuilding = true

    try {
      // P0-3: 尝试从 IndexedDB 恢复持久化索引
      const persisted = await this.loadPersistedIndex()
      if (persisted) {
        this.hnsw = persisted
        this.indexBuilding = false
        return
      }

      // 回退：从 localDocs 全量构建索引
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

      // P0-3: 构建完成后持久化
      await this.persistIndex()
    } catch (err) {
      logger.error('[VectorProvider] HNSW 索引构建失败，将回退到全量扫描', { error: err })
    } finally {
      this.indexBuilding = false
    }
  }

  /**
   * P0-3: 从 IndexedDB 加载持久化的 HNSW 索引
   * @returns 恢复的 HNSWIndex 实例，或 null（表示无持久化数据或数据已过期）
   */
  private async loadPersistedIndex(): Promise<HNSWIndex | null> {
    try {
      const doc = await queryGet<{ id: string; serializedIndex: SerializedHNSW; docCount: number; persistedAt: number }>(
        STORE_NAME.localDocs,
        HNSW_INDEX_DOC_ID,
      )
      if (!doc?.serializedIndex) return null

      const index = new HNSWIndex(doc.serializedIndex.space, doc.serializedIndex.dim)
      index.loadIndex(doc.serializedIndex)

      // 校验：索引中的向量数量应与持久化时的文档数量一致
      const currentDocCount = (await queryList<LocalDoc>(STORE_NAME.localDocs)).filter(
        (d) => d.embedding && d.embedding.length > 0,
      ).length
      if (index.getCurrentCount() !== currentDocCount) {
        logger.info('[VectorProvider] 持久化索引已过期（文档数量变化），将重建', {
          persisted: index.getCurrentCount(),
          current: currentDocCount,
        })
        return null
      }

      logger.info('[VectorProvider] 从 IndexedDB 恢复 HNSW 索引', {
        count: index.getCurrentCount(),
        dim: doc.serializedIndex.dim,
        persistedAt: new Date(doc.persistedAt).toISOString(),
      })
      return index
    } catch (err) {
      logger.warn('[VectorProvider] 加载持久化索引失败，将重建', {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /**
   * P0-3: 将 HNSW 索引持久化到 IndexedDB
   */
  private async persistIndex(): Promise<void> {
    if (!this.hnsw) return
    try {
      const serializedIndex = this.hnsw.saveIndex()
      const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
      const docCount = allDocs.filter((d) => d.embedding && d.embedding.length > 0).length

      await sendWriteEnvelope('saveLocalDocs', {
        id: HNSW_INDEX_DOC_ID,
        serializedIndex,
        docCount,
        persistedAt: Date.now(),
      })
      logger.debug('[VectorProvider] HNSW 索引已持久化', { count: this.hnsw.getCurrentCount(), docCount })
    } catch (err) {
      logger.warn('[VectorProvider] 持久化索引失败', {
        error: err instanceof Error ? err.message : String(err),
      })
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

  /** 插入/更新单条向量记录（P0-3：写入后自动回写持久化索引） */
  async upsertVector(record: VectorRecord): Promise<QueryResult<void>> {
    try {
      const existing = await queryGet<LocalDoc>(STORE_NAME.localDocs, record.id)
      if (existing) {
        existing.embedding = record.vector
        await sendWriteEnvelope('saveLocalDocs', existing, 'system')
        // 同步更新内存索引
        if (this.hnsw) {
          this.hnsw.addItems([record.vector], [record.id])
          await this.persistIndex()
        }
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** 批量插入向量（P0-3：批量写入后一次性回写持久化索引） */
  async upsertVectors(records: VectorRecord[]): Promise<QueryResult<void>> {
    let successCount = 0
    for (const record of records) {
      const result = await this.upsertVector(record)
      if (result.success) successCount++
    }
    // 批量写入后一次性持久化（upsertVector 内部已逐个持久化，此处做最终确保）
    if (this.hnsw && successCount > 0) {
      await this.persistIndex()
    }
    logger.info('[VectorProvider] 批量写入完成', { total: records.length, success: successCount })
    return { success: successCount === records.length }
  }

  /** 向量相似度搜索（HNSW 优先，索引未就绪时回退到全量扫描） */
  async searchVectors(query: VectorSearchQuery): Promise<ListResult<VectorSearchResult>> {
    try {
      await this.ensureIndexLoaded()
      const threshold = query.minScore ?? MIN_SIMILARITY

      let results: VectorSearchResult[] = []

      if (this.hnsw && this.hnsw.getCurrentCount() > 0) {
        // HNSW 路径：O(log n) 近似最近邻
        const knn = this.hnsw.searchKnn(query.vector, query.topK * 2)
        results = collectKnnResults(knn.ids, knn.distances, threshold)
        logger.info('[VectorProvider] HNSW 搜索完成', {
          queryDim: query.vector.length,
          candidates: knn.ids.length,
          results: results.length,
        })
      } else {
        // 全量扫描回退
        const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
        results = collectScanResults(allDocs, query.vector, threshold)
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

  /** 删除向量（P0-3：删除后自动回写持久化索引） */
  async deleteVector(id: string): Promise<QueryResult<void>> {
    if (this.hnsw) {
      this.hnsw.markDeleted(id)
      await this.persistIndex()
    }
    return this.delete({ key: id })
  }
}
