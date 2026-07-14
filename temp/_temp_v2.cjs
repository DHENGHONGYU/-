const fs = require('fs');
const path = 'src/services/storage/vectorProvider.ts';
let content = fs.readFileSync(path, 'utf-8');

// 1. Add HNSWIndex import
if (!content.includes("import { HNSWIndex } from './hnswIndex'")) {
  content = content.replace(
    "import { cosineSimilarity } from '@/services/system/localEmbeddingService'",
    "import { cosineSimilarity } from '@/services/system/localEmbeddingService'\nimport { HNSWIndex } from './hnswIndex'"
  );
}

// 2. Replace class definition and add ensureIndexLoaded
const oldClass = `export class VectorProviderImpl implements StorageProvider {
  readonly backend = 'vector' as const
  readonly morphologies: DataMorphology[] = ['vector', 'document']

  async get<T>(options: GetOptions): Promise<QueryResult<T>> {`;

const newClass = `export class VectorProviderImpl implements StorageProvider {
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
      const dim = allDocs[0].embedding!.length
      const index = new HNSWIndex('cosine', dim)
      index.initIndex(Math.max(10000, allDocs.length * 2), { M: 16, efConstruction: 200 })
      index.setEf(64)

      const vectors: number[][] = []
      const ids: string[] = []
      for (const doc of allDocs) {
        if (doc.embedding && doc.embedding.length === dim) {
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

  async get<T>(options: GetOptions): Promise<QueryResult<T>> {`;

content = content.replace(oldClass, newClass);

// 3. Replace upsertVector to also update index
content = content.replace(
  `      if (existing) {
        existing.embedding = record.vector
        await sendWriteEnvelope('saveLocalDocs', existing, 'system')
      }`,
  `      if (existing) {
        existing.embedding = record.vector
        await sendWriteEnvelope('saveLocalDocs', existing, 'system')
        // 同步更新内存索引
        if (this.hnsw) {
          this.hnsw.addItems([record.vector], [record.id])
        }
      }`
);

// 4. Replace searchVectors to use HNSW with fallback
const oldSearch = `  /** 向量相似度搜索 */
  async searchVectors(query: VectorSearchQuery): Promise<ListResult<VectorSearchResult>> {
    try {
      const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
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
  }`;

const newSearch = `  /** 向量相似度搜索（HNSW 优先，索引未就绪时回退到全量扫描） */
  async searchVectors(query: VectorSearchQuery): Promise<ListResult<VectorSearchResult>> {
    try {
      await this.ensureIndexLoaded()
      const threshold = query.minScore ?? MIN_SIMILARITY

      let results: VectorSearchResult[] = []

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
  }`;

content = content.replace(oldSearch, newSearch);

// 5. Replace deleteVector to also mark deleted in index
content = content.replace(
  `  /** 删除向量 */
  async deleteVector(id: string): Promise<QueryResult<void>> {
    return this.delete({ key: id })
  }`,
  `  /** 删除向量 */
  async deleteVector(id: string): Promise<QueryResult<void>> {
    if (this.hnsw) {
      this.hnsw.markDeleted(id)
    }
    return this.delete({ key: id })
  }`
);

fs.writeFileSync(path, content, 'utf-8');
console.log('vectorProvider.ts updated with hnswlib-aligned HNSW');
