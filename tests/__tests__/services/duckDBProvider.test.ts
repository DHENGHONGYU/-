/**
 * @file tests/__tests__/services/duckDBProvider.test.ts
 * @description DuckDBProvider 单元测试 —— 覆盖 SQL 安全、表名转换、核心业务逻辑
 *
 * 测试策略：
 *   - 纯逻辑方法（tableName、SQL 安全检查）：直接实例化测试
 *   - 需要 DuckDB 引擎的方法：使用 vi.mock 模拟 @duckdb/duckdb-wasm
 *   - 不依赖真实 WASM 加载，确保测试在 CI 中快速稳定运行
 *
 * @created 2026-07-20
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DuckDBProviderImpl, type OHLCVRow, type SQLQueryResult } from '@/services/storage/duckDBProvider'
import type { TimeSeriesPoint } from '@/services/storage/storageProvider'

// ============================================================
// Mock DuckDB WASM
// ============================================================
// 模拟 DuckDB 连接，使用内存数组存储数据

interface MockRow {
  timestamp: number
  value: number
  volume: number
  metadata: string
}

let mockData: Map<string, MockRow[]> = new Map()

const mockQuery = vi.fn(async (sql: string) => {
  // 解析简单的 INSERT 语句
  if (sql.trim().toUpperCase().startsWith('INSERT INTO')) {
    const match = sql.match(/INSERT INTO (\w+)/i)
    const table = match?.[1] ?? ''
    if (!mockData.has(table)) mockData.set(table, [])

    // 解析 VALUES
    const valuesMatch = sql.match(/VALUES\s*(.*)$/is)
    if (valuesMatch) {
      const valuesStr = valuesMatch[1]
      const rowMatches = valuesStr.match(/\(([^)]+)\)/g) ?? []
      for (const rowStr of rowMatches) {
        const parts = rowStr.slice(1, -1).split(',').map(s => s.trim())
        mockData.get(table)!.push({
          timestamp: Number(parts[0]),
          value: Number(parts[1]),
          volume: Number(parts[2]),
          metadata: parts[3]?.replace(/^'|'$/g, '') ?? '{}',
        })
      }
    }
    return { numRows: 0, numCols: 0, schema: { fields: [] }, getChildAt: () => ({ get: () => undefined }) }
  }

  // 解析简单的 SELECT（仅支持全表扫描）
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i)
    const table = fromMatch?.[1] ?? ''
    const rows = mockData.get(table) ?? []

    // 简单提取列名
    const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i)
    const selectPart = selectMatch?.[1] ?? '*'
    const columns = selectPart === '*'
      ? ['timestamp', 'value', 'volume', 'metadata']
      : selectPart.split(',').map(s => s.trim().split(' ').pop()?.replace(/.*\./, '') ?? '')

    // 模拟 numRows / numCols / schema / getChildAt
    const resultRows = rows
    const schemaFields = columns.map(name => ({ name }))

    return {
      numRows: resultRows.length,
      numCols: columns.length,
      schema: { fields: schemaFields },
      getChildAt: (colIndex: number) => ({
        get: (rowIndex: number) => {
          const colName = columns[colIndex] ?? ''
          const row = resultRows[rowIndex] as Record<string, unknown>
          return row?.[colName]
        },
      }),
    }
  }

  // CREATE TABLE / DROP TABLE 等直接返回空结果
  return { numRows: 0, numCols: 0, schema: { fields: [] }, getChildAt: () => ({ get: () => undefined }) }
})

const mockConn = {
  query: mockQuery,
  close: vi.fn(),
}

const mockDB = {
  instantiate: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(mockConn),
}

vi.mock('@duckdb/duckdb-wasm', () => ({
  getJsDelivrBundles: vi.fn(() => ({})),
  selectBundle: vi.fn(() => Promise.resolve({
    mainModule: 'mock_main.wasm',
    mainWorker: 'mock_worker.js',
    pthreadWorker: 'mock_pthread.js',
  })),
  ConsoleLogger: class { constructor() {} },
  AsyncDuckDB: class {
    constructor() {
      return mockDB
    }
  },
}))

// 模拟 Worker
vi.stubGlobal('Worker', class MockWorker {
  constructor() {}
  postMessage() {}
  terminate() {}
})

// ============================================================
// 测试用例
// ============================================================

describe('DuckDBProvider', () => {
  let provider: DuckDBProviderImpl

  beforeEach(async () => {
    mockData.clear()
    mockQuery.mockClear()
    provider = new DuckDBProviderImpl()
  })

  afterEach(async () => {
    await provider.close()
  })

  // ==========================================================
  // 表名安全转换
  // ==========================================================

  describe('tableName 安全转换', () => {
    it('正常 symbol 生成正确表名', async () => {
      await provider.init()
      // 通过 writePoints 间接验证 tableName 逻辑（需要非空数据才会触发表创建）
      await provider.writePoints('600519.SH', [{ timestamp: 1, value: 1 }])
      // 表名应该是 quotes_600519_SH
      expect(mockQuery).toHaveBeenCalled()
      const calls = mockQuery.mock.calls.map(c => c[0] as string)
      const createTableSql = calls.find(s => s.toUpperCase().includes('CREATE TABLE'))
      expect(createTableSql).toContain('quotes_600519_SH')
    })

    it('特殊字符 symbol 被安全转义（防 SQL 注入）', async () => {
      await provider.init()
      // 包含 SQL 注入危险字符
      await provider.writePoints('test; DROP TABLE students;--', [{ timestamp: 1, value: 1 }])
      const calls = mockQuery.mock.calls.map(c => c[0] as string)
      const createTableSql = calls.find(s => s.toUpperCase().includes('CREATE TABLE'))
      // 特殊字符应被替换为下划线
      expect(createTableSql).toBeDefined()
      // 验证表名部分不包含 SQL 注入关键字符
      const tableMatch = createTableSql?.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)
      const tableName = tableMatch?.[1] ?? ''
      expect(tableName).not.toContain(';')       // 分号被转义
      expect(tableName).not.toContain('--')      // 注释符被转义
      expect(tableName).toMatch(/^quotes_\w+$/)  // 表名仅包含字母数字下划线
    })

    it('点号、斜杠、空格等特殊字符被替换', async () => {
      await provider.init()
      await provider.writePoints('AAPL.US/OTC Test', [{ timestamp: 1, value: 1 }])
      const calls = mockQuery.mock.calls.map(c => c[0] as string)
      const createTableSql = calls.find(s => s.toUpperCase().includes('CREATE TABLE'))
      // 表名中不应包含原始特殊字符
      expect(createTableSql).toContain('quotes_AAPL_US_OTC_Test')
      // 验证表名部分（CREATE TABLE 后面的表名）不含 . / 空格
      const tableMatch = createTableSql?.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)
      const tableName = tableMatch?.[1] ?? ''
      expect(tableName).not.toContain('.')
      expect(tableName).not.toContain('/')
      expect(tableName).not.toContain(' ')
    })

    it('下划线和字母数字保留', async () => {
      await provider.init()
      await provider.writePoints('BTC_USDT_2024', [{ timestamp: 1, value: 1 }])
      const calls = mockQuery.mock.calls.map(c => c[0] as string)
      const createTableSql = calls.find(s => s.toUpperCase().includes('CREATE TABLE'))
      expect(createTableSql).toContain('quotes_BTC_USDT_2024')
    })
  })

  // ==========================================================
  // querySQL 安全检查
  // ==========================================================

  describe('querySQL 安全检查', () => {
    beforeEach(async () => {
      await provider.init()
    })

    it('SELECT 查询允许通过', async () => {
      const result = await provider.querySQL('SELECT 1')
      expect(result.success).toBe(true)
    })

    it('小写 select 也允许（不区分大小写）', async () => {
      const result = await provider.querySQL('select * from test')
      expect(result.success).toBe(true)
    })

    it('前后有空格的 SELECT 也允许', async () => {
      const result = await provider.querySQL('   SELECT 1   ')
      expect(result.success).toBe(true)
    })

    it('INSERT 语句被拒绝', async () => {
      const result = await provider.querySQL('INSERT INTO test VALUES (1)')
      expect(result.success).toBe(false)
      expect(result.error).toContain('仅允许 SELECT')
    })

    it('DROP TABLE 被拒绝', async () => {
      const result = await provider.querySQL('DROP TABLE users')
      expect(result.success).toBe(false)
      expect(result.error).toContain('仅允许 SELECT')
    })

    it('UPDATE 被拒绝', async () => {
      const result = await provider.querySQL('UPDATE test SET value=1')
      expect(result.success).toBe(false)
      expect(result.error).toContain('仅允许 SELECT')
    })

    it('DELETE 被拒绝', async () => {
      const result = await provider.querySQL('DELETE FROM test WHERE id=1')
      expect(result.success).toBe(false)
      expect(result.error).toContain('仅允许 SELECT')
    })

    it('CREATE TABLE 被拒绝', async () => {
      const result = await provider.querySQL('CREATE TABLE test (id INT)')
      expect(result.success).toBe(false)
      expect(result.error).toContain('仅允许 SELECT')
    })

    it('空字符串被拒绝', async () => {
      const result = await provider.querySQL('')
      expect(result.success).toBe(false)
      expect(result.error).toContain('仅允许 SELECT')
    })

    it('未初始化时返回错误', async () => {
      const p = new DuckDBProviderImpl()
      const result = await p.querySQL('SELECT 1')
      expect(result.success).toBe(false)
      expect(result.error).toContain('未初始化')
      await p.close()
    })
  })

  // ==========================================================
  // writePoints 写入逻辑
  // ==========================================================

  describe('writePoints 写入', () => {
    beforeEach(async () => {
      await provider.init()
    })

    it('空数组写入直接返回成功', async () => {
      const result = await provider.writePoints('TEST', [])
      expect(result.success).toBe(true)
    })

    it('单条数据写入成功', async () => {
      const point: TimeSeriesPoint = { timestamp: 1000, value: 100 }
      const result = await provider.writePoints('TEST', [point])
      expect(result.success).toBe(true)

      // 验证 INSERT 语句被调用
      const insertCalls = mockQuery.mock.calls.filter(
        c => (c[0] as string).toUpperCase().startsWith('INSERT')
      )
      expect(insertCalls.length).toBeGreaterThan(0)
    })

    it('批量写入数据', async () => {
      const points: TimeSeriesPoint[] = [
        { timestamp: 1000, value: 100 },
        { timestamp: 2000, value: 200 },
        { timestamp: 3000, value: 300 },
      ]
      const result = await provider.writePoints('TEST', points)
      expect(result.success).toBe(true)

      // 验证 INSERT 语句包含 3 条数据
      const insertCalls = mockQuery.mock.calls.filter(
        c => (c[0] as string).toUpperCase().startsWith('INSERT')
      )
      expect(insertCalls.length).toBe(1)
      // 统计 VALUES 中的行数
      const insertSql = insertCalls[0][0] as string
      const valueCount = (insertSql.match(/\(/g) ?? []).length - 1 // 减去列名括号
      expect(valueCount).toBe(3)
    })

    it('写入包含 volume 的数据', async () => {
      const point: TimeSeriesPoint = {
        timestamp: 1000,
        value: 100,
        metadata: { volume: 500 },
      }
      const result = await provider.writePoints('TEST', [point])
      expect(result.success).toBe(true)
    })

    it('重复调用 ensureTable 只建表一次（幂等性）', async () => {
      await provider.writePoints('TEST', [{ timestamp: 1, value: 1 }])
      await provider.writePoints('TEST', [{ timestamp: 2, value: 2 }])

      const createCalls = mockQuery.mock.calls.filter(
        c => (c[0] as string).toUpperCase().includes('CREATE TABLE')
      )
      // 应该只有 1 次 CREATE TABLE 调用
      expect(createCalls.length).toBe(1)
    })
  })

  // ==========================================================
  // healthCheck 健康检查
  // ==========================================================

  describe('healthCheck', () => {
    it('未初始化时返回 false', async () => {
      const result = await provider.healthCheck()
      expect(result).toBe(false)
    })

    it('初始化成功后返回 true', async () => {
      await provider.init()
      const result = await provider.healthCheck()
      expect(result).toBe(true)
    })

    it('关闭后健康检查返回 false', async () => {
      await provider.init()
      await provider.close()
      const result = await provider.healthCheck()
      expect(result).toBe(false)
    })
  })

  // ==========================================================
  // close 关闭连接
  // ==========================================================

  describe('close', () => {
    it('关闭后状态重置', async () => {
      await provider.init()
      await provider.close()

      // 关闭后健康检查应失败
      const healthy = await provider.healthCheck()
      expect(healthy).toBe(false)
    })

    it('重复关闭不报错', async () => {
      await provider.init()
      await provider.close()
      await expect(provider.close()).resolves.not.toThrow()
    })

    it('未初始化时关闭不报错', async () => {
      await expect(provider.close()).resolves.not.toThrow()
    })
  })

  // ==========================================================
  // getAvailableTables
  // ==========================================================

  describe('getAvailableTables', () => {
    it('未初始化时返回空数组', async () => {
      const tables = await provider.getAvailableTables()
      expect(tables).toEqual([])
    })

    it('初始化后无表时返回空数组', async () => {
      await provider.init()
      const tables = await provider.getAvailableTables()
      expect(Array.isArray(tables)).toBe(true)
    })
  })

  // ==========================================================
  // delete 删除表
  // ==========================================================

  describe('delete', () => {
    it('删除已存在的表成功', async () => {
      await provider.init()
      await provider.writePoints('TEST', [{ timestamp: 1, value: 1 }])
      const result = await provider.delete({ key: 'TEST' })
      expect(result.success).toBe(true)
    })

    it('删除不存在的表也成功（DROP IF EXISTS）', async () => {
      await provider.init()
      const result = await provider.delete({ key: 'NON_EXISTENT' })
      expect(result.success).toBe(true)
    })
  })

  // ==========================================================
  // StorageProvider 接口
  // ==========================================================

  describe('StorageProvider 接口', () => {
    beforeEach(async () => {
      await provider.init()
    })

    it('get 方法返回指引错误（提示用 queryTimeSeries）', async () => {
      const result = await provider.get({ key: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('queryTimeSeries')
    })

    it('list 方法返回指引错误', async () => {
      const result = await provider.list()
      expect(result.success).toBe(false)
      expect(result.error).toContain('queryTimeSeries')
    })

    it('save 方法返回指引错误（提示用 writePoints）', async () => {
      const result = await provider.save({})
      expect(result.success).toBe(false)
      expect(result.error).toContain('writePoints')
    })
  })

  // ==========================================================
  // backend 和 morphologies 属性
  // ==========================================================

  describe('属性标识', () => {
    it('backend 为 duckdb', () => {
      expect(provider.backend).toBe('duckdb')
    })

    it('morphologies 包含 time_series', () => {
      expect(provider.morphologies).toContain('time_series')
    })
  })
})
