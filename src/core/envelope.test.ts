/**
 * @test_id V9-TEST-ST-014
 * @covers_docs []
 */
import { describe, it, expect } from 'vitest'
import { EnvelopeFactory, EnvelopeError, type StandardEnvelope } from './envelope'
import { ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'

// ──────────────────────────────────────────────
// EnvelopeError
// ──────────────────────────────────────────────
describe('EnvelopeError', () => {
  it('继承自 Error', () => {
    const err = new EnvelopeError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(EnvelopeError)
  })

  it('name 属性为 EnvelopeError', () => {
    const err = new EnvelopeError('test')
    expect(err.name).toBe('EnvelopeError')
  })

  it('message 属性正确', () => {
    const err = new EnvelopeError('validation failed')
    expect(err.message).toBe('validation failed')
  })
})

// ──────────────────────────────────────────────
// EnvelopeFactory.create
// ──────────────────────────────────────────────
describe('EnvelopeFactory.create', () => {
  it('创建信封时自动填充 timestamp', () => {
    const before = Date.now()
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.analyzer,
        target: ENVELOPE_TARGET.db,
        action: 'INSERT_STOCK',
        traceId: 'trace-001',
      },
      { stockCode: '600519' },
    )
    const after = Date.now()

    expect(envelope.meta.timestamp).toBeGreaterThanOrEqual(before)
    expect(envelope.meta.timestamp).toBeLessThanOrEqual(after)
    expect(envelope.payload).toEqual({ stockCode: '600519' })
  })

  it('可以覆盖 timestamp', () => {
    const fixedTs = 1700000000000
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.analyzer,
        target: ENVELOPE_TARGET.db,
        action: 'INSERT_STOCK',
        traceId: 'trace-002',
        timestamp: fixedTs,
      },
      null,
    )

    expect(envelope.meta.timestamp).toBe(fixedTs)
  })

  it('返回 StandardEnvelope 结构', () => {
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.fetcher,
        target: ENVELOPE_TARGET.ui,
        action: 'SAVE_SCORES',
        traceId: 'trace-003',
      },
      undefined,
    )

    expect(envelope).toHaveProperty('meta')
    expect(envelope).toHaveProperty('payload')
    expect(envelope.meta.source).toBe(MODULE_ID.fetcher)
    expect(envelope.meta.target).toBe(ENVELOPE_TARGET.ui)
    expect(envelope.meta.traceId).toBe('trace-003')
  })
})

// ──────────────────────────────────────────────
// EnvelopeFactory.validate
// ──────────────────────────────────────────────
describe('EnvelopeFactory.validate', () => {
  function makeValidEnvelope(overrides?: Partial<StandardEnvelope>): StandardEnvelope {
    return {
      meta: {
        source: MODULE_ID.analyzer,
        target: ENVELOPE_TARGET.db,
        action: 'SAVE_SCORES',
        traceId: 'trace-001',
        timestamp: Date.now(),
        ...overrides?.meta,
      },
      payload: { data: 'test' },
      ...overrides,
    }
  }

  it('有效信封返回 valid: true', () => {
    const result = EnvelopeFactory.validate(makeValidEnvelope())
    expect(result).toEqual({ valid: true })
  })

  it('非 object 返回 valid: false', () => {
    const result = EnvelopeFactory.validate(null as unknown as StandardEnvelope)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope must be an object')
  })

  it('字符串返回 valid: false', () => {
    const result = EnvelopeFactory.validate('not an object' as unknown as StandardEnvelope)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope must be an object')
  })

  it('缺少 meta 返回 valid: false', () => {
    const result = EnvelopeFactory.validate({ payload: {} } as unknown as StandardEnvelope)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope meta is required')
  })

  it('缺少 source 返回 valid: false', () => {
    const result = EnvelopeFactory.validate(
      makeValidEnvelope({ meta: { source: '' as any, target: ENVELOPE_TARGET.db, action: 'SAVE_SCORES', traceId: 'trace-001', timestamp: Date.now() } }),
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope source is required')
  })

  it('无效 target 返回 valid: false', () => {
    const result = EnvelopeFactory.validate(
      makeValidEnvelope({ meta: { source: MODULE_ID.analyzer, target: 'invalid_target' as any, action: 'SAVE_SCORES', traceId: 'trace-001', timestamp: Date.now() } }),
    )
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid envelope target')
  })

  it('缺少 action 返回 valid: false', () => {
    const result = EnvelopeFactory.validate(
      makeValidEnvelope({ meta: { source: MODULE_ID.analyzer, target: ENVELOPE_TARGET.db, action: '' as any, traceId: 'trace-001', timestamp: Date.now() } }),
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope action is required')
  })

  it('缺少 traceId 返回 valid: false', () => {
    const result = EnvelopeFactory.validate(
      makeValidEnvelope({ meta: { source: MODULE_ID.analyzer, target: ENVELOPE_TARGET.db, action: 'SAVE_SCORES', traceId: '', timestamp: Date.now() } }),
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope traceId is required')
  })

  it('timestamp 非正数返回 valid: false', () => {
    const result = EnvelopeFactory.validate(
      makeValidEnvelope({ meta: { source: MODULE_ID.analyzer, target: ENVELOPE_TARGET.db, action: 'SAVE_SCORES', traceId: 'trace-001', timestamp: 0 } }),
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope timestamp must be a positive number')
  })

  it('timestamp 为负数返回 valid: false', () => {
    const result = EnvelopeFactory.validate(
      makeValidEnvelope({ meta: { source: MODULE_ID.analyzer, target: ENVELOPE_TARGET.db, action: 'SAVE_SCORES', traceId: 'trace-001', timestamp: -1 } }),
    )
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope timestamp must be a positive number')
  })

  it('payload === undefined 返回 valid: false', () => {
    const envelope = makeValidEnvelope()
    ;(envelope as any).payload = undefined
    const result = EnvelopeFactory.validate(envelope)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Envelope payload is required (can be null)')
  })

  it('payload 为 null 时返回 valid: true', () => {
    const result = EnvelopeFactory.validate(makeValidEnvelope({ payload: null }))
    expect(result.valid).toBe(true)
  })
})
