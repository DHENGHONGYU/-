/**
 * @test_id V9-TEST-UT-011
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-BACK-027, V9-DOC-DATA-052, V9-DOC-DATA-042, V9-DOC-DATA-051]
 */
import { describe, it, expect } from 'vitest'
import { DataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { MODULE_ID, ENVELOPE_TARGET, ENVELOPE_ACTION, type EnvelopeAction } from '@/config/dbConfig'

function createMockEnvelope(action: EnvelopeAction = ENVELOPE_ACTION.insertStock) {
  return EnvelopeFactory.create(
    {
      source: MODULE_ID.pool,
      target: ENVELOPE_TARGET.db,
      action,
      traceId: `test-${Date.now()}`,
    },
    { symbol: 'TEST' },
  )
}

describe('DataBridge priority broadcast', () => {
  it('应该broadcast to all subscribers', () => {
    const db = new DataBridge()
    const order: string[] = []
    const mockEnvelope = createMockEnvelope()

    db.subscribe('test', () => order.push('first'))
    db.subscribe('test', () => order.push('second'))

    db.broadcast('test', mockEnvelope)
    expect(order).toEqual(['first', 'second'])
  })

  it('应该maintain registration order', () => {
    const db = new DataBridge()
    const order: string[] = []
    const mockEnvelope = createMockEnvelope()

    db.subscribe('test', () => order.push('first'))
    db.subscribe('test', () => order.push('second'))
    db.subscribe('test', () => order.push('third'))

    db.broadcast('test', mockEnvelope)
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('应该取消订阅 correctly and not execute unsubscribed callback', () => {
    const db = new DataBridge()
    const order: string[] = []
    const mockEnvelope = createMockEnvelope()

    const unsubscribe = db.subscribe('test', () => order.push('should-not-appear'))
    db.subscribe('test', () => order.push('remaining'))

    unsubscribe()

    db.broadcast('test', mockEnvelope)
    expect(order).toEqual(['remaining'])
  })

  it('应该处理空值 subscriber list gracefully', () => {
    const db = new DataBridge()
    const mockEnvelope = createMockEnvelope()

    
    expect(() => db.broadcast('nonexistent-channel', mockEnvelope)).not.toThrow()
  })

  it('应该continue broadcasting when a subscriber throws', () => {
    const db = new DataBridge()
    const order: string[] = []
    const mockEnvelope = createMockEnvelope()

    db.subscribe(
      'test',
      () => {
        order.push('error')
        throw new Error('subscriber error')
      },
    )
    db.subscribe('test', () => order.push('after-error'))

    db.broadcast('test', mockEnvelope)
    expect(order).toEqual(['error', 'after-error'])
  })

  it('应该返回 correct subscriber count after subscribe/unsubscribe', () => {
    const db = new DataBridge()
    const cb1 = () => {}
    const cb2 = () => {}

    const unsub1 = db.subscribe('test', cb1)
    const unsub2 = db.subscribe('test', cb2)

    // @ts-expect-error - accessing private field for testing
    expect(db.subscribers.get('test')?.size).toBe(2)

    unsub1()
    // @ts-expect-error - accessing private field for testing
    expect(db.subscribers.get('test')?.size).toBe(1)

    unsub2()
    // @ts-expect-error - accessing private field for testing
    expect(db.subscribers.get('test')?.size).toBe(0)
  })
})
