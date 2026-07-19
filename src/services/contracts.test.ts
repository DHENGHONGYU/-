/**
 * @test_id V9-TEST-ST-059
 * @covers_docs []
 */
import { describe, it, expect } from 'vitest'
import {
  ok,
  fail,
  isOk,
  isFail,
  mapResult,
  tryResult,
  tryResultSync,
  BaseService,
  type Result,
  type IService,
} from './contracts'
import { V9Error, ValidationError, toV9Error } from '@/lib/errors'

describe('Result / contracts (S-01)', () => {
  it('ok / fail 构造成功与失败分支', () => {
    const success: Result<number> = ok(42)
    expect(success.ok).toBe(true)
    if (isOk(success)) expect(success.value).toBe(42)

    const failure = fail(new ValidationError('bad', 'symbol'))
    expect(failure.ok).toBe(false)
    if (isFail(failure)) {
      expect(failure.error).toBeInstanceOf(V9Error)
      expect(failure.error.code).toBe('INVALID_SYMBOL')
    }
  })

  it('isOk / isFail 类型守卫', () => {
    expect(isOk(ok('x'))).toBe(true)
    expect(isOk(fail(new V9Error('e')) as Result<string>)).toBe(false)
    expect(isFail(fail(new V9Error('e')))).toBe(true)
    expect(isFail(ok('x') as Result<string>)).toBe(false)
  })

  it('mapResult 仅映射成功分支，失败分支透传', () => {
    const mapped = mapResult(ok(2), (v) => v * 3)
    expect(mapped.ok).toBe(true)
    if (isOk(mapped)) expect(mapped.value).toBe(6)

    const err = fail(new ValidationError('bad'))
    const passthrough = mapResult(err as Result<number>, (v) => v + 1)
    expect(passthrough.ok).toBe(false)
  })

  it('tryResult 成功时返回 ok(value)', async () => {
    const r = await tryResult(async () => 7)
    expect(r.ok).toBe(true)
    if (isOk(r)) expect(r.value).toBe(7)
  })

  it('tryResult 抛错时收敛为 V9Error（非 V9Error 异常被包装）', async () => {
    const r = await tryResult(() => {
      throw new Error('boom')
    })
    expect(r.ok).toBe(false)
    if (isFail(r)) {
      expect(r.error).toBeInstanceOf(V9Error)
      expect(r.error.message).toBe('boom')
    }
  })

  it('tryResult 已为 V9Error 子类时原样保留（含 category / code）', async () => {
    const original = new ValidationError('invalid field', 'price')
    const r = await tryResult(() => {
      throw original
    })
    expect(r.ok).toBe(false)
    if (isFail(r)) {
      expect(r.error).toBe(original)
      expect(r.error.category).toBe('validation')
    }
  })

  it('tryResultSync 同步抛错同样收敛', () => {
    const r = tryResultSync(() => {
      throw new TypeError('t')
    })
    expect(r.ok).toBe(false)
    if (isFail(r)) expect(r.error).toBeInstanceOf(V9Error)
  })

  it('IService 实现可通过 execute 返回 Result', async () => {
    class DoubleService extends BaseService<number, number> {
      readonly name = 'DoubleService'
      async execute(req: number): Promise<Result<number>> {
        return tryResult(() => req * 2)
      }
    }
    const svc: IService<number, number> = new DoubleService()
    expect(svc.name).toBe('DoubleService')
    const r = await svc.execute(21)
    expect(r.ok).toBe(true)
    if (isOk(r)) expect(r.value).toBe(42)

    // 失败路径：execute 内抛错也安全收敛
    class FailingService extends BaseService<void, number> {
      readonly name = 'FailingService'
      async execute(): Promise<Result<number>> {
        return tryResult(() => {
          throw new Error('nope')
        })
      }
    }
    const fr = await new FailingService().execute()
    expect(fr.ok).toBe(false)
    if (isFail(fr)) expect(fr.error).toBeInstanceOf(V9Error)
  })

  it('toV9Error 兜底逻辑与 tryResult 一致', () => {
    const fromString = toV9Error('raw string')
    expect(fromString).toBeInstanceOf(V9Error)
    expect(fromString.message).toContain('raw string')
  })
})
