/**
 * 本地 mock 股票库
 *
 * 用于 `StockSearch` 在离线/无 AKShare 搜索接口时的降级数据源。
 * 该库仅包含常见 A 股标的，不应作为真实股票池使用。
 */

export interface MockStock {
  symbol: string
  name: string
  industry: string
  pe?: number
  pb?: number
  marketCap?: number
}

export const MOCK_STOCK_LIBRARY: MockStock[] = [
  { symbol: '600519.SH', name: '贵州茅台', industry: '白酒', pe: 28.5, pb: 8.2, marketCap: 2100000000000 },
  { symbol: '000001.SZ', name: '平安银行', industry: '银行', pe: 6.3, pb: 0.72, marketCap: 220000000000 },
  { symbol: '000858.SZ', name: '五粮液', industry: '白酒', pe: 22.1, pb: 5.8, marketCap: 650000000000 },
  { symbol: '600036.SH', name: '招商银行', industry: '银行', pe: 7.2, pb: 0.95, marketCap: 900000000000 },
  { symbol: '002594.SZ', name: '比亚迪', industry: '汽车', pe: 35.4, pb: 5.1, marketCap: 700000000000 },
  { symbol: '300750.SZ', name: '宁德时代', industry: '电池', pe: 42.0, pb: 8.3, marketCap: 980000000000 },
  { symbol: '601318.SH', name: '中国平安', industry: '保险', pe: 9.1, pb: 1.1, marketCap: 850000000000 },
  { symbol: '600276.SH', name: '恒瑞医药', industry: '医药', pe: 65.2, pb: 9.8, marketCap: 400000000000 },
  { symbol: '000333.SZ', name: '美的集团', industry: '家电', pe: 15.3, pb: 3.2, marketCap: 450000000000 },
  { symbol: '002415.SZ', name: '海康威视', industry: '电子', pe: 25.6, pb: 4.5, marketCap: 320000000000 },
  { symbol: '600900.SH', name: '长江电力', industry: '电力', pe: 18.7, pb: 2.9, marketCap: 680000000000 },
  { symbol: '601012.SH', name: '隆基绿能', industry: '光伏', pe: 30.1, pb: 3.8, marketCap: 180000000000 },
  { symbol: '300059.SZ', name: '东方财富', industry: '证券', pe: 28.4, pb: 4.2, marketCap: 260000000000 },
  { symbol: '002230.SZ', name: '科大讯飞', industry: '软件', pe: 120.5, pb: 8.1, marketCap: 150000000000 },
  { symbol: '600030.SH', name: '中信证券', industry: '证券', pe: 16.2, pb: 1.5, marketCap: 340000000000 },
]
