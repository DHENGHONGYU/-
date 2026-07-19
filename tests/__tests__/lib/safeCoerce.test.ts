/**
 * @test_id V9-TEST-UT-093
 * safeCoerce 单元测试
 *
 * 覆盖 toSafeNumber / toSafeBoolean / toSafeEnum / toSafeString / toSafeArray 等
 * 类型安全强制转换函数的边界行为。
 *
 * 特别关注 toSafeBoolean 的字符串数字 '1'/'0' 识别范围验证，
 * 用于决策是否应该扩展识别范围。
  * @covers_docs []
*/
import { describe, it, expect } from 'vitest'
import {
  toSafeNumber,
  toSafeNumberInRange,
  toSafeOptionalNumber,
  toSafeEnum,
  toSafeBoolean,
  toSafeArray,
  toSafeString,
} from '@/lib/safeCoerce'

describe('safeCoerce — 类型安全强制转换工具', () => {
  // ============================================================
  // toSafeNumber
  // ============================================================
  describe('toSafeNumber() 安全数字转换', () => {
    it('正常数字保持不变', () => {
      expect(toSafeNumber(42)).toBe(42)
      expect(toSafeNumber(0)).toBe(0)
      expect(toSafeNumber(-1)).toBe(-1)
      expect(toSafeNumber(3.14)).toBe(3.14)
    })

    it('数字字符串解析为数字', () => {
      expect(toSafeNumber('42')).toBe(42)
      expect(toSafeNumber('3.14')).toBe(3.14)
      expect(toSafeNumber('-1')).toBe(-1)
    })

    it('无效值返回默认值', () => {
      expect(toSafeNumber('abc')).toBe(0)
      expect(toSafeNumber(NaN)).toBe(0)
      expect(toSafeNumber(Infinity)).toBe(0)
      expect(toSafeNumber(-Infinity)).toBe(0)
      expect(toSafeNumber(null)).toBe(0)
      expect(toSafeNumber(undefined)).toBe(0)
      expect(toSafeNumber('')).toBe(0)
    })

    it('自定义默认值', () => {
      expect(toSafeNumber('abc', 50)).toBe(50)
      expect(toSafeNumber(null, -1)).toBe(-1)
    })
  })

  // ============================================================
  // toSafeNumberInRange
  // ============================================================
  describe('toSafeNumberInRange() 范围校验数字转换', () => {
    it('范围内的值保持不变', () => {
      expect(toSafeNumberInRange(50, 0, 100, 0)).toBe(50)
      expect(toSafeNumberInRange(0, 0, 100, 0)).toBe(0)
      expect(toSafeNumberInRange(100, 0, 100, 0)).toBe(100)
    })

    it('越界值返回默认值', () => {
      expect(toSafeNumberInRange(-1, 0, 100, 0)).toBe(0)
      expect(toSafeNumberInRange(101, 0, 100, 0)).toBe(0)
    })

    it('无效值返回默认值', () => {
      expect(toSafeNumberInRange('abc', 0, 100, 0)).toBe(0)
      expect(toSafeNumberInRange(NaN, 0, 100, 0)).toBe(0)
      expect(toSafeNumberInRange(Infinity, 0, 100, 0)).toBe(0)
    })
  })

  // ============================================================
  // toSafeOptionalNumber
  // ============================================================
  describe('toSafeOptionalNumber() 可选数字转换', () => {
    it('正常数字保持不变', () => {
      expect(toSafeOptionalNumber(42)).toBe(42)
      expect(toSafeOptionalNumber('3.14')).toBe(3.14)
    })

    it('无效值返回 undefined 而非 0', () => {
      expect(toSafeOptionalNumber(null)).toBeUndefined()
      expect(toSafeOptionalNumber(undefined)).toBeUndefined()
      expect(toSafeOptionalNumber('')).toBeUndefined()
      expect(toSafeOptionalNumber('abc')).toBeUndefined()
    })
  })

  // ============================================================
  // toSafeEnum
  // ============================================================
  describe('toSafeEnum() 枚举值校验', () => {
    const ALLOWED = ['bullish', 'bearish', 'neutral'] as const

    it('合法枚举值保持不变', () => {
      expect(toSafeEnum('bullish', ALLOWED, 'neutral')).toBe('bullish')
      expect(toSafeEnum('bearish', ALLOWED, 'neutral')).toBe('bearish')
    })

    it('非法值返回默认值', () => {
      expect(toSafeEnum('invalid', ALLOWED, 'neutral')).toBe('neutral')
      expect(toSafeEnum(null, ALLOWED, 'neutral')).toBe('neutral')
      expect(toSafeEnum(123, ALLOWED, 'neutral')).toBe('neutral')
    })

    it('大小写敏感', () => {
      expect(toSafeEnum('Bullish', ALLOWED, 'neutral')).toBe('neutral')
      expect(toSafeEnum('BULLISH', ALLOWED, 'neutral')).toBe('neutral')
    })
  })

  // ============================================================
  // toSafeBoolean — 核心测试
  // ============================================================
  describe('toSafeBoolean() 安全布尔转换', () => {
    // --- 布尔类型 ---
    describe('布尔类型输入', () => {
      it('true 保持不变', () => {
        expect(toSafeBoolean(true)).toBe(true)
      })
      it('false 保持不变', () => {
        expect(toSafeBoolean(false)).toBe(false)
      })
    })

    // --- 数字类型 ---
    describe('数字类型输入', () => {
      it('数字 1 转换为 true', () => {
        expect(toSafeBoolean(1)).toBe(true)
      })
      it('数字 0 转换为 false', () => {
        expect(toSafeBoolean(0)).toBe(false)
      })
      it('非 0/1 的数字返回默认值', () => {
        expect(toSafeBoolean(2)).toBe(false)
        expect(toSafeBoolean(-1)).toBe(false)
        expect(toSafeBoolean(0.5)).toBe(false)
      })
      it('NaN 返回默认值', () => {
        expect(toSafeBoolean(NaN)).toBe(false)
        expect(toSafeBoolean(NaN, true)).toBe(true)
      })
      it('Infinity 返回默认值', () => {
        expect(toSafeBoolean(Infinity)).toBe(false)
        expect(toSafeBoolean(-Infinity)).toBe(false)
      })
    })

    // --- 字符串类型 ---
    describe('字符串类型输入', () => {
      it("'true' 转换为 true", () => {
        expect(toSafeBoolean('true')).toBe(true)
      })
      it("'false' 转换为 false", () => {
        expect(toSafeBoolean('false')).toBe(false)
      })
    })

    // --- 字符串数字 '1'/'0' 识别范围验证（核心决策点）---
    describe('字符串数字 "1"/"0" 识别范围验证', () => {
      /**
       * 决策背景：
       * - 当前设计：仅识别 true/false、1/0、'true'/'false'，其他返回 defaultValue
       * - 潜在增强：识别 '1'/'0' 字符串数字
       * - 风险：'1' 可能是评分值而非布尔值，扩展识别范围可能导致误判
       *
       * 本组测试验证当前行为（不识别 '1'/'0'），为扩展决策提供基线数据。
       */

      it("当前行为：'1' 返回默认值 false（不识别字符串数字）", () => {
        // 当前设计：严格匹配，不识别 '1'
        expect(toSafeBoolean('1')).toBe(false)
      })

      it("当前行为：'0' 返回默认值 false（不识别字符串数字）", () => {
        // 当前设计：严格匹配，不识别 '0'
        expect(toSafeBoolean('0')).toBe(false)
      })

      it("当前行为：'1' 带自定义默认值时返回 true", () => {
        // 验证：不识别 '1'，返回自定义默认值
        expect(toSafeBoolean('1', true)).toBe(true)
      })

      it("当前行为：'0' 带自定义默认值时返回 true", () => {
        // 验证：不识别 '0'，返回自定义默认值
        expect(toSafeBoolean('0', true)).toBe(true)
      })

      /**
       * 扩展识别范围的风险分析：
       *
       * 如果扩展为识别 '1'/'0'，则以下场景会产生误判：
       * 1. API 返回评分字段（如 rotationScore: '1'）被误判为 true
       * 2. API 返回等级字段（如 level: '0'）被误判为 false
       *
       * 当前严格匹配的设计更安全：
       * - API 布尔字段应使用标准 JSON true/false
       * - 数字字段应使用 1/0（数字类型）
       * - 字符串布尔应使用 'true'/'false'（明确语义）
       *
       * 结论：保持当前严格匹配设计，不扩展识别 '1'/'0'。
       */
    })

    // --- 字符串大小写变体 ---
    describe('字符串大小写变体', () => {
      it("'TRUE' 不被识别（大小写敏感）", () => {
        expect(toSafeBoolean('TRUE')).toBe(false)
      })
      it("'True' 不被识别（大小写敏感）", () => {
        expect(toSafeBoolean('True')).toBe(false)
      })
      it("'FALSE' 不被识别（大小写敏感）", () => {
        expect(toSafeBoolean('FALSE')).toBe(false)
      })
    })

    // --- 其他字符串 ---
    describe('其他字符串输入', () => {
      it("'yes' 不被识别", () => {
        expect(toSafeBoolean('yes')).toBe(false)
      })
      it("'no' 不被识别", () => {
        expect(toSafeBoolean('no')).toBe(false)
      })
      it('空字符串返回默认值', () => {
        expect(toSafeBoolean('')).toBe(false)
      })
    })

    // --- 空值 ---
    describe('空值输入', () => {
      it('null 返回默认值', () => {
        expect(toSafeBoolean(null)).toBe(false)
        expect(toSafeBoolean(null, true)).toBe(true)
      })
      it('undefined 返回默认值', () => {
        expect(toSafeBoolean(undefined)).toBe(false)
        expect(toSafeBoolean(undefined, true)).toBe(true)
      })
    })

    // --- 对象/数组 ---
    describe('对象/数组输入', () => {
      it('空对象返回默认值', () => {
        expect(toSafeBoolean({})).toBe(false)
      })
      it('非空对象返回默认值', () => {
        expect(toSafeBoolean({ a: 1 })).toBe(false)
      })
      it('空数组返回默认值', () => {
        expect(toSafeBoolean([])).toBe(false)
      })
      it('非空数组返回默认值', () => {
        expect(toSafeBoolean([1])).toBe(false)
      })
    })

    // --- BigInt ---
    describe('BigInt 输入', () => {
      it('BigInt(1) 不被识别为 true（类型不同）', () => {
        // typeof BigInt(1) === 'bigint'，不等于 number 1
        expect(toSafeBoolean(BigInt(1))).toBe(false)
      })
      it('BigInt(0) 不被识别为 false（类型不同）', () => {
        expect(toSafeBoolean(BigInt(0))).toBe(false)
      })
    })

    // --- Symbol ---
    describe('Symbol 输入', () => {
      it('Symbol() 返回默认值', () => {
        expect(toSafeBoolean(Symbol())).toBe(false)
      })
    })

    // --- 布尔对象 ---
    describe('布尔对象输入', () => {
      it('new Boolean(true) 不被识别（typeof object）', () => {
        // typeof new Boolean(true) === 'object'，不是 'boolean'
        expect(toSafeBoolean(new Boolean(true))).toBe(false)
      })
      it('new Boolean(false) 不被识别（typeof object）', () => {
        expect(toSafeBoolean(new Boolean(false))).toBe(false)
      })
    })

    // --- 自定义默认值 ---
    describe('自定义默认值', () => {
      it('非法输入返回自定义默认值 true', () => {
        expect(toSafeBoolean('invalid', true)).toBe(true)
        expect(toSafeBoolean(null, true)).toBe(true)
        expect(toSafeBoolean(2, true)).toBe(true)
      })
      it('自定义默认值不影响合法值的识别', () => {
        expect(toSafeBoolean(true, false)).toBe(true)
        expect(toSafeBoolean(false, true)).toBe(false)
        expect(toSafeBoolean(1, false)).toBe(true)
        expect(toSafeBoolean(0, true)).toBe(false)
      })
    })
  })

  // ============================================================
  // toSafeArray
  // ============================================================
  describe('toSafeArray() 安全数组转换', () => {
    it('数组保持不变', () => {
      expect(toSafeArray([1, 2, 3])).toEqual([1, 2, 3])
      expect(toSafeArray([])).toEqual([])
    })
    it('非数组返回空数组', () => {
      expect(toSafeArray(null)).toEqual([])
      expect(toSafeArray(undefined)).toEqual([])
      expect(toSafeArray('abc')).toEqual([])
      expect(toSafeArray(42)).toEqual([])
      expect(toSafeArray({ a: 1 })).toEqual([])
    })
  })

  // ============================================================
  // toSafeString
  // ============================================================
  describe('toSafeString() 安全字符串转换', () => {
    it('字符串保持不变', () => {
      expect(toSafeString('hello')).toBe('hello')
    })
    it('数字转为字符串', () => {
      expect(toSafeString(42)).toBe('42')
      expect(toSafeString(3.14)).toBe('3.14')
    })
    it('布尔转为字符串', () => {
      expect(toSafeString(true)).toBe('true')
      expect(toSafeString(false)).toBe('false')
    })
    it('null/undefined 返回默认值', () => {
      expect(toSafeString(null)).toBe('')
      expect(toSafeString(null, 'unknown')).toBe('unknown')
      expect(toSafeString(undefined, 'N/A')).toBe('N/A')
    })
  })
})
