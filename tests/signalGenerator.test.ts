/**
 * @test_id V9-TEST-UT-056
 * @covers_docs [V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-BACK-008, V9-DOC-DATA-013]
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { dataLayer } from '@/data/dataLayer'
import { db } from '@/data/db'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { generateSignalsForSymbol, pickStrongestSignal } from '@/services/trading/signalGenerator'
import type { DailyQuotes, KlineBar, Stock } from '@/data/types'

function buildHistory(count: number, factory: (i: number) => KlineBar): KlineBar[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}

async function seedStockAndQuotes(
  symbol: string,
  history: KlineBar[],
): Promise<{ stock: Stock; quotes: DailyQuotes }> {
  const price = history[history.length - 1]!.close
  await dataLayer.stocks.add({
    symbol,
    name: '测试股票',
    researchStatus: 'watching',
    source: 'manual',
    price,
  })
  const stock: Stock = {
    symbol,
    name: '测试股票',
    researchStatus: 'watching',
    source: 'manual',
    price,
    dataVersion: 0,
  }

  const quotes: DailyQuotes = {
    symbol,
    latest: history[history.length - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
  await dataLayer.dailyQuotes.save(quotes)
  return { stock, quotes }
}

describe('signalGenerator', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    dataBridge.invalidateCache(STORE_NAME.stocks)
    dataBridge.invalidateCache(STORE_NAME.dailyQuotes)
    dataBridge.invalidateCache(STORE_NAME.signals)
  })

  it('returns watch signal when quotes are missing', async () => {
    await dataLayer.stocks.add({
      symbol: '000001.SZ',
      name: '测试',
      researchStatus: 'watching',
      source: 'manual',
      pool: 'research',
    })

    const signals = await generateSignalsForSymbol('000001.SZ')

    expect(signals).toHaveLength(1)
    expect(signals[0]!.direction).toBe('watch')
  })

  it('generates buy_dip signal when price drops below MA20 and RSI is oversold', async () => {
    const history = buildHistory(40, (i) => {
      // 前 39 天平稳，最后一天大跌
      const close = i < 39 ? 100 + i * 0.1 : 85
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close - 0.5,
        high: close + 0.5,
        low: close - 1,
        close,
        volume: 10000,
        amount: 10000 * close,
      }
    })

    await seedStockAndQuotes('000001.SZ', history)
    const signals = await generateSignalsForSymbol('000001.SZ')

    const dip = signals.find((s) => s.type === 'buy_dip')
    expect(dip).toBeDefined()
    expect(dip?.direction).toBe('buy')
  })

  it('generates buy_pivot signal on breakout with volume surge', async () => {
    const history = buildHistory(40, (i) => {
      const close = 50 + i * 0.5
      const volume = i === 39 ? 25000 : 10000
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close - 0.3,
        high: close + 0.3,
        low: close - 0.3,
        close,
        volume,
        amount: volume * close,
      }
    })

    await seedStockAndQuotes('000002.SZ', history)
    const signals = await generateSignalsForSymbol('000002.SZ')

    const pivot = signals.find((s) => s.type === 'buy_pivot')
    expect(pivot).toBeDefined()
    expect(pivot?.direction).toBe('buy')
  })

  it('generates sell_profit_taking signal when price is far above MA20 and RSI is high', async () => {
    const history = buildHistory(40, (i) => {
      const close = i < 39 ? 100 + i * 0.2 : 140
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close - 0.5,
        high: close + 0.5,
        low: close - 0.5,
        close,
        volume: 10000,
        amount: 10000 * close,
      }
    })

    await seedStockAndQuotes('000003.SZ', history)
    const signals = await generateSignalsForSymbol('000003.SZ')

    const profit = signals.find((s) => s.type === 'sell_profit_taking')
    expect(profit).toBeDefined()
    expect(profit?.direction).toBe('sell')
  })

  it('generates sell_trailing_stop signal after a significant drawdown', async () => {
    const history = buildHistory(40, (i) => {
      const close = i < 35 ? 100 + i * 0.5 : 105 - (i - 34) * 4
      const high = close + 1
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close - 0.5,
        high,
        low: close - 1,
        close,
        volume: 10000,
        amount: 10000 * close,
      }
    })

    await seedStockAndQuotes('000004.SZ', history)
    const signals = await generateSignalsForSymbol('000004.SZ')

    const stop = signals.find((s) => s.type === 'sell_trailing_stop')
    expect(stop).toBeDefined()
    expect(stop?.direction).toBe('sell')
  })

  it('generates composite signals when multiple same-direction signals fire', async () => {
    // 同时满足 sell_profit_taking 与 sell_trailing_stop：
    // 价格远高于 MA20 且 RSI 超买，同时从近期高点大幅回撤
    const history = buildHistory(40, (i) => {
      let close: number
      if (i < 38) close = 100
      else if (i === 38) close = 170
      else close = 150
      return {
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 10000,
        amount: 10000 * close,
      }
    })

    await seedStockAndQuotes('000005.SZ', history)
    const signals = await generateSignalsForSymbol('000005.SZ')

    const composite = signals.find((s) => s.type === 'composite_sell')
    expect(composite).toBeDefined()
    expect(composite?.direction).toBe('sell')
  })

  it('applies confidence override: high-confidence sell beats low-confidence buy', () => {
    // sell(0.80) vs buy(0.50): gap=0.30>=0.20, sell_conf=0.80>=0.70 → sell 胜出
    const signals = [
      { direction: 'hold' as const, confidence: 0.9, type: 'hold', strategy: 'test', id: '1', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'buy' as const, confidence: 0.5, type: 'buy_dip', strategy: 'test', id: '2', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'sell' as const, confidence: 0.8, type: 'sell', strategy: 'test', id: '3', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
    ]
    const strongest = pickStrongestSignal(signals)
    expect(strongest?.direction).toBe('sell')
    expect(strongest?.confidence).toBe(0.8)
  })

  it('applies confidence override at exact boundary: sell_trailing_stop(0.70) vs buy_safety_margin(0.50)', () => {
    // 真实信号值：sell_trailing_stop conf=0.70, buy_safety_margin conf=0.50
    // 浮点精度：0.7-0.5=0.1999... 需 EPSILON 容差才能 >= 0.20
    const signals = [
      { direction: 'buy' as const, confidence: 0.5, type: 'buy_safety_margin', strategy: 'test', id: '1', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'sell' as const, confidence: 0.7, type: 'sell_trailing_stop', strategy: 'test', id: '2', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
    ]
    const strongest = pickStrongestSignal(signals)
    expect(strongest?.direction).toBe('sell')
    expect(strongest?.confidence).toBe(0.7)
  })

  it('keeps direction priority when confidence gap is below threshold', () => {
    // buy(0.65) vs sell(0.75): gap=0.10<0.20 → buy 胜出
    const signals = [
      { direction: 'sell' as const, confidence: 0.75, type: 'composite_sell', strategy: 'test', id: '1', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'buy' as const, confidence: 0.65, type: 'buy_pivot', strategy: 'test', id: '2', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
    ]
    const strongest = pickStrongestSignal(signals)
    expect(strongest?.direction).toBe('buy')
    expect(strongest?.confidence).toBe(0.65)
  })

  it('keeps direction priority when sell confidence is below override floor', () => {
    // buy(0.50) vs sell(0.68): sell_conf=0.68<0.70 → buy 胜出
    const signals = [
      { direction: 'sell' as const, confidence: 0.68, type: 'sell_trailing_stop', strategy: 'test', id: '1', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'buy' as const, confidence: 0.50, type: 'buy_safety_margin', strategy: 'test', id: '2', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
    ]
    const strongest = pickStrongestSignal(signals)
    expect(strongest?.direction).toBe('buy')
    expect(strongest?.confidence).toBe(0.50)
  })

  it('does not apply override for non-trade directions (watch/hold)', () => {
    // buy(0.50) vs watch(0.95): watch 非交易方向 → buy 胜出
    const signals = [
      { direction: 'watch' as const, confidence: 0.95, type: 'watch', strategy: 'test', id: '1', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'buy' as const, confidence: 0.50, type: 'buy_safety_margin', strategy: 'test', id: '2', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
    ]
    const strongest = pickStrongestSignal(signals)
    expect(strongest?.direction).toBe('buy')
    expect(strongest?.confidence).toBe(0.50)
  })

  it('sorts same direction by confidence descending', () => {
    const signals = [
      { direction: 'buy' as const, confidence: 0.50, type: 'buy_safety_margin', strategy: 'test', id: '1', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'buy' as const, confidence: 0.75, type: 'composite_buy', strategy: 'test', id: '2', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
      { direction: 'buy' as const, confidence: 0.55, type: 'buy_dip', strategy: 'test', id: '3', symbol: 'A', rationale: '', snapshot: {}, createdAt: 0 },
    ]
    const strongest = pickStrongestSignal(signals)
    expect(strongest?.direction).toBe('buy')
    expect(strongest?.confidence).toBe(0.75)
    expect(strongest?.type).toBe('composite_buy')
  })
})
