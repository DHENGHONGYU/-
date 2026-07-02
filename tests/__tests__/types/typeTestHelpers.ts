/**
 * 类型级（Type-level）单元测试工具集
 *
 * @description
 * 提供编译期断言工具，用于在不产生运行时开销的前提下，校验类型之间的
 * 赋值兼容性、严格相等与字段可空性。所有断言由 `tsc --noEmit` 校验；
 * vitest 运行期不对这些断言做类型检查（esbuild 仅剥离类型）。
 *
 * 使用方式见 `user-type.spec.ts`。
 *
 * @module tests/__tests__/types/typeTestHelpers
 * @created 2026-07-02 - 类型安全硬约束示例
 */

// ============================================================
// 断言原语
// ============================================================

/**
 * 编译期断言：仅接受 `true`。
 * 传入 `false` 会在编译期触发 "Type 'false' does not satisfy constraint 'true'"。
 */
export type Expect<T extends true> = T

/**
 * 严格相等判定：A 与 B 互为子类型时返回 `true`。
 *
 * 利用泛型函数的逆变特性实现双向（invariant）比较，
 * 区别于单向 `extends` 的赋值兼容判断。
 */
export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

/**
 * 判断 T 是否为 `any`。
 * `any` 会绕过多数类型检查，显式排除可避免假阳性。
 */
export type IsAny<T> = 0 extends 1 & T ? true : false

// ============================================================
// 可空性检测
// ============================================================

/**
 * 提取 T 中「值类型包含 null」的字段名联合类型。
 * - 无任何 null 字段时结果为 `never`。
 * - `-?` 移除可选修饰符，确保 `field?: T | null` 同样被检测。
 *
 * @example
 * type R1 = NullKeys<{ a: string; b: string | null }> // 'b'
 * type R2 = NullKeys<{ a: string; b: number }>          // never
 */
export type NullKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never
}[keyof T]

/**
 * 提取 T 中「值类型包含 undefined」的字段名联合类型（含可选字段）。
 * 用于补充校验「禁止可空字段」的更严格场景。
 */
export type UndefinedKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]

/**
 * 类型级断言辅助函数：当且仅当 T 为 `never` 时通过编译。
 * 用于将「无 null 字段」这类断言转换为可读的函数调用形式。
 * 返回类型标注为 T 以确保类型参数被「读取」（规避 noUnusedLocals/TS6133）。
 *
 * @example
 * assertNever<NullKeys<UserType>>() // 通过 => 无 null 字段
 */
export function assertNever<T extends never>(): T {
  // 运行期无操作；仅在编译期约束 T 必须为 never。
  return null as unknown as T
}
