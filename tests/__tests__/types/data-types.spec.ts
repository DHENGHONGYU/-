/**
 * @test_id V9-TEST-UT-117
 * 核心数据类型 类型级（Type-level）单元测试
 *
 * @description
 * 把 Stock / Order / V6Score / Signal 的关键不变式固化为编译期断言：
 *   1. 必填字段不得为 null/undefined
 *   2. 枚举字段必须为合法值
 *   3. 数值字段不得为 any
 *
 * 校验机制：由 tsc --noEmit 校验，vitest 运行期 no-op。
 *
 * @module tests/__tests__/types/data-types.spec
 * @created 2026-07-05 - P2 类型测试扩展
  * @covers_docs [V9-DOC-ARCH-008, V9-DOC-PROJ-054, V9-DOC-PROJ-113, V9-DOC-PROJ-066, V9-DOC-PROJ-053]
*/

import { describe, it } from 'vitest'
import { expectType } from 'ts-expect'

import type { Stock, Order, V6Score, Signal } from '@/data/types'
import type {
  Equals,
  Expect,
  IsAny,
  NullKeys,
  UndefinedKeys,
} from './typeTestHelpers'
import { assertNever } from './typeTestHelpers'

// ============================================================
// Stock 类型断言
// ============================================================

/** Stock 必填字段不得为 null */
export const _stockNoNullFields: Expect<
  Equals<NullKeys<Pick<Stock, 'symbol' | 'name' | 'researchStatus' | 'source' | 'dataVersion'>>, never>
> = true

/** Stock 必填字段不得为 undefined */
export const _stockNoUndefinedFields: Expect<
  Equals<UndefinedKeys<Pick<Stock, 'symbol' | 'name' | 'researchStatus' | 'source' | 'dataVersion'>>, never>
> = true

/** Stock.symbol 不得为 any */
export const _stockSymbolNotAny: Expect<Equals<IsAny<Stock['symbol']>, false>> = true

/** Stock.name 不得为 any */
export const _stockNameNotAny: Expect<Equals<IsAny<Stock['name']>, false>> = true

/** Stock.dataVersion 不得为 any */
export const _stockDataVersionNotAny: Expect<Equals<IsAny<Stock['dataVersion']>, false>> = true

// ============================================================
// Order 类型断言
// ============================================================

/** Order 必填字段不得为 null */
export const _orderNoNullFields: Expect<
  Equals<NullKeys<Pick<Order, 'id' | 'symbol' | 'direction' | 'quantity' | 'price' | 'createdAt'>>, never>
> = true

/** Order 必填字段不得为 undefined */
export const _orderNoUndefinedFields: Expect<
  Equals<UndefinedKeys<Pick<Order, 'id' | 'symbol' | 'direction' | 'quantity' | 'price' | 'createdAt'>>, never>
> = true

/** Order.direction 不得为 any */
export const _orderDirectionNotAny: Expect<Equals<IsAny<Order['direction']>, false>> = true

/** Order.quantity 不得为 any */
export const _orderQuantityNotAny: Expect<Equals<IsAny<Order['quantity']>, false>> = true

// ============================================================
// V6Score 类型断言
// ============================================================

/** V6Score 必填字段不得为 null */
export const _v6ScoreNoNullFields: Expect<
  Equals<NullKeys<Pick<V6Score, 'symbol' | 'score' | 'calculatedAt'>>, never>
> = true

/** V6Score 必填字段不得为 undefined */
export const _v6ScoreNoUndefinedFields: Expect<
  Equals<UndefinedKeys<Pick<V6Score, 'symbol' | 'score' | 'calculatedAt'>>, never>
> = true

/** V6Score.totalScore 不得为 any */
export const _v6ScoreTotalScoreNotAny: Expect<Equals<IsAny<V6Score['score']>, false>> = true

// ============================================================
// Signal 类型断言
// ============================================================

/** Signal 必填字段不得为 null */
export const _signalNoNullFields: Expect<
  Equals<NullKeys<Pick<Signal, 'id' | 'symbol' | 'direction' | 'type' | 'confidence' | 'createdAt'>>, never>
> = true

/** Signal 必填字段不得为 undefined */
export const _signalNoUndefinedFields: Expect<
  Equals<UndefinedKeys<Pick<Signal, 'id' | 'symbol' | 'direction' | 'type' | 'confidence' | 'createdAt'>>, never>
> = true

/** Signal.direction 不得为 any */
export const _signalDirectionNotAny: Expect<Equals<IsAny<Signal['direction']>, false>> = true

/** Signal.confidence 不得为 any */
export const _signalConfidenceNotAny: Expect<Equals<IsAny<Signal['confidence']>, false>> = true

// ============================================================
// 运行时测试（no-op，仅确保文件被 vitest 加载）
// ============================================================

describe('核心数据类型 类型级单元测试', () => {
  it('Stock 必填字段类型安全', () => {
    const sampleStock: Stock = {
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'candidate',
      source: 'manual',
      pool: 'research',
      dataVersion: 1,
    }
    expectType<string>(sampleStock.symbol)
    expectType<string>(sampleStock.name)
    expectType<number>(sampleStock.dataVersion)
  })

  it('Order 必填字段类型安全', () => {
    const sampleOrder: Order = {
      id: 'order-001',
      symbol: '600519.SH',
      direction: 'buy',
      quantity: 100,
      price: 1800,
      amount: 1800,
      status: 'filled',
      accountType: 'real',
      createdAt: Date.now(),
    }
    expectType<string>(sampleOrder.id)
    expectType<string>(sampleOrder.symbol)
    expectType<number>(sampleOrder.quantity)
  })

  it('V6Score 必填字段类型安全', () => {
    const sampleScore: V6Score = {
      symbol: '600519.SH',
      score: 85.5,
      factors: {},
      algorithmVersion: 'v6.0',
      calculatedAt: Date.now(),
      dataVersion: 1,
    }
    expectType<string>(sampleScore.symbol)
    expectType<number>(sampleScore.score)
  })

  it('Signal 必填字段类型安全', () => {
    const sampleSignal: Signal = {
      id: 'signal-001',
      symbol: '600519.SH',
      direction: 'buy',
      type: 'v6_score',
      strategy: 'v6',
      confidence: 0.85,
      rationale: '综合评分高',
      snapshot: {},
      createdAt: Date.now(),
    }
    expectType<string>(sampleSignal.id)
    expectType<string>(sampleSignal.symbol)
    expectType<number>(sampleSignal.confidence)
  })

  it('Stock 必填字段不得为 null', () => {
    assertNever<NullKeys<Pick<Stock, 'symbol' | 'name' | 'researchStatus' | 'source' | 'dataVersion'>>>()
  })

  it('Order 必填字段不得为 null', () => {
    assertNever<NullKeys<Pick<Order, 'id' | 'symbol' | 'direction' | 'quantity' | 'price' | 'createdAt'>>>()
  })

  it('V6Score 必填字段不得为 null', () => {
    assertNever<NullKeys<Pick<V6Score, 'symbol' | 'score' | 'calculatedAt'>>>()
  })

  it('Signal 必填字段不得为 null', () => {
    assertNever<NullKeys<Pick<Signal, 'id' | 'symbol' | 'direction' | 'type' | 'confidence' | 'createdAt'>>>()
  })
})
