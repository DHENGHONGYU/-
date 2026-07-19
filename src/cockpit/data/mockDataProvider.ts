/**
 * @doc []
 */
export interface MarketIndex {
  name: string
  code: string
  value: number
  change: number
  changePercent: number
  high: number
  low: number
  volume: string
  pe: number
}

export interface SectorData {
  name: string
  code: string
  changePercent: number
}

export interface FundFlow {
  type: 'main' | 'retail' | 'north'
  name: string
  value: number
  unit: string
}

export interface MarketSentiment {
  fearGreedIndex: number
  fearGreedLabel: string
  totalStocks: number
  up: number
  down: number
  flat: number
  limitUp: number
  limitDown: number
  upOver5Percent: number
  downOver5Percent: number
}

export interface WatchlistStock {
  name: string
  code: string
  price: number
  changePercent: number
}

export interface PortfolioStats {
  totalAssets: string
  availableFunds: string
  todayPnL: string
  todayPnLPercent: number
  totalPnL: string
  totalPnLPercent: number
  holdings: number
  maxDrawdown: number
  sharpeRatio: number
}

export interface TradeReview {
  totalTrades: number
  profitable: number
  losing: number
  winRate: number
  profitLossRatio: number
  disciplineScore: number
}

/**
 * mockMarketIndices
 */
export const mockMarketIndices: MarketIndex[] = [
  {
    name: '上证指数',
    code: '000001',
    value: 3258.45,
    change: -21.55,
    changePercent: -0.66,
    high: 3340.64,
    low: 3258.45,
    volume: '3691亿',
    pe: 13.2,
  },
  {
    name: '深证成指',
    code: '399001',
    value: 10402.55,
    change: -97.45,
    changePercent: -0.93,
    high: 10612.52,
    low: 10402.55,
    volume: '1202亿',
    pe: 22.5,
  },
  {
    name: '创业板指',
    code: '399006',
    value: 2168.84,
    change: 18.84,
    changePercent: 0.88,
    high: 2168.84,
    low: 2129.14,
    volume: '3246亿',
    pe: 32.8,
  },
  {
    name: '科创50',
    code: '000688',
    value: 985.26,
    change: 5.26,
    changePercent: 0.54,
    high: 985.26,
    low: 973.27,
    volume: '3137亿',
    pe: 68.5,
  },
]

/**
 * mockSectorData
 */
export const mockSectorData: SectorData[] = [
  { name: '半导体', code: 'semiconductor', changePercent: -0.08 },
  { name: '白酒', code: 'baijiu', changePercent: 1.21 },
  { name: '新能源', code: 'new_energy', changePercent: 1.80 },
  { name: '医药生物', code: 'pharmacy', changePercent: 1.98 },
  { name: '银行', code: 'bank', changePercent: -0.36 },
  { name: '房地产', code: 'real_estate', changePercent: 0.67 },
  { name: '计算机', code: 'computer', changePercent: 2.44 },
  { name: '通信', code: 'communication', changePercent: 2.44 },
  { name: '军工', code: 'military', changePercent: -1.67 },
  { name: '化工', code: 'chemical', changePercent: 1.93 },
  { name: '汽车', code: 'auto', changePercent: 0.06 },
  { name: '电子', code: 'electronics', changePercent: 1.68 },
  { name: '传媒', code: 'media', changePercent: 2.02 },
  { name: '交通运输', code: 'transport', changePercent: 2.64 },
  { name: '有色金属', code: 'nonferrous', changePercent: -0.41 },
  { name: '钢铁', code: 'steel', changePercent: -0.77 },
  { name: '建筑材料', code: 'construction', changePercent: -0.55 },
  { name: '农林牧渔', code: 'agriculture', changePercent: 1.82 },
  { name: '商贸零售', code: 'retail', changePercent: 0.71 },
  { name: '电力', code: 'power', changePercent: 0.58 },
]

/**
 * mockFundFlows
 */
export const mockFundFlows: FundFlow[] = [
  { type: 'main', name: '主力净流入', value: 27.8, unit: '亿' },
  { type: 'retail', name: '散户净流入', value: -48.7, unit: '亿' },
  { type: 'north', name: '北向净流入', value: 9.2, unit: '亿' },
]

/**
 * mockMarketSentiment
 */
export const mockMarketSentiment: MarketSentiment = {
  fearGreedIndex: 64,
  fearGreedLabel: '贪婪',
  totalStocks: 5300,
  up: 3170,
  down: 1129,
  flat: 1001,
  limitUp: 74,
  limitDown: 12,
  upOver5Percent: 235,
  downOver5Percent: 167,
}

/**
 * mockWatchlist
 */
export const mockWatchlist: WatchlistStock[] = [
  { name: '五粮液', code: '000858', price: 147.99, changePercent: 2.06 },
  { name: '恒瑞医药', code: '600276', price: 48.86, changePercent: 1.79 },
  { name: '比亚迪', code: '002594', price: 271.58, changePercent: 1.33 },
  { name: '宁德时代', code: '300750', price: 214.47, changePercent: -0.25 },
  { name: '平安银行', code: '000001', price: 11.16, changePercent: -0.38 },
  { name: '北方华创', code: '002371', price: 332.81, changePercent: -0.65 },
  { name: '贵州茅台', code: '600519', price: 1567.00, changePercent: -0.82 },
  { name: '中芯国际', code: '688981', price: 86.52, changePercent: -1.68 },
]

/**
 * mockPortfolioStats
 */
export const mockPortfolioStats: PortfolioStats = {
  totalAssets: '502.4万',
  availableFunds: '117.0万',
  todayPnL: '+5.0万',
  todayPnLPercent: 1.00,
  totalPnL: '+9.7万',
  totalPnLPercent: 2.59,
  holdings: 8,
  maxDrawdown: 5.5,
  sharpeRatio: 0.56,
}

/**
 * mockTradeReview
 */
export const mockTradeReview: TradeReview = {
  totalTrades: 28,
  profitable: 16,
  losing: 12,
  winRate: 57.1,
  profitLossRatio: 1.35,
  disciplineScore: 68,
}

/**
 * MockMarketDataProvider
 */
export class MockMarketDataProvider {
  /**
   * 获取大盘指数数据
   * @description 未来替换为真实 API：使用行情接口获取上证指数、深证成指、创业板指、科创50等指数实时数据
   * @example 真实API调用示例：
   * ```typescript
   * // await fetch('/api/market/indices').then(res => res.json())
   * ```
   */
  static getMarketIndices(): Promise<MarketIndex[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockMarketIndices), 500)
    })
  }

  /**
   * 获取板块数据
   * @description 未来替换为真实 API：使用行业板块接口获取各板块涨跌幅数据
   * @example 真实API调用示例：
   * ```typescript
   * // await fetch('/api/market/sectors').then(res => res.json())
   * ```
   */
  static getSectorData(): Promise<SectorData[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockSectorData), 600)
    })
  }

  /**
   * 获取资金流向数据
   * @description 未来替换为真实 API：使用资金流向接口获取主力/散户/北向资金数据
   * @example 真实API调用示例：
   * ```typescript
   * // await fetch('/api/market/fund-flow').then(res => res.json())
   * ```
   */
  static getFundFlows(): Promise<FundFlow[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockFundFlows), 400)
    })
  }

  /**
   * 获取市场情绪数据
   * @description 未来替换为真实 API：使用市场情绪接口获取涨跌家数、涨停跌停、恐惧贪婪指数等数据
   * @example 真实API调用示例：
   * ```typescript
   * // await fetch('/api/market/sentiment').then(res => res.json())
   * ```
   */
  static getMarketSentiment(): Promise<MarketSentiment> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockMarketSentiment), 550)
    })
  }

  /**
   * 获取自选股数据
   * @description 未来替换为真实 API：使用自选股接口获取用户自选股票列表及实时行情
   * @example 真实API调用示例：
   * ```typescript
   * // await fetch('/api/user/watchlist').then(res => res.json())
   * ```
   */
  static getWatchlist(): Promise<WatchlistStock[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockWatchlist), 450)
    })
  }

  /**
   * 获取持仓概览数据
   * @description 未来替换为真实 API：使用持仓接口获取用户账户资产、持仓数量、盈亏等数据
   * @example 真实API调用示例：
   * ```typescript
   * // await fetch('/api/user/portfolio').then(res => res.json())
   * ```
   */
  static getPortfolioStats(): Promise<PortfolioStats> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockPortfolioStats), 500)
    })
  }

  /**
   * 获取交易复盘数据
   * @description 未来替换为真实 API：使用AI复盘接口获取用户交易统计、胜率、盈亏比等分析数据
   * @example 真实API调用示例：
   * ```typescript
   * // await fetch('/api/ai/trade-review').then(res => res.json())
   * ```
   */
  static getTradeReview(): Promise<TradeReview> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockTradeReview), 700)
    })
  }
}
