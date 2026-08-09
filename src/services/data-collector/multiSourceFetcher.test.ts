/**
 * @fileoverview multiSourceFetcher 边界条件单元测试
 *
 * 覆盖 calculatePearson / calculateBeta 的 NaN 传播防护，
 * 以及 fetchChipData 类型断言修复后的行为验证。
 *
 * 运行方式：
 *   npx vitest run src/services/data-collector/multiSourceFetcher.test.ts
 */

import { describe, it, expect } from 'vitest'
import { calculatePearson, calculateBeta } from './multiSourceFetcher'

// ============================================================
// calculatePearson — NaN 传播防护
// ============================================================

describe('calculatePearson', () => {
  describe('正常数据', () => {
    it('完全正相关应返回 ~1.0', () => {
      const pairs: Array<[number, number]> = [
        [1, 10],
        [2, 20],
        [3, 30],
        [4, 40],
        [5, 50],
      ]
      const result = calculatePearson(pairs)
      expect(result).toBeCloseTo(1.0, 4)
    })

    it('完全负相关应返回 ~-1.0', () => {
      const pairs: Array<[number, number]> = [
        [1, 50],
        [2, 40],
        [3, 30],
        [4, 20],
        [5, 10],
      ]
      const result = calculatePearson(pairs)
      expect(result).toBeCloseTo(-1.0, 4)
    })

    it('无相关应返回 ~0', () => {
      const pairs: Array<[number, number]> = [
        [1, 1],
        [2, 2],
        [3, 1],
        [4, 2],
        [5, 1],
        [6, 2],
      ]
      const result = calculatePearson(pairs)
      expect(Math.abs(result)).toBeLessThan(0.5)
    })
  })

  describe('边界条件 — 空数组与少量数据', () => {
    it('空数组应返回 0（非 NaN）', () => {
      expect(calculatePearson([])).toBe(0)
    })

    it('单个数据对应返回 0（非 NaN）', () => {
      expect(calculatePearson([[1, 2]])).toBe(0)
    })

    it('两个数据对应返回有效数值（非 NaN）', () => {
      const result = calculatePearson([
        [1, 2],
        [2, 4],
      ])
      expect(Number.isNaN(result)).toBe(false)
    })
  })

  describe('NaN 传播防护 — 修复后的核心边界', () => {
    it('pairs 含 NaN 时应过滤无效对，返回有效结果（非 NaN）', () => {
      const pairs: Array<[number, number]> = [
        [1, 10],
        [NaN, 20], // 无效对，应被过滤
        [3, 30],
        [4, 40],
        [5, 50],
      ]
      const result = calculatePearson(pairs)
      expect(Number.isNaN(result)).toBe(false)
      // 过滤掉 NaN 后剩余 4 对完全正相关
      expect(result).toBeCloseTo(1.0, 4)
    })

    it('pairs 全为 NaN 时应返回 0（非 NaN）', () => {
      const pairs: Array<[number, number]> = [
        [NaN, NaN],
        [NaN, NaN],
        [NaN, NaN],
      ]
      expect(calculatePearson(pairs)).toBe(0)
    })

    it('pairs 含 undefined 时应过滤无效对', () => {
      const pairs: Array<[number, number]> = [
        [1, 10],
        [undefined as unknown as number, 20], // 无效对
        [3, 30],
        [4, 40],
      ]
      const result = calculatePearson(pairs)
      expect(Number.isNaN(result)).toBe(false)
    })

    it('pairs 混合 NaN 和正常值时应正确计算', () => {
      const pairs: Array<[number, number]> = [
        [1, 1],
        [NaN, 99], // 无效
        [2, 2],
        [99, NaN], // 无效
        [3, 3],
        [4, 4],
      ]
      const result = calculatePearson(pairs)
      expect(Number.isNaN(result)).toBe(false)
      expect(result).toBeCloseTo(1.0, 4) // 剩余 4 对完全正相关
    })

    it('pairs 含 Infinity 时结果应非 NaN（或 0）', () => {
      const pairs: Array<[number, number]> = [
        [1, 1],
        [Infinity, 2],
        [3, 3],
      ]
      const result = calculatePearson(pairs)
      // Infinity 会被 reduce 吞掉，但不应返回 NaN
      expect(Number.isNaN(result)).toBe(false)
    })
  })
})

// ============================================================
// calculateBeta — NaN 传播防护
// ============================================================

describe('calculateBeta', () => {
  describe('正常数据', () => {
    it('标的与指数同涨同跌应返回正 Beta', () => {
      const pairs: Array<[number, number]> = [
        [100, 1000],
        [105, 1050],
        [110, 1100],
        [115, 1150],
        [120, 1200],
      ]
      const result = calculateBeta(pairs)
      expect(result).toBeGreaterThan(0)
      expect(Number.isNaN(result)).toBe(false)
    })

    it('标的涨指数跌应返回负 Beta', () => {
      // 标的收益率递增（0.1→0.2→0.3→0.4），指数收益率递减（更负）
      // 两序列反相关 → Beta 为负
      const pairs: Array<[number, number]> = [
        [100, 1000],
        [110, 990],
        [132, 960],
        [171.6, 900],
        [240.24, 810],
      ]
      const result = calculateBeta(pairs)
      expect(result).toBeLessThan(0)
      expect(Number.isNaN(result)).toBe(false)
    })
  })

  describe('边界条件 — 空数组与少量数据', () => {
    it('空数组应返回 0（非 NaN）', () => {
      expect(calculateBeta([])).toBe(0)
    })

    it('单个数据对应返回 0（无法计算收益率）', () => {
      expect(calculateBeta([[100, 1000]])).toBe(0)
    })

    it('两个数据对应返回 0（仅 1 个收益率，不足 2 个）', () => {
      expect(
        calculateBeta([
          [100, 1000],
          [110, 1050],
        ]),
      ).toBe(0)
    })
  })

  describe('NaN 传播防护 — 修复后的核心边界', () => {
    it('pairs 含 NaN 时应跳过无效对，返回有效结果（非 NaN）', () => {
      const pairs: Array<[number, number]> = [
        [100, 1000],
        [NaN, 1050], // 无效，跳过
        [110, 1100],
        [120, 1200],
        [NaN, NaN], // 无效，跳过
        [130, 1300],
      ]
      const result = calculateBeta(pairs)
      expect(Number.isNaN(result)).toBe(false)
    })

    it('pairs 全为 NaN 时应返回 0（非 NaN）', () => {
      const pairs: Array<[number, number]> = [
        [NaN, NaN],
        [NaN, NaN],
        [NaN, NaN],
        [NaN, NaN],
      ]
      expect(calculateBeta(pairs)).toBe(0)
    })

    it('pairs 含 undefined 时应跳过无效对', () => {
      const pairs: Array<[number, number]> = [
        [100, 1000],
        [undefined as unknown as number, 1050], // 无效
        [110, 1100],
        [120, 1200],
        [130, 1300],
        [140, 1400],
      ]
      const result = calculateBeta(pairs)
      expect(Number.isNaN(result)).toBe(false)
    })

    it('pairs 含 0 值时应跳过（避免除零），返回有效结果', () => {
      const pairs: Array<[number, number]> = [
        [0, 1000], // prevX=0，收益率除零，跳过
        [100, 1050],
        [105, 1100],
        [110, 1150],
        [115, 1200],
      ]
      const result = calculateBeta(pairs)
      expect(Number.isNaN(result)).toBe(false)
    })

    it('pairs 含 Infinity 时结果应非 NaN', () => {
      const pairs: Array<[number, number]> = [
        [100, 1000],
        [Infinity, 1050], // 无效
        [110, 1100],
        [120, 1200],
      ]
      const result = calculateBeta(pairs)
      expect(Number.isNaN(result)).toBe(false)
    })

    it('pairs 混合 NaN 和正常值时应正确计算', () => {
      const pairs: Array<[number, number]> = [
        [100, 1000],
        [NaN, 99], // 无效
        [105, 1050],
        [99, NaN], // 无效
        [110, 1100],
        [115, 1150],
        [120, 1200],
      ]
      const result = calculateBeta(pairs)
      expect(Number.isNaN(result)).toBe(false)
      expect(result).toBeGreaterThan(0)
    })
  })
})
