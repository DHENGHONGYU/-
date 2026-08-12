/**
 * @test_id V9-TEST-ST-081-c
 * DataBridge 层 toSafeNumber 边界条件专项单元测试
 *
 * 测试目标：
 * - toSafeNumber 数字安全转换与边界处理
 *
 * 测试维度：
 * - 正常输入：整数、浮点数、负数、零、合法字符串数字
 * - 非法输入：null / undefined / 空字符串 / 非数字字符串 / NaN / Infinity / 对象 / 数组
 * - 布尔输入：true 转 1、false 转 0（JavaScript 语义兼容）
 * - 自定义默认值：非法输入时返回自定义默认值
 *
 * 运行命令：
 *   npm test -- --run src/services/fetcher/strategyDataAdapter.edge.test.ts
 * @covers_docs [V9-DOC-PROJ-092, V9-DOC-BACK-003, V9-DOC-ARCH-008, V9-DOC-BACK-010, V9-DOC-QA-010]
*/
import { describe, test, expect } from 'vitest'
import {
  toSafeNumber,
} from './strategyDataAdapter'

// ============================================================
// toSafeNumber
// ============================================================

describe('toSafeNumber', () => {
  describe('正常输入', () => {
    test('正整数保持不变', () => {
      expect(toSafeNumber(42)).toBe(42)
    })
    test('负数保持不变', () => {
      expect(toSafeNumber(-10)).toBe(-10)
    })
    test('浮点数保持不变', () => {
      expect(toSafeNumber(3.14)).toBe(3.14)
    })
    test('0 保持不变', () => {
      expect(toSafeNumber(0)).toBe(0)
    })
    test('合法字符串数字 "4.5" 转换为 4.5', () => {
      expect(toSafeNumber('4.5')).toBe(4.5)
    })
    test('合法字符串数字 "80" 转换为 80', () => {
      expect(toSafeNumber('80')).toBe(80)
    })
    test('字符串 "0" 转换为 0', () => {
      expect(toSafeNumber('0')).toBe(0)
    })
    test('字符串 "-5" 转换为 -5', () => {
      expect(toSafeNumber('-5')).toBe(-5)
    })
  })

  describe('非法输入 - 返回默认值', () => {
    test('null 返回默认值', () => {
      expect(toSafeNumber(null)).toBe(0)
    })
    test('undefined 返回默认值', () => {
      expect(toSafeNumber(undefined)).toBe(0)
    })
    test('空字符串返回默认值', () => {
      expect(toSafeNumber('')).toBe(0)
    })
    test('非数字字符串 "abc" 返回默认值', () => {
      expect(toSafeNumber('abc')).toBe(0)
    })
    test('NaN 返回默认值', () => {
      expect(toSafeNumber(NaN)).toBe(0)
    })
    test('Infinity 返回默认值', () => {
      expect(toSafeNumber(Infinity)).toBe(0)
    })
    test('-Infinity 返回默认值', () => {
      expect(toSafeNumber(-Infinity)).toBe(0)
    })
    test('对象返回默认值', () => {
      expect(toSafeNumber({ a: 1 })).toBe(0)
    })
    test('数组返回默认值', () => {
      expect(toSafeNumber([1, 2, 3])).toBe(0)
    })
    test('true 转换为 1（JavaScript Number(true) === 1，符合预期）', () => {
      expect(toSafeNumber(true)).toBe(1)
    })
    test('false 转换为 0（JavaScript Number(false) === 0，符合预期）', () => {
      expect(toSafeNumber(false)).toBe(0)
    })
  })

  describe('自定义默认值', () => {
    test('null 时返回自定义默认值 50', () => {
      expect(toSafeNumber(null, 50)).toBe(50)
    })
    test('NaN 时返回自定义默认值 -1', () => {
      expect(toSafeNumber(NaN, -1)).toBe(-1)
    })
    test('非法字符串时返回自定义默认值 100', () => {
      expect(toSafeNumber('invalid', 100)).toBe(100)
    })
  })
})
