/**
 * @fileoverview DataBridge 路由辅助函数
 *
 * 从 databridge.ts 拆分（Phase 1: routeToQuery/Event/Manager）。
 * 提取后主文件从 957 行降至 ~780 行，CC 从 100 降至 ~70。
 *
 * Phase 2: 提取 broadcast/subscribe/auditLog → databridgeComm.ts
 * Phase 3: 提取 cache 逻辑 → databridgeCache.ts
 * 目标：主文件 < 400 行，CC < 30
 *
 * @module core/databridgeRouter
 * @since 2026-07-18 (P1-16 Phase 1)
  * @doc [V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008, V9-DOC-BACK-012, V9-DOC-PROJ-002]
*/

import type { StandardEnvelope } from './envelope'
import { ENVELOPE_ACTION, type StoreName } from '@/config/dbConfig'
import { db } from '@/data/db'
import { getLogger } from '@/lib/logger'
import type { QueryRequest } from './databridge'

const logger = getLogger()

// ── routeToQuery 委托接口 ──

interface QueryDelegate {
  query<T = unknown>(request: QueryRequest): Promise<{ success: boolean; data?: T; error?: string }>
}

interface BroadcastDelegate {
  (channel: string, envelope: StandardEnvelope): void
}

// ── routeToQuery ──

/**
 * 路由 Query 动作：构造 QueryRequest → 执行查询 → 广播结果。
 *
 * @dep 需要 DataBridge 实例的 query() 和 broadcast() 方法
 */
export async function routeToQuery(
  envelope: StandardEnvelope,
  store: StoreName,
  queryDelegate: QueryDelegate,
  broadcast: BroadcastDelegate,
): Promise<void> {
  const { meta, payload } = envelope
  logger.info(`[DataBridgeRouter] routeToQuery() called: action="${meta.action}", store="${store}"`)

  const queryRequest: QueryRequest = {
    action: meta.action as QueryRequest['action'],
    store,
    key: payload != null && typeof payload === 'object' && 'key' in payload
      ? String((payload as Record<string, unknown>).key)
      : undefined,
    indexName: payload != null && typeof payload === 'object' && 'indexName' in payload
      ? String((payload as Record<string, unknown>).indexName)
      : undefined,
    indexValue: payload != null && typeof payload === 'object' && 'indexValue' in payload
      ? (payload as Record<string, unknown>).indexValue
      : undefined,
    source: meta.source,
  }

  const result = await queryDelegate.query(queryRequest)

  const newPayload = payload != null && typeof payload === 'object'
    ? { ...(payload as Record<string, unknown>), queryResult: result }
    : { queryResult: result }

  broadcast(`query:${store}`, { meta: envelope.meta, payload: newPayload })

  logger.info(`[DataBridgeRouter] routeToQuery() completed: action="${meta.action}", success=${result.success}`)
}

// ── routeToEvent ──

/**
 * 路由 Event 动作：广播到 event:{action} 和 event:* 两个频道。
 *
 * @dep 需要 DataBridge 实例的 broadcast() 方法
 */
export function routeToEvent(
  envelope: StandardEnvelope,
  broadcast: BroadcastDelegate,
): void {
  const { meta } = envelope
  const eventChannel = `event:${meta.action.toLowerCase()}`
  logger.info(`[DataBridgeRouter] routeToEvent() called: action="${meta.action}", eventChannel="${eventChannel}"`)
  broadcast(eventChannel, envelope)
  broadcast('event:*', envelope)
  logger.info(`[DataBridgeRouter] routeToEvent() completed: action="${meta.action}"`)
}

// ── routeToManager ──

/**
 * 路由 Manager 动作：resetAll / importAll / exportAll。
 *
 * @dep 直接依赖 db 实例进行全量操作
 */
export async function routeToManager(envelope: StandardEnvelope): Promise<void> {
  const { meta } = envelope
  logger.info(`[DataBridgeRouter] routeToManager() called: action="${meta.action}"`)

  try {
    switch (meta.action) {
      case ENVELOPE_ACTION.resetAll: {
        logger.info('[DataBridgeRouter] Manager resetAll: clearing entire database')
        await db.reset()
        break
      }
      case ENVELOPE_ACTION.importAll: {
        const data = envelope.payload as Record<string, unknown[]>
        const tableCount = Object.keys(data).length
        const totalRecords = Object.values(data).reduce((sum, arr) => sum + arr.length, 0)
        logger.info(`[DataBridgeRouter] Manager importAll: ${tableCount} tables, ${totalRecords} records`)
        await db.import(data)
        break
      }
      case ENVELOPE_ACTION.exportAll: {
        logger.info('[DataBridgeRouter] Manager exportAll: exporting all data')
        await db.export()
        break
      }
      default: {
        logger.error(`[DataBridgeRouter] routeToManager() failed: Unknown action "${meta.action}"`)
        throw new Error(`Unknown manager action: ${envelope.meta.action}`)
      }
    }
    logger.info(`[DataBridgeRouter] routeToManager() completed: action="${meta.action}"`)
  } catch (err) {
    logger.error(`[DataBridgeRouter] routeToManager() failed: action="${meta.action}"`, { error: err })
    throw err
  }
}
