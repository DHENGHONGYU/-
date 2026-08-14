/**
 * @fileoverview 常用股票列表常量
 * 用于股票选择器展示
 *
 * @module constants/stockList
 */

/** 股票选项 */
export interface StockOption {
  /** 股票代码（6位） */
  symbol: string
  /** 股票名称 */
  name: string
  /** 交易所：sh / sz */
  market: 'sh' | 'sz'
}

/**
 * 常用股票列表（覆盖主要指数成分股和热门板块）
 *
 * 注：此列表为展示用静态数据，真实数据应以 stockStore 或 Smartbox 搜索结果为准
 */
export const POPULAR_STOCKS: StockOption[] = [
  // 上证50 / 沪深300 成分股
  { symbol: '600519', name: '贵州茅台', market: 'sh' },
  { symbol: '601318', name: '中国平安', market: 'sh' },
  { symbol: '600036', name: '招商银行', market: 'sh' },
  { symbol: '601398', name: '工商银行', market: 'sh' },
  { symbol: '600028', name: '中国石化', market: 'sh' },
  { symbol: '601857', name: '中国石油', market: 'sh' },
  { symbol: '601988', name: '中国银行', market: 'sh' },
  { symbol: '600030', name: '中信证券', market: 'sh' },
  { symbol: '601166', name: '兴业银行', market: 'sh' },
  { symbol: '600887', name: '伊利股份', market: 'sh' },
  { symbol: '600309', name: '万华化学', market: 'sh' },
  { symbol: '600031', name: '三一重工', market: 'sh' },
  { symbol: '601628', name: '中国人寿', market: 'sh' },
  { symbol: '600050', name: '中国联通', market: 'sh' },
  { symbol: '601328', name: '交通银行', market: 'sh' },

  // 深证成指 / 创业板成分股
  { symbol: '000858', name: '五粮液', market: 'sz' },
  { symbol: '000001', name: '平安银行', market: 'sz' },
  { symbol: '000651', name: '格力电器', market: 'sz' },
  { symbol: '000333', name: '美的集团', market: 'sz' },
  { symbol: '002594', name: '比亚迪', market: 'sz' },
  { symbol: '000725', name: '京东方A', market: 'sz' },
  { symbol: '002415', name: '海康威视', market: 'sz' },
  { symbol: '000568', name: '泸州老窖', market: 'sz' },
  { symbol: '000661', name: '长春高新', market: 'sz' },
  { symbol: '002304', name: '洋河股份', market: 'sz' },

  // 创业板热门
  { symbol: '300750', name: '宁德时代', market: 'sz' },
  { symbol: '300059', name: '东方财富', market: 'sz' },
  { symbol: '300760', name: '迈瑞医疗', market: 'sz' },
  { symbol: '300015', name: '爱尔眼科', market: 'sz' },
  { symbol: '300014', name: '亿纬锂能', market: 'sz' },

  // 科创板
  { symbol: '688981', name: '中芯国际', market: 'sh' },
  { symbol: '688111', name: '金山办公', market: 'sh' },
  { symbol: '688012', name: '中微公司', market: 'sh' },

  // 科技/互联网
  { symbol: '002415', name: '海康威视', market: 'sz' },
  { symbol: '300059', name: '东方财富', market: 'sz' },
  { symbol: '600588', name: '用友网络', market: 'sh' },

  // 新能源
  { symbol: '002594', name: '比亚迪', market: 'sz' },
  { symbol: '300750', name: '宁德时代', market: 'sz' },
  { symbol: '601012', name: '隆基绿能', market: 'sh' },
  { symbol: '002459', name: 'TCL中环', market: 'sz' },

  // 消费/医药
  { symbol: '600276', name: '恒瑞医药', market: 'sh' },
  { symbol: '000538', name: '云南白药', market: 'sz' },
  { symbol: '600196', name: '复星医药', market: 'sh' },
  { symbol: '000568', name: '泸州老窖', market: 'sz' },
  { symbol: '600809', name: '山西汾酒', market: 'sh' },
]

/**
 * 按代码查询股票信息
 * @param symbol 股票代码
 * @returns 股票选项或 undefined
 */
export function getStockBySymbol(symbol: string): StockOption | undefined {
  return POPULAR_STOCKS.find(s => s.symbol === symbol)
}

/**
 * 根据股票代码推断所属交易所
 * @param symbol 6位股票代码
 * @returns 'sh' 上海 / 'sz' 深圳
 */
export function inferMarketFromSymbol(symbol: string): 'sh' | 'sz' {
  const prefix = symbol.slice(0, 3)
  const shPrefixes = ['600', '601', '603', '605', '688', '689']
  if (shPrefixes.includes(prefix)) return 'sh'
  return 'sz'
}

/**
 * 将领域 Stock 类型转换为 StockOption
 * @param stock 领域层 Stock 对象
 * @returns StockOption 选项
 */
export function toStockOption(stock: { symbol: string; name: string }): StockOption {
  return {
    symbol: stock.symbol,
    name: stock.name,
    market: inferMarketFromSymbol(stock.symbol),
  }
}

/**
 * 搜索股票（按名称或代码）
 * @param keyword 搜索关键词
 * @returns 匹配的股票列表
 */
export function searchStocks(keyword: string): StockOption[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return POPULAR_STOCKS
  return POPULAR_STOCKS.filter(
    s => s.symbol.includes(kw) || s.name.toLowerCase().includes(kw),
  )
}

/**
 * 按分组获取股票
 * @param group 分组名称
 * @returns 股票列表
 */
export function getStocksByGroup(group: 'all' | 'sh' | 'sz'): StockOption[] {
  if (group === 'all') return POPULAR_STOCKS
  return POPULAR_STOCKS.filter(s => s.market === group)
}
