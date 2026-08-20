/**
 * G3-B Golden Test · 阶段 B（实盘风格数据验证）
 *
 * 设计：基于 10 只代表性股票的真实行情统计特征构造"实盘风格"Mock 数据
 * - 不是纯合成噪声，而是模拟真实市场统计特征：
 *   - 换手率幅度（大盘蓝筹 0.3-1% / 中小盘 2-5% / 题材股 8-20% / 妖股 20-40%）
 *   - 换手与量能正相关（放量时换手率上升）
 *   - 价格走势符合真实形态（拉升/回调/横盘/暴跌/反弹）
 *   - 价格波动有"动量"（相邻交易日收益率相关 > 0）
 *
 * 验证目标：
 * 1. hybrid vs linear 在实盘风格数据上的差异范围
 * 2. 接入 l7_l8 评分链路后，筹码维度得分变化
 * 3. 与阶段 A 纯合成数据对比，算法行为一致性
 *
 * @doc G3-B: 2026-08-20 阶段 B 实盘风格数据验证
 */

import type { KlineBar } from '@/data/types/types.marketData'

export interface RealMarketTestCase {
  symbol: string
  name: string
  marketCapTier: 'mega' | 'large' | 'mid' | 'small' | 'micro'
  tags: string[]
  /** 基于真实市场特征构造的 300 根日K（至少 250 根用于 250 窗口） */
  klines: KlineBar[]
}

// 简单线性同余随机数发生器（可复现）
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface RealisticPattern {
  days: number
  startPrice: number
  avgTurnover: number
  turnoverStd: number
  /** 日收益率分布：均值、标准差、动量系数（相邻日相关） */
  returnMean: number
  returnStd: number
  momentum: number
  /** 量价关系：换手与收益率绝对值的相关系数 */
  volumeReturnCorr: number
  /** 形态阶段：拉升高换手/回调低换手/横盘中等换手 */
  phases: Array<{
    from: number
    to: number
    returnScale: number
    turnoverScale: number
    label: string
  }>
}

function generateRealisticKlines(
  pattern: RealisticPattern,
  seed: number,
): KlineBar[] {
  const rand = mulberry32(seed)
  const klines: KlineBar[] = []

  let price = pattern.startPrice
  let prevReturn = 0

  // 起始日期
  const startDate = new Date(2025, 7, 1)

  for (let i = 0; i < pattern.days; i++) {
    // 确定当前阶段
    let phase = pattern.phases.find((p) => i >= p.from && i < p.to)
    if (!phase) phase = pattern.phases[pattern.phases.length - 1]!

    const returnScale = phase.returnScale
    const turnoverScale = phase.turnoverScale

    // 收益率（动量：与上一日收益率正相关）
    const noise1 = rand() * 2 - 1
    const noise2 = rand() * 2 - 1
    let dailyReturn = (pattern.returnMean + noise1 * pattern.returnStd) * returnScale
    dailyReturn += prevReturn * pattern.momentum  // 动量项
    prevReturn = dailyReturn

    // 当日波动：生成 OHLC
    const open = price
    const intradayVol = pattern.returnStd * returnScale * 1.5
    const highNoise = Math.abs(rand() * 2 - 1) * intradayVol
    const lowNoise = Math.abs(rand() * 2 - 1) * intradayVol
    const close = open * (1 + dailyReturn)
    const high = Math.max(open, close) * (1 + highNoise)
    const low = Math.min(open, close) * (1 - lowNoise)

    // 换手率：基础 + 量价关系（收益率绝对值越大换手越高）
    const baseTurnover = pattern.avgTurnover * turnoverScale
    const volShock = noise2 * pattern.turnoverStd
    const returnDrivenTurnover = Math.abs(dailyReturn) * pattern.volumeReturnCorr * 100
    // 换手率不会 < 0.05% 或 > 50%（真实市场极端值）
    let turnover = baseTurnover + volShock + returnDrivenTurnover
    turnover = Math.max(0.0005, Math.min(50, turnover))

    // 成交量：与换手正相关（换手=成交量/流通盘，流通盘近似恒定→量≈换手×常数）
    // 基准量：按 avgTurnover 估算，假设 ~1 亿元流通市值量级（随意但自洽）
    const floatShares = 1e8 / pattern.startPrice  // 假设流通市值 1 亿元
    const volume = floatShares * (turnover / 100)  // 股数
    const amount = volume * (open + close) / 2  // 成交额

    // 日期
    const dateObj = new Date(startDate.getTime() + i * 86400000)
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

    klines.push({
      date: dateStr,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(volume),
      amount: Math.round(amount),
      turnoverRate: Number(turnover.toFixed(4)),  // 百分比形式（与 KlineBar 定义一致）
    })

    price = close
  }

  return klines
}

export function buildRealMarketTestCases(): RealMarketTestCase[] {
  const cases: RealMarketTestCase[] = []

  const scenarios: Array<{
    symbol: string
    name: string
    marketCapTier: RealMarketTestCase['marketCapTier']
    tags: string[]
    pattern: RealisticPattern
    seed: number
  }> = [
    // 1. 贵州茅台（超大盘蓝筹）：极低换手 0.3-1%，年化收益 8-12%，波动低
    {
      symbol: '600519.SH',
      name: '贵州茅台',
      marketCapTier: 'mega',
      tags: ['白酒', '超大盘', '蓝筹', 'low-turnover'],
      seed: 10001,
      pattern: {
        days: 300,
        startPrice: 1680,
        avgTurnover: 0.32,
        turnoverStd: 0.1,
        returnMean: 0.0004,
        returnStd: 0.013,
        momentum: 0.05,
        volumeReturnCorr: 0.8,
        phases: [
          { from: 0, to: 100, returnScale: 0.9, turnoverScale: 0.9, label: '横盘温和' },
          { from: 100, to: 180, returnScale: 1.5, turnoverScale: 1.4, label: '春季行情拉升' },
          { from: 180, to: 240, returnScale: 0.6, turnoverScale: 0.7, label: '回调缩量' },
          { from: 240, to: 300, returnScale: 1.1, turnoverScale: 1.1, label: '中报预期反弹' },
        ],
      },
    },
    // 2. 宁德时代（大盘成长）：中换手 2-5%，波动偏大，赛道股
    {
      symbol: '300750.SZ',
      name: '宁德时代',
      marketCapTier: 'large',
      tags: ['新能源', '大盘成长', '赛道股', 'mid-turnover'],
      seed: 10002,
      pattern: {
        days: 300,
        startPrice: 248,
        avgTurnover: 3.2,
        turnoverStd: 1.2,
        returnMean: 0.0006,
        returnStd: 0.025,
        momentum: 0.12,
        volumeReturnCorr: 1.1,
        phases: [
          { from: 0, to: 70, returnScale: 0.7, turnoverScale: 0.8, label: '低位横盘' },
          { from: 70, to: 130, returnScale: 1.8, turnoverScale: 1.6, label: '锂电周期主升' },
          { from: 130, to: 200, returnScale: 1.3, turnoverScale: 1.4, label: '高位震荡' },
          { from: 200, to: 250, returnScale: 1.5, turnoverScale: 1.3, label: '获利回吐' },
          { from: 250, to: 300, returnScale: 1.0, turnoverScale: 0.9, label: '平台整理' },
        ],
      },
    },
    // 3. 比亚迪（大盘+汽车周期）：中换手 2.5-4%
    {
      symbol: '002594.SZ',
      name: '比亚迪',
      marketCapTier: 'large',
      tags: ['汽车', '大盘', '周期成长', 'mid-turnover'],
      seed: 10003,
      pattern: {
        days: 300,
        startPrice: 226,
        avgTurnover: 2.8,
        turnoverStd: 1.0,
        returnMean: 0.0005,
        returnStd: 0.022,
        momentum: 0.10,
        volumeReturnCorr: 1.0,
        phases: [
          { from: 0, to: 80, returnScale: 1.0, turnoverScale: 1.0, label: '震荡上行' },
          { from: 80, to: 160, returnScale: 1.6, turnoverScale: 1.5, label: '新能源车销量爆发' },
          { from: 160, to: 230, returnScale: 1.2, turnoverScale: 1.2, label: '高位分化' },
          { from: 230, to: 300, returnScale: 0.9, turnoverScale: 0.85, label: '销量增速回落' },
        ],
      },
    },
    // 4. 中国平安（金融蓝筹+价值）：低换手 1-2%，长期横盘/下跌
    {
      symbol: '601318.SH',
      name: '中国平安',
      marketCapTier: 'mega',
      tags: ['金融', '蓝筹', '价值', 'low-turnover'],
      seed: 10004,
      pattern: {
        days: 300,
        startPrice: 46.8,
        avgTurnover: 0.9,
        turnoverStd: 0.35,
        returnMean: -0.0002,
        returnStd: 0.015,
        momentum: 0.04,
        volumeReturnCorr: 0.7,
        phases: [
          { from: 0, to: 90, returnScale: 0.8, turnoverScale: 0.8, label: '阴跌缩量' },
          { from: 90, to: 150, returnScale: 1.3, turnoverScale: 1.4, label: '地产政策反弹' },
          { from: 150, to: 220, returnScale: 1.0, turnoverScale: 1.0, label: '利好兑现回落' },
          { from: 220, to: 300, returnScale: 0.7, turnoverScale: 0.7, label: '地量磨底' },
        ],
      },
    },
    // 5. 中芯国际（科技+半导体周期）：高换手 5-12%，题材驱动
    {
      symbol: '688981.SH',
      name: '中芯国际',
      marketCapTier: 'large',
      tags: ['半导体', '科技', '科创板', 'high-turnover', 'thematic'],
      seed: 10005,
      pattern: {
        days: 300,
        startPrice: 52.0,
        avgTurnover: 8.5,
        turnoverStd: 4.0,
        returnMean: 0.001,
        returnStd: 0.035,
        momentum: 0.18,
        volumeReturnCorr: 1.3,
        phases: [
          { from: 0, to: 60, returnScale: 0.9, turnoverScale: 0.7, label: '题材平静期' },
          { from: 60, to: 120, returnScale: 2.0, turnoverScale: 2.2, label: '国产替代主升浪' },
          { from: 120, to: 180, returnScale: 1.5, turnoverScale: 1.6, label: '高位天量' },
          { from: 180, to: 240, returnScale: 1.4, turnoverScale: 1.3, label: '题材退潮回调' },
          { from: 240, to: 300, returnScale: 1.1, turnoverScale: 1.0, label: '次新热点轮动' },
        ],
      },
    },
    // 6. 海康威视（白马+AI概念）：中换手 2-4%，机构持仓高
    {
      symbol: '002415.SZ',
      name: '海康威视',
      marketCapTier: 'large',
      tags: ['安防AI', '白马', '机构持仓', 'mid-turnover'],
      seed: 10006,
      pattern: {
        days: 300,
        startPrice: 33.5,
        avgTurnover: 1.8,
        turnoverStd: 0.8,
        returnMean: 0.0003,
        returnStd: 0.019,
        momentum: 0.07,
        volumeReturnCorr: 0.9,
        phases: [
          { from: 0, to: 100, returnScale: 0.8, turnoverScale: 0.8, label: '弱市缩量' },
          { from: 100, to: 160, returnScale: 1.7, turnoverScale: 1.7, label: 'AI 行情' },
          { from: 160, to: 230, returnScale: 1.0, turnoverScale: 1.0, label: 'AI 退潮横盘' },
          { from: 230, to: 300, returnScale: 1.3, turnoverScale: 1.3, label: '智能驾驶第二波' },
        ],
      },
    },
    // 7. 东方财富（券商+互联网金融）：高换手 5-10%，牛市贝塔
    {
      symbol: '300059.SZ',
      name: '东方财富',
      marketCapTier: 'large',
      tags: ['券商', '互金', 'high-turnover', 'beta'],
      seed: 10007,
      pattern: {
        days: 300,
        startPrice: 14.5,
        avgTurnover: 7.0,
        turnoverStd: 3.0,
        returnMean: 0.0002,
        returnStd: 0.03,
        momentum: 0.15,
        volumeReturnCorr: 1.2,
        phases: [
          { from: 0, to: 70, returnScale: 0.6, turnoverScale: 0.5, label: '地量成交低迷' },
          { from: 70, to: 130, returnScale: 2.2, turnoverScale: 2.4, label: '政策牛脉冲' },
          { from: 130, to: 200, returnScale: 1.2, turnoverScale: 1.3, label: '高位放量分歧' },
          { from: 200, to: 260, returnScale: 1.4, turnoverScale: 1.2, label: '政策预期再燃' },
          { from: 260, to: 300, returnScale: 0.9, turnoverScale: 0.9, label: '预期差修正' },
        ],
      },
    },
    // 8. 中青宝（题材+元宇宙妖股）：极高换手 12-25%，脉冲式行情
    {
      symbol: '300052.SZ',
      name: '中青宝',
      marketCapTier: 'small',
      tags: ['元宇宙', '题材妖股', 'extreme-turnover', 'pump-dump'],
      seed: 10008,
      pattern: {
        days: 300,
        startPrice: 18.0,
        avgTurnover: 16.0,
        turnoverStd: 8.0,
        returnMean: -0.0005,
        returnStd: 0.045,
        momentum: 0.25,
        volumeReturnCorr: 1.6,
        phases: [
          { from: 0, to: 50, returnScale: 0.6, turnoverScale: 0.4, label: '阴跌休眠' },
          { from: 50, to: 80, returnScale: 3.0, turnoverScale: 3.2, label: '概念启动连续涨停' },
          { from: 80, to: 130, returnScale: 2.5, turnoverScale: 3.0, label: '高位天量分歧' },
          { from: 130, to: 190, returnScale: 2.0, turnoverScale: 2.3, label: 'A 字型暴跌' },
          { from: 190, to: 250, returnScale: 1.0, turnoverScale: 1.0, label: '超跌反弹' },
          { from: 250, to: 300, returnScale: 0.8, turnoverScale: 0.7, label: '阴跌回归' },
        ],
      },
    },
    // 9. ST星星（微盘ST股）：极高换手 15-30%，摘帽预期炒作
    {
      symbol: '300256.SZ',
      name: 'ST星星',
      marketCapTier: 'micro',
      tags: ['ST', '微盘', '摘帽', 'extreme-turnover', 'speculative'],
      seed: 10009,
      pattern: {
        days: 300,
        startPrice: 3.2,
        avgTurnover: 22.0,
        turnoverStd: 10.0,
        returnMean: -0.001,
        returnStd: 0.05,
        momentum: 0.22,
        volumeReturnCorr: 1.4,
        phases: [
          { from: 0, to: 60, returnScale: 0.5, turnoverScale: 0.5, label: '退市恐慌阴跌' },
          { from: 60, to: 110, returnScale: 2.5, turnoverScale: 2.8, label: '重整方案出台' },
          { from: 110, to: 170, returnScale: 1.8, turnoverScale: 2.2, label: '摘帽预期炒作' },
          { from: 170, to: 230, returnScale: 1.5, turnoverScale: 1.8, label: '利好兑现回调' },
          { from: 230, to: 300, returnScale: 1.2, turnoverScale: 1.4, label: '重整结果博弈' },
        ],
      },
    },
    // 10. 寒武纪（AI芯片+科创板）：高换手 8-18%，趋势性强
    {
      symbol: '688256.SH',
      name: '寒武纪-U',
      marketCapTier: 'mid',
      tags: ['AI芯片', '科创板', '成长', 'high-turnover', 'momentum'],
      seed: 10010,
      pattern: {
        days: 300,
        startPrice: 230,
        avgTurnover: 12.0,
        turnoverStd: 5.0,
        returnMean: 0.0015,
        returnStd: 0.04,
        momentum: 0.20,
        volumeReturnCorr: 1.5,
        phases: [
          { from: 0, to: 70, returnScale: 0.8, turnoverScale: 0.8, label: 'AI 大模型前' },
          { from: 70, to: 150, returnScale: 2.3, turnoverScale: 2.4, label: '大模型行情主升' },
          { from: 150, to: 210, returnScale: 1.7, turnoverScale: 1.8, label: '高位巨量震荡' },
          { from: 210, to: 270, returnScale: 1.3, turnoverScale: 1.4, label: '监管影响回调' },
          { from: 270, to: 300, returnScale: 1.5, turnoverScale: 1.6, label: '国产算力第二波' },
        ],
      },
    },
  ]

  for (const s of scenarios) {
    const klines = generateRealisticKlines(s.pattern, s.seed)
    cases.push({
      symbol: s.symbol,
      name: s.name,
      marketCapTier: s.marketCapTier,
      tags: s.tags,
      klines,
    })
  }

  return cases
}
