/**
 * @module services/contracts
 * @description S-01：服务接口契约标准化基础类型
 *
 * 提供统一的：
 * - `Result<T>`：服务方法的标准返回容器（成功承载 value，失败承载 V9Error）
 * - `IService<TReq, TRes>`：服务契约统一接口
 * - `tryResult` / `tryResultSync`：将可能抛错的调用安全转换为 Result，
 *   内部经由 `toV9Error` 统一收敛到 `V9Error` 体系（复用 src/lib/errors）
 *
 * 设计原则：
 * - 不新建错误类，复用 `src/lib/errors` 的 `V9Error` 体系，避免重复。
 * - `Result` 及其构造器为纯类型工具，已下沉至 `@/core/result`（core 层），
 *   可被 data / services / store 各层安全引用；本模块 re-export 以保持
 *   既有 `import { ok, fail, type Result } from '@/services/contracts'` 兼容。
 * - services 专属能力（tryResult / IService / BaseService，依赖 errorBus）
 *   仍保留在本模块。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { toV9Error } from '@/lib/errors'
import { captureError, type ErrorContext } from '@/services/errorBus'
import { ok, fail, isOk, isFail, mapResult, type Result } from '@/core/result'

// 纯类型 Result 工具从 core/result 统一导出（破除 data↔services 循环依赖，2026-07-16 P0）
// isOk/isFail/mapResult 在此仅作向后兼容 re-export；ok/fail 另供本模块 tryResult 使用
export { ok, fail, isOk, isFail, mapResult }
export type { Result }

/**
 * 将可能抛错的异步（或同步）调用安全执行为 Result<T>。
 * 任何异常均经 `toV9Error` 收敛为 V9Error；若传入 `context`，
 * 失败还会经 `captureError` 上报全局错误总线（S-02）。
 */
export async function tryResult<T>(
  fn: () => Promise<T> | T,
  context?: ErrorContext,
): Promise<Result<T>> {
  try {
    return ok(await fn())
  } catch (e) {
    const err = toV9Error(e)
    if (context) captureError(err, context)
    return fail(err)
  }
}

/** 同步版本的 tryResult */
export function tryResultSync<T>(fn: () => T, context?: ErrorContext): Result<T> {
  try {
    return ok(fn())
  } catch (e) {
    const err = toV9Error(e)
    if (context) captureError(err, context)
    return fail(err)
  }
}

/**
 * 服务契约统一接口。
 * 所有对外暴露业务能力的 Service 应实现此接口，
 * 使调用方以一致的 `execute(req): Promise<Result<TRes>>` 方式消费。
 */
export interface IService<TReq = void, TRes = unknown> {
  /** 服务名，用于日志与契约注册 */
  readonly name: string
  /** 执行服务，返回统一 Result */
  execute(req: TReq): Promise<Result<TRes>>
}

/**
 * IService 的便捷抽象基类。
 * 子类只需实现 `name` 与 `execute`，即可获得统一契约形态。
 */
export abstract class BaseService<TReq = void, TRes = unknown> implements IService<TReq, TRes> {
  abstract readonly name: string
  abstract execute(req: TReq): Promise<Result<TRes>>
}
