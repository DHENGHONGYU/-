/**
 * @fileoverview Stockpool ACL 权限验证集成测试
 *
 * 测试目标：
 *   验证 ACL_MATRIX 中 stockpool 模块的读写权限配置，以及 DataBridge
 *   在 ACL 校验下的查询（query）和转发（forward）行为。
 *
 * 设计要点：
 *   1. 文件最外层 afterAll 调用 close() 重置 db 单例，解决同一进程串行
 *      运行多个测试文件时 fake-indexeddb 状态冲突（vitest forks 池单进程）。
 *   2. 不包含任何修改共享 ACL_MATRIX 单例的测试（Readonly<> 仅编译期
 *      保护，运行时赋值会成功并污染后续测试）。
 *   3. 查询不存在的 key 时 IndexedDB get() 返回 undefined 而非 null，
 *      使用 toBeFalsy() 断言。
 *
 * 测试结构：6 个套件，共 21 个用例
 *   套件1: ACL_MATRIX 配置验证（4 用例）
 *   套件2: DataBridge.query 读权限验证（4 用例）
 *   套件3: DataBridge.forward 写权限验证（2 用例）
 *   套件4: 所有 ResearchStatus 状态流转（5 用例）
 *   套件5: ACL 拒绝验证（4 用例）
 *   套件6: 缓存与 ACL 一致性（2 用例）
 */

import { db, close } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { dataLayer } from '@/data/dataLayer'
import {
  ACL_MATRIX,
  MODULE_ID,
  STORE_NAME,
  DB_OPERATION,
  DATA_SOURCE,
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  type AclPermission,
  type DataSource,
} from '@/config/dbConfig'
import { RESEARCH_STATUS, type ResearchStatus } from '@/constants/stockpool.constants'
import { mcpRegistry } from '@/mcp/core/registry'
import { registerAllServers } from '@/mcp/register'
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Stock } from '@/data/types'

// ============================================================
// 常量
// ============================================================

const TEST_STOCK_SYMBOL = 'TEST001'
const TEST_STOCK_NAME = '测试股票'

// ============================================================
// 辅助函数
// ============================================================

interface AddStockOverrides {
  symbol?: string
  name?: string
  researchStatus?: ResearchStatus
  source?: DataSource
  group?: string
}

async function addTestStock(overrides: AddStockOverrides = {}): Promise<void> {
  await dataLayer.stocks.add({
    symbol: overrides.symbol ?? TEST_STOCK_SYMBOL,
    name: overrides.name ?? TEST_STOCK_NAME,
    researchStatus: overrides.researchStatus ?? RESEARCH_STATUS.candidate,
    source: overrides.source ?? DATA_SOURCE.manual,
    group: overrides.group,
  })
}

// ============================================================
// 文件最外层 afterAll
// 重置 db 单例，解决同一进程串行运行多个测试文件时 fake-indexeddb 状态冲突
// close() 等价于 db.close()，关闭底层 IDBDatabase 连接并重置 V6Database 状态
// ============================================================

afterAll(() => {
  close()
})

// ============================================================
// MCP 注册中心初始化（文件级 beforeAll）
// ============================================================

beforeAll(() => {
  registerAllServers()
  expect(mcpRegistry).toBeDefined()
})

// ============================================================
// 套件 1: ACL_MATRIX 配置验证（4 用例）
// ============================================================

describe('ACL_MATRIX 配置验证', () => {
  it('stockpool 模块应在 ACL_MATRIX 中定义', { timeout: 60000 }, () => {
    const permission: AclPermission = ACL_MATRIX[MODULE_ID.stockpool]
    expect(permission).toBeDefined()
  })

  it('stockpool 的 actions 应包含 SELECT/INSERT/UPDATE/DELETE', { timeout: 60000 }, () => {
    const actions = ACL_MATRIX[MODULE_ID.stockpool].actions
    expect(actions).toContain(DB_OPERATION.select)
    expect(actions).toContain(DB_OPERATION.insert)
    expect(actions).toContain(DB_OPERATION.update)
    expect(actions).toContain(DB_OPERATION.delete)
  })

  it('stockpool 的 read 列表应包含 stocks 和 v6Scores', { timeout: 60000 }, () => {
    const read = ACL_MATRIX[MODULE_ID.stockpool].read
    expect(read).toContain(STORE_NAME.stocks)
    expect(read).toContain(STORE_NAME.v6Scores)
  })

  it('stockpool 的 write 列表应包含 stocks', { timeout: 60000 }, () => {
    const write = ACL_MATRIX[MODULE_ID.stockpool].write
    expect(write).toContain(STORE_NAME.stocks)
  })
})

// ============================================================
// 套件 2: DataBridge.query 读权限验证（4 用例）
// ============================================================

describe('DataBridge.query 读权限验证', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    await addTestStock()
  })

  it('stockpool 应能通过 QUERY_LIST 查询 stocks store', { timeout: 60000 }, async () => {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.symbol).toBe(TEST_STOCK_SYMBOL)
  })

  it('stockpool 应能通过 QUERY_GET 按 key 查询 stocks store', { timeout: 60000 }, async () => {
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.symbol).toBe(TEST_STOCK_SYMBOL)
    expect(result.data?.name).toBe(TEST_STOCK_NAME)
  })

  it('stockpool 应能查询 v6Scores store（read 权限）', { timeout: 60000 }, async () => {
    const result = await dataBridge.query<unknown[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.v6Scores,
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
  })

  it('查询不存在的 key 应返回 success: true 但 data 为空', { timeout: 60000 }, async () => {
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'NONEXISTENT_KEY',
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    // IndexedDB get() 返回 undefined 而非 null，用 toBeFalsy() 断言
    expect(result.data).toBeFalsy()
  })
})

// ============================================================
// 套件 3: DataBridge.forward 写权限验证（2 用例）
// ============================================================

describe('DataBridge.forward 写权限验证', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    await addTestStock()
  })

  it('stockpool 应能通过 forward 更新 stocks store', { timeout: 60000 }, async () => {
    const envelope = {
      meta: {
        source: MODULE_ID.stockpool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: 'test-forward-update-1',
        timestamp: Date.now(),
      },
      payload: {
        symbol: TEST_STOCK_SYMBOL,
        name: 'forward更新后的名称',
        researchStatus: RESEARCH_STATUS.candidate,
        source: DATA_SOURCE.manual,
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      },
    }
    await dataBridge.forward(envelope)

    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('forward更新后的名称')
  })

  it('stockpool 应能多次 forward 更新同一股票', { timeout: 60000 }, async () => {
    // 第一次更新
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.stockpool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: 'test-forward-multi-1',
        timestamp: Date.now(),
      },
      payload: {
        symbol: TEST_STOCK_SYMBOL,
        name: '第一次更新',
        researchStatus: RESEARCH_STATUS.screened,
        source: DATA_SOURCE.manual,
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      },
    })

    // 第二次更新
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.stockpool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: 'test-forward-multi-2',
        timestamp: Date.now(),
      },
      payload: {
        symbol: TEST_STOCK_SYMBOL,
        name: '第二次更新',
        researchStatus: RESEARCH_STATUS.deepDive,
        source: DATA_SOURCE.manual,
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      },
    })

    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('第二次更新')
    expect(result.data?.researchStatus).toBe(RESEARCH_STATUS.deepDive)
  })
})

// ============================================================
// 套件 4: 所有 ResearchStatus 状态流转（5 用例）
// ============================================================

describe('所有 ResearchStatus 状态流转', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    await addTestStock()
  })

  it('应能存储和查询 candidate 状态的股票', { timeout: 60000 }, async () => {
    await addTestStock({ symbol: 'TEST_CANDIDATE', researchStatus: RESEARCH_STATUS.candidate })
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'TEST_CANDIDATE',
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.researchStatus).toBe(RESEARCH_STATUS.candidate)
  })

  it('应能存储和查询 screened 状态的股票', { timeout: 60000 }, async () => {
    await addTestStock({ symbol: 'TEST_SCREENED', researchStatus: RESEARCH_STATUS.screened })
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'TEST_SCREENED',
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.researchStatus).toBe(RESEARCH_STATUS.screened)
  })

  it('应能存储和查询 deepDive 状态的股票', { timeout: 60000 }, async () => {
    await addTestStock({ symbol: 'TEST_DEEPDIVE', researchStatus: RESEARCH_STATUS.deepDive })
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'TEST_DEEPDIVE',
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.researchStatus).toBe(RESEARCH_STATUS.deepDive)
  })

  it('应能存储和查询 watching 状态的股票', { timeout: 60000 }, async () => {
    await addTestStock({ symbol: 'TEST_WATCHING', researchStatus: RESEARCH_STATUS.watching })
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'TEST_WATCHING',
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.researchStatus).toBe(RESEARCH_STATUS.watching)
  })

  it('应能存储和查询 archived 状态的股票', { timeout: 60000 }, async () => {
    await addTestStock({ symbol: 'TEST_ARCHIVED', researchStatus: RESEARCH_STATUS.archived })
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'TEST_ARCHIVED',
      source: MODULE_ID.stockpool,
    })
    expect(result.success).toBe(true)
    expect(result.data?.researchStatus).toBe(RESEARCH_STATUS.archived)
  })
})

// ============================================================
// 套件 5: ACL 拒绝验证（4 用例）
// ============================================================

describe('ACL 拒绝验证', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    await addTestStock()
  })

  it('fetcher 模块没有 dailyQuotes 的 SELECT 权限（read 不含 dailyQuotes）', { timeout: 60000 }, async () => {
    // 2026-07-12 修正：fetcher.read 已含 stocks（fetchStockBasic/fetchStockKline 需读取现有 stock 合并字段）。
    // 改用 dailyQuotes（fetcher 仅 write 不 read）作为真实拒绝场景。
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.dailyQuotes,
      source: MODULE_ID.fetcher,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('fetcher 模块应能写入并查询 stocks（write + read 权限）', { timeout: 60000 }, async () => {
    // 写入应成功（fetcher.write 包含 stocks，actions 包含 insert）
    await dataBridge.forward({
      meta: {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.insertStock,
        traceId: 'test-fetcher-write',
        timestamp: Date.now(),
      },
      payload: {
        symbol: 'FETCHER001',
        name: 'fetcher写入股票',
        researchStatus: RESEARCH_STATUS.candidate,
        source: DATA_SOURCE.akshare,
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      },
    })

    // 2026-07-12 修正：fetcher.read 已含 stocks，查询应成功
    const queryResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'FETCHER001',
      source: MODULE_ID.fetcher,
    })
    expect(queryResult.success).toBe(true)
    expect(queryResult.data?.name).toBe('fetcher写入股票')

    // stockpool 查询应能验证 fetcher 写入的数据
    const verifyResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: 'FETCHER001',
      source: MODULE_ID.stockpool,
    })
    expect(verifyResult.success).toBe(true)
    expect(verifyResult.data?.name).toBe('fetcher写入股票')
  })

  it('user 模块没有 stocks 的 SELECT 权限（actions 不含 select）', { timeout: 60000 }, async () => {
    const result = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.user,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('system 模块拥有所有 store 的所有权限', { timeout: 60000 }, async () => {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.system,
    })
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.length).toBeGreaterThan(0)
  })
})

// ============================================================
// 套件 6: 缓存与 ACL 一致性（2 用例）
// ============================================================

describe('缓存与 ACL 一致性', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.v6Scores)
    await addTestStock()
  })

  it('invalidateCache 后 stockpool 仍能正确查询', { timeout: 60000 }, async () => {
    // 第一次查询（缓存未命中 → DB → 写入缓存）
    const r1 = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    expect(r1.success).toBe(true)
    expect(r1.data?.symbol).toBe(TEST_STOCK_SYMBOL)

    // 清除缓存
    dataBridge.invalidateCache(STORE_NAME.stocks)

    // 第二次查询（缓存未命中 → DB → 重新写入缓存）
    const r2 = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    expect(r2.success).toBe(true)
    expect(r2.data?.symbol).toBe(TEST_STOCK_SYMBOL)
    expect(r2.data?.name).toBe(TEST_STOCK_NAME)
  })

  it('同一股票连续查询多次结果一致', { timeout: 60000 }, async () => {
    const r1 = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    const r2 = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    const r3 = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: TEST_STOCK_SYMBOL,
      source: MODULE_ID.stockpool,
    })
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(r3.success).toBe(true)
    expect(r1.data?.symbol).toBe(TEST_STOCK_SYMBOL)
    expect(r2.data?.symbol).toBe(TEST_STOCK_SYMBOL)
    expect(r3.data?.symbol).toBe(TEST_STOCK_SYMBOL)
  })
})
