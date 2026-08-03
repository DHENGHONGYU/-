/**
 * seedService.test.ts — P0 修复种子数据服务测试
 *
 * 覆盖范围：
 *  1) stockExists 分支（成功 true / data=null / 异常 catch）
 *  2) insertStock 分支（成功 / forward 抛错）
 *  3) seedDefaultStocks 端到端：
 *     - 首次启动，空库 → inserted=8
 *     - 二次启动，已存在 → skipped=8（幂等）
 *     - 第 3 只 forward 失败 → failed=1，其他 7 只照常（单条隔离）
 *     - 混合场景（前 4 存在 / 中间 2 成功 / 后 2 forward 失败）
 *     - stockExists query 抛错 场景（视同不存在，尝试写入）
 *
 * 目标：seedService.ts 覆盖率 → 100% Stmts / Branch / Funcs / Lines
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID } from '@/config/dbConfig'
import { seedDefaultStocks } from './seedService'

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn(),
    forward: vi.fn(),
    init: vi.fn(),
  },
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn((len = 8) => 'A'.repeat(len)),
}))

vi.mock('@/lib/logger', () => {
  const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
  return { getLogger: () => log }
})

type QueryResp<T> = { success: boolean; data: T | null }

const EXPECTED_STOCKS = 8 // DEFAULT_STOCKS 长度

describe('seedService — P0 修复验证 (seedService.ts)', () => {
  const mockedQuery = vi.mocked(dataBridge.query)
  const mockedForward = vi.mocked(dataBridge.forward)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('stockExists 三条分支覆盖', () => {
    it('query success + data 非空 → 幂等 skip', async () => {
      // 第 1 只 → 存在 (skip)；其余 7 只 → 不存在 (insert)
      let q = 0
      mockedQuery.mockImplementation(async () => {
        q++
        if (q === 1) return { success: true, data: { symbol: '600519.SH' } } as QueryResp<any>
        return { success: true, data: null } as QueryResp<any>
      })
      mockedForward.mockResolvedValue(undefined)
      await seedDefaultStocks()
      expect(mockedQuery).toHaveBeenCalledTimes(EXPECTED_STOCKS)
      expect(mockedForward).toHaveBeenCalledTimes(EXPECTED_STOCKS - 1)
    })

    it('query success=true but data=null/undefined → 视同不存在，insert 分支', async () => {
      // data=null 与 data=undefined 两种情况
      let q = 0
      mockedQuery.mockImplementation(async () => {
        q++
        if (q === 1) return { success: true, data: null } as QueryResp<any>
        if (q === 2) return { success: true, data: undefined } as QueryResp<any>
        return { success: true, data: { symbol: `s${q}` } } as QueryResp<any>
      })
      mockedForward.mockResolvedValue(undefined)
      await seedDefaultStocks()
      // 前 2 只 insert，后 6 只 skip
      expect(mockedForward).toHaveBeenCalledTimes(2)
    })

    it('stockExists 内部抛错 → catch 返回 false，进入 insert 分支（不提前退出）', async () => {
      let q = 0
      mockedQuery.mockImplementation(async () => {
        q++
        if (q === 1) throw new Error('IDB 断连')
        if (q === 2) return { success: false, data: null } as QueryResp<any>
        return { success: true, data: { symbol: `s${q}` } } as QueryResp<any>
      })
      mockedForward.mockResolvedValue(undefined)
      await expect(seedDefaultStocks()).resolves.not.toThrow()
      // q=1 (throw → false → insert)；q=2 (success=false → false → insert)；
      // q=3~8 存在 → skip
      expect(mockedForward).toHaveBeenCalledTimes(2)
    })
  })

  describe('insertStock 两条分支覆盖', () => {
    it('insertStock: forward 成功 → inserted++', async () => {
      mockedQuery.mockResolvedValue({ success: true, data: null } as QueryResp<any>)
      mockedForward.mockResolvedValue(undefined)
      await seedDefaultStocks()
      expect(mockedForward).toHaveBeenCalledTimes(EXPECTED_STOCKS)
    })

    it('insertStock: forward 抛错 → catch 记录 error；其他 7 只照常写入', async () => {
      mockedQuery.mockResolvedValue({ success: true, data: null } as QueryResp<any>)
      let f = 0
      mockedForward.mockImplementation(async () => {
        f++
        // 第 3 只失败
        if (f === 3) throw new Error('primary key conflict')
      })
      await expect(seedDefaultStocks()).resolves.not.toThrow()
      expect(mockedForward).toHaveBeenCalledTimes(EXPECTED_STOCKS)
      expect(f).toBe(EXPECTED_STOCKS)
    })
  })

  describe('seedDefaultStocks 端到端场景', () => {
    it('首次启动（空库）→ 8 只全部 insert；Envelope.meta/payload 常量正确', async () => {
      mockedQuery.mockResolvedValue({ success: true, data: null } as QueryResp<any>)
      mockedForward.mockResolvedValue(undefined)
      await seedDefaultStocks()
      expect(mockedQuery).toHaveBeenCalledTimes(EXPECTED_STOCKS)
      expect(mockedForward).toHaveBeenCalledTimes(EXPECTED_STOCKS)

      // 验证第 1 只 (贵州茅台 600519.SH) Envelope 完整
      const env = mockedForward.mock.calls[0]?.[0]
      expect(env).toBeDefined()
      expect(env?.meta?.action).toBe(ENVELOPE_ACTION.insertStock)
      expect(env?.meta?.source).toBe(MODULE_ID.system)
      expect(typeof env?.meta?.traceId).toBe('string')
      expect(env?.meta?.traceId).toMatch(/^seed-/)

      const payload = env?.payload
      expect(payload.symbol).toBe('600519.SH')
      expect(payload.name).toBe('贵州茅台')
      expect(payload.pool).toBeDefined()
      expect(payload.researchStatus).toBeDefined()
      expect(payload.group).toBeDefined()
      expect(payload.source).toBe('manual')
      expect(typeof payload.ingestedAt).toBe('number')
      expect(typeof payload.updatedAt).toBe('number')
      expect(payload.dataVersion).toBe(1)
    })

    it('二次启动（全存在）→ skipped=8，forward 调用 0 次（幂等）', async () => {
      mockedQuery.mockResolvedValue({ success: true, data: { symbol: 'X' } } as QueryResp<any>)
      mockedForward.mockResolvedValue(undefined)
      await seedDefaultStocks()
      expect(mockedQuery).toHaveBeenCalledTimes(EXPECTED_STOCKS)
      expect(mockedForward).toHaveBeenCalledTimes(0)
    })

    it('8 只 forward 全部失败 → 流程仍不抛出，failed=8', async () => {
      mockedQuery.mockResolvedValue({ success: true, data: null } as QueryResp<any>)
      mockedForward.mockRejectedValue(new Error('磁盘只读'))
      await expect(seedDefaultStocks()).resolves.not.toThrow()
      expect(mockedForward).toHaveBeenCalledTimes(EXPECTED_STOCKS)
    })

    it('混合: 前 4 已存在,中间 2 成功,后 2 forward 失败 → forward=4 次', async () => {
      let q = 0
      mockedQuery.mockImplementation(async () => {
        q++
        if (q <= 4) return { success: true, data: { symbol: `s${q}` } } as QueryResp<any>
        return { success: true, data: null } as QueryResp<any>
      })
      let f = 0
      mockedForward.mockImplementation(async () => {
        f++
        // forward 的第 3、4 次（即 q=7、8）失败
        if (f >= 3) throw new Error(`fail #${f}`)
      })
      await expect(seedDefaultStocks()).resolves.not.toThrow()
      expect(mockedQuery).toHaveBeenCalledTimes(EXPECTED_STOCKS)
      expect(mockedForward).toHaveBeenCalledTimes(EXPECTED_STOCKS - 4)
    })
  })
})
