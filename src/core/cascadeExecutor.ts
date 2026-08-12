/**
 * @fileoverview 级联策略执行器（cascadeExecutor）
 *
 * 与 DataBridge DeleteHandler 配套。DeleteHandler 在 db.delete() 前调用
 * `cascadeExecutor.execute(store, id)` 执行级联策略检查
 * （CASCADE / RESTRICT / SET_NULL / SOFT_DELETE）。
 *
 * 级联关系定义在 src/config/cascadeConfig.ts 中。
 *
 * 执行流程：
 * 1. 读取 CASCADE_CONFIG 中当前 store 的依赖列表
 * 2. 对每个依赖：查询子记录数量
 * 3. 根据策略执行：
 *    - CASCADE: 立即删除子记录，返回 affectedCount
 *    - RESTRICT: 存在子记录时抛出 CascadeError
 *    - SET_NULL: 将子记录外键置空
 *    - SOFT_DELETE: 标记子记录 deletedAt
 *    - NONE: 跳过
 * 4. 递归处理子 store 的级联（深度优先，避免孤儿数据）
 *
 * @doc [V9-DOC-BACK-005, V9-DOC-BACK-012, V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
 */
import { db } from '@/data/db'
import { getCascadeDependencies } from '@/config/cascadeConfig'
import type { StoreName } from '@/config/dbConfig'
import type { CascadeResult, CascadeTarget, CascadeStrategy } from '@/types/modules/cascade.types'
import { CascadeError } from '@/types/modules/cascade.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 级联执行器
 */
class CascadeExecutor {
  /**
   * 执行级联策略检查与执行
   * @param store 目标 store 名称（父表）
   * @param id 待删除主实体 id
   * @returns 级联目标列表（包含受影响记录数）
   * @throws CascadeError 当 RESTRICT 策略阻止删除时
   */
  async execute(store: StoreName, id: string): Promise<CascadeResult> {
    const targets: CascadeTarget[] = []
    const visited = new Set<string>()

    await this.executeRecursive(store, id, targets, visited)

    if (targets.length > 0) {
      logger.info('[cascadeExecutor] 级联执行完成', {
        store,
        id,
        targetCount: targets.length,
        totalAffected: targets.reduce((s, t) => s + t.affectedCount, 0),
      })
    }

    return { targets }
  }

  /**
   * 递归执行级联（深度优先，先清理最深层子数据）
   */
  private async executeRecursive(
    store: StoreName,
    id: string,
    targets: CascadeTarget[],
    visited: Set<string>,
  ): Promise<void> {
    const dependencies = getCascadeDependencies(store)
    if (dependencies.length === 0) return

    for (const dep of dependencies) {
      const visitKey = `${dep.childStore}:${dep.foreignKey}=${id}`
      if (visited.has(visitKey)) continue
      visited.add(visitKey)

      // 1. 先递归处理子 store 的级联（深度优先）
      await this.executeRecursive(dep.childStore, id, targets, visited)

      // 2. 查询当前层子记录数
      let count = 0
      try {
        const records = await db.getAllByIndex(dep.childStore, dep.indexName, id)
        count = records.length
      } catch (err) {
        // 索引不存在或 store 未就绪，跳过（容错）
        logger.warn('[cascadeExecutor] 查询子记录失败，跳过', {
          parentStore: store,
          childStore: dep.childStore,
          indexName: dep.indexName,
          error: err instanceof Error ? err.message : String(err),
        })
        continue
      }

      if (count === 0) continue

      // 3. 根据策略执行
      const target = await this.applyStrategy(dep.strategy, dep.childStore, dep.indexName, id, count)
      if (target) {
        targets.push(target)
      }
    }
  }

  /**
   * 应用单个级联策略
   */
  private async applyStrategy(
    strategy: CascadeStrategy,
    childStore: StoreName,
    indexName: string,
    value: string,
    count: number,
  ): Promise<CascadeTarget | null> {
    switch (strategy) {
      case 'CASCADE': {
        const deleted = await db.deleteByIndex(childStore, indexName, value)
        return {
          store: childStore,
          strategy: 'CASCADE',
          affectedCount: deleted,
        }
      }

      case 'RESTRICT': {
        if (count > 0) {
          throw new CascadeError(
            `删除被阻止：${childStore} 中存在 ${count} 条关联记录（索引: ${indexName}）`,
          )
        }
        return null
      }

      case 'SET_NULL': {
        // 将外键字段置空
        const records = await db.getAllByIndex<Record<string, unknown>>(childStore, indexName, value)
        for (const record of records) {
          const keyPath = this.getKeyPath(childStore)
          if (keyPath && record[keyPath] !== undefined) {
            const fieldName = this.indexToField(indexName)
            const updated = { ...record, [fieldName]: null }
            await db.put(childStore, updated)
          }
        }
        return {
          store: childStore,
          strategy: 'SET_NULL',
          affectedCount: records.length,
        }
      }

      case 'SOFT_DELETE': {
        const records = await db.getAllByIndex<Record<string, unknown>>(childStore, indexName, value)
        const now = new Date().toISOString()
        for (const record of records) {
          const updated = { ...record, deletedAt: now }
          await db.put(childStore, updated)
        }
        return {
          store: childStore,
          strategy: 'SOFT_DELETE',
          affectedCount: records.length,
        }
      }

      case 'NONE':
      default:
        return null
    }
  }

  /**
   * 索引名转字段名（by-plan → planId）
   */
  private indexToField(indexName: string): string {
    const base = indexName.replace(/^by-/, '')
    // kebab-case 转 camelCase: workflow-id → workflowId
    return base.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  }

  /**
   * 获取 store 的 keyPath（用于 SET_NULL 策略更新记录）
   */
  private getKeyPath(store: StoreName): string | null {
    const idFields: Record<string, string> = {
      execution_logs: 'id',
      score_evidence: 'id',
      news_stock_map: 'id',
      workflow_schedules: 'id',
      workflow_triggers: 'id',
      workflow_runs: 'id',
      rbac_user_roles: 'id',
      rbac_role_permissions: 'id',
    }
    return idFields[store] ?? 'id'
  }
}

export const cascadeExecutor = new CascadeExecutor()
