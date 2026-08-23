/**
 * @test_id V9-TEST-IT-011
 * @fileoverview DataGateway（src/data/gateway/）契约级集成测试
 *
 * @description
 * 覆盖 v1.7.0 落地的 data/gateway 门面 8 类 API 的真实 IndexedDB 链路：
 *   套件1: 生命周期（isReady/init/ready）
 *   套件2: 基础 CRUD（get/getAll/queryByIndex/put/delete/deleteByIndex）
 *   套件3: 事务管理（runInTransaction 原子性 + runInTransactionWithContext）
 *   套件4: 批量操作（batchPut/clearStore）
 *   套件5: 级联删除（deleteWithCascade 契约形状）
 *   套件6: 数据管理（exportData/importData 往返 + resetAll）
 *   套件7: 工厂方法（createRepository）
 *   套件8: 接口契约（单例一致性 + 公开 API 面完整性）
 *
 * 背景：健康度盘点（2026-08-23）发现 src/data/gateway/ 零测试覆盖，
 * 该层是业务代码访问 IndexedDB 的唯一门面（AGENTS.md v1.7.0 契约），
 * 故以真实存储（非 mock）建立契约基线。
 *
 * @module tests/__tests__/integration/gateway.contract.test
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-ARCH-008]
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { close } from '@/data/db'
import { gateway, getDataGateway } from '@/data/gateway'
import { STORE_NAME, DATA_SOURCE } from '@/config/dbConfig'
import { RESEARCH_STATUS } from '@/constants/pool.constants'
import type { Stock } from '@/data/types'

// ============================================================
// 测试夹具
// ============================================================

/** 标准 A 股 symbol（对齐 isValidSymbolWithExchange 契约：6位数字+.SH/.SZ/.BJ） */
const SYMBOL_A = '600519.SH'
const SYMBOL_B = '000001.SZ'

/** 构造最小可用 Stock 实体 */
function makeStock(symbol: string, name: string, overrides: Partial<Stock> = {}): Stock {
  return {
    symbol,
    name,
    researchStatus: RESEARCH_STATUS.candidate,
    source: DATA_SOURCE.manual,
    dataVersion: 1,
    ingestedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

// ============================================================
// 文件最外层：关闭连接并重置单例，保证串行测试文件间完全隔离
// ============================================================

afterAll(() => {
  close()
})

// ============================================================
// 套件 1: 生命周期
// ============================================================

describe('套件1: Gateway 生命周期', () => {
  it('init() 幂等且 isReady()/ready() 就绪后可用', async () => {
    await gateway.init()
    await gateway.init() // 幂等：重复调用不应抛错
    expect(gateway.isReady()).toBe(true)
    await expect(gateway.ready()).resolves.toBeUndefined()
  }, { timeout: 30000 })

  it('getDataGateway() 应返回与导出单例相同的实例', () => {
    expect(getDataGateway()).toBe(gateway)
  })
})

// ============================================================
// 套件 2: 基础 CRUD
// ============================================================

describe('套件2: 基础 CRUD', () => {
  beforeEach(async () => {
    await gateway.init()
    await gateway.resetAll()
  })

  it('put + get：写入后按主键读取一致', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    const got = await gateway.get<Stock>(STORE_NAME.stocks, SYMBOL_A)
    expect(got).toBeDefined()
    expect(got?.name).toBe('贵州茅台')
  }, { timeout: 30000 })

  it('get：不存在的键返回 undefined', async () => {
    const got = await gateway.get<Stock>(STORE_NAME.stocks, '999999.SH')
    expect(got).toBeUndefined()
  }, { timeout: 30000 })

  it('getAll：返回全部记录', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_B, '平安银行'))
    const all = await gateway.getAll<Stock>(STORE_NAME.stocks)
    expect(all.length).toBe(2)
  }, { timeout: 30000 })

  it('queryByIndex：按 by-status 索引查询', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_B, '平安银行', {
      researchStatus: RESEARCH_STATUS.screened,
    }))
    const candidates = await gateway.queryByIndex<Stock>(
      STORE_NAME.stocks, 'by-status', RESEARCH_STATUS.candidate,
    )
    expect(candidates.length).toBe(1)
    expect(candidates[0]!.symbol).toBe(SYMBOL_A)
  }, { timeout: 30000 })

  it('put 覆盖写：同键再次写入为更新语义', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台(更新)'))
    const all = await gateway.getAll<Stock>(STORE_NAME.stocks)
    expect(all.length).toBe(1)
    expect(all[0]!.name).toBe('贵州茅台(更新)')
  }, { timeout: 30000 })

  it('delete：按主键删除后不可读', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.delete(STORE_NAME.stocks, SYMBOL_A)
    const got = await gateway.get<Stock>(STORE_NAME.stocks, SYMBOL_A)
    expect(got).toBeUndefined()
  }, { timeout: 30000 })

  it('deleteByIndex：按索引批量删除并返回受影响数量', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_B, '平安银行', {
      researchStatus: RESEARCH_STATUS.screened,
    }))
    const removed = await gateway.deleteByIndex(
      STORE_NAME.stocks, 'by-status', RESEARCH_STATUS.candidate,
    )
    expect(removed).toBe(1)
    const remaining = await gateway.getAll<Stock>(STORE_NAME.stocks)
    expect(remaining.length).toBe(1)
    expect(remaining[0]!.symbol).toBe(SYMBOL_B)
  }, { timeout: 30000 })
})

// ============================================================
// 套件 3: 事务管理
// ============================================================

describe('套件3: 事务管理', () => {
  beforeEach(async () => {
    await gateway.init()
    await gateway.resetAll()
  })

  it('runInTransaction：回调返回值透传且写入持久化', async () => {
    const result = await gateway.runInTransaction(
      [STORE_NAME.stocks],
      'readwrite',
      async (tx) => {
        const store = tx.objectStore(STORE_NAME.stocks)
        store.put(makeStock(SYMBOL_A, '贵州茅台'))
        return 'committed'
      },
    )
    expect(result).toBe('committed')
    const got = await gateway.get<Stock>(STORE_NAME.stocks, SYMBOL_A)
    expect(got).toBeDefined()
  }, { timeout: 30000 })

  it('runInTransaction：回调抛错时整个事务回滚（原子性）', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await expect(
      gateway.runInTransaction([STORE_NAME.stocks], 'readwrite', async (tx) => {
        const store = tx.objectStore(STORE_NAME.stocks)
        store.delete(SYMBOL_A)
        throw new Error('模拟事务内失败')
      }),
    ).rejects.toThrow('模拟事务内失败')
    // 回滚：删除不应生效
    const got = await gateway.get<Stock>(STORE_NAME.stocks, SYMBOL_A)
    expect(got).toBeDefined()
  }, { timeout: 30000 })

  it('runInTransactionWithContext：事务内 put/get/getAll 读写一致', async () => {
    const count = await gateway.runInTransactionWithContext(
      [STORE_NAME.stocks],
      'readwrite',
      async (ctx) => {
        await ctx.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
        await ctx.put(STORE_NAME.stocks, makeStock(SYMBOL_B, '平安银行'))
        const single = await ctx.get<Stock>(STORE_NAME.stocks, SYMBOL_A)
        expect(single?.name).toBe('贵州茅台')
        const all = await ctx.getAll<Stock>(STORE_NAME.stocks)
        return all.length
      },
    )
    expect(count).toBe(2)
  }, { timeout: 30000 })

  it('runInTransactionWithContext：事务内 queryByIndex/delete 可用', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_B, '平安银行', {
      researchStatus: RESEARCH_STATUS.screened,
    }))
    await gateway.runInTransactionWithContext(
      [STORE_NAME.stocks],
      'readwrite',
      async (ctx) => {
        const screened = await ctx.queryByIndex<Stock>(
          STORE_NAME.stocks, 'by-status', RESEARCH_STATUS.screened,
        )
        expect(screened.length).toBe(1)
        await ctx.delete(STORE_NAME.stocks, SYMBOL_B)
      },
    )
    const remaining = await gateway.getAll<Stock>(STORE_NAME.stocks)
    expect(remaining.length).toBe(1)
  }, { timeout: 30000 })
})

// ============================================================
// 套件 4: 批量操作
// ============================================================

describe('套件4: 批量操作', () => {
  beforeEach(async () => {
    await gateway.init()
    await gateway.resetAll()
  })

  it('batchPut：批量写入全部可见', async () => {
    await gateway.batchPut(STORE_NAME.stocks, [
      makeStock(SYMBOL_A, '贵州茅台'),
      makeStock(SYMBOL_B, '平安银行'),
    ])
    const all = await gateway.getAll<Stock>(STORE_NAME.stocks)
    expect(all.length).toBe(2)
  }, { timeout: 30000 })

  it('clearStore：清空后为空数组', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.clearStore(STORE_NAME.stocks)
    const all = await gateway.getAll<Stock>(STORE_NAME.stocks)
    expect(all.length).toBe(0)
  }, { timeout: 30000 })
})

// ============================================================
// 套件 5: 级联删除契约
// ============================================================

describe('套件5: 级联删除契约', () => {
  beforeEach(async () => {
    await gateway.init()
    await gateway.resetAll()
  })

  it('deleteWithCascade：返回 { targets: CascadeTargetResult[] } 契约形状', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    const result = await gateway.deleteWithCascade(STORE_NAME.stocks, SYMBOL_A)
    expect(result).toHaveProperty('targets')
    expect(Array.isArray(result.targets)).toBe(true)
    for (const target of result.targets) {
      expect(target).toHaveProperty('store')
      expect(target).toHaveProperty('strategy')
      expect(target).toHaveProperty('affectedCount')
    }
  }, { timeout: 30000 })
})

// ============================================================
// 套件 6: 数据管理
// ============================================================

describe('套件6: 数据管理', () => {
  beforeEach(async () => {
    await gateway.init()
    await gateway.resetAll()
  })

  it('exportData + importData：导出后清空再导入，数据一致', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    const exported = await gateway.exportData()
    expect(Object.keys(exported).length).toBeGreaterThan(0)
    expect(exported[STORE_NAME.stocks]?.length).toBe(1)

    await gateway.clearStore(STORE_NAME.stocks)
    await gateway.importData(exported)
    const restored = await gateway.get<Stock>(STORE_NAME.stocks, SYMBOL_A)
    expect(restored?.name).toBe('贵州茅台')
  }, { timeout: 60000 })

  it('resetAll：清空全部 store', async () => {
    await gateway.put(STORE_NAME.stocks, makeStock(SYMBOL_A, '贵州茅台'))
    await gateway.resetAll()
    const all = await gateway.getAll<Stock>(STORE_NAME.stocks)
    expect(all.length).toBe(0)
  }, { timeout: 60000 })
})

// ============================================================
// 套件 7: 工厂方法
// ============================================================

describe('套件7: createRepository 工厂', () => {
  beforeAll(async () => {
    await gateway.init()
    await gateway.resetAll()
  })

  it('Repository put/get/getAll/delete 契约闭环', async () => {
    const repo = gateway.createRepository<Stock>({
      store: STORE_NAME.stocks,
      writeAction: 'insertStock',
      deleteAction: 'deleteStock',
      // DeleteStockHandler 期望载荷为 { symbol }，需显式指定删除键字段
      deleteKeyField: 'symbol',
      keyOf: (s) => s.symbol,
    })
    expect(repo.store).toBe(STORE_NAME.stocks)

    const putResult = await repo.put(makeStock(SYMBOL_A, '贵州茅台'), SYMBOL_A)
    expect(putResult, `put 失败: ${putResult.error ?? '未知'}`).toEqual({ success: true })

    const got = await repo.get(SYMBOL_A)
    expect(got?.name).toBe('贵州茅台')

    const all = await repo.getAll()
    expect(all.length).toBe(1)

    const delResult = await repo.delete(SYMBOL_A)
    expect(delResult, `delete 失败: ${delResult.error ?? '未知'}`).toEqual({ success: true })
    const afterDelete = await repo.get(SYMBOL_A)
    expect(afterDelete).toBeUndefined()
  }, { timeout: 30000 })
})

// ============================================================
// 套件 8: 接口契约（公开 API 面完整性）
// ============================================================

describe('套件8: Gateway 接口契约', () => {
  /** IGateway 契约定义的完整方法面（对齐 src/data/gateway/gateway.types.ts） */
  const I_GATEWAY_METHODS = [
    'isReady', 'init', 'ready',
    'runInTransaction', 'runInTransactionWithContext',
    'get', 'getAll', 'queryByIndex', 'put', 'delete', 'deleteByIndex',
    'batchPut', 'clearStore',
    'deleteWithCascade',
    'resetAll', 'exportData', 'importData',
    'createRepository',
  ] as const

  it('单例应完整实现 IGateway 全部 18 个方法', () => {
    for (const method of I_GATEWAY_METHODS) {
      expect(typeof (gateway as unknown as Record<string, unknown>)[method]).toBe('function')
    }
  })
})
