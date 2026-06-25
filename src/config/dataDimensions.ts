/**
 * 七维数据架构配置（V6 Pro 迁移）
 *
 * 定义信息采集与存储的七个维度：
 * 01_basic / 02_kline / 03_chip / 04_events / 05_news / 06_industry / 07_index
 */

export type DataDimensionType =
  | '01_basic'
  | '02_kline'
  | '03_chip'
  | '04_events'
  | '05_news'
  | '06_industry'
  | '07_index'

export interface DataDimensionMeta {
  code: DataDimensionType
  name: string
  description: string
  /** 全量存储 / 轻量化索引 */
  storageStrategy: 'full' | 'lightweight'
  /** 文件命名模式 */
  filePattern: string
}

export const DATA_DIMENSIONS: DataDimensionMeta[] = [
  {
    code: '01_basic',
    name: '基本信息',
    description: '公司资料/行业/股本/股东户数/千股千评',
    storageStrategy: 'full',
    filePattern: '{symbol}_basic.json',
  },
  {
    code: '02_kline',
    name: 'K线数据',
    description: '日/周/月线OHLCV+均线+技术指标',
    storageStrategy: 'full',
    filePattern: '{symbol}_{period}.json',
  },
  {
    code: '03_chip',
    name: '筹码分布',
    description: '股东户数趋势/主力成本/机构参与度',
    storageStrategy: 'full',
    filePattern: '{symbol}_chip.json',
  },
  {
    code: '04_events',
    name: '重大事项',
    description: '公告/财报/业绩快报/分红送转/限售解禁',
    storageStrategy: 'lightweight',
    filePattern: '{symbol}_events.json',
  },
  {
    code: '05_news',
    name: '热点新闻',
    description: '个股新闻标题+摘要+链接/热搜/龙虎榜',
    storageStrategy: 'lightweight',
    filePattern: '{symbol}_news.json',
  },
  {
    code: '06_industry',
    name: '行业竞品',
    description: '行业成分股/估值排名/资金流向/ETF规模',
    storageStrategy: 'full',
    filePattern: '{symbol}_peers.json',
  },
  {
    code: '07_index',
    name: '关联指数',
    description: 'Pearson/Beta/Alpha/R²/ETF规模',
    storageStrategy: 'full',
    filePattern: '{symbol}_index.json',
  },
]

export const DATA_DIMENSION_MAP: Record<DataDimensionType, DataDimensionMeta> = DATA_DIMENSIONS.reduce(
  (map, dim) => {
    map[dim.code] = dim
    return map
  },
  {} as Record<DataDimensionType, DataDimensionMeta>,
)

/** 单维度采集状态 */
export interface DimensionStatus {
  status: 'pending' | 'collecting' | 'completed' | 'failed'
  records: number
  updatedAt: string
  hash?: string
}

/** 单股票元数据 */
export interface StockMeta {
  code: string
  name: string
  market: 'SH' | 'SZ' | 'BJ'
  industry: string
  addedAt: string
  lastCollectTime: string | null
  dimensions: Record<DataDimensionType, DimensionStatus>
}

/** 全局 meta.json 结构 */
export interface GlobalMeta {
  version: string
  schemaVersion: string
  createdAt: string
  lastUpdated: string
  stocks: StockMeta[]
  statistics: {
    totalStocks: number
    totalRecords: number
    totalNews: number
    totalEvents: number
    storageSizeMB: number
  }
}

export function createDefaultMeta(): GlobalMeta {
  return {
    version: '1.0.0',
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    stocks: [],
    statistics: {
      totalStocks: 0,
      totalRecords: 0,
      totalNews: 0,
      totalEvents: 0,
      storageSizeMB: 0,
    },
  }
}

/** 生成空的维度状态 */
export function createEmptyDimensionStatus(): Record<DataDimensionType, DimensionStatus> {
  return DATA_DIMENSIONS.reduce(
    (map, dim) => {
      map[dim.code] = {
        status: 'pending',
        records: 0,
        updatedAt: new Date().toISOString(),
      }
      return map
    },
    {} as Record<DataDimensionType, DimensionStatus>,
  )
}

/** 获取维度文件路径 */
export function getDimensionFilePath(
  dimension: DataDimensionType,
  symbol: string,
  extra?: string,
): string {
  const meta = DATA_DIMENSION_MAP[dimension]
  if (!meta) throw new Error(`未知维度: ${dimension}`)
  let pattern = meta.filePattern
  pattern = pattern.replace('{symbol}', symbol)
  if (extra) pattern = pattern.replace('{period}', extra)
  return `${dimension}/${pattern}`
}

/** 估算单股票七维存储空间（KB） */
export function estimateDimensionStorage(): Record<DataDimensionType, { perStockKB: number; description: string }> {
  return DATA_DIMENSIONS.reduce(
    (map, dim) => {
      const perStockKB = dim.storageStrategy === 'full' ? 100 : 15
      map[dim.code] = {
        perStockKB,
        description: `${dim.name}（${dim.storageStrategy === 'full' ? '全量' : '轻量化'}）`,
      }
      return map
    },
    {} as Record<DataDimensionType, { perStockKB: number; description: string }>,
  )
}
