/**
 * 模拟股票数据生成器
 * 用于本地测试 V6 评分引擎和 LLM 增强逻辑
 */

import type { Stock, DailyQuotes, KlineBar } from '@/data/types'
import type {
  StockBasicData,
  FinancialData,
  QuoteData,
  LayerInput,
  IndustryScoreData,
} from '@/services/scoring/v6-engine/types'
import type { V6ScoreEngineConfig } from '@/services/scoring/v6-engine/config'
import { DEFAULT_ENGINE_CONFIG } from '@/services/scoring/v6-engine/config'

// ============================================================
// 基础数据生成器
// ============================================================

/** 生成 K 线历史数据 */
export function generateKlineHistory(
  days: number,
  basePrice: number,
  volatility: number = 0.02,
  trend: number = 0.001,
): KlineBar[] {
  const history: KlineBar[] = []
  let price = basePrice
  const now = Date.now()
  const msPerDay = 24 * 60 * 60 * 1000

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * msPerDay).toISOString().split('T')[0] || ''
    const change = (Math.random() - 0.5) * 2 * volatility + trend
    const open = price
    const close = price * (1 + change)
    const high = Math.max(open, close) * (1 + Math.random() * 0.01)
    const low = Math.min(open, close) * (1 - Math.random() * 0.01)
    const volume = Math.floor(1000000 + Math.random() * 5000000)
    const amount = volume * close

    history.push({ date, open, high, low, close, volume, amount })
    price = close
  }

  return history
}

/** 生成 DailyQuotes 数据 */
export function generateDailyQuotes(
  symbol: string,
  days: number = 120,
  basePrice: number = 50,
  volatility: number = 0.02,
  trend: number = 0.001,
): DailyQuotes {
  const history = generateKlineHistory(days, basePrice, volatility, trend)
  const latest = history[history.length - 1]

  return {
    symbol,
    latest,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
}

// ============================================================
// 场景化股票数据
// ============================================================

/** 场景 1: 优质成长股 (半导体行业) */
export const MOCK_STOCK_HIGH_QUALITY: Stock = {
  symbol: '688001.SH',
  name: '华兴源创',
  price: 45.67,
  pe: 35.2,
  pb: 4.8,
  roe: 18.5,
  marketCap: 18000000000,
  researchStatus: 'watching',
  source: 'akshare',
  dataVersion: 1,
  industryCode: '半导体',
  theme: ['AI算力', '第四次工业革命稀缺核心资源'],
  sector: '半导体',
  group: '核心池',
  dataQuality: {
    basic: true,
    kline: true,
    finance: true,
    lastChecked: Date.now(),
  },
  updatedAt: Date.now(),
}

export const MOCK_FINANCIALS_HIGH_QUALITY: FinancialData = {
  revenue: 25.6,
  revenueYoY: 0.35,
  netProfit: 4.2,
  netProfitYoY: 0.42,
  grossMargin: 0.52,
  netMargin: 0.16,
  operatingCF: 5.8,
  rdRatio: 0.12,
  receivables: 3.2,
  inventoryTurnoverDays: 45,
  interestBearingDebt: 2.5,
  goodwill: 0.8,
  netAssets: 38,
  ordersInHand: 15,
  newOrders: 8,
  shareholderPledge: 0.15,
  customerConcentration: 0.35,
  auditOpinion: '标准无保留意见',
}

export const MOCK_QUOTES_HIGH_QUALITY: QuoteData = {
  latestClose: 45.67,
  return20d: 0.08,
  volatility20d: 0.025,
  avgTurnover20d: 0.035,
  return60d: 0.15,
  history: generateKlineHistory(120, 40, 0.02, 0.001),
  volumeHistory: generateKlineHistory(120, 40, 0.02, 0.001).map((k) => k.volume),
}

/** 场景 2: 价值洼地股 (银行行业) */
export const MOCK_STOCK_VALUE_PIT: Stock = {
  symbol: '601398.SH',
  name: '工商银行',
  price: 5.23,
  pe: 6.8,
  pb: 0.75,
  roe: 12.3,
  marketCap: 1850000000000,
  researchStatus: 'watching',
  source: 'akshare',
  dataVersion: 1,
  industryCode: '金融',
  theme: ['高股息'],
  sector: '银行',
  group: '价值池',
  dataQuality: {
    basic: true,
    kline: true,
    finance: true,
    lastChecked: Date.now(),
  },
  updatedAt: Date.now(),
}

export const MOCK_FINANCIALS_VALUE_PIT: FinancialData = {
  revenue: 850,
  revenueYoY: 0.05,
  netProfit: 350,
  netProfitYoY: 0.06,
  grossMargin: 0.45,
  netMargin: 0.38,
  operatingCF: 420,
  rdRatio: 0.02,
  receivables: 120,
  inventoryTurnoverDays: 0,
  interestBearingDebt: 800,
  goodwill: 5,
  netAssets: 2400,
  ordersInHand: 0,
  newOrders: 0,
  shareholderPledge: 0.05,
  customerConcentration: 0.1,
  auditOpinion: '标准无保留意见',
}

export const MOCK_QUOTES_VALUE_PIT: QuoteData = {
  latestClose: 5.23,
  return20d: -0.02,
  volatility20d: 0.015,
  avgTurnover20d: 0.008,
  return60d: -0.05,
  history: generateKlineHistory(120, 5.5, 0.015, -0.0005),
  volumeHistory: generateKlineHistory(120, 5.5, 0.015, -0.0005).map((k) => k.volume),
}

/** 场景 3: 热门追涨股 (AI 概念) */
export const MOCK_STOCK_HOT_MOMENTUM: Stock = {
  symbol: '300474.SZ',
  name: '景嘉微',
  price: 128.5,
  pe: 85.6,
  pb: 12.3,
  roe: 15.2,
  marketCap: 38000000000,
  researchStatus: 'watching',
  source: 'akshare',
  dataVersion: 1,
  industryCode: 'AI/TMT',
  theme: ['AI算力', '国产GPU'],
  sector: '半导体',
  group: '热门池',
  dataQuality: {
    basic: true,
    kline: true,
    finance: true,
    lastChecked: Date.now(),
  },
  updatedAt: Date.now(),
}

export const MOCK_FINANCIALS_HOT_MOMENTUM: FinancialData = {
  revenue: 12.8,
  revenueYoY: 0.68,
  netProfit: 2.1,
  netProfitYoY: 0.95,
  grossMargin: 0.65,
  netMargin: 0.16,
  operatingCF: 1.5,
  rdRatio: 0.25,
  receivables: 2.8,
  inventoryTurnoverDays: 60,
  interestBearingDebt: 1.2,
  goodwill: 1.5,
  netAssets: 8,
  ordersInHand: 8,
  newOrders: 5,
  shareholderPledge: 0.2,
  customerConcentration: 0.45,
  auditOpinion: '标准无保留意见',
}

export const MOCK_QUOTES_HOT_MOMENTUM: QuoteData = {
  latestClose: 128.5,
  return20d: 0.25,
  volatility20d: 0.045,
  avgTurnover20d: 0.08,
  return60d: 0.45,
  history: generateKlineHistory(120, 90, 0.04, 0.003),
  volumeHistory: generateKlineHistory(120, 90, 0.04, 0.003).map((k) => k.volume),
}

/** 场景 4: 问题股 (财务风险) */
export const MOCK_STOCK_PROBLEM: Stock = {
  symbol: '000001.SZ',
  name: '问题科技',
  price: 8.92,
  pe: -15.6,
  pb: 1.2,
  roe: -8.5,
  marketCap: 3500000000,
  researchStatus: 'candidate',
  source: 'manual',
  dataVersion: 1,
  industryCode: '软件',
  theme: [],
  sector: '计算机',
  group: '观察池',
  dataQuality: {
    basic: true,
    kline: true,
    finance: true,
    lastChecked: Date.now(),
  },
  updatedAt: Date.now(),
}

export const MOCK_FINANCIALS_PROBLEM: FinancialData = {
  revenue: 8.5,
  revenueYoY: -0.25,
  netProfit: -1.2,
  netProfitYoY: -1.5,
  grossMargin: 0.28,
  netMargin: -0.14,
  operatingCF: -0.8,
  rdRatio: 0.08,
  receivables: 4.5,
  inventoryTurnoverDays: 120,
  interestBearingDebt: 3.2,
  goodwill: 2.8,
  netAssets: 5,
  ordersInHand: 2,
  newOrders: 1,
  shareholderPledge: 0.65,
  customerConcentration: 0.72,
  auditOpinion: '保留意见',
}

export const MOCK_QUOTES_PROBLEM: QuoteData = {
  latestClose: 8.92,
  return20d: -0.15,
  volatility20d: 0.055,
  avgTurnover20d: 0.06,
  return60d: -0.35,
  history: generateKlineHistory(120, 12, 0.05, -0.003),
  volumeHistory: generateKlineHistory(120, 12, 0.05, -0.003).map((k) => k.volume),
}

// ============================================================
// 行业评分数据
// ============================================================

export const MOCK_INDUSTRY_SCORE_SEMICONDUCTOR: IndustryScoreData = {
  sectorName: '半导体',
  skillCScore: 4.2,
  skillCRating: 'A',
  skillNScore: 85,
  relevance: 0.95,
  allocationBias: '超配',
}

export const MOCK_INDUSTRY_SCORE_FINANCE: IndustryScoreData = {
  sectorName: '金融',
  skillCScore: 3.5,
  skillCRating: 'B',
  skillNScore: 65,
  relevance: 0.85,
  allocationBias: '标配',
}

export const MOCK_INDUSTRY_SCORE_AI_TMT: IndustryScoreData = {
  sectorName: 'AI/TMT',
  skillCScore: 4.5,
  skillCRating: 'A+',
  skillNScore: 92,
  relevance: 0.98,
  allocationBias: '超配',
}

// ============================================================
// LayerInput 构建器
// ============================================================

export function buildLayerInput(
  stock: Stock,
  financials: FinancialData,
  quotes: QuoteData,
  industryScore?: IndustryScoreData,
  config: V6ScoreEngineConfig = DEFAULT_ENGINE_CONFIG,
): LayerInput {
  const stockBasic: StockBasicData = {
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
    sector: stock.industryCode,
  }

  return {
    stock: stockBasic,
    financials,
    quotes,
    industryScore,
    config,
  }
}

// ============================================================
// 批量生成工具
// ============================================================

export function generateMockStocks(count: number): Stock[] {
  const stocks: Stock[] = []
  const industries = ['半导体', '金融', 'AI/TMT', '消费', '医药', '新能源']
  const sectors = ['科技', '金融', '消费', '医药', '制造']

  for (let i = 0; i < count; i++) {
    const symbol = `${String(i).padStart(6, '0')}.SZ`
    const industry = industries[i % industries.length]
    const sector = sectors[i % sectors.length]
    const basePrice = 10 + Math.random() * 100
    const pe = 5 + Math.random() * 50
    const pb = 0.5 + Math.random() * 5
    const roe = 5 + Math.random() * 20

    stocks.push({
      symbol,
      name: `测试股票${i}`,
      price: basePrice,
      pe,
      pb,
      roe,
      marketCap: 1000000000 + Math.random() * 100000000000,
      researchStatus: i % 3 === 0 ? 'watching' : 'candidate',
      source: i % 2 === 0 ? 'akshare' : 'manual',
      dataVersion: 1,
      industryCode: industry,
      sector,
      group: i % 4 === 0 ? '核心池' : '观察池',
      dataQuality: {
        basic: true,
        kline: true,
        finance: true,
        lastChecked: Date.now(),
      },
      updatedAt: Date.now(),
    })
  }

  return stocks
}

export function generateMockDailyQuotesList(
  symbols: string[],
  days: number = 120,
): DailyQuotes[] {
  return symbols.map((symbol) => {
    const basePrice = 10 + Math.random() * 100
    return generateDailyQuotes(symbol, days, basePrice)
  })
}

// ============================================================
// 测试数据导出
// ============================================================

export const MOCK_STOCK_SCENARIOS = {
  highQuality: {
    stock: MOCK_STOCK_HIGH_QUALITY,
    financials: MOCK_FINANCIALS_HIGH_QUALITY,
    quotes: MOCK_QUOTES_HIGH_QUALITY,
    industryScore: MOCK_INDUSTRY_SCORE_SEMICONDUCTOR,
  },
  valuePit: {
    stock: MOCK_STOCK_VALUE_PIT,
    financials: MOCK_FINANCIALS_VALUE_PIT,
    quotes: MOCK_QUOTES_VALUE_PIT,
    industryScore: MOCK_INDUSTRY_SCORE_FINANCE,
  },
  hotMomentum: {
    stock: MOCK_STOCK_HOT_MOMENTUM,
    financials: MOCK_FINANCIALS_HOT_MOMENTUM,
    quotes: MOCK_QUOTES_HOT_MOMENTUM,
    industryScore: MOCK_INDUSTRY_SCORE_AI_TMT,
  },
  problem: {
    stock: MOCK_STOCK_PROBLEM,
    financials: MOCK_FINANCIALS_PROBLEM,
    quotes: MOCK_QUOTES_PROBLEM,
    industryScore: undefined,
  },
} as const
