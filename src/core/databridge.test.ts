import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataBridge } from '@/core/databridge'
import { EnvelopeFactory, EnvelopeError } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, STORE_NAME, type EnvelopeAction, type ModuleId } from '@/config/dbConfig'
import * as dbModule from '@/data/db'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/data/db', () => ({
  db: {
    isReady: vi.fn(() => true),
    ready: vi.fn(() => Promise.resolve()),
    get: vi.fn(),
    getAll: vi.fn(),
    getAllByIndex: vi.fn(),
    put: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('@/core/acl', () => ({
  aclEngine: {
    assert: vi.fn(),
  },
  inferOperation: vi.fn(() => 'SELECT'),
}))

describe('DataBridge', () => {
  let bridge: DataBridge

  beforeEach(() => {
    bridge = new DataBridge()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('forward()', () => {
    it('throws EnvelopeError for invalid envelope', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.insertStock,
          source: 'stockpool' as ModuleId,
          target: ENVELOPE_TARGET.db,
          traceId: 'test-1',
        },
        { symbol: '600519' },
      )
      const invalidEnvelope = { ...envelope, meta: { ...envelope.meta, source: '' as ModuleId } }

      await expect(bridge.forward(invalidEnvelope)).rejects.toThrow(EnvelopeError)
    })

    it('throws EnvelopeError for unknown action without store mapping', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: 'UNKNOWN_ACTION' as EnvelopeAction,
          source: 'stockpool' as ModuleId,
          target: ENVELOPE_TARGET.db,
          traceId: 'test-2',
        },
        {},
      )

      await expect(bridge.forward(envelope)).rejects.toThrow(EnvelopeError)
    })
  })

  describe('query()', () => {
    it('returns cached result on second identical query', async () => {
      const getAllMock = vi.mocked(dbModule.db.getAll)
      getAllMock.mockResolvedValueOnce([{ id: '1' }])

      const result1 = await bridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: 'stockpool',
      })
      const result2 = await bridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: 'stockpool',
      })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(getAllMock).toHaveBeenCalledTimes(1)
    })

    it('returns error when queryGet misses key', async () => {
      const result = await bridge.query({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        source: 'stockpool',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('queryGet requires key parameter')
    })
  })
})
