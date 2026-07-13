import { describe, expect, it, vi, beforeEach } from 'vitest'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { aclEngine, AclError } from '@/core/acl'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { db } from '@/data/db'
import type { Stock } from '@/data/types'

describe('DataBridge', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    // 清除缓存以确保测试隔离
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  it('应该insert a stock through envelope', async () => {
    const stock: Stock = {
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'candidate',
      source: 'manual',
      dataVersion: 1,
      ingestedAt: Date.now(),
      updatedAt: Date.now(),
    }

    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.stockpool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.insertStock,
        traceId: 'test-1',
      },
      stock,
    )

    await dataBridge.forward(envelope)

    const result = await db.get<Stock>('stocks', '600519.SH')
    expect(result).toBeDefined()
    expect(result?.name).toBe('贵州茅台')
  })

  it('应该reject unauthorized module', async () => {
    vi.spyOn(aclEngine, 'assert').mockImplementation(() => {
      throw new AclError('mock ACL rejection')
    })

    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.deleteStock,
        traceId: 'test-2',
      },
      { symbol: '600519.SH' },
    )

    await expect(dataBridge.forward(envelope)).rejects.toThrow()
    vi.restoreAllMocks()
  })

  it('应该enqueue rejected market envelope instead of throwing (DF-005)', async () => {
    const spy = vi.spyOn(aclEngine, 'assert').mockImplementation(({ store }) => {
      if (store === 'daily_quotes') {
        throw new AclError('mock ACL rejection')
      }
    })

    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveDailyQuotes,
        traceId: 'test-fallback',
      },
      {
        symbol: '000001.SZ',
        latest: {
          date: '2026-06-24',
          open: 12,
          high: 12.5,
          low: 11.8,
          close: 12.3,
          volume: 12345,
          amount: 151843.5,
        },
        history: [],
        period: 'daily',
        adjust: 'qfq',
        updatedAt: Date.now(),
      },
    )

    await expect(dataBridge.forward(envelope)).resolves.toBeUndefined()
    expect(dataBridge.failedEnvelopes).toHaveLength(1)
    expect(dataBridge.failedEnvelopes[0]?.meta.action).toBe(ENVELOPE_ACTION.saveDailyQuotes)

    spy.mockRestore()

    const result = await dataBridge.retryFailed()
    expect(result.success).toBe(1)
    expect(result.failed).toBe(0)
    expect(dataBridge.failedEnvelopes).toHaveLength(0)
  })
})

describe('DataBridge.query()', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    // 清除缓存以确保测试隔离
    dataBridge.invalidateCache(STORE_NAME.stocks)
  })

  describe('缓存命中场景', () => {
    it('queryGet 应该从缓存返回数据（第二次查询）', async () => {
      // 准备测试数据
      const stock: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock)

      // 第一次查询（缓存未命中）
      const result1 = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })

      expect(result1.success).toBe(true)
      expect(result1.data?.symbol).toBe('000001.SZ')

      // 第二次查询（应该命中缓存）
      const result2 = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })

      expect(result2.success).toBe(true)
      expect(result2.data?.symbol).toBe('000001.SZ')
    })

    it('queryList 应该从缓存返回列表（第二次查询）', async () => {
      // 准备测试数据
      const stocks: Stock[] = [
        {
          symbol: '000001.SZ',
          name: '平安银行',
          researchStatus: 'candidate',
          source: 'manual',
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          symbol: '000002.SZ',
          name: '万科A',
          researchStatus: 'watching',
          source: 'manual',
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]
      for (const stock of stocks) {
        await db.put('stocks', stock)
      }

      // 第一次查询
      const result1 = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.datalayer,
      })

      expect(result1.success).toBe(true)
      expect(result1.data).toHaveLength(2)

      // 第二次查询（应该命中缓存）
      const result2 = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.datalayer,
      })

      expect(result2.success).toBe(true)
      expect(result2.data).toHaveLength(2)
    })
  })

  describe('缓存失效场景', () => {
    it('写操作后应该清除缓存，下次查询返回新数据', async () => {
      // 准备初始数据
      const stock1: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock1)

      // 第一次查询（缓存数据）
      const result1 = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })
      expect(result1.success).toBe(true)
      expect(result1.data?.name).toBe('平安银行')

      // 执行写操作（通过 forward）
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.stockpool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: 'test-update',
        },
        { symbol: '000001.SZ', name: '平安银行（更新）' },
      )
      await dataBridge.forward(envelope)

      // 第二次查询（应该返回更新后的数据，缓存已失效）
      const result2 = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })
      expect(result2.success).toBe(true)
      expect(result2.data?.name).toBe('平安银行（更新）')
    })

    it('invalidateCache 应该清除指定 store 的缓存', async () => {
      // 准备数据并查询（填充缓存）
      const stock: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock)

      await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })

      // 手动清除缓存
      dataBridge.invalidateCache(STORE_NAME.stocks)

      // 修改数据库中的数据
      const updatedStock = { ...stock, name: '平安银行（手动更新）' }
      await db.put('stocks', updatedStock)

      // 再次查询（应该返回新数据，因为缓存已清除）
      const result = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })
      expect(result.success).toBe(true)
      expect(result.data?.name).toBe('平安银行（手动更新）')
    })
  })

  describe('ACL 权限校验场景', () => {
    it('datalayer 模块应该有所有 store 的读权限', async () => {
      const stock: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock)

      const result = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })

      expect(result.success).toBe(true)
      expect(result.data?.symbol).toBe('000001.SZ')
    })

    it('未授权模块查询应该返回失败', async () => {
      const stock: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock)

      // 使用未授权的模块（user 没有 stocks 的读权限）
      const result = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.user, // 2026-07-12 修正：fetcher.read 已含 stocks，改用 user 作为未授权模块
      })

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/cannot|not allowed/i)
    })

    it('system 模块应该有所有 store 的读权限', async () => {
      const stock: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock)

      const result = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.system,
      })

      expect(result.success).toBe(true)
      expect(result.data?.symbol).toBe('000001.SZ')
    })
  })

  describe('查询类型场景', () => {
    it('queryGet 应该按主键查询单条记录', async () => {
      const stock: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock)

      const result = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })

      expect(result.success).toBe(true)
      expect(result.data?.symbol).toBe('000001.SZ')
      expect(result.data?.name).toBe('平安银行')
    })

    it('queryList 应该查询所有记录', async () => {
      const stocks: Stock[] = [
        {
          symbol: '000001.SZ',
          name: '平安银行',
          researchStatus: 'candidate',
          source: 'manual',
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          symbol: '000002.SZ',
          name: '万科A',
          researchStatus: 'watching',
          source: 'manual',
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]
      for (const stock of stocks) {
        await db.put('stocks', stock)
      }

      const result = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.datalayer,
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('queryByIndex 应该按索引查询记录', async () => {
      const stocks: Stock[] = [
        {
          symbol: '000001.SZ',
          name: '平安银行',
          researchStatus: 'candidate',
          source: 'manual',
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          symbol: '000002.SZ',
          name: '万科A',
          researchStatus: 'candidate',
          source: 'manual',
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          symbol: '000003.SZ',
          name: '国农科技',
          researchStatus: 'watching',
          source: 'manual',
          dataVersion: 1,
          ingestedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]
      for (const stock of stocks) {
        await db.put('stocks', stock)
      }

      const result = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.stocks,
        indexName: 'by-status',
        indexValue: 'candidate',
        source: MODULE_ID.datalayer,
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data?.every((s) => s.researchStatus === 'candidate')).toBe(true)
    })

    it('queryGet 缺少 key 参数应该返回失败', async () => {
      const result = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        // 缺少 key 参数
        source: MODULE_ID.datalayer,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('key')
    })

    it('queryByIndex 缺少 indexName 参数应该返回失败', async () => {
      const result = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.stocks,
        // 缺少 indexName 和 indexValue
        source: MODULE_ID.datalayer,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('indexName')
    })
  })

  describe('审计日志场景', () => {
    it('查询操作应该记录审计日志', async () => {
      const stock: Stock = {
        symbol: '000001.SZ',
        name: '平安银行',
        researchStatus: 'candidate',
        source: 'manual',
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('stocks', stock)

      await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: '000001.SZ',
        source: MODULE_ID.datalayer,
      })

      // 等待审计日志异步写入
      await new Promise((resolve) => setTimeout(resolve, 100))

      // 查询审计日志
      const logs = await db.getAll('research_logs')
      expect(logs.length).toBeGreaterThan(0)
      const queryLog = logs.find((log: any) => log.action === ENVELOPE_ACTION.queryGet)
      expect(queryLog).toBeDefined()
      expect((queryLog as Record<string, unknown>).actor).toBe(MODULE_ID.datalayer)
      expect((queryLog as Record<string, unknown>).targetType).toBe(STORE_NAME.stocks)
    })
  })
})
