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
 * - `Result` 为纯类型，可被 services / core / store 各层引用。
 * - 服务层（services）依赖 lib/errors 符合 AGENTS.md §一 分层白名单。
 */

import { V9Error, toV9Error } from '@/lib/errors'
import { captureError, type ErrorContext } from '@/services/errorBus'

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
