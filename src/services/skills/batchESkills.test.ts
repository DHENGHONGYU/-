/**
 * @test_id V9-TEST-ST-110
 * @module services/skills/batchESkills.test
 * @description Batch E 交易集成 SKILL 单元测试
 *
 * 覆盖 S-02 仓位管理、S-13 入场信号、S-14 出场信号、S-15 风控止损。
  * @covers_docs []
*/

import { describe, it, expect } from 'vitest'
import { SkillRegistry } from './skillRegistry'
import {
  positionManagementSkill,
  entrySignalSkill,
  exitSignalSkill,
  riskStopLossSkill,
  type PositionManagementOutput,
  type EntrySignalOutput,
  type ExitSignalOutput,
  type RiskStopLossOutput,
} from './index'
import type { DailyQuotes, KlineBar, Stock } from '@/data/types'
import type { Order } from '@/data/types'

function buildStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '000001.SZ',
    name: '测试股票',
    researchStatus: 'watching',
    source: 'manual',
    dataVersion: 1,
    price: 100,
    pe: 15,
    pb: 2,
    ...overrides,
  }
}

function buildHistory(count: number, factory: (i: number) => KlineBar): KlineBar[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}

function buildDailyQuotes(history: KlineBar[], symbol = '000001.SZ'): DailyQuotes {
  return {
    symbol,
    latest: history[history.length - 1]!,
    history,
    period: 'daily',
    adjust: 'qfq',
    updatedAt: Date.now(),
  }
}

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    symbol: '000001.SZ',
    direction: 'buy',
    quantity: 100,
    price: 100,
    amount: 10000,
    status: 'filled',
    accountType: 'paper',
    createdAt: Date.now() - 25 * 60 * 60 * 1000,
    ...overrides,
  }
}

describe('Batch E trading skills', () => {
  const registry = new SkillRegistry()
  registry.register(positionManagementSkill)
  registry.register(entrySignalSkill)
  registry.register(exitSignalSkill)
  registry.register(riskStopLossSkill)

  // ============================================================
  // S-02 仓位管理
  // ============================================================

  describe('positionManagementSkill', () => {
    it('正常买入场景返回建议仓位与整手取整', async () => {
      const result = await registry.execute<PositionManagementOutput>('position-management', {
        symbol: '000001.SZ',
        params: {
          direction: 'buy',
          price: 100,
          portfolioValue: 1_000_000,
        },
      })

      expect(result.status).toBe('success')
      expect(result.data).toBeDefined()
      expect(result.data!.action).toBe('buy')
      expect(result.data!.targetShares).toBe(600)
      expect(result.data!.targetValue).toBe(60_000)
      expect(result.data!.positionPct).toBeCloseTo(0.06, 4)
      expect(result.data!.kellyPct).toBeCloseTo(0.25, 4)
      expect(result.data!.roundedDown).toBe(true)
      expect(result.data!.rationale).toContain('000001.SZ')
    })

    it('卖出方向返回当前持仓清仓', async () => {
      const result = await registry.execute<PositionManagementOutput>('position-management', {
        symbol: '000001.SZ',
        params: {
          direction: 'sell',
          price: 100,
          portfolioValue: 1_000_000,
          currentHoldingShares: 500,
          currentHoldingValue: 50_000,
        },
      })

      expect(result.status).toBe('success')
      expect(result.data!.action).toBe('sell')
      expect(result.data!.targetShares).toBe(500)
      expect(result.data!.targetValue).toBe(50_000)
    })

    it('缺少必要参数时返回失败', async () => {
      const result = await registry.execute<PositionManagementOutput>('position-management', {
        symbol: '000001.SZ',
        params: { direction: 'buy' },
      })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Invalid input')
    })
  })

  // ============================================================
  // S-13 入场信号
  // ============================================================

  describe('entrySignalSkill', () => {
    it('超跌反弹场景生成 buy_dip 入场信号', async () => {
      const history = buildHistory(40, (i) => {
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

      const result = await registry.execute<EntrySignalOutput>('entry-signal', {
        symbol: '000001.SZ',
        params: {
          stock: buildStock(),
          quotes: buildDailyQuotes(history),
        },
      })

      expect(result.status).toBe('success')
      expect(result.data).toBeDefined()
      expect(result.data!.signalCount).toBeGreaterThanOrEqual(1)
      expect(result.data!.strongestSignal.direction).toBe('buy')
      expect(result.data!.signals.some((s) => s.type === 'buy_dip')).toBe(true)
    })

    it('数据不足时返回失败', async () => {
      const history = buildHistory(5, (i) => ({
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 10000,
        amount: 1_000_000,
      }))

      const result = await registry.execute<EntrySignalOutput>('entry-signal', {
        symbol: '000001.SZ',
        params: {
          stock: buildStock(),
          quotes: buildDailyQuotes(history),
        },
      })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('K 线数据不足')
    })
  })

  // ============================================================
  // S-14 出场信号
  // ============================================================

  describe('exitSignalSkill', () => {
    it('止盈场景生成 sell_profit_taking 出场信号', async () => {
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

      const result = await registry.execute<ExitSignalOutput>('exit-signal', {
        symbol: '000001.SZ',
        params: {
          stock: buildStock(),
          quotes: buildDailyQuotes(history),
          costPrice: 100,
        },
      })

      expect(result.status).toBe('success')
      expect(result.data).toBeDefined()
      expect(result.data!.signalCount).toBeGreaterThanOrEqual(1)
      expect(result.data!.strongestSignal.direction).toBe('sell')
      expect(result.data!.signals.some((s) => s.type === 'sell_profit_taking')).toBe(true)
    })

    it('从高点大幅回撤时触发移动止损', async () => {
      const history = buildHistory(40, (i) => {
        let close: number
        let high: number
        if (i < 35) {
          close = 100 + i * 0.5
          high = close + 1
        } else {
          close = 105 - (i - 34) * 4
          high = 123
        }
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

      const result = await registry.execute<ExitSignalOutput>('exit-signal', {
        symbol: '000001.SZ',
        params: {
          stock: buildStock(),
          quotes: buildDailyQuotes(history),
          costPrice: 100,
        },
      })

      expect(result.status).toBe('success')
      expect(result.data!.stopLossSuggestion.triggered).toBe(true)
      // 当固定止损与移动止损同时触发时，fixed 代表从成本价已发生实际亏损，优先级更高
      expect(result.data!.stopLossSuggestion.type).toBe('fixed')
      expect(result.data!.signals.some((s) => s.type === 'sell_trailing_stop')).toBe(true)
    })
  })

  // ============================================================
  // S-15 风控止损
  // ============================================================

  describe('riskStopLossSkill', () => {
    it('合法买入订单通过风控检查', async () => {
      const result = await registry.execute<RiskStopLossOutput>('risk-stop-loss', {
        symbol: '000001.SZ',
        params: {
          order: {
            direction: 'buy',
            price: 100,
            quantity: 100,
            portfolioValue: 1_000_000,
            source: 'manual',
          },
          quotes: { updatedAt: Date.now() },
        },
      })

      expect(result.status).toBe('success')
      expect(result.data).toBeDefined()
      expect(result.data!.ok).toBe(true)
      expect(result.data!.riskLevel).toBe('low')
      expect(result.data!.blocks).toHaveLength(0)
      expect(result.data!.passedChecks).toContain('price-quantity-valid')
      expect(result.data!.stopLossSuggestion.suggested).toBe(true)
    })

    it('MCP 来源订单标记警告与人工复核', async () => {
      const result = await registry.execute<RiskStopLossOutput>('risk-stop-loss', {
        symbol: '000001.SZ',
        params: {
          order: {
            direction: 'buy',
            price: 100,
            quantity: 100,
            portfolioValue: 1_000_000,
            source: 'mcp',
          },
          quotes: { updatedAt: Date.now() },
        },
      })

      expect(result.status).toBe('success')
      expect(result.data!.ok).toBe(true)
      expect(result.data!.riskLevel).toBe('medium')
      expect(result.data!.warnings.some((w) => w.includes('人工复核'))).toBe(true)
    })

    it('超出单笔仓位上限被阻断', async () => {
      const result = await registry.execute<RiskStopLossOutput>('risk-stop-loss', {
        symbol: '000001.SZ',
        params: {
          order: {
            direction: 'buy',
            price: 100,
            quantity: 10000,
            portfolioValue: 1_000_000,
          },
          quotes: { updatedAt: Date.now() },
        },
      })

      expect(result.status).toBe('blocked')
      expect(result.data).toBeDefined()
      expect(result.data!.ok).toBe(false)
      expect(result.data!.riskLevel).toBe('blocked')
      expect(result.data!.blocks.some((b) => b.includes('单笔上限'))).toBe(true)
    })

    it('同标的冷却期内被阻断', async () => {
      const orders: Order[] = [
        buildOrder({
          symbol: '000001.SZ',
          direction: 'buy',
          quantity: 100,
          createdAt: Date.now() - 2 * 60 * 60 * 1000,
        }),
      ]

      const result = await registry.execute<RiskStopLossOutput>('risk-stop-loss', {
        symbol: '000001.SZ',
        params: {
          order: {
            direction: 'buy',
            price: 100,
            quantity: 100,
            portfolioValue: 1_000_000,
          },
          orders,
          quotes: { updatedAt: Date.now() },
        },
      })

      expect(result.status).toBe('blocked')
      expect(result.data!.blocks.some((b) => b.includes('冷却期'))).toBe(true)
    })

    it('缺少订单参数返回失败', async () => {
      const result = await registry.execute<RiskStopLossOutput>('risk-stop-loss', {
        symbol: '000001.SZ',
        params: {},
      })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Invalid input')
    })
  })
})
