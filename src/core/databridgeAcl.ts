/**
 * @fileoverview DataBridge ACL 校验层
 *
 * 从 databridge.ts 抽出，封装与 ACL 相关的所有校验方法。
 * 属于 Phase 1 提取，与 @todo 计划的 Phase 2/3 一致。
 *
 * @module core/databridgeAcl
 */

import { ENVELOPE_ACTION, type DbOperation, type ModuleId, type StoreName } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import { aclEngine } from './acl'
import { EnvelopeError } from './envelope'
import { fallbackQueue } from './fallbackQueue'
import type { StandardEnvelope } from './envelope'

const logger = getLogger()

/**
 * 执行 query 的 ACL 校验，校验失败抛出原错误。
 */
export function assertQueryAcl(source: ModuleId, store: StoreName): void {
  try {
    logger.debug(`[databridgeAcl] query() ACL check: module="${source}", store="${store}", operation="SELECT"`)
    aclEngine.assert({ module: source, store, operation: 'SELECT' })
    logger.info(`[databridgeAcl] query() ACL PASS: module="${source}", store="${store}"`)
  } catch (aclErr) {
    throw aclErr
  }
}

/** queryGet 参数校验：必须提供 key。 */
export function assertQueryGetKey(request: { key?: unknown }): void {
  if (request.key != null) return
  logger.error('[databridgeAcl] queryGet requires key parameter')
  throw new EnvelopeError('queryGet requires key parameter')
}

/** queryByIndex 参数校验：必须提供 indexName + indexValue。 */
export function assertQueryByIndexKey(request: { indexName?: unknown; indexValue?: unknown }): void {
  if (request.indexName != null && request.indexValue !== undefined) return
  logger.error('[databridgeAcl] queryByIndex requires indexName and indexValue')
  throw new EnvelopeError('queryByIndex requires indexName and indexValue parameters')
}

/** 判断是否为市场类 envelope（示例：saveDailyQuotes）。 */
export function isMarketEnvelope(action: string): boolean {
  return action === ENVELOPE_ACTION.saveDailyQuotes
}

/**
 * ACL 校验；若市场类 envelope 被拒绝则入队重试并返回 false，
 * 否则返回 true 表示继续处理。
 */
export async function assertAclWithFallback(
  envelope: StandardEnvelope,
  targetStore: StoreName,
  operation: DbOperation,
): Promise<boolean> {
  const { meta } = envelope
  const source = meta.source as ModuleId

  try {
    aclEngine.assert({ module: source, store: targetStore, operation })
    return true
  } catch (aclErr) {
    // 市场类请求 ACL 拒绝时先放重试队列（限市场类，不阻塞通用流程）
    if (isMarketEnvelope(meta.action)) {
      logger.warn('[databridgeAcl] 市场数据 ACL 拒绝，入队重试', {
        source,
        store: targetStore,
        action: meta.action,
        error: String(aclErr),
      })
      fallbackQueue.push(envelope)
      return false
    }
    // 非市场类直接抛出
    throw aclErr
  }
}
