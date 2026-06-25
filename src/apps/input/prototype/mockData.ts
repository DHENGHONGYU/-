export interface MockStock {
  symbol: string
  name: string
  price: number
  change: number
  pe?: number
  pb?: number
  marketCap?: number
  quality: 'full' | 'partial' | 'missing'
  hasBasic: boolean
  hasKline: boolean
  hasFinance: boolean
  status: 'candidate' | 'screened' | 'deepDive' | 'watching'
}

export interface MockSector {
  code: string
  name: string
  rank: number
  total: number
  trend: 'up' | 'down' | 'neutral'
  factors: {
    name: string
    value: number
    max: number
    color: string
  }[]
  stocks: {
    symbol: string
    name: string
    price: number
    change: number
    added: boolean
  }[]
  advice: string
}

export interface MockDataSource {
  name: string
  status: 'ok' | 'error' | 'testing' | 'idle'
  latency?: number
  lastCheck?: string
}

export interface MockImportRow {
  code: string
  name: string
  symbol: string
  status: 'valid' | 'invalid' | 'duplicate'
  error?: string
}

export interface MockTask {
  id: string
  symbol: string
  status: 'pending' | 'running' | 'success' | 'error'
  message: string
}

export const mockStocks: MockStock[] = [
  {
    symbol: '600519.SH',
    name: '贵州茅台',
    price: 1688.0,
    change: 1.25,
    pe: 28.5,
    pb: 8.2,
    marketCap: 21200,
    quality: 'full',
    hasBasic: true,
    hasKline: true,
    hasFinance: true,
    status: 'candidate',
  },
  {
    symbol: '000001.SZ',
    name: '平安银行',
    price: 11.35,
    change: -0.82,
    pe: 4.8,
    pb: 0.52,
    marketCap: 2200,
    quality: 'partial',
    hasBasic: true,
    hasKline: true,
    hasFinance: false,
    status: 'candidate',
  },
  {
    symbol: '300750.SZ',
    name: '宁德时代',
    price: 198.5,
    change: 2.14,
    pe: 22.1,
    pb: 5.6,
    marketCap: 8700,
    quality: 'missing',
    hasBasic: false,
    hasKline: false,
    hasFinance: false,
    status: 'candidate',
  },
  {
    symbol: '601318.SH',
    name: '中国平安',
    price: 45.2,
    change: 0.45,
    pe: 9.2,
    pb: 0.88,
    marketCap: 8200,
    quality: 'full',
    hasBasic: true,
    hasKline: true,
    hasFinance: true,
    status: 'screened',
  },
]

export const mockSectors: MockSector[] = [
  {
    code: 'semiconductor',
    name: '半导体',
    rank: 1,
    total: 82,
    trend: 'up',
    factors: [
      { name: '景气', value: 34, max: 40, color: '#2E5C8A' },
      { name: '资金', value: 26, max: 30, color: '#6B5B8E' },
      { name: '估值', value: 12, max: 20, color: '#06A77D' },
      { name: 'β', value: 7, max: 10, color: '#C73E3A' },
      { name: '量能', value: 3, max: 10, color: '#D4A017' },
    ],
    stocks: [
      { symbol: '600519.SH', name: '贵州茅台', price: 1688.0, change: 1.25, added: false },
      { symbol: '000001.SZ', name: '平安银行', price: 11.35, change: -0.82, added: true },
    ],
    advice: '资金持续流入，景气度排名 #1，建议重点关注龙头',
  },
  {
    code: 'new-energy',
    name: '新能源车',
    rank: 2,
    total: 76,
    trend: 'up',
    factors: [
      { name: '景气', value: 30, max: 40, color: '#2E5C8A' },
      { name: '资金', value: 22, max: 30, color: '#6B5B8E' },
      { name: '估值', value: 14, max: 20, color: '#06A77D' },
      { name: 'β', value: 6, max: 10, color: '#C73E3A' },
      { name: '量能', value: 4, max: 10, color: '#D4A017' },
    ],
    stocks: [
      { symbol: '300750.SZ', name: '宁德时代', price: 198.5, change: 2.14, added: false },
    ],
    advice: '估值修复中，β 偏高，适合趋势跟踪策略',
  },
  {
    code: 'bank',
    name: '银行',
    rank: 3,
    total: 58,
    trend: 'neutral',
    factors: [
      { name: '景气', value: 18, max: 40, color: '#2E5C8A' },
      { name: '资金', value: 15, max: 30, color: '#6B5B8E' },
      { name: '估值', value: 18, max: 20, color: '#06A77D' },
      { name: 'β', value: 4, max: 10, color: '#C73E3A' },
      { name: '量能', value: 3, max: 10, color: '#D4A017' },
    ],
    stocks: [
      { symbol: '000001.SZ', name: '平安银行', price: 11.35, change: -0.82, added: true },
    ],
    advice: '估值低、波动小，可作为防御性配置',
  },
]

export const mockDataSources: MockDataSource[] = [
  { name: 'AKShare', status: 'ok', latency: 45, lastCheck: '14:02:11' },
  { name: 'iFind', status: 'testing' },
  { name: 'Yahoo Finance', status: 'ok', latency: 120, lastCheck: '14:01:55' },
  { name: 'Tianyancha', status: 'idle' },
  { name: 'Scholar', status: 'error', latency: 0, lastCheck: '13:58:22' },
]

export const mockImportRows: MockImportRow[] = [
  { code: '600519', name: '贵州茅台', symbol: '600519.SH', status: 'valid' },
  { code: '000001', name: '平安银行', symbol: '000001.SZ', status: 'duplicate' },
  { code: '300750', name: '宁德时代', symbol: '300750.SZ', status: 'valid' },
  { code: '999999', name: '不存在', symbol: '', status: 'invalid', error: '代码格式错误' },
]

export const mockTasks: MockTask[] = [
  { id: '1', symbol: '600519.SH', status: 'success', message: '基础+K线采集完成' },
  { id: '2', symbol: '000001.SZ', status: 'success', message: '基础+K线采集完成' },
  { id: '3', symbol: '300750.SZ', status: 'running', message: 'K线采集中...' },
  { id: '4', symbol: '601318.SH', status: 'pending', message: '等待中' },
]
