/**
 * @fileoverview 热门板块评分持久化与查询
 *
 * 从 hotSectorAnalyzer.ts 拆分而来，职责：
 * - 实现 analyzeHotSectors：批量评分并持久化到 dataLayer
 * - 实现 getLatestHotSectorScore：查询最新评分
 *
 * 设计原则：
 * - 持久化通过 DataBridge.forward() 路由，不直接写 db
 * - 动态导入 dataBridge 避免循环依赖（databridge.ts 引用了 hotSectorAnalyzer）
 *
 * @module services/scoring/hotSectorPersistence
 * @created 2026-07-07 - 从 hotSectorAnalyzer.ts 拆分
 */

import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { getDefaultDualStrategyRuleConfig, type DualStrategyRuleConfig } from '@/config/dualStrategyRules'
import { HOT_SECTOR_THRESHOLDS } from '@/config/thresholds'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import type { DataLayerResult, HotSectorScore, Stock, V6Score } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'

// 从 hotSectorOrchestrator 静态导入 analyzeBatch（无循环依赖）
// 编排逻辑已迁移至 hotSectorOrchestrator.ts，避免与 hotSectorAnalyzer.ts (barrel) 形成循环
import { analyzeBatch } from './hotSectorOrchestrator'

const logger = getLogger()

export interface HotSectorAnalyzerOptions {
  ruleConfig?: DualStrategyRuleConfig
}

/**
 * 对股票列表执行热门板块策略分析。
 *
 * 过滤逻辑：
 * - 只保留 V6 评分不低于 hotSectorV6Min 的股票
 * - 为每只股票计算 HotSectorScore 并持久化
 */
export async function analyzeHotSectors(
  stocks: Stock[],
  options: HotSectorAnalyzerOptions = {},
): Promise<DataLayerResult<HotSectorScore[]>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const filtered: string[] = []

  const v6Settled = await Promise.allSettled(
    stocks.map(async (stock) => {
      const result = await dataBridge.query<V6Score>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.v6Scores,
        key: stock.symbol,
      })
      return result.success ? result.data : undefined
    })
  )
  for (let i = 0; i < stocks.length; i++) {
    const result = v6Settled[i]!
    const v6Score = result.status === 'fulfilled' ? result.value : undefined
    if ((v6Score?.score ?? HOT_SECTOR_THRESHOLDS.SCORE_MIN) >= ruleConfig.hotSectorV6Min) {
      filtered.push(stocks[i]!.symbol)
    }
  }

  // 编排逻辑通过 hotSectorOrchestrator 静态导入，已无循环依赖
  const scores = await analyzeBatch(filtered)

  // 写入操作保留原样，通过 DataBridge.forward() 路由
  // TODO[P2]: 迁移至 DataBridge.forward()
  const { dataBridge: dataBridgeDynamic } = await import('@/core/databridge')

  for (const score of scores) {
    if (score.dataVersion == null) {
      logger.warn('[hotSectorAnalyzer] 字段缺失，使用默认值', { field: 'dataVersion', context: `symbol=${score.symbol}` })
    }
    const baseVersion = score.dataVersion ?? 0
    score.dataVersion = baseVersion + 1
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.analyzer,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.saveHotSectorScores,
          traceId: `hs-${nanoid(8)}`,
        },
        score,
      )
      await dataBridgeDynamic.forward(envelope)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[hotSectorAnalyzer] DataBridge.forward failed for ${score.symbol}`, { error: message })
    }
  }

  return { success: true, data: scores }
}

/**
 * 获取指定 symbol 最新的一条 HotSectorScore。
 */
export async function getLatestHotSectorScore(symbol: string): Promise<HotSectorScore | undefined> {
  const result = await dataBridge.query<HotSectorScore>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.hotSectorScores,
    key: symbol,
  })
  return result.success ? result.data : undefined
}
