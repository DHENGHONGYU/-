/**
 * UserType 类型级（Type-level）单元测试
 *
 * @description
 * 把 `UserType` 的两条不变式固化为编译期断言：
 *   1. `UserType` 必须可赋值给 `BaseUser`；
 *   2. `UserType` 不得包含值为 null 的字段。
 *
 * 校验机制：
 *   - 纯类型级断言（`Expect<Equals<...>>`）与 `ts-expect` 的 `expectType`
 *     均由 `tsc --noEmit` 校验。vitest 运行期仅作为 no-op 通过
 *     （esbuild 转译会剥离类型，不做类型检查）。
 *   - 因此本文件的实际「失败信号」出现在 `npm run tsc` / `predev` / `prebuild`。
 *
 * 用法约定：
 *   后续修改 `UserType` 时，可直接要求「请确保修改不破坏 user-type.spec.ts
 *   中的类型测试」，AI 须保持以下断言全部通过编译。
 *
 * @module tests/__tests__/types/user-type.spec
 * @created 2026-07-02 - 类型安全硬约束示例
 */

import { describe, it } from 'vitest'
import { expectType } from 'ts-expect'

import type { BaseUser, UserType } from './fixtures/userTypes'
import type {
  Equals,
  Expect,
  IsAny,
  NullKeys,
  UndefinedKeys,
} from './typeTestHelpers'
import { assertNever } from './typeTestHelpers'

// ============================================================
// 纯类型级断言（由 tsc --noEmit 校验，无运行时产物）
// 导出 const 以规避 noUnusedLocals，并使断言显式可见。
// ============================================================

/** 不变式 1（类型级）：UserType 可赋值给 BaseUser。 */
export const _assignableToBaseUser: Expect<
  UserType extends BaseUser ? true : false
> = true

/** 不变式 1 反向（类型级）：BaseUser 不可赋值给 UserType
 * （UserType 是更具体的子类型，避免误判为相等）。
 * 断言结果为 false，故用 Equals<..., false> 归一化为 true。 */
export const _baseNotAssignableToUser: Expect<
  Equals<BaseUser extends UserType ? true : false, false>
> = true

/** 不变式 2（类型级）：UserType 不含任何 null 字段
 *  => NullKeys<UserType> 必须为 never。 */
export const _noNullFields: Expect<Equals<NullKeys<UserType>, never>> = true

/** 附加：UserType 不为 any（防止 any 绕过所有检查的假阳性）。
 * 断言结果为 false，故用 Equals<..., false> 归一化为 true。 */
export const _userTypeIsNotAny: Expect<Equals<IsAny<UserType>, false>> = true

/** 附加：UserType 不含 undefined 可空字段（更严格的「无可空字段」场景）。 */
export const _noUndefinedFields: Expect<
  Equals<UndefinedKeys<UserType>, never>
> = true

// ============================================================
// ts-expect 断言（运行期 no-op，编译期由 tsc 校验）
// ============================================================

describe('UserType 类型级单元测试', () => {
  // 一个合法的 UserType 样例，供 expectType 使用。
  const sampleUser: UserType = {
    id: 'u-001',
    name: 'Alice',
    email: 'alice@example.com',
    role: 'analyst',
    createdAt: 1_751_424_000_000,
    lastLoginAt: 1_751_424_000_000,
    department: '投研部',
    isActive: true,
  }

  it('UserType 必须可赋值给 BaseUser', () => {
    // 断言 sampleUser（UserType）可作为 BaseUser 使用。
    expectType<BaseUser>(sampleUser)
  })

  it('UserType 不得包含值为 null 的字段', () => {
    // 若存在 null 字段，NullKeys<UserType> 将不再是 never，
    // 此处 expectType<never>(...) 编译期即报错。
    expectType<never>(null as unknown as NullKeys<UserType>)

    // 等价的函数式断言：约束类型参数必须为 never。
    assertNever<NullKeys<UserType>>()
  })

  it('BaseUser 不可赋值给 UserType（确保断言方向正确，非误判为相等）', () => {
    // 反向：BaseUser 缺少 UserType 的扩展字段，不应被当作 UserType。
    // @ts-expect-error — BaseUser 不可赋值给 UserType，此处必须报错
    const _invalid: UserType = {
      id: 'u-002',
      name: 'Bob',
      email: 'bob@example.com',
    } as BaseUser
    expectType<UserType>(_invalid)
  })
})
