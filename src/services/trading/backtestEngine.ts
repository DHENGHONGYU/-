import type {
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
  BacktestCurve,
  BacktestCurvePoint,
  BacktestTrade,
  BacktestPosition,
  DataLayerResult,
  Stock,
  DualStrategyResult,
} from '@/data/types'
import { getLogger } from '@/lib/logger'
import { runDualStrategy } from './dualStrategyEngine'

const logger = getLogger()

// ============================================================
// 运行时数据类型（内部使用）
// ============================================================

interface Portfolio {
  cash: number
  positions: Map<string, PositionRecord>
  totalValue: number
}

interface PositionRecord {
  symbol: string
  name: string
  quantity: number
  avgCost: number
  openDate: number
}

interface DailySnapshot {
  date: number
  portfolioValue: number
  positionsCount: number
}

// ============================================================
// 回测引擎接口
// ============================================================

export interface RunBacktestOptions {
  config: BacktestConfig
  stocks?: Stock[]
  persistResult?: boolean
  onProgress?: (progress: number) => void
}

export interface BacktestEngineAPI {
  runBacktest(options: RunBacktestOptions): Promise<DataLayerResult<BacktestResult>>
  getBacktestHistory(): Promise<DataLayerResult<BacktestResult[]>>
  deleteBacktest(backtestId: string): Promise<DataLayerResult<void>>
}

// ============================================================
// 核心回测函数
// ============================================================

/**
 * 运行回测
 *
 * @param options 回测配置选项
 * @returns 回测结果
 */
export async function runBacktestEngine(
  options: RunBacktestOptions
): Promise<DataLayerResult<BacktestResult>> {
  const startTime = Date.now()
  const { config, stocks = [], persistResult = true, onProgress } = options

  logger.info('[backtestEngine] 开始回测', {
    strategyId: config.strategyId,
    strategyName: config.strategyName,
    startDate: config.startDate,
    endDate: config.endDate,
    initialCapital: config.initialCapital,
    stocksCount: stocks.length,
  })

  // 验证输入
  if (stocks.length === 0) {
    logger.warn('[backtestEngine] 股票池为空')
    return { success: false, error: '股票池为空，请先添加股票' }
  }

  if (config.initialCapital <= 0) {
    logger.warn('[backtestEngine] 初始资金无效', { initialCapital: config.initialCapital })
    return { success: false, error: '初始资金必须大于 0' }
  }

  try {
    // 阶段1：生成交易信号
    onProgress?.(10)
    logger.info('[backtestEngine] 阶段1: 生成交易信号')
    
    const signalResult = await generateTradingSignals(stocks, config)
    if (!signalResult.success) {
      return { success: false, error: signalResult.error }
    }
    
    const { buySignals, sellSignals, signalDays } = signalResult.data!
    onProgress?.(30)
    logger.info('[backtestEngine] 生成信号完成', {
      buySignals: buySignals.length,
      sellSignals: sellSignals.length,
      tradingDays: signalDays.length,
    })

    // 阶段2：模拟交易
    onProgress?.(40)
    logger.info('[backtestEngine] 阶段2: 模拟交易')
    
    const { trades, finalPositions, dailySnapshots } = simulateTrades(
      config,
      signalDays,
      buySignals,
      sellSignals
    )
    onProgress?.(70)
    logger.info('[backtestEngine] 交易模拟完成', {
      totalTrades: trades.length,
      finalPositions: finalPositions.length,
    })

    // 阶段3：计算绩效指标
    onProgress?.(80)
    logger.info('[backtestEngine] 阶段3: 计算绩效指标')
    
    const metrics = calculateMetrics(config, dailySnapshots, trades)
    const curve = buildEquityCurve(dailySnapshots)
    onProgress?.(90)

    // 构建结果
    const result: BacktestResult = {
      config,
      metrics,
      curve,
      trades,
      positions: finalPositions,
      summary: {
        startTime: config.startDate,
        endTime: config.endDate,
        executionTime: Date.now() - startTime,
        dataPoints: signalDays.length,
        signalCount: buySignals.length + sellSignals.length,
      },
    }

    // 持久化结果
    if (persistResult) {
      await persistBacktestResult(result)
    }

    onProgress?.(100)
    logger.info('[backtestEngine] 回测完成', {
      totalReturn: metrics.totalReturn.toFixed(2) + '%',
      sharpeRatio: metrics.sharpeRatio.toFixed(2),
      winRate: metrics.winRate.toFixed(2) + '%',
      executionTime: result.summary.executionTime + 'ms',
    })

    return { success: true, data: result }
  } catch (err) {
    logger.error('[backtestEngine] 回测异常', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return {
      success: false,
      error: err instanceof Error ? err.message : '回测执行异常',
    }
  }
}

// ============================================================
// 信号生成
// ============================================================

interface SignalResult {
  success: boolean
  data?: {
    buySignals: TradingSignal[]
    sellSignals: TradingSignal[]
    signalDays: TradingDay[]
  }
  error?: string
}

interface TradingSignal {
  date: number
  symbol: string
  name: string
  direction: 'BUY' | 'SELL'
  price: number
  reason: string
}

interface TradingDay {
  date: number
  prices: Map<string, number>
}

async function generateTradingSignals(
  stocks: Stock[],
  config: BacktestConfig
): Promise<SignalResult> {
  try {
    // 调用双策略引擎获取信号
    const dualResult = await runDualStrategy(stocks)
    if (!dualResult.success || !dualResult.data) {
      return { success: false, error: dualResult.error ?? '双策略引擎执行失败' }
    }

    const strategyResult = dualResult.data
    const buySignals: TradingSignal[] = []
    const sellSignals: TradingSignal[] = []

    // 生成买入信号
    for (const candidate of strategyResult.watchlistCandidates) {
      buySignals.push({
        date: Date.now(),
        symbol: candidate.symbol,
        name: candidate.name,
        direction: 'BUY',
        price: candidate.price ?? 10,
        reason: 'watchlist_candidate',
      })
    }

    // 生成卖出信号（轮动信号）
    for (const signal of strategyResult.signals) {
      sellSignals.push({
        date: Date.now(),
        symbol: signal.symbol,
        name: signal.symbol,
        direction: 'SELL',
        price: 10,
        reason: signal.type,
      })
    }

    // 模拟交易日数据
    const tradingDays = generateMockTradingDays(config, stocks)

    return {
      success: true,
      data: { buySignals, sellSignals, signalDays: tradingDays },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '信号生成失败',
    }
  }
}

// ============================================================
// 交易模拟
// ============================================================

function simulateTrades(
  config: BacktestConfig,
  tradingDays: TradingDay[],
  buySignals: TradingSignal[],
  sellSignals: TradingSignal[]
): {
  trades: BacktestTrade[]
  finalPositions: BacktestPosition[]
  dailySnapshots: DailySnapshot[]
} {
  const trades: BacktestTrade[] = []
  const dailySnapshots: DailySnapshot[] = []

  // 初始化组合
  let portfolio: Portfolio = {
    cash: config.initialCapital,
    positions: new Map(),
    totalValue: config.initialCapital,
  }

  // 模拟每日交易
  for (const day of tradingDays) {
    const date = day.date
    const prices = day.prices

    // 处理卖出信号
    for (const signal of sellSignals.filter((s) => s.date === date)) {
      const position = portfolio.positions.get(signal.symbol)
      if (position) {
        const trade = executeSell(config, portfolio, position, prices, signal)
        trades.push(trade)
        portfolio.positions.delete(signal.symbol)
      }
    }

    // 处理买入信号
    for (const signal of buySignals.filter((s) => s.date === date)) {
      if (portfolio.positions.size < config.maxPositions) {
        const trade = executeBuy(config, portfolio, prices, signal)
        if (trade) {
          trades.push(trade)
        }
      }
    }

    // 更新持仓市值
    let totalValue = portfolio.cash
    for (const [symbol, position] of portfolio.positions) {
      const price = prices.get(symbol) ?? position.avgCost
      totalValue += position.quantity * price
    }
    portfolio.totalValue = totalValue

    // 记录每日快照
    dailySnapshots.push({
      date,
      portfolioValue: totalValue,
      positionsCount: portfolio.positions.size,
    })
  }

  // 生成最终持仓
  const finalPositions: BacktestPosition[] = []
  for (const [symbol, position] of portfolio.positions) {
    const currentPrice = 10 // 简化处理
    const marketValue = position.quantity * currentPrice
    finalPositions.push({
      symbol,
      name: position.name,
      quantity: position.quantity,
      avgCost: position.avgCost,
      currentPrice,
      marketValue,
      profit: marketValue - position.quantity * position.avgCost,
      profitRate: ((currentPrice - position.avgCost) / position.avgCost) * 100,
      holdingDays: Math.floor((Date.now() - position.openDate) / (24 * 60 * 60 * 1000)),
      openDate: position.openDate,
    })
  }

  return { trades, finalPositions, dailySnapshots }
}

function executeBuy(
  config: BacktestConfig,
  portfolio: Portfolio,
  prices: Map<string, number>,
  signal: TradingSignal
): BacktestTrade | null {
  const price = prices.get(signal.symbol) ?? signal.price
  const buyAmount = portfolio.cash * config.positionSize
  const slippagePrice = price * (1 + config.slippageRate)
  const quantity = Math.floor(buyAmount / slippagePrice / 100) * 100 // 整手

  if (quantity <= 0) return null

  const grossAmount = quantity * slippagePrice
  const commission = Math.max(grossAmount * config.commissionRate, config.minCommission)
  const netAmount = grossAmount + commission

  if (netAmount > portfolio.cash) return null

  portfolio.cash -= netAmount
  portfolio.positions.set(signal.symbol, {
    symbol: signal.symbol,
    name: signal.name,
    quantity,
    avgCost: slippagePrice,
    openDate: signal.date,
  })

  return {
    id: `trade_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    symbol: signal.symbol,
    name: signal.name,
    direction: 'BUY',
    price: slippagePrice,
    quantity,
    amount: grossAmount,
    commission,
    stampDuty: 0,
    slippage: price * config.slippageRate * quantity,
    netAmount,
    timestamp: signal.date,
    signal: signal.reason,
  }
}

function executeSell(
  config: BacktestConfig,
  portfolio: Portfolio,
  position: PositionRecord,
  prices: Map<string, number>,
  signal: TradingSignal
): BacktestTrade {
  const price = prices.get(signal.symbol) ?? signal.price
  const slippagePrice = price * (1 - config.slippageRate)
  const grossAmount = position.quantity * slippagePrice
  const commission = Math.max(grossAmount * config.commissionRate, config.minCommission)
  const stampDuty = grossAmount * config.stampDutyRate
  const netAmount = grossAmount - commission - stampDuty

  portfolio.cash += netAmount

  return {
    id: `trade_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    symbol: signal.symbol,
    name: signal.name,
    direction: 'SELL',
    price: slippagePrice,
    quantity: position.quantity,
    amount: grossAmount,
    commission,
    stampDuty,
    slippage: price * config.slippageRate * position.quantity,
    netAmount,
    timestamp: signal.date,
    signal: signal.reason,
  }
}

// ============================================================
// 绩效指标计算
// ============================================================

function calculateMetrics(
  config: BacktestConfig,
  snapshots: DailySnapshot[],
  trades: BacktestTrade[]
): BacktestMetrics {
  if (snapshots.length === 0) {
    return createEmptyMetrics()
  }

  const initialValue = config.initialCapital
  const finalValue = snapshots[snapshots.length - 1].portfolioValue

  // 计算收益率
  const totalReturn = ((finalValue - initialValue) / initialValue) * 100
  const backtestDays = Math.ceil((config.endDate - config.startDate) / (24 * 60 * 60 * 1000))
  const tradingDays = snapshots.length
  const years = tradingDays / 250
  const annualizedReturn = years > 0 ? (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100 : 0

  // 计算日收益率
  const dailyReturns: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const dailyReturn = (snapshots[i].portfolioValue - snapshots[i - 1].portfolioValue) / snapshots[i - 1].portfolioValue
    dailyReturns.push(dailyReturn)
  }

  // 计算最大回撤
  let maxValue = initialValue
  let maxDrawdown = 0
  let maxDrawdownDuration = 0
  let currentDrawdownDuration = 0

  for (const snapshot of snapshots) {
    if (snapshot.portfolioValue > maxValue) {
      maxValue = snapshot.portfolioValue
      currentDrawdownDuration = 0
    } else {
      const drawdown = (maxValue - snapshot.portfolioValue) / maxValue * 100
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
        maxDrawdownDuration = currentDrawdownDuration
      }
      currentDrawdownDuration++
    }
  }

  // 计算波动率
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length
  const volatility = Math.sqrt(variance * 250) * 100

  // 计算下行风险
  const negativeReturns = dailyReturns.filter((r) => r < 0)
  const downsideRisk = negativeReturns.length > 0
    ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length * 250) * 100
    : 0

  // 计算 Sharpe 比率
  const riskFreeRate = 0.03 // 年化无风险利率 3%
  const dailyRiskFree = riskFreeRate / 250
  const excessReturns = dailyReturns.map((r) => r - dailyRiskFree)
  const excessMean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length
  const excessStd = Math.sqrt(excessReturns.reduce((sum, r) => sum + Math.pow(r - excessMean, 2), 0) / excessReturns.length)
  const sharpeRatio = excessStd > 0 ? (excessMean / excessStd) * Math.sqrt(250) : 0

  // 计算 Sortino 比率
  const sortinoRatio = downsideRisk > 0 ? (annualizedReturn - riskFreeRate * 100) / downsideRisk : 0

  // 计算 Calmar 比率
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0

  // 交易统计
  const winTrades = trades.filter((t) => t.direction === 'SELL' && t.netAmount > t.amount)
  const lossTrades = trades.filter((t) => t.direction === 'SELL' && t.netAmount <= t.amount)
  const totalTrades = trades.length
  const winRate = totalTrades > 0 ? (winTrades.length / totalTrades) * 100 : 0
  const avgWinAmount = winTrades.length > 0
    ? winTrades.reduce((sum, t) => sum + (t.netAmount - t.amount), 0) / winTrades.length
    : 0
  const avgLossAmount = lossTrades.length > 0
    ? lossTrades.reduce((sum, t) => sum + (t.amount - t.netAmount), 0) / lossTrades.length
    : 0
  const profitFactor = avgLossAmount > 0 ? avgWinAmount / avgLossAmount : 0

  // 平均持仓天数
  const avgHoldingDays = tradingDays / (totalTrades / 2)

  // 最大持仓数
  const maxPositionsHeld = Math.max(...snapshots.map((s) => s.positionsCount))

  // 换手率
  const totalTurnover = trades.reduce((sum, t) => sum + t.amount, 0)
  const turnoverRate = (totalTurnover / initialValue / years) * 100

  return {
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    maxDrawdownDuration,
    volatility,
    downsideRisk,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    totalTrades,
    winTrades: winTrades.length,
    lossTrades: lossTrades.length,
    winRate,
    avgWinAmount,
    avgLossAmount,
    profitFactor,
    avgHoldingDays,
    maxPositionsHeld,
    turnoverRate,
    backtestDays,
    tradingDays,
  }
}

function createEmptyMetrics(): BacktestMetrics {
  return {
    totalReturn: 0,
    annualizedReturn: 0,
    maxDrawdown: 0,
    maxDrawdownDuration: 0,
    volatility: 0,
    downsideRisk: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    winRate: 0,
    avgWinAmount: 0,
    avgLossAmount: 0,
    profitFactor: 0,
    avgHoldingDays: 0,
    maxPositionsHeld: 0,
    turnoverRate: 0,
    backtestDays: 0,
    tradingDays: 0,
  }
}

// ============================================================
// 收益曲线构建
// ============================================================

function buildEquityCurve(snapshots: DailySnapshot[]): BacktestCurve {
  const points: BacktestCurvePoint[] = []
  let peakValue = snapshots[0]?.portfolioValue ?? 0

  for (const snapshot of snapshots) {
    const cumulativeReturn = ((snapshot.portfolioValue - (snapshots[0]?.portfolioValue ?? snapshot.portfolioValue)) 
      / (snapshots[0]?.portfolioValue ?? snapshot.portfolioValue)) * 100

    if (snapshot.portfolioValue > peakValue) {
      peakValue = snapshot.portfolioValue
    }

    const drawdown = peakValue > 0 ? ((peakValue - snapshot.portfolioValue) / peakValue) * 100 : 0

    points.push({
      date: snapshot.date,
      portfolioValue: snapshot.portfolioValue,
      dailyReturn: 0, // 可根据前一日计算
      cumulativeReturn,
      drawdown,
      positionsCount: snapshot.positionsCount,
    })
  }

  return { points }
}

// ============================================================
// 模拟数据生成
// ============================================================

function generateMockTradingDays(config: BacktestConfig, stocks: Stock[]): TradingDay[] {
  const days: TradingDay[] = []
  const dayMs = 24 * 60 * 60 * 1000
  let currentDate = config.startDate

  while (currentDate <= config.endDate) {
    const prices = new Map<string, number>()
    for (const stock of stocks) {
      // 模拟价格波动
      const basePrice = stock.price ?? 10
      const randomFactor = 1 + (Math.random() - 0.5) * 0.1
      prices.set(stock.symbol, basePrice * randomFactor)
    }

    days.push({ date: currentDate, prices })
    currentDate += dayMs
  }

  return days
}

// ============================================================
// 历史记录管理（IndexedDB）
// ============================================================

const DB_NAME = 'backtest_db'
const STORE_NAME = 'backtest_history'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'summary.executionTime' })
      }
    }
  })
}

async function persistBacktestResult(result: BacktestResult): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.add(result)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    logger.info('[backtestEngine] 回测结果已持久化', { executionTime: result.summary.executionTime })
  } catch (err) {
    logger.warn('[backtestEngine] 回测结果持久化失败', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function getBacktestHistory(): Promise<DataLayerResult<BacktestResult[]>> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const results = request.result as BacktestResult[]
        logger.info('[backtestEngine] 加载历史记录', { count: results.length })
        resolve({ success: true, data: results })
      }
      request.onerror = () => {
        resolve({ success: false, error: '加载历史记录失败' })
      }
    })
  } catch (err) {
    logger.error('[backtestEngine] 加载历史记录异常', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { success: false, error: '加载历史记录异常' }
  }
}

export async function deleteBacktest(executionTime: number): Promise<DataLayerResult<void>> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(executionTime)

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        logger.info('[backtestEngine] 删除回测记录', { executionTime })
        resolve({ success: true })
      }
      tx.onerror = () => {
        resolve({ success: false, error: '删除回测记录失败' })
      }
    })
  } catch (err) {
    logger.error('[backtestEngine] 删除回测记录异常', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { success: false, error: '删除回测记录异常' }
  }
}

// ============================================================
// 兼容性导出
// ============================================================

// 导出与 Store 兼容的函数
export const runBacktestEngineService = runBacktestEngine
export const getBacktestHistoryService = getBacktestHistory
export const deleteBacktestService = deleteBacktest
