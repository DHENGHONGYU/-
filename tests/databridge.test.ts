import { describe, expect, it, vi } from 'vitest'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { aclEngine, AclError } from '@/core/acl'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION } from '@/config/dbConfig'
import { db } from '@/data/db'
import type { Stock } from '@/data/types'

describe('DataBridge', () => {
  it('should insert a stock through envelope', async () => {
    await db.init()

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

  it('should reject unauthorized module', async () => {
    await db.init()

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
  })

  it('should enqueue rejected market envelope instead of throwing (DF-005)', async () => {
    await db.init()
    await db.reset()

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
