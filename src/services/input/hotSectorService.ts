import { addStock } from './inputService'
import { dataBridge, ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/core/databridge'
import type { AddStockOptions } from './inputService'
import type { DataLayerResult, Stock } from '@/data/types'

export interface HotSectorStock {
  symbol: string
  name: string
}

export interface HotSector {
  code: string
  name: string
  score: number
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
 * 热门板块样本数据源
 *
 * V9 当前阶段使用配置化样本数据作为热点推荐入口；
 * 后续可替换为 AKShare 板块行情接口或 dataLayer.rotationScores。
 */
const HOT_SECTORS: HotSector[] = [
  {
    code: 'semiconductor',
    name: '半导体',
    score: 82,
    trend: 'up',
    factors: { momentum: 85, fundFlow: 78, valuation: 68, sentiment: 88 },
    stocks: [
      { symbol: '600519.SH', name: '贵州茅台' },
      { symbol: '000001.SZ', name: '平安银行' },
      { symbol: '300750.SZ', name: '宁德时代' },
    ],
  },
  {
    code: 'ai',
    name: '人工智能',
    score: 76,
    trend: 'up',
    factors: { momentum: 80, fundFlow: 72, valuation: 70, sentiment: 82 },
    stocks: [
      { symbol: '002230.SZ', name: '科大讯飞' },
      { symbol: '688256.SH', name: '寒武纪' },
      { symbol: '300418.SZ', name: '昆仑万维' },
    ],
  },
  {
    code: 'new-energy',
    name: '新能源',
    score: 71,
    trend: 'neutral',
    factors: { momentum: 68, fundFlow: 74, valuation: 72, sentiment: 70 },
    stocks: [
      { symbol: '002594.SZ', name: '比亚迪' },
      { symbol: '300014.SZ', name: '亿纬锂能' },
      { symbol: '601012.SH', name: '隆基绿能' },
    ],
  },
  {
    code: 'consumer',
    name: '大消费',
    score: 65,
    trend: 'neutral',
    factors: { momentum: 62, fundFlow: 66, valuation: 74, sentiment: 64 },
    stocks: [
      { symbol: '000858.SZ', name: '五粮液' },
      { symbol: '600887.SH', name: '伊利股份' },
      { symbol: '603288.SH', name: '海天味业' },
    ],
  },
]

/**
 * getHotSectors
 * @returns HotSector[]
 */
export function getHotSectors(): HotSector[] {
  return HOT_SECTORS.map((s) => ({ ...s }))
}

/**
 * getHotSectorByCode
 * @param code
 * @returns HotSector | undefined
 */
export function getHotSectorByCode(code: string): HotSector | undefined {
  return HOT_SECTORS.find((s) => s.code === code)
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
  const sector = getHotSectorByCode(sectorCode)
  if (!sector) {
    return { success: false, error: `未找到热门板块 ${sectorCode}` }
  }

  const result: AddHotSectorStockResult = { added: [], failed: [] }

  for (const stock of sector.stocks) {
    const existsResult = await dataBridge.query<Stock>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.stocks,
      key: stock.symbol,
      source: MODULE_ID.stockpool,
    })
    const exists = existsResult.success && existsResult.data != null
    if (exists) {
      result.failed.push({ symbol: stock.symbol, error: '股票已存在' })
      continue
    }

    const addResult = await addStock(
      { symbol: stock.symbol, name: stock.name },
      { fetchBasicAfterAdd: false, group: options.group },
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
  const sector = getHotSectorByCode(sectorCode)
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
    source: MODULE_ID.stockpool,
  })
  const exists = existsResult.success && existsResult.data != null
  if (exists) {
    return { success: false, error: '股票已存在' }
  }

  return addStock(
    { symbol: stock.symbol, name: stock.name },
    { fetchBasicAfterAdd: false, group: options.group },
  )
}
