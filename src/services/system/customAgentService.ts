/**
 * @module customAgentService
 * @description 自定义智能体服务层（阶段 B-1）
 *
 * 职责：
 * - 为 `useCustomAgentStore` 提供 CRUD 接口，避免 Store 直接依赖 `data/` 层。
 * - 写操作通过 DataBridge.forward() 走信封协议（服务层允许依赖 data/ 读操作）。
 *
 * @compliance
 * - Store 层仅依赖 services/ 与 core/，不再直接引入 @/data/dataLayer。
 * @see src/store/customAgentStore.ts
 */
import { STORE_NAME } from '@/config/dbConfig'
import type { CustomAgent, CustomAgentType } from '@/data/types'
import type { DataLayerResult } from '@/data/types'
import { queryGet, queryList, queryByIndex } from '@/data/dataLayerHelpers'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

const logger = getLogger()

/**
 * 加载全部自定义智能体
 */
export async function loadCustomAgents(): Promise<CustomAgent[]> {
  try {
    const list = await queryList<CustomAgent>(STORE_NAME.customAgents)
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
    const list = await queryByIndex<CustomAgent>(STORE_NAME.customAgents, 'by-type', type)
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
    const agent = await queryGet<CustomAgent>(STORE_NAME.customAgents, id)
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
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.user,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.saveCustomAgent,
        traceId: `custom-agent-${nanoid(8)}-${agent.id}`,
      },
      agent,
    )
    await dataBridge.forward(envelope)
    logger.info('[customAgentService] saveCustomAgent 成功', { id: agent.id })
    return { success: true, data: agent as CustomAgent }
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
    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.user,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.deleteCustomAgent,
        traceId: `custom-agent-del-${nanoid(8)}-${id}`,
      },
      { id },
    )
    await dataBridge.forward(envelope)
    logger.info('[customAgentService] deleteCustomAgent 成功', { id })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[customAgentService] deleteCustomAgent 异常', { id, error: message })
    return { success: false, error: message }
  }
}
