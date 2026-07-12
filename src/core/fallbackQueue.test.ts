import { describe, it, expect, beforeEach } from 'vitest'
import { FallbackQueue } from './fallbackQueue'
import type { StandardEnvelope } from './envelope'

function makeEnvelope(id: string): StandardEnvelope {
  return {
    meta: {
      source: 'analyzer' as any,
      target: 'db' as any,
      action: 'SAVE_SCORES' as any,
      traceId: id,
      timestamp: Date.now(),
    },
    payload: { id },
  }
}

// ──────────────────────────────────────────────
// FallbackQueue
// ──────────────────────────────────────────────
describe('FallbackQueue', () => {
  let queue: FallbackQueue

  beforeEach(() => {
    queue = new FallbackQueue()
  })

  it('初始队列为空', () => {
    expect(queue.length).toBe(0)
    expect(queue.peek()).toEqual([])
  })

  it('push 添加一个信封', () => {
    const envelope = makeEnvelope('trace-001')
    queue.push(envelope)
    expect(queue.length).toBe(1)
    expect(queue.peek()).toEqual([envelope])
  })

  it('push 多个信封', () => {
    const e1 = makeEnvelope('trace-001')
    const e2 = makeEnvelope('trace-002')
    const e3 = makeEnvelope('trace-003')

    queue.push(e1)
    queue.push(e2)
    queue.push(e3)

    expect(queue.length).toBe(3)
    expect(queue.peek()).toEqual([e1, e2, e3])
  })

  it('length 返回正确长度', () => {
    expect(queue.length).toBe(0)

    queue.push(makeEnvelope('a'))
    expect(queue.length).toBe(1)

    queue.push(makeEnvelope('b'))
    expect(queue.length).toBe(2)

    queue.drain()
    expect(queue.length).toBe(0)
  })

  it('peek 返回引用但不排空', () => {
    queue.push(makeEnvelope('trace-001'))
    queue.push(makeEnvelope('trace-002'))

    const peeked = queue.peek()
    expect(peeked).toHaveLength(2)

    // 再次 peek 仍然有数据
    expect(queue.peek()).toHaveLength(2)
    expect(queue.length).toBe(2)

    // peek 返回的是内部队列的引用
    expect(peeked).toBe(queue.peek())
  })

  it('drain 排空并返回副本', () => {
    const e1 = makeEnvelope('trace-001')
    const e2 = makeEnvelope('trace-002')
    queue.push(e1)
    queue.push(e2)

    const drained = queue.drain()
    expect(drained).toEqual([e1, e2])

    // drain 后队列为空
    expect(queue.length).toBe(0)
    expect(queue.peek()).toEqual([])

    // 返回的是副本，不是引用
    expect(drained).not.toBe(queue.peek())
  })

  it('clear 清空队列', () => {
    queue.push(makeEnvelope('trace-001'))
    queue.push(makeEnvelope('trace-002'))
    expect(queue.length).toBe(2)

    queue.clear()
    expect(queue.length).toBe(0)
    expect(queue.peek()).toEqual([])
  })

  it('drain 空队列返回空数组', () => {
    const drained = queue.drain()
    expect(drained).toEqual([])
    expect(drained).toHaveLength(0)
  })

  it('多次 drain 只返回当前队列的快照', () => {
    queue.push(makeEnvelope('trace-001'))

    const first = queue.drain()
    expect(first).toHaveLength(1)

    queue.push(makeEnvelope('trace-002'))

    const second = queue.drain()
    expect(second).toHaveLength(1)
    expect(second[0]!.meta.traceId).toBe('trace-002')
  })
})
