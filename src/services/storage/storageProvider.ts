/**
 * storageProvider — 存储抽象层类型定义
 *
 * 为不同数据形态定义统一存储接口，支持切换后端：
 * - IndexedDB（默认）：关系型/文档数据（当前生产后端）
 * - DuckDB/sql.js（预留）：高频行情列式存储
 * - LanceDB/Chroma（预留）：向量嵌入语义检索
 *
 * 设计原则：
 * - 不破坏现有 dataLayer 调用方
 * - 新增代码通过 StorageProvider 接口访问存储
 * - 允许按数据形态选择最佳存储后端
 */

// ============================================================
// 存储后端类型
// ============================================================

export type StorageBackend = 'indexeddb' | 'duckdb' | 'vector'

// ============================================================
// 数据形态分类
// ============================================================

export type DataMorphology =
  | 'document'       // 文档/关系数据（LocalDoc, Stock, etc.）→ IndexedDB
  | 'time_series'    // 高频行情/时序数据（DailyQuotes, Kline）→ DuckDB/sql.js
  | 'vector'         // 嵌入向量（embeddings）→ LanceDB/Chroma
  | 'file'           // 大文件/二进制 → IndexedDB blob 或 FileSystem API

// ============================================================
// 通用存储操作
// ============================================================

export interface GetOptions {
  /** 主键 */
  key: string | number
  /** 对象存储名称 */
  store?: string
}

export interface ListOptions {
  store?: string
  /** 按字段过滤 */
  filter?: Record<string, unknown>
  /** 排序字段 */
  orderBy?: string
  /** 排序方向 */
  orderDir?: 'asc' | 'desc'
  /** 限制数量 */
  limit?: number
}

export interface SaveOptions {
  store?: string
}

export interface DeleteOptions {
  key: string | number
  store?: string
}

export interface QueryResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ListResult<T> {
  success: boolean
  data: T[]
  error?: string
}

// ============================================================
// 时序数据专有接口
// ============================================================

export interface TimeSeriesPoint {
  timestamp: number
  value: number
  /** 可选的额外字段 */
  metadata?: Record<string, number | string>
}

export interface TimeSeriesQuery {
  symbol: string
  startTime?: number
  endTime?: number
  limit?: number
  fields?: string[]
}

// ============================================================
// 向量检索专有接口
// ============================================================

export interface VectorRecord {
  id: string
  vector: number[]
  metadata?: Record<string, string | number>
}

export interface VectorSearchQuery {
  vector: number[]
  topK: number
  filter?: Record<string, unknown>
  minScore?: number
}

export interface VectorSearchResult {
  id: string
  score: number
  metadata?: Record<string, string | number>
}

// ============================================================
// StorageProvider 接口
// ============================================================

export interface StorageProvider {
  /** 存储后端类型 */
  readonly backend: StorageBackend
  /** 支持的数据形态 */
  readonly morphologies: DataMorphology[]

  /** 读取单条 */
  get<T>(options: GetOptions): Promise<QueryResult<T>>
  /** 列出多条 */
  list<T>(options?: ListOptions): Promise<ListResult<T>>
  /** 保存（新增/覆盖） */
  save<T>(data: T, options?: SaveOptions): Promise<QueryResult<void>>
  /** 删除 */
  delete(options: DeleteOptions): Promise<QueryResult<void>>
  /** 健康检查 */
  healthCheck(): Promise<boolean>
}

// ============================================================
// 时序存储扩展接口
// ============================================================

export interface TimeSeriesProvider extends StorageProvider {
  readonly backend: 'duckdb'
  readonly morphologies: ['time_series']

  /** 批量写入时序数据点 */
  writePoints(symbol: string, points: TimeSeriesPoint[]): Promise<QueryResult<void>>
  /** 查询时序数据 */
  queryTimeSeries(query: TimeSeriesQuery): Promise<ListResult<TimeSeriesPoint>>
  /** 聚合查询（OHLCV） */
  aggregate(symbol: string, windowMs: number): Promise<ListResult<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>>
}

// ============================================================
// 向量存储扩展接口
// ============================================================

export interface VectorProvider extends StorageProvider {
  readonly backend: 'vector'
  readonly morphologies: ['vector']

  /** 插入/更新向量 */
  upsertVector(record: VectorRecord): Promise<QueryResult<void>>
  /** 批量插入向量 */
  upsertVectors(records: VectorRecord[]): Promise<QueryResult<void>>
  /** 向量相似度搜索 */
  searchVectors(query: VectorSearchQuery): Promise<ListResult<VectorSearchResult>>
  /** 删除向量 */
  deleteVector(id: string): Promise<QueryResult<void>>
}
