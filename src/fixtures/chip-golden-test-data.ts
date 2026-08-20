/**
 * G3-B Golden Test 合成数据
 *
 * 10 只测试股票 × 4 种换手率场景
 * 关键设计：换手率需有**趋势性变化**（高→低 或 低→高），
 * 而非纯随机噪声，否则 hybrid 归一化后 ≈ linear。
 */

export type TurnoverTrend = 'stable' | 'decreasing' | 'increasing' | 'volatile' | 'spike_recent' | 'spike_early'

export interface ChipGoldenTestCase {
  symbol: string
  name: string
  tags: string[]
  closes: number[]
  volumes: number[]
  turnoverRates: number[]
  currentPrice: number
  turnoverTrend: TurnoverTrend
  /** 高换手率区间（最近 N 天），用于验证 hybrid 对近端筹码的放大效果 */
  highTRWindow: { start: number; end: number }
}

function generateSeries(
  days: number,
  startPrice: number,
  pattern: 'up' | 'down' | 'consolidation' | 'volatile',
  avgTurnover: number,
  volumeBase: number,
  seed: number,
  turnoverTrend: TurnoverTrend,
): { closes: number[]; volumes: number[]; turnoverRates: number[] } {
  const closes: number[] = []
  const volumes: number[] = []
  const turnoverRates: number[] = []
  let price = startPrice

  for (let i = 0; i < days; i++) {
    const t = i / days
    let drift = 0
    let volatility = 0

    switch (pattern) {
      case 'up':
        drift = 0.0015
        volatility = 0.012
        break
      case 'down':
        drift = -0.0008
        volatility = 0.015
        break
      case 'consolidation':
        drift = 0.0001
        volatility = 0.008
        break
      case 'volatile':
        drift = 0.0005 + Math.sin(t * Math.PI * 4) * 0.003
        volatility = 0.04
        break
    }

    const noise = Math.sin(seed + i * 0.7) * volatility + Math.cos(seed * 1.3 + i * 0.3) * volatility * 0.5
    price = Math.max(1, price * (1 + drift + noise))
    closes.push(Number(price.toFixed(2)))

    const volMultiplier = pattern === 'volatile' ? 2.5 : pattern === 'up' ? 1.2 : 1
    volumes.push(Math.round(volumeBase * volMultiplier * (0.7 + Math.abs(Math.sin(seed + i * 0.5)) * 0.8)))

    let turnoverFactor = 1
    switch (turnoverTrend) {
      case 'stable':
        turnoverFactor = 1 + Math.sin(seed + i * 0.3) * 0.2
        break
      case 'decreasing':
        turnoverFactor = 1.8 - t * 1.5 + Math.sin(seed + i * 0.3) * 0.15
        break
      case 'increasing':
        turnoverFactor = 0.3 + t * 2.0 + Math.sin(seed + i * 0.3) * 0.15
        break
      case 'volatile':
        turnoverFactor = 1 + Math.sin(t * Math.PI * 8 + seed) * 1.2 + Math.cos(t * Math.PI * 3 + seed) * 0.5
        break
      case 'spike_recent':
        turnoverFactor = i > days * 0.7 ? 3.5 + Math.sin(seed + i) * 0.5 : 0.8 + Math.sin(seed + i * 0.3) * 0.2
        break
      case 'spike_early':
        turnoverFactor = i < days * 0.3 ? 3.5 + Math.sin(seed + i) * 0.5 : 0.8 + Math.sin(seed + i * 0.3) * 0.2
        break
    }

    const baseTR = avgTurnover
    const tr = Math.min(0.5, Math.max(0.001, baseTR * turnoverFactor))
    turnoverRates.push(Number(tr.toFixed(4)))
  }

  return { closes, volumes, turnoverRates }
}

export function buildGoldenTestCases(): ChipGoldenTestCase[] {
  const cases: ChipGoldenTestCase[] = []

  const scenarios: {
    tags: string[]
    avgTR: number
    volumeBase: number
    pattern: 'up' | 'down' | 'consolidation' | 'volatile'
    trend: TurnoverTrend
  }[] = [
    { tags: ['low-turnover', 'blue-chip', 'trend-decreasing'], avgTR: 0.003, volumeBase: 80000, pattern: 'consolidation', trend: 'decreasing' },
    { tags: ['low-turnover', 'dividend', 'trend-stable'], avgTR: 0.004, volumeBase: 50000, pattern: 'up', trend: 'stable' },
    { tags: ['mid-turnover', 'growth', 'trend-increasing'], avgTR: 0.03, volumeBase: 120000, pattern: 'up', trend: 'increasing' },
    { tags: ['mid-turnover', 'growth-consolidation', 'trend-stable'], avgTR: 0.025, volumeBase: 100000, pattern: 'consolidation', trend: 'stable' },
    { tags: ['mid-turnover', 'cyclical-down', 'trend-decreasing'], avgTR: 0.035, volumeBase: 150000, pattern: 'down', trend: 'decreasing' },
    { tags: ['high-turnover', 'thematic', 'trend-spike-recent'], avgTR: 0.10, volumeBase: 250000, pattern: 'volatile', trend: 'spike_recent' },
    { tags: ['high-turnover', 'momentum-down', 'trend-spike-early'], avgTR: 0.12, volumeBase: 300000, pattern: 'down', trend: 'spike_early' },
    { tags: ['high-turnover', 'range-bound', 'trend-stable'], avgTR: 0.08, volumeBase: 200000, pattern: 'consolidation', trend: 'stable' },
    { tags: ['extreme-turnover', 'pump', 'trend-increasing'], avgTR: 0.20, volumeBase: 500000, pattern: 'volatile', trend: 'increasing' },
    { tags: ['extreme-turnover', 'dump', 'trend-decreasing'], avgTR: 0.25, volumeBase: 600000, pattern: 'volatile', trend: 'decreasing' },
  ]

  const symbols = ['600519', '000858', '300750', '002594', '601318', '688981', '002415', '300059', '300750-ST', '002800']
  const names = ['贵州茅台', '五粮液', '宁德时代', '比亚迪', '中国平安', '中芯国际', '海康威视', '东方财富', '乐视网', 'ST天润']
  const startPrices = [1700, 150, 250, 230, 45, 55, 35, 15, 50, 3]

  for (let i = 0; i < 10; i++) {
    const s = scenarios[i]!
    const { closes, volumes, turnoverRates } = generateSeries(
      250,
      startPrices[i]!,
      s.pattern,
      s.avgTR,
      s.volumeBase,
      i * 31 + 7,
      s.trend,
    )

    const currentPrice = closes[closes.length - 1]!
    const highTRWindow = findHighTurnoverWindow(turnoverRates)

    cases.push({
      symbol: symbols[i]!,
      name: names[i]!,
      tags: s.tags,
      closes,
      volumes,
      turnoverRates,
      currentPrice,
      turnoverTrend: s.trend,
      highTRWindow,
    })
  }

  return cases
}

function findHighTurnoverWindow(rates: number[]): { start: number; end: number } {
  const avg = rates.reduce((s, v) => s + v, 0) / rates.length
  const threshold = avg * 1.5
  let start = -1
  let end = -1
  for (let i = rates.length - 1; i >= 0; i--) {
    if (rates[i]! > threshold) {
      if (end === -1) end = i
      start = i
    } else if (end !== -1) {
      break
    }
  }
  if (start === -1) return { start: rates.length - 50, end: rates.length - 1 }
  return { start, end }
}
