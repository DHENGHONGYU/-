/**
 * duckDBProvider — DuckDB 时序数据存储实现
 *
 * 基于 @duckdb/duckdb-wasm 在浏览器中运行 DuckDB 列式数据库，
 * 专用于高频行情数据的写入与 OHLCV 聚合查询。
 *
 * 使用方式：
 * ```typescript
 * import { duckDbProvider } from './duckDBProvider'
 * await duckDbProvider.init()
 * await duckDbProvider.writePoints('600519.SH', points)
 * const ohlcv = await duckDbProvider.aggregate('600519.SH', 3600000)
 * ```
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { getLogger } from '@/lib/logger'
import type {
  AsyncDuckDB,
  AsyncDuckDBConnection,
  DuckDBBundle,
  DuckDBBundles,
} from '@duckdb/duckdb-wasm'
import type {
  GetOptions,
  ListOptions,
  SaveOptions,
  DeleteOptions,
  TimeSeriesProvider,
  TimeSeriesPoint,
  TimeSeriesQuery,
  QueryResult,
  ListResult,
} from './storageProvider'

const logger = getLogger()

// ============================================================
// DuckDB Provider
// ============================================================

/**
 * DuckDBProvider — DuckDB 时序存储
 *
 * 设计说明：
 * - 惰性初始化：首次调用 init() 时加载 DuckDB WebAssembly 引擎
 * - 自动建表：每个 symbol 自动建表（quotes_{normalizedSymbol}）
 * - 预聚合：支持按时间窗口做 OHLCV 聚合
 *
 * 注意：DuckDB 在浏览器中运行于 Web Worker，初始化需 ~1-3s。
 */
export class DuckDBProviderImpl implements TimeSeriesProvider {
  readonly backend = 'duckdb' as const
  readonly morphologies: ['time_series'] = ['time_series']

  // DuckDB 实例（惰性初始化）
  private db: AsyncDuckDB | null = null
  private conn: AsyncDuckDBConnection | null = null
  private initialized = false

  /** 已建表缓存 */
  private tablesCreated = new Set<string>()

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 初始化 DuckDB 引擎
   * @returns true 表示初始化成功
   */
  async init(): Promise<boolean> {
    if (this.initialized && this.db) return true

    try {
      // 动态导入 duckdb-wasm（首次调用时加载 ~15MB wasm）
      // 使用 unknown 中转避免类型断言与模块版本不兼容
      const ddbModule = await import('@duckdb/duckdb-wasm')
      const ddb = ddbModule as unknown as {
        getJsDelivrBundles(): DuckDBBundles
        selectBundle(bundles: DuckDBBundles): Promise<DuckDBBundle>
        ConsoleLogger: new (...args: unknown[]) => unknown
        AsyncDuckDB: new (logger: unknown, worker: Worker) => AsyncDuckDB
      }
      const bundles = ddb.getJsDelivrBundles()
      const bundle = await ddb.selectBundle(bundles)

      const workerUrl = bundle.mainWorker
      if (!workerUrl) {
        throw new Error('DuckDB bundle 不包含 worker URL')
      }
      const worker = new Worker(workerUrl)
      const logger_ = new ddb.ConsoleLogger()
      this.db = new ddb.AsyncDuckDB(logger_, worker)
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker)

      this.conn = await this.db.connect()
      this.initialized = true

      getLogger().info('[DuckDBProvider] 引擎初始化完成')
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      getLogger().error('[DuckDBProvider] 引擎初始化失败', { error: msg })
      return false
    }
  }

  // ============================================================
  // SQL 查询（仅允许 SELECT，防注入）
  // ============================================================

  /**
   * 执行 SQL 查询（安全受限：仅允许 SELECT，拒绝 INSERT/UPDATE/DELETE/DROP 等写操作）
   * @returns 成功时 success=true；被拒绝或出错时 success=false 并附带 error
   */
  async querySQL(sql: string): Promise<QueryResult<unknown>> {
    if (!this.initialized) {
      const ok = await this.init()
      if (!ok) return { success: false, error: 'DuckDB 未初始化' }
    }

    const trimmed = (sql ?? '').trim()
    if (!trimmed) {
      return { success: false, error: '仅允许 SELECT 查询' }
    }

    // 安全校验：必须以 SELECT 开头（大小写不敏感），否则拒绝
    if (!/^SELECT\s/i.test(trimmed)) {
      return { success: false, error: '仅允许 SELECT 查询，禁止 INSERT/UPDATE/DELETE/DROP 等操作' }
    }

    try {
      await this.conn!.query(trimmed)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * 关闭 DuckDB 引擎连接，释放资源
   */
  async close(): Promise<void> {
    try {
      this.conn = null
      this.db = null
      this.initialized = false
      this.tablesCreated.clear()
    } catch {
      // 关闭失败不抛出，仅重置状态
    }
  }

  /**
   * 返回已创建的表名列表（去重）
   */
  async getAvailableTables(): Promise<string[]> {
    return Array.from(this.tablesCreated)
  }

  // ============================================================
  // 表管理
  // ============================================================

  private tableName(symbol: string): string {
    const clean = symbol.replace(/[^a-zA-Z0-9_]/g, '_')
    return `quotes_${clean}`
  }

  private async ensureTable(symbol: string): Promise<void> {
    const table = this.tableName(symbol)
    if (this.tablesCreated.has(table)) return

    await this.conn!.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        timestamp BIGINT,
        value DOUBLE,
        volume DOUBLE DEFAULT 0,
        metadata TEXT
      )
    `)
    this.tablesCreated.add(table)
  }

  // ============================================================
  // StorageProvider 接口
  // ============================================================

  async get<T>(_options: GetOptions): Promise<QueryResult<T>> {
    return { success: false, error: 'DuckDBProvider: 请使用 queryTimeSeries 查询时序数据' }
  }

  async list<T>(_options?: ListOptions): Promise<ListResult<T>> {
    return { success: false, data: [], error: 'DuckDBProvider: 请使用 queryTimeSeries 查询时序数据' }
  }

  async save<T>(_data: T, _options?: SaveOptions): Promise<QueryResult<void>> {
    return { success: false, error: 'DuckDBProvider: 请使用 writePoints 写入时序数据' }
  }

  async delete(options: DeleteOptions): Promise<QueryResult<void>> {
    if (!this.initialized) {
      const ok = await this.init()
      if (!ok) return { success: false, error: 'DuckDB 未初始化' }
    }

    try {
      const table = this.tableName(String(options.key))
      await this.conn!.query(`DROP TABLE IF EXISTS ${table}`)
      this.tablesCreated.delete(table)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) return false
    try {
      await this.conn!.query('SELECT 1')
      return true
    } catch (err) { console.warn('[duckDBProvider.ts]', err);
      return false
    }
  }

  // ============================================================
  // TimeSeriesProvider 专有方法
  // ============================================================

  /**
   * 批量写入时序数据点
   */
  async writePoints(symbol: string, points: TimeSeriesPoint[]): Promise<QueryResult<void>> {
    if (!this.initialized) {
      const ok = await this.init()
      if (!ok) return { success: false, error: 'DuckDB 未初始化' }
    }

    if (points.length === 0) return { success: true }

    try {
      await this.ensureTable(symbol)
      const table = this.tableName(symbol)

      // 批量准备 values
      const values = points
        .map((p) => `(${p.timestamp}, ${p.value}, ${(p.metadata?.volume as number) ?? 0}, '${JSON.stringify(p.metadata ?? {})}')`)
        .join(',\n')

      await this.conn!.query(`INSERT INTO ${table} (timestamp, value, volume, metadata) VALUES ${values}`)

      logger.info('[DuckDBProvider] 写入完成', { symbol, points: points.length })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * 查询时序数据
   */
  async queryTimeSeries(query: TimeSeriesQuery): Promise<ListResult<TimeSeriesPoint>> {
    if (!this.initialized) {
      const ok = await this.init()
      if (!ok) return { success: false, data: [], error: 'DuckDB 未初始化' }
    }

    try {
      const table = this.tableName(query.symbol)
      let sql = `SELECT timestamp, value FROM ${table} WHERE 1=1`

      if (query.startTime) sql += ` AND timestamp >= ${query.startTime}`
      if (query.endTime) sql += ` AND timestamp <= ${query.endTime}`
      sql += ' ORDER BY timestamp ASC'
      if (query.limit) sql += ` LIMIT ${query.limit}`

      const result = await this.conn!.query(sql)

      const points: TimeSeriesPoint[] = []
      for (let i = 0; i < result.numRows; i++) {
        points.push({
          timestamp: Number(result.getChild('timestamp')?.get(i) ?? 0),
          value: Number(result.getChild('value')?.get(i) ?? 0),
        })
      }

      return { success: true, data: points }
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) }
    }
  }

  /**
   * OHLCV 聚合查询
   */
  async aggregate(symbol: string, windowMs: number): Promise<ListResult<OHLCVRow>> {
    if (!this.initialized) {
      const ok = await this.init()
      if (!ok) return { success: false, data: [], error: 'DuckDB 未初始化' }
    }

    try {
      const table = this.tableName(symbol)
      const sql = `
        SELECT
          FLOOR(timestamp / ${windowMs}) * ${windowMs} AS bucket,
          FIRST(value) AS open,
          MAX(value) AS high,
          MIN(value) AS low,
          LAST(value) AS close,
          SUM(volume) AS volume
        FROM ${table}
        GROUP BY bucket
        ORDER BY bucket ASC
      `

      const result = await this.conn!.query(sql)
      const rows: OHLCVRow[] = []
      for (let i = 0; i < result.numRows; i++) {
        rows.push({
          timestamp: Number(result.getChild('bucket')?.get(i) ?? 0),
          open: Number(result.getChild('open')?.get(i) ?? 0),
          high: Number(result.getChild('high')?.get(i) ?? 0),
          low: Number(result.getChild('low')?.get(i) ?? 0),
          close: Number(result.getChild('close')?.get(i) ?? 0),
          volume: Number(result.getChild('volume')?.get(i) ?? 0),
        })
      }

      return { success: true, data: rows }
    } catch (err) {
      return { success: false, data: [], error: err instanceof Error ? err.message : String(err) }
    }
  }
}

/** OHLCV 聚合结果行 */
interface OHLCVRow {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
