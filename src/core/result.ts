/**
 * @module core/result
 * @description 统一结果容器 `Result<T>` 的纯类型定义与构造器（分层安全基座）
 *
 * 背景（2026-07-16 架构审查 P0）：
 * 原 `Result` 定义位于 `src/services/contracts.ts`，而 `contracts.ts` 依赖
 * `@/services/errorBus`（services 层），导致 `src/data/queryBuilder.ts` 引用
 * `Result` 时形成 `data → services` 反向依赖，进而与 services 普遍依赖
 * `@/data/*` 构成 **data↔services 循环依赖**，违反单向分层。
 *
 * 解法：将纯类型的 `Result / ok / fail / isOk / isFail / mapResult` 下沉到
 * `core/` 层（可被 data / services / store 各层依赖）。这些构造器仅返回对象
 * 字面量、不实例化任何错误类，因此对 `V9Error` 只需 **类型导入**（`import type`），
 * 符合 AGENTS.md「类型导入豁免跨层检查」的约定，不引入运行时 core→lib 依赖。
 *
 * `src/services/contracts.ts` 现从本模块 re-export，保持所有既有
 * `import { ok, fail, type Result } from '@/services/contracts'` 向后兼容。
  * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
*/

import type { V9Error } from '@/lib/errors'

/**
 * 统一服务结果类型。
 * - 成功分支：`{ ok: true, value }`
 * - 失败分支：`{ ok: false, error }`，error 必为 V9Error 子类
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: V9Error }

/** 构造成功结果 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

/** 构造失败结果 */
export function fail<T = never>(error: V9Error): Result<T> {
  return { ok: false, error }
}

/** 类型守卫：是否为成功结果 */
export function isOk<T>(r: Result<T>): r is { readonly ok: true; readonly value: T } {
  return r.ok
}

/** 类型守卫：是否为失败结果 */
export function isFail<T>(r: Result<T>): r is { readonly ok: false; readonly error: V9Error } {
  return !r.ok
}

/** 对成功分支的值做映射，失败分支原样透传 */
export function mapResult<T, U>(r: Result<T>, fn: (value: T) => U): Result<U> {
  return r.ok ? ok(fn(r.value)) : r
}
