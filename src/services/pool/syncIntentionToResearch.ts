/**
 * @fileoverview 意向池 → 研究池 晋升同步服务
 *
 * 背景：系统采用「观察/意向/研究/持仓」单一 stocks 记录模型，
 * 每个 symbol 在 IndexedDB `stocks` store 中仅有唯一一条记录，
 * 其 `pool` 字段决定所属池（observation / intention / research / position）。
 * 因此「同步到 researchPool」= 将该记录的 pool 由 'intention' 升为 'research'，
 * 并保留已采集的数据（price/pe/pb/roe 等），属于 funnel 式晋升。
 *
 * 触发时机：意向池标的经采集（fetchBasicDataUseCase）高质量完成后调用。
 * 复用与编排层 ObservationPoolReviewer.enrollToResearchPool 相同语义，
 * 但此处由「采集完成」直接驱动，而非定时复盘。
 *
 * @module services/pool/syncIntentionToResearch
 * @doc [V9-DOC-DATA-031]
 */

import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { POOL_TYPE, RESEARCH_STATUS, DEFAULT_POOL_GROUP } from '@/constants/pool.constants'
import { nanoid } from 'nanoid'
import { getLogger } from '@/lib/logger'
import type { Stock } from '@/data/types'

const logger = getLogger()

/**
 * 将意向池标的晋升到研究池（采集高质量完成后调用）。
 *
 * - 已研究池则直接返回 true（幂等，避免重复写入）。
 * - 先读取现有记录以保留采集到的数据，仅改写 pool / researchStatus / updatedAt。
 * - 经 DataBridge 信封协议落库，与 ACL / 广播保持一致。
 *
 * @param symbol 标的代码
 * @returns 是否成功晋升（已为研究池也返回 true）
 */
export async function syncIntentionToResearch(symbol: string): Promise<boolean> {
  const normalized = symbol.trim().toUpperCase()
  logger.info('[syncIntentionToResearch] 开始', { symbol: normalized })

  try {
    const res = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: normalized,
      source: MODULE_ID.pool,
    })
    if (!res.success || !res.data) {
      logger.warn('[syncIntentionToResearch] 未找到标的，跳过晋升', { symbol: normalized })
      return false
    }

    const stock = res.data
    if (stock.pool === POOL_TYPE.research) {
      logger.info('[syncIntentionToResearch] 已是研究池，幂等跳过', { symbol: normalized })
      return true
    }

    const envelope = EnvelopeFactory.create(
      {
        source: MODULE_ID.pool,
        target: ENVELOPE_TARGET.db,
        action: ENVELOPE_ACTION.updateStock,
        traceId: `promote-research-${nanoid(8)}-${normalized}`,
      },
      {
        symbol: normalized,
        pool: POOL_TYPE.research,
        researchStatus: RESEARCH_STATUS.candidate,
        group: stock.group ?? DEFAULT_POOL_GROUP,
        updatedAt: Date.now(),
      },
    )
    await dataBridge.forward(envelope)
    logger.info('[syncIntentionToResearch] 晋升成功', { symbol: normalized, from: stock.pool, to: 'research' })
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[syncIntentionToResearch] 晋升失败', { symbol: normalized, error: message })
    return false
  }
}
