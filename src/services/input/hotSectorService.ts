/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 *
 * 热门板块检索服务（检索层）。
 *
 * 2026-08-09 改造（按 hot-momentum-strategy.md §2.5）：
 * - 废弃硬编码 HOT_SECTORS 样本数组，改为读取 IndexedDB rotationScores store。
 * - "热门"定义 = RotationSectorScore.total（五因子加权 0-100）DESC TOP N。
 * - 字段映射按 §2.5.6：HotSector.code ← sectorCode（申万二级，匹配键）。
 * - getHotSectors/getHotSectorByCode 改为 async（读 store 本就是异步）。
 */
import { addStock } from './inputService'
import { dataBridge, ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/core/databridge'
import type { RotationSectorScore } from '@/data/types'
import type { AddStockOptions } from './inputService'
import type { DataLayerResult, Stock } from '@/data/types'

export interface HotSectorStock {
  symbol: string
  name: string
}

export interface HotSector {
  /** 申万二级板块代码（匹配键，对应 Stock.industryCode）*/
  code: string
  name: string
  /** 板块强度分 0-100（来自 RotationSectorScore.total）*/
  score: number
  /**
   * 评分日期（来自 RotationSectorScore.scoreDate，YYYY-MM-DD）。
   * 用于考核标准中的及时性判定（近一周内视为及时）。
   */
  scoreDate?: string
  trend: 'up' | 'down' | 'neutral'
  factors: {
    momentum: number
    fundFlow: number
    valuation: number
    sentiment: number
  }
  stocks: HotSectorStock[]
}

export type AddHotSectorOptions = AddStockOptions

/**
 * 将 RotationSectorScore 映射为 HotSector（检索层对外契约）。
 * 按 hot-momentum-strategy.md §2.5.6 字段映射表。
 */
function toHotSector(rs: RotationSectorScore): HotSector {
  const total = rs.total ?? 0
  return {
    code: rs.sectorCode,
    name: rs.sectorName,
    score: total,
    scoreDate: rs.scoreDate,
    trend: total >= 70 ? 'up' : total <= 30 ? 'down' : 'neutral',
    factors: {
      // 景气 + 量能 加权作为动量
      momentum: ((rs.f1Jingqi ?? 0) + (rs.f5Nengliang ?? 0)) / 2,
      fundFlow: rs.f2Zijin ?? 0,
      valuation: rs.f3Guzhi ?? 0,
      sentiment: rs.f1Jingqi ?? 0,
    },
    stocks: (rs.poolStocks ?? []).map((s) => ({ symbol: s.symbol, name: s.name })),
  }
}

/**
 * 从 rotationScores store 读取最新评分日期的全部板块记录。
 * 取最大 scoreDate 的那一批，确保跨板块横向可比（同一评分日）。
 */
async function loadLatestRotationScores(): Promise<RotationSectorScore[]> {
  const result = await dataBridge.query<RotationSectorScore[]>({
    action: ENVELOPE_ACTION.queryList,
    store: STORE_NAME.rotationScores,
    source: MODULE_ID.pool,
  })
  const all = result.success ? (result.data ?? []) : []
  if (all.length === 0) return []

  // 找出最新 scoreDate
  const latestDate = all.reduce((max, rs) => {
    return rs.scoreDate > max ? rs.scoreDate : max
  }, all[0]!.scoreDate)

  return all.filter((rs) => rs.scoreDate === latestDate)
}

/**
 * getHotSectors —— 读取最新评分日的板块，按 total DESC 排序返回。
 * @returns HotSector[]（按板块强度分降序）
 */
export async function getHotSectors(): Promise<HotSector[]> {
  const latest = await loadLatestRotationScores()
  return latest
    .map(toHotSector)
    .sort((a, b) => b.score - a.score)
}

/**
 * getHotSectorByCode —— 按板块代码读取最新评分。
 * @param code 申万二级板块代码（如 801120.SW）
 */
export async function getHotSectorByCode(code: string): Promise<HotSector | undefined> {
  const result = await dataBridge.query<RotationSectorScore[]>({
    action: ENVELOPE_ACTION.queryByIndex,
    store: STORE_NAME.rotationScores,
    indexName: 'by-sector',
    indexValue: code,
    source: MODULE_ID.pool,
  })
  const list = result.success ? (result.data ?? []) : []
  if (list.length === 0) return undefined

  const rs = list.sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime())[0]
  return rs ? toHotSector(rs) : undefined
}

export interface AddHotSectorStockResult {
  added: Stock[]
  failed: Array<{ symbol: string; error: string }>
}

/**
 * 将指定热门板块的全部推荐股票加入意向候选池
 */
export async function addHotSectorStocks(
  sectorCode: string,
  options: AddHotSectorOptions = {},
): Promise<DataLayerResult<AddHotSectorStockResult>> {
  const sector = await getHotSectorByCode(sectorCode)
  if (!sector) {
    return { success: false, error: `未找到热门板块 ${sectorCode}` }
  }

  const result: AddHotSectorStockResult = { added: [], failed: [] }

  for (const stock of sector.stocks) {
    const existsResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: stock.symbol,
      source: MODULE_ID.pool,
    })
    const exists = existsResult.success && existsResult.data != null
    if (exists) {
      result.failed.push({ symbol: stock.symbol, error: '股票已存在' })
      continue
    }

    const addResult = await addStock(
      { symbol: stock.symbol, name: stock.name },
      { fetchBasicAfterAdd: false, group: options.group, screenSource: 'hot-sector' },
    )
    if (addResult.success && addResult.data) {
      result.added.push(addResult.data)
    } else {
      result.failed.push({ symbol: stock.symbol, error: addResult.error ?? '加入失败' })
    }
  }

  return { success: true, data: result }
}

/**
 * 将单只热门推荐股票加入意向候选池
 */
export async function addHotSectorStock(
  sectorCode: string,
  symbol: string,
  options: AddHotSectorOptions = {},
): Promise<DataLayerResult<Stock>> {
  const sector = await getHotSectorByCode(sectorCode)
  if (!sector) {
    return { success: false, error: `未找到热门板块 ${sectorCode}` }
  }

  const stock = sector.stocks.find((s) => s.symbol === symbol)
  if (!stock) {
    return { success: false, error: `${symbol} 不在 ${sector.name} 推荐列表中` }
  }

  const existsResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: stock.symbol,
    source: MODULE_ID.pool,
  })
  const exists = existsResult.success && existsResult.data != null
  if (exists) {
    return { success: false, error: '股票已存在' }
  }

  return addStock(
    { symbol: stock.symbol, name: stock.name },
    { fetchBasicAfterAdd: false, group: options.group, screenSource: 'hot-sector' },
  )
}
