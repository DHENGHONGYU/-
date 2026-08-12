/**
 * 被测类型 Fixture：BaseUser / UserType
 *
 * @description
 * 本代码库（智能投研复盘系统 V9）无用户管理领域类型，此处作为
 * 类型级单元测试的示例被测对象。`UserType` 必须满足两条不变式：
 *   1. 可赋值给 `BaseUser`（是 BaseUser 的超集 / 子类型）；
 *   2. 不包含值为 null 的字段。
 *
 * `user-type.spec.ts` 将把上述不变式固化为编译期断言；
 * 后续修改 `UserType` 时若破坏不变式，`tsc --noEmit` 将直接报错。
 *
 * @module tests/__tests__/types/fixtures/userTypes
 * @created 2026-07-02 - 类型安全硬约束示例
 */

/**
 * 用户基类接口：定义所有用户类型必须具备的最小字段集。
 */
export interface BaseUser {
  id: string
  name: string
  email: string
}

/**
 * 完整用户类型：扩展 BaseUser，新增业务字段。
 *
 * 不变式：
 *   - extends BaseUser => 可赋值给 BaseUser；
 *   - 所有字段均不可为 null（不使用 `| null`）。
 *
 * ⚠️ 破坏示例（会触发 user-type.spec.ts 编译失败）：
 *   department: string | null   // 违反「无 null 字段」
 *   // 移除 id / name / email    // 违反「可赋值给 BaseUser」
 */
export interface UserType extends BaseUser {
  role: 'admin' | 'analyst' | 'viewer'
  createdAt: number
  lastLoginAt: number
  department: string
  isActive: boolean
}
