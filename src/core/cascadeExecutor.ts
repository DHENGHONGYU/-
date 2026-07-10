/**
 * @fileoverview 级联策略执行器（cascadeExecutor）
 *
 * 与 DataBridge DeleteHandler 配套。DeleteHandler 在 db.delete() 前调用
 * `cascadeExecutor.execute(store, id)` 执行级联策略检查
 * （CASCADE / RESTRICT / SET_NULL / SOFT_DELETE）。
 *
 * 修复说明（2026-07-08）：原 databridgeHandlers.ts 引用了从未创建的
 * cascadeExecutor / cascade.types，导致所有经 databridge 的测试套件无法加载。
 * 本文件为最小可用实现，用于恢复测试链路。
 *
 * 当前无 cascadeConfig 配置，默认对所有 store 采用 NONE 策略：
 * 不阻止删除、不产生级联目标，直接允许主实体删除。
 * 后续接入 src/config/cascadeConfig.ts 后，可在此读取 store 策略并返回对应
 * targets / 抛出 CascadeError（RESTRICT 阻止删除）。
 */
import type { StoreName } from '@/config/dbConfig'
import type { CascadeResult } from '@/types/modules/cascade.types'

/**
 * cascadeExecutor
 */
export const cascadeExecutor = {
  /**
   * 执行级联策略检查
   * @param _store 目标 store 名称
   * @param _id 待删除主实体 id
   * @returns 级联目标列表（空表示无级联、允许删除）
   */
  async execute(_store: StoreName, _id: string): Promise<CascadeResult> {
    return { targets: [] }
  },
}
