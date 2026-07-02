/**
 * @module store/helpers/withOptimisticUpdate
 * @lifecycle @Global
 * @description 乐观更新事务边界工具 — 提供统一的 snapshot → apply → rollback 三步流程
 *
 * 解决问题：
 * - tradingStore.ts:173 有局部 snapshot，但全项目无统一 Rollback 机制
 * - 各 Store 各自实现乐观更新，代码重复且行为不一致
 *
 * 使用方式：
 *
 * ```ts
 * import { withOptimisticUpdate } from '@/store/helpers/withOptimisticUpdate'
 *
 * // 在 Store action 中
 * addOrder: async (order) => {
 *   return withOptimisticUpdate(
 *     get,
 *     set,
 *     (draft) => { draft.orders.push(order) },  // 乐观应用
 *     async () => { await dataBridge.forward(envelope) },  // 实际写入
 *     'addOrder',
 *   )
 * }
 * ```
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface OptimisticUpdateResult<T> {
  success: boolean
  data?: T
  error?: string
  rolledBack: boolean
}

/**
 * 执行乐观更新事务
 *
 * @param getStore Store 的 get 函数
 * @param setStore Store 的 set 函数
 * @param applyFn 乐观应用函数（修改 draft 状态，立即反映到 UI）
 * @param commitFn 实际提交函数（异步写入 DB/API）
 * @param operationName 操作名称（用于日志）
 * @returns 事务结果
 */
export async function withOptimisticUpdate<TState, TResult>(
  getStore: () => TState,
  setStore: (updater: (state: TState) => TState) => void,
  applyFn: (state: TState) => void,
  commitFn: () => Promise<TResult>,
  operationName: string,
): Promise<OptimisticUpdateResult<TResult>> {
  // Step 1: 保存快照（深拷贝当前状态用于回滚）
  const snapshot = structuredClone(getStore())

  logger.info(`[withOptimisticUpdate] "${operationName}" — 保存快照`)

  // Step 2: 乐观应用变更
  try {
    setStore((state) => {
      applyFn(state)
      return state
    })
    logger.debug(`[withOptimisticUpdate] "${operationName}" — 乐观应用完成`)
  } catch (err) {
    logger.error(`[withOptimisticUpdate] "${operationName}" — 乐观应用失败`, {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      success: false,
      error: `乐观应用失败: ${err instanceof Error ? err.message : String(err)}`,
      rolledBack: false,
    }
  }

  // Step 3: 实际提交
  try {
    const result = await commitFn()
    logger.info(`[withOptimisticUpdate] "${operationName}" — 提交成功`)
    return {
      success: true,
      data: result,
      rolledBack: false,
    }
  } catch (err) {
    // Step 3b: 提交失败 → 回滚到快照
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error(`[withOptimisticUpdate] "${operationName}" — 提交失败，开始回滚`, {
      error: errorMsg,
    })

    try {
      setStore(() => snapshot)
      logger.info(`[withOptimisticUpdate] "${operationName}" — 回滚完成`)
    } catch (rollbackErr) {
      logger.error(`[withOptimisticUpdate] "${operationName}" — 回滚失败!`, {
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      })
    }

    return {
      success: false,
      error: errorMsg,
      rolledBack: true,
    }
  }
}

/**
 * 轻量级快照工具（不使用 structuredClone，适用于大型状态）
 * 仅保存指定字段的浅拷贝
 */
export function snapshotFields<TState, K extends keyof TState>(
  state: TState,
  fields: K[],
): Pick<TState, K> {
  const snap: Partial<Pick<TState, K>> = {}
  for (const f of fields) {
    snap[f] = Array.isArray(state[f])
      ? [...(state[f] as unknown[])] as TState[K]
      : typeof state[f] === 'object' && state[f] !== null
        ? { ...state[f] } as TState[K]
        : state[f]
  }
  return snap as Pick<TState, K>
}

/**
 * 恢复指定字段（配合 snapshotFields 使用）
 */
export function restoreFields<TState, K extends keyof TState>(
  setStore: (updater: (state: TState) => TState) => void,
  snapshot: Pick<TState, K>,
): void {
  setStore((state) => {
    return { ...state, ...snapshot }
  })
}
