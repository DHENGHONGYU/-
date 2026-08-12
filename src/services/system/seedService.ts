/**
 * @module services/system/seedService
 * @description 首次启动种子数据服务：默认股票池 8 只标的幂等写入
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023]
 */

import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import { nanoid } from 'nanoid'
import { POOL_TYPE, INTENTION_STATUS } from '@/constants/pool.constants'
import type { Stock } from '@/data/types/types.stock'

const logger = getLogger()

/** 默认种子股票池（8 只覆盖各赛道：白酒/银行/新能源/半导体/医药/消费/周期/互联科技）
 *  pool 映射到项目真实股票池类型（POOL_TYPE.intention = 'intention' / POOL_TYPE.research = 'research'），
 *  researchStatus 使用 INTENTION_STATUS.screening（INTENTION 池初始状态）
 */
export const DEFAULT_STOCKS: Array<
  Pick<Stock, 'symbol' | 'name' | 'pool' | 'group' | 'researchStatus'>
> = [
  { symbol: '600519.SH', name: '贵州茅台', pool: POOL_TYPE.intention, group: 'default', researchStatus: INTENTION_STATUS.screening },
  { symbol: '000001.SZ', name: '平安银行', pool: POOL_TYPE.intention, group: 'default', researchStatus: INTENTION_STATUS.screening },
  { symbol: '300750.SZ', name: '宁德时代', pool: POOL_TYPE.intention, group: 'default', researchStatus: INTENTION_STATUS.screening },
  { symbol: '600584.SH', name: '长电科技', pool: POOL_TYPE.intention, group: 'default', researchStatus: INTENTION_STATUS.screening },
  { symbol: '600276.SH', name: '恒瑞医药', pool: POOL_TYPE.research,  group: 'default', researchStatus: INTENTION_STATUS.screening },
  { symbol: '000858.SZ', name: '五粮液',   pool: POOL_TYPE.research,  group: 'default', researchStatus: INTENTION_STATUS.screening },
  { symbol: '601899.SH', name: '紫金矿业', pool: POOL_TYPE.research,  group: 'default', researchStatus: INTENTION_STATUS.screening },
  { symbol: '0700.HK',   name: '腾讯控股', pool: POOL_TYPE.research,  group: 'default', researchStatus: INTENTION_STATUS.screening },
]

/**
 * 查询 symbol 是否已存在；任何异常或空响应均视作不存在（确保后续写入尝试）
 */
async function stockExists(symbol: string): Promise<boolean> {
  try {
    const res = await dataBridge.query<Stock | null>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: symbol,
      source: MODULE_ID.system,
    })
    return Boolean(res.success && res.data)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.warn('[seedService] stockExists 抛错，视同不存在以继续写入', { symbol, error: errorMsg })
    return false
  }
}

/**
 * 写入单条股票；单条失败不影响其余条目（单条隔离，绝不中断整批）
 */
async function insertStock(
  base: Pick<Stock, 'symbol' | 'name' | 'pool' | 'group' | 'researchStatus'>,
): Promise<{ ok: boolean; err?: string }> {
  const now = Date.now()
  const payload = {
    symbol: base.symbol,
    name: base.name,
    pool: base.pool,
    group: base.group,
    researchStatus: base.researchStatus,
    source: 'manual',
    ingestedAt: now,
    updatedAt: now,
    dataVersion: 1,
  } as Stock
  try {
    await dataBridge.forward({
      meta: {
        action: ENVELOPE_ACTION.insertStock,
        source: MODULE_ID.system,
        target: 'db' as const,
        traceId: `seed-${nanoid(10)}`,
        timestamp: Date.now(),
      },
      payload,
    })
    return { ok: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error('[seedService] insertStock 单条写入失败', { symbol: base.symbol, error: errorMsg })
    return { ok: false, err: errorMsg }
  }
}

/**
 * 幂等写入 DEFAULT_STOCKS；返回计数以便审计/启动日志
 */
export async function seedDefaultStocks(): Promise<{ inserted: number; skipped: number; failed: number }> {
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const stock of DEFAULT_STOCKS) {
    try {
      const exists = await stockExists(stock.symbol)
      if (exists) {
        skipped++
        continue
      }
      const r = await insertStock(stock)
      if (r.ok) inserted++
      else failed++
    } catch (err) {
      failed++
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error('[seedService] seedDefaultStocks 单条流程异常（已被单条隔离）', {
        symbol: stock.symbol,
        error: errorMsg,
      })
    }
  }

  logger.info('[seedService] 默认种子股票池写入完成', { inserted, skipped, failed, total: DEFAULT_STOCKS.length })
  return { inserted, skipped, failed }
}
