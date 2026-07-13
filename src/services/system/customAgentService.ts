/**
 * @module customAgentService
 * @description 自定义智能体服务层（阶段 B-1）
 *
 * 职责：
 * - 为 `useCustomAgentStore` 提供 CRUD 接口，避免 Store 直接依赖 `data/` 层。
 * - 内部通过 `dataLayer.customAgents` 访问 IndexedDB（服务层允许依赖 data/）。
 *
 * @compliance
 * - Store 层仅依赖 services/ 与 core/，不再直接引入 @/data/dataLayer。
 * @see src/store/customAgentStore.ts
 */
import { dataLayer } from '@/data/dataLayer'
import type { CustomAgent, CustomAgentType } from '@/data/types'
import type { DataLayerResult } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 加载全部自定义智能体
 */
export async function loadCustomAgents(): Promise<CustomAgent[]> {
  try {
    const list = await dataLayer.customAgents.list()
    logger.info('[customAgentService] loadCustomAgents 成功', { count: list.length })
    return list
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[customAgentService] loadCustomAgents 失败', { error: message })
    throw err
  }
}

/**
 * 按类型加载自定义智能体
 */
export async function loadCustomAgentsByType(type: CustomAgentType): Promise<CustomAgent[]> {
  try {
    const list = await dataLayer.customAgents.listByType(type)
    logger.info('[customAgentService] loadCustomAgentsByType 成功', { type, count: list.length })
    return list
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[customAgentService] loadCustomAgentsByType 失败', { type, error: message })
    throw err
  }
}

/**
 * 按 ID 加载单个自定义智能体
 */
export async function getCustomAgent(id: string): Promise<CustomAgent | undefined> {
  try {
    const agent = await dataLayer.customAgents.get(id)
    logger.info('[customAgentService] getCustomAgent', { id, found: agent != null })
    return agent
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[customAgentService] getCustomAgent 失败', { id, error: message })
    throw err
  }
}

/**
 * 保存/更新自定义智能体
 */
export async function saveCustomAgent(
  agent: Omit<CustomAgent, 'createdAt' | 'updatedAt'> & { createdAt?: number },
): Promise<DataLayerResult<CustomAgent>> {
  try {
    const result = await dataLayer.customAgents.save(agent)
    if (!result.success) {
      logger.error('[customAgentService] saveCustomAgent 失败', { id: agent.id, error: result.error })
      return result
    }
    logger.info('[customAgentService] saveCustomAgent 成功', { id: agent.id })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[customAgentService] saveCustomAgent 异常', { id: agent.id, error: message })
    return { success: false, error: message }
  }
}

/**
 * 删除自定义智能体
 */
export async function deleteCustomAgent(id: string): Promise<DataLayerResult<void>> {
  try {
    const result = await dataLayer.customAgents.remove(id)
    if (!result.success) {
      logger.error('[customAgentService] deleteCustomAgent 失败', { id, error: result.error })
      return result
    }
    logger.info('[customAgentService] deleteCustomAgent 成功', { id })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[customAgentService] deleteCustomAgent 异常', { id, error: message })
    return { success: false, error: message }
  }
}
