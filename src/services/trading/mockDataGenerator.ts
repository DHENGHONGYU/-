/**
 * 交易流程模拟数据生成器
 * 用于本地开发环境，生成各种交易状态和场景的测试数据
 */

import type { TradingSignal } from './signalGenerator'
import type { Order, OrderStatus } from '@/data/types'
import { ORDER_STATUS, ORDER_DIRECTION, ACCOUNT_TYPE } from '@/config/dbConfig'

// ============================================================
// 模拟数据配置
// ============================================================

/** 模拟股票池 */
const MOCK_STOCKS = [
  { symbol: '600519.SH', name: '贵州茅台', price: 1680.50 },
  { symbol: '000858.SZ', name: '五粮液', price: 145.80 },
  { symbol: '601318.SH', name: '中国平安', price: 48.25 },
  { symbol: '000001.SZ', name: '平安银行', price: 11.35 },
  { symbol: '600036.SH', name: '招商银行', price: 35.60 },
  { symbol: '601166.SH', name: '兴业银行', price: 18.90 },
  { symbol: '000333.SZ', name: '美的集团', price: 58.75 },
  { symbol: '600276.SH', name: '恒瑞医药', price: 42.30 },
  { symbol: '300750.SZ', name: '宁德时代', price: 198.50 },
  { symbol: '601012.SH', name: '隆基绿能', price: 25.80 },
]

/** 用户信息池 */
const MOCK_USERS = [
  { userId: 'user_001', name: '张三', riskLevel: 'conservative' },
  { userId: 'user_002', name: '李四', riskLevel: 'moderate' },
  { userId: 'user_003', name: '王五', riskLevel: 'aggressive' },
]

// ============================================================
// 工具函数
// ============================================================

/** 生成唯一ID */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/** 随机选择 */
function randomChoice<T>(arr: readonly T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)]
  if (item === undefined) {
    throw new Error('[MockDataGenerator] randomChoice: 数组为空')
  }
  return item
}

/** 随机整数 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 随机浮点数 */
function randomFloat(min: number, max: number, decimals: number = 2): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals))
}

/** 随机时间戳（最近N天内） */
function randomTimestamp(daysBack: number = 30): number {
  const now = Date.now()
  const msBack = daysBack * 24 * 60 * 60 * 1000
  return now - Math.floor(Math.random() * msBack)
}

// ============================================================
// 模拟信号生成器
// ============================================================

/**
 * 生成模拟交易信号
 * @param count - 生成数量
 */
export function generateMockSignals(count: number = 5): TradingSignal[] {
  const signals: TradingSignal[] = []
  
  for (let i = 0; i < count; i++) {
    const stock = randomChoice(MOCK_STOCKS)
    const direction = randomChoice(['buy', 'sell', 'hold'] as const)
    const confidence = randomFloat(0.6, 0.95)
    
    signals.push({
      id: generateId('sig'),
      symbol: stock.symbol,
      direction,
      confidence,
      rationale: generateRationale(direction, confidence),
      createdAt: randomTimestamp(7),
      snapshot: {
        pePercentile: randomFloat(10, 90),
        pbPercentile: randomFloat(10, 90),
        priceToMA20: randomFloat(-5, 5),
        priceToMA60: randomFloat(-10, 10),
        volumeRatio: randomFloat(0.5, 2.0),
        rsi14: randomFloat(20, 80),
        macdDirection: randomChoice(['red', 'green', 'neutral'] as const),
      },
      type: 'technical',
      strategy: 'mock_strategy',
    })
  }
  
  return signals.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 生成信号理由
 */
function generateRationale(direction: string, confidence: number): string {
  const reasons = {
    buy: [
      '技术面突破关键阻力位，量能放大',
      '基本面改善，业绩超预期',
      '板块轮动效应，资金流入明显',
      '估值处于历史低位，安全边际充足',
    ],
    sell: [
      '技术面跌破支撑位，趋势转弱',
      '估值过高，存在回调风险',
      '板块资金流出，市场情绪转冷',
      '达到目标价，建议获利了结',
    ],
    hold: [
      '震荡整理，等待方向选择',
      '基本面稳定，暂无明显催化',
      '技术面中性，建议观望',
    ],
  }
  
  const reasonList = reasons[direction as keyof typeof reasons] || reasons.hold
  const reason = randomChoice(reasonList)
  return `${reason}（置信度：${(confidence * 100).toFixed(1)}%）`
}

// ============================================================
// 模拟订单生成器
// ============================================================

/**
 * 生成模拟订单
 * @param count - 生成数量
 * @param options - 配置选项
 */
export function generateMockOrders(
  count: number = 10,
  options: {
    statusDistribution?: Record<string, number>
    dateRange?: number
  } = {}
): Order[] {
  const {
    statusDistribution = {
      [ORDER_STATUS.pending]: 0.2,
      [ORDER_STATUS.filled]: 0.6,
      [ORDER_STATUS.cancelled]: 0.2,
    },
    dateRange = 30,
  } = options
  
  const orders: Order[] = []
  const user = randomChoice(MOCK_USERS)
  
  for (let i = 0; i < count; i++) {
    const stock = randomChoice(MOCK_STOCKS)
    const direction = randomChoice([ORDER_DIRECTION.buy, ORDER_DIRECTION.sell])
    const status = selectStatusByDistribution(statusDistribution)
    const quantity = randomInt(1, 50) * 100 // 100股的整数倍
    const price = stock.price * randomFloat(0.95, 1.05) // 在市场价附近波动
    const amount = quantity * price
    
    orders.push({
      id: generateId('ord'),
      symbol: stock.symbol,
      direction,
      quantity,
      price: Number(price.toFixed(2)),
      amount: Number(amount.toFixed(2)),
      status,
      accountType: ACCOUNT_TYPE.paper,
      createdAt: randomTimestamp(dateRange),
      userId: user.userId,
    })
  }
  
  return orders.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 根据分布选择状态
 */
function selectStatusByDistribution(distribution: Record<string, number>): OrderStatus {
  const rand = Math.random()
  let cumulative = 0
  
  for (const [status, probability] of Object.entries(distribution)) {
    cumulative += probability
    if (rand <= cumulative) {
      return status as OrderStatus
    }
  }
  
  return ORDER_STATUS.pending
}

// ============================================================
// 模拟持仓生成器
// ============================================================

export interface MockPosition {
  symbol: string
  name: string
  quantity: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
  realizedPnl: number
  weight: number
}

/**
 * 生成模拟持仓
 * @param count - 持仓数量
 */
export function generateMockPositions(count: number = 5): MockPosition[] {
  const positions: MockPosition[] = []
  let totalMarketValue = 0
  
  const selectedStocks = MOCK_STOCKS.slice(0, count)
  
  for (const stock of selectedStocks) {
    const quantity = randomInt(1, 20) * 100
    const avgCost = stock.price * randomFloat(0.85, 1.15)
    const currentPrice = stock.price
    const marketValue = quantity * currentPrice
    const unrealizedPnl = (currentPrice - avgCost) * quantity
    const unrealizedPnlPercent = ((currentPrice - avgCost) / avgCost) * 100
    
    totalMarketValue += marketValue
    
    positions.push({
      symbol: stock.symbol,
      name: stock.name,
      quantity,
      avgCost: Number(avgCost.toFixed(2)),
      currentPrice: Number(currentPrice.toFixed(2)),
      marketValue: Number(marketValue.toFixed(2)),
      unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
      unrealizedPnlPercent: Number(unrealizedPnlPercent.toFixed(2)),
      realizedPnl: Number(randomFloat(-5000, 10000).toFixed(2)),
      weight: 0, // 稍后计算
    })
  }
  
  // 计算权重
  for (const position of positions) {
    position.weight = Number(((position.marketValue / totalMarketValue) * 100).toFixed(2))
  }
  
  return positions
}

// ============================================================
// 模拟风控指标生成器
// ============================================================

export interface MockRiskMetrics {
  var95: number
  var99: number
  maxDrawdown: number
  sharpeRatio: number
  sortinoRatio: number
  beta: number
  alpha: number
  volatility: number
  winRate: number
  profitLossRatio: number
  alerts: MockRiskAlert[]
}

export interface MockRiskAlert {
  id: string
  level: 'info' | 'warning' | 'danger'
  type: string
  message: string
  timestamp: number
  threshold: number
  currentValue: number
}

/**
 * 生成模拟风控指标
 */
export function generateMockRiskMetrics(): MockRiskMetrics {
  const alerts: MockRiskAlert[] = []
  
  // 随机生成一些风险预警
  if (Math.random() > 0.7) {
    alerts.push({
      id: generateId('alert'),
      level: 'warning',
      type: 'position_concentration',
      message: '单只股票持仓超过30%',
      timestamp: Date.now(),
      threshold: 30,
      currentValue: randomFloat(30, 45),
    })
  }
  
  if (Math.random() > 0.8) {
    alerts.push({
      id: generateId('alert'),
      level: 'danger',
      type: 'max_drawdown',
      message: '最大回撤超过预警线',
      timestamp: Date.now(),
      threshold: 15,
      currentValue: randomFloat(15, 25),
    })
  }
  
  if (Math.random() > 0.6) {
    alerts.push({
      id: generateId('alert'),
      level: 'info',
      type: 'daily_loss',
      message: '当日亏损超过2%',
      timestamp: Date.now(),
      threshold: 2,
      currentValue: randomFloat(2, 5),
    })
  }
  
  return {
    var95: randomFloat(1.5, 3.5),
    var99: randomFloat(2.5, 5.5),
    maxDrawdown: randomFloat(5, 20),
    sharpeRatio: randomFloat(0.5, 2.5),
    sortinoRatio: randomFloat(0.8, 3.0),
    beta: randomFloat(0.6, 1.4),
    alpha: randomFloat(-2, 5),
    volatility: randomFloat(10, 30),
    winRate: randomFloat(45, 70),
    profitLossRatio: randomFloat(1.2, 2.5),
    alerts,
  }
}

// ============================================================
// 综合数据生成器
// ============================================================

export interface MockTradingData {
  signals: TradingSignal[]
  orders: Order[]
  positions: MockPosition[]
  riskMetrics: MockRiskMetrics
  generatedAt: number
  metadata: {
    version: string
    environment: string
    userId: string
  }
}

/**
 * 生成完整的模拟交易数据
 */
export function generateMockTradingData(): MockTradingData {
  const user = randomChoice(MOCK_USERS)
  
  return {
    signals: generateMockSignals(8),
    orders: generateMockOrders(15),
    positions: generateMockPositions(6),
    riskMetrics: generateMockRiskMetrics(),
    generatedAt: Date.now(),
    metadata: {
      version: '1.0.0',
      environment: 'development',
      userId: user.userId,
    },
  }
}

/**
 * 导出模拟数据到 localStorage（用于调试）
 */
export function exportMockDataToStorage(data: MockTradingData): void {
  try {
    localStorage.setItem('mock_trading_data', JSON.stringify(data))
    // eslint-disable-next-line no-console
    console.log('[MockDataGenerator] 模拟数据已导出到 localStorage')
  } catch (error) {
    console.error('[MockDataGenerator] 导出模拟数据失败', error)
  }
}

/**
 * 从 localStorage 加载模拟数据
 */
export function loadMockDataFromStorage(): MockTradingData | null {
  try {
    const data = localStorage.getItem('mock_trading_data')
    if (data) {
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('[MockDataGenerator] 加载模拟数据失败', error)
  }
  return null
}
