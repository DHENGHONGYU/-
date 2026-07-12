/**
 * @fileoverview Signal 测试数据夹具
 * @description 提供交易信号相关的 builder 函数与典型场景常量
 *
 * 设计原则：
 * - builder 函数支持 Partial override
 * - 默认值符合业务真实形态（buy 信号、高置信度）
 * - 常量场景覆盖 buy/sell/hold/watch 四种 direction
 *
 * 使用示例：
 * ```typescript
 * import { buildSignal, MOCK_SIGNAL_BUY } from '../fixtures'
 *
 * it('应生成买入信号', () => {
 *   const signal = buildSignal({ symbol: '600519.SH', confidence: 0.85 })
 *   expect(signal.direction).toBe('buy')
 * })
 * ```
 */

import type { Signal, SignalSnapshot } from '@/data/types'

/**
 * 构建 SignalSnapshot 实例
 *
 * @param overrides 部分字段覆盖
 * @returns 完整的 SignalSnapshot 对象
 */
export function buildSignalSnapshot(overrides?: Partial<SignalSnapshot>): SignalSnapshot {
  return {
    pePercentile: 0.3,
    pbPercentile: 0.25,
    priceToMA20: 1.05,
    priceToMA60: 0.92,
    volumeRatio: 1.8,
    rsi14: 55,
    macdDirection: 'green',
    ...overrides,
  }
}

/**
 * 构建 Signal 实例（builder 模式 + override）
 *
 * @param overrides 部分字段覆盖
 * @returns 完整的 Signal 对象
 *
 * 默认值：
 * - id: 'test-signal-001'
 * - symbol: '600519.SH'
 * - direction: 'buy'
 * - type: 'technical'
 * - strategy: 'v6-engine'
 * - confidence: 0.75
 * - rationale: '估值合理，技术面转强'
 * - snapshot: 默认乐观指标（PE/PB 处于低位、放量上涨）
 * - createdAt: 固定时间戳
 */
export function buildSignal(overrides?: Partial<Signal>): Signal {
  const defaults: Signal = {
    id: 'test-signal-001',
    symbol: '600519.SH',
    direction: 'buy',
    type: 'technical',
    strategy: 'v6-engine',
    confidence: 0.75,
    rationale: '估值合理，技术面转强',
    snapshot: buildSignalSnapshot(),
    createdAt: 1700000000000,
  }

  return overrides ? { ...defaults, ...overrides } : defaults
}

/** 买入信号（高置信度，乐观指标） */
export const MOCK_SIGNAL_BUY: Signal = buildSignal({
  id: 'mock-buy-001',
  direction: 'buy',
  confidence: 0.85,
})

/** 卖出信号（高置信度，悲观指标） */
export const MOCK_SIGNAL_SELL: Signal = buildSignal({
  id: 'mock-sell-001',
  direction: 'sell',
  confidence: 0.82,
  rationale: '估值过高，技术面转弱',
  snapshot: buildSignalSnapshot({
    pePercentile: 0.85,
    pbPercentile: 0.80,
    priceToMA20: 1.15,
    volumeRatio: 2.5,
    rsi14: 75,
    macdDirection: 'red',
  }),
})

/** 持有信号（中置信度，中性指标） */
export const MOCK_SIGNAL_HOLD: Signal = buildSignal({
  id: 'mock-hold-001',
  direction: 'hold',
  confidence: 0.6,
  rationale: '估值合理，技术面震荡',
  snapshot: buildSignalSnapshot({
    pePercentile: 0.5,
    pbPercentile: 0.5,
    priceToMA20: 1.0,
    volumeRatio: 1.0,
    rsi14: 50,
    macdDirection: 'neutral',
  }),
})

/** 观察信号（低置信度，需进一步确认） */
export const MOCK_SIGNAL_WATCH: Signal = buildSignal({
  id: 'mock-watch-001',
  direction: 'watch',
  confidence: 0.4,
  rationale: '趋势尚未明朗，建议观察',
})

/** 批量信号场景（4 种 direction 各一个） */
export const MOCK_SIGNALS_BATCH: Signal[] = [
  MOCK_SIGNAL_BUY,
  MOCK_SIGNAL_SELL,
  MOCK_SIGNAL_HOLD,
  MOCK_SIGNAL_WATCH,
]
