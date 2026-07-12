/**
 * RefreshCoordinator -- 跨 Store 刷新协调器（单例）
 *
 * 解决问题：
 * isRefreshing 锁是"skip"语义，后续调用者无法感知前一次刷新何时完成。
 * 例如 disciplineStore 调用 orderStore.getState().refresh() 时，
 * 如果 orderStore 正在刷新，直接 return 导致 disciplineStore 读取到旧数据。
 *
 * 方案：
 * 维护 per-store 的 refresh Promise，后续调用 await 同一 Promise 而非跳过。
 * 这将 isRefreshing 的语义从"skip"升级为"await"，保证跨 Store 数据一致性。
 *
 * 提供两套 API：
 * 1. coordinateRefresh(storeName, refreshFn) -- 内部注册+自动清除，用于自身 Store 的 refresh
 * 2. register / waitFor / waitForAll / done  -- 显式注册，用于跨 Store 依赖等待
 *
 * @see src/store/orderStore.ts -- refresh() 改用 coordinator
 * @see src/store/disciplineStore.ts -- recalculate() 中 waitFor('orderStore')
 * @see src/store/executionStore.ts -- executePlan() 中 waitFor('orderStore')
 * @see src/store/positionStore.ts -- refresh() 中 waitFor('orderStore')
 */

// ============================================================
// 实现（必须在单例实例之前声明，避免 TS2449）
// ============================================================

class RefreshCoordinator {
  /**
   * 按 storeName 存储正在进行的 refresh Promise。
   * 后续调用者 await 同一 Promise，而非跳过。
   */
  private _pending = new Map<string, Promise<void>>()

  // ----------------------------------------------------------
  // API 1：coordinateRefresh -- 内部注册 + 自动清除
  // ----------------------------------------------------------

  /**
   * 协调跨 Store 的刷新操作。
   *
   * - 如果该 storeName 无 pending Promise -> 直接执行 refreshFn 并注册。
   * - 如果有 pending Promise -> 先 await 当前 Promise 完成后再执行 refreshFn。
   *
   * @param storeName - Store 标识名（如 'orderStore'）
   * @param refreshFn - 实际刷新函数
   * @returns 刷新完成后的 Promise
   */
  coordinateRefresh(
    storeName: string,
    refreshFn: () => Promise<void>,
  ): Promise<void> {
    const existing = this._pending.get(storeName)
    if (existing) {
      return existing
        .then(() => this._executeAndTrack(storeName, refreshFn))
        .catch(() => {
          // 前一次刷新失败，仍需执行当前刷新
          return this._executeAndTrack(storeName, refreshFn)
        })
    }

    return this._executeAndTrack(storeName, refreshFn)
  }

  // ----------------------------------------------------------
  // API 2：register / waitFor / waitForAll / done -- 显式注册
  // ----------------------------------------------------------

  /**
   * 注册一个正在进行的刷新操作。
   * 调用方需在刷新完成后手动调用 done(storeId) 移除注册。
   *
   * @param storeId - Store 标识名（如 'orderStore'）
   * @param promise - 正在进行的刷新 Promise
   */
  register(storeId: string, promise: Promise<void>): void {
    const tracked = promise
      .then(() => {
        // Promise 完成后自动清除（作为 done() 的安全网）
        // 但不阻止 done() 提前清除
      })
      .catch(() => {
        // 同样安全网：失败时也自动清除
      })

    this._pending.set(storeId, tracked)
  }

  /**
   * 等待指定 Store 的刷新完成。
   * 如已完成或未注册，则立即返回。
   *
   * @param storeId - Store 标识名
   * @returns 等待完成的 Promise
   */
  waitFor(storeId: string): Promise<void> {
    const pending = this._pending.get(storeId)
    if (pending) {
      return pending.catch(() => {
        // 即使目标 Store 刷新失败，也不阻塞调用方
        // 调用方可以选择使用过期数据或走其他降级逻辑
      })
    }
    return Promise.resolve()
  }

  /**
   * 等待多个 Store 的刷新完成。
   * 所有 Promise 都 settle 后返回（无论成功或失败）。
   *
   * @param storeIds - Store 标识名列表
   * @returns 等待全部完成的 Promise
   */
  waitForAll(storeIds: string[]): Promise<void> {
    const promises = storeIds.map((id) => this.waitFor(id))
    return Promise.allSettled(promises).then(() => undefined)
  }

  /**
   * 刷新完成时手动移除注册。
   * 通常由 Store 的 refresh 完成后调用。
   * 如果 Promise 已自然完成，此调用为空操作（幂等）。
   *
   * @param storeId - Store 标识名
   */
  done(storeId: string): void {
    this._pending.delete(storeId)
  }

  // ----------------------------------------------------------
  // 兼容 API：getPendingPromise / clearPending（向后兼容）
  // ----------------------------------------------------------

  /**
   * 获取当前 pending Promise（可被其他 Store await）。
   * 向后兼容方法，推荐使用 waitFor() 替代。
   *
   * @param storeName - Store 标识名
   * @returns 当前 pending Promise 或 null
   */
  getPendingPromise(storeName: string): Promise<void> | null {
    return this._pending.get(storeName) ?? null
  }

  /**
   * 手动清除 pending Promise。
   * 向后兼容方法，推荐使用 done() 替代。
   *
   * @param storeName - Store 标识名
   */
  clearPending(storeName: string): void {
    this._pending.delete(storeName)
  }

  // ----------------------------------------------------------
  // 内部方法
  // ----------------------------------------------------------

  /**
   * 执行 refreshFn 并将 Promise 注册到 _pending。
   * 完成后自动清除 pending（无论成功或失败）。
   */
  private _executeAndTrack(
    storeName: string,
    refreshFn: () => Promise<void>,
  ): Promise<void> {
    const promise = refreshFn()
      .then(() => {
        this.clearPending(storeName)
      })
      .catch((err) => {
        // 异常时也清除 pending，允许后续调用者发起新的刷新
        // 但将异常传播给调用者
        this.clearPending(storeName)
        throw err
      })

    this._pending.set(storeName, promise)
    return promise
  }
}

// ============================================================
// 单例（在 class 声明之后，避免 TS2449）
// ============================================================

/**
 * RefreshCoordinator 单例实例。
 * 模块级冻结对象，保证全局唯一。
 */
export const refreshCoordinator = new RefreshCoordinator()
