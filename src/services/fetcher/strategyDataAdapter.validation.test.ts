/**
 * @test_id V9-TEST-ST-081-b
 * DataBridge 层 validation 函数专项单元测试
 *
 * 测试目标：
 * - toSafeEnum 枚举校验与回退
 * - toSafeBoolean 布尔规范化与回退
 *
 * 测试维度：
 * - 正常输入：合法枚举值、布尔值保持不变
 * - 非法输入：越界枚举、非法布尔表示回退到默认值
 * - 大小写敏感：枚举大小写不匹配时回退
 * - 自定义默认值：非法输入时返回自定义默认值
 *
 * 运行命令：
 *   npm test -- --run src/services/fetcher/strategyDataAdapter.validation.test.ts
 * @covers_docs [V9-DOC-PROJ-092, V9-DOC-BACK-003, V9-DOC-ARCH-008, V9-DOC-BACK-010, V9-DOC-QA-010]
*/
import { describe, test, expect } from 'vitest'
import {
  toSafeEnum,
  toSafeBoolean,
} from './strategyDataAdapter'

// ============================================================
// toSafeEnum
// ============================================================

describe('toSafeEnum', () => {
  const ALLOWED = ['bullish', 'bearish', 'neutral'] as const
  const DEFAULT = 'neutral'

  describe('正常输入', () => {
    test('合法枚举值 "bullish" 保持不变', () => {
      expect(toSafeEnum('bullish', ALLOWED, DEFAULT)).toBe('bullish')
    })
    test('合法枚举值 "bearish" 保持不变', () => {
      expect(toSafeEnum('bearish', ALLOWED, DEFAULT)).toBe('bearish')
    })
    test('合法枚举值 "neutral" 保持不变', () => {
      expect(toSafeEnum('neutral', ALLOWED, DEFAULT)).toBe('neutral')
    })
  })

  describe('非法输入 - 返回默认值', () => {
    test('非法字符串 "invalid" 返回默认值', () => {
      expect(toSafeEnum('invalid', ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('空字符串返回默认值', () => {
      expect(toSafeEnum('', ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('null 返回默认值', () => {
      expect(toSafeEnum(null, ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('undefined 返回默认值', () => {
      expect(toSafeEnum(undefined, ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('数字返回默认值', () => {
      expect(toSafeEnum(123, ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('对象返回默认值', () => {
      expect(toSafeEnum({ key: 'bullish' }, ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('数组返回默认值', () => {
      expect(toSafeEnum(['bullish'], ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('true 返回默认值', () => {
      expect(toSafeEnum(true, ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
  })

  describe('大小写敏感', () => {
    test('"Bullish" 不匹配 "bullish"，返回默认值', () => {
      expect(toSafeEnum('Bullish', ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
    test('"BULLISH" 不匹配 "bullish"，返回默认值', () => {
      expect(toSafeEnum('BULLISH', ALLOWED, DEFAULT)).toBe(DEFAULT)
    })
  })
})

// ============================================================
// toSafeBoolean
// ============================================================

describe('toSafeBoolean', () => {
  describe('正常输入', () => {
    test('true 保持不变', () => {
      expect(toSafeBoolean(true)).toBe(true)
    })
    test('false 保持不变', () => {
      expect(toSafeBoolean(false)).toBe(false)
    })
  })

  describe('数字输入', () => {
    test('数字 1 转换为 true', () => {
      expect(toSafeBoolean(1)).toBe(true)
    })
    test('数字 0 转换为 false', () => {
      expect(toSafeBoolean(0)).toBe(false)
    })
  })

  describe('字符串输入', () => {
    test('"true" 转换为 true', () => {
      expect(toSafeBoolean('true')).toBe(true)
    })
    test('"false" 转换为 false', () => {
      expect(toSafeBoolean('false')).toBe(false)
    })
  })

  describe('非法输入 - 返回默认值', () => {
    test('null 返回默认值 false', () => {
      expect(toSafeBoolean(null)).toBe(false)
    })
    test('undefined 返回默认值 false', () => {
      expect(toSafeBoolean(undefined)).toBe(false)
    })
    test('空字符串返回默认值 false', () => {
      expect(toSafeBoolean('')).toBe(false)
    })
    test('"yes" 返回默认值 false（不被识别）', () => {
      expect(toSafeBoolean('yes')).toBe(false)
    })
    test('"no" 返回默认值 false', () => {
      expect(toSafeBoolean('no')).toBe(false)
    })
    test('数字 2 返回默认值 false（只识别 0/1）', () => {
      expect(toSafeBoolean(2)).toBe(false)
    })
    test('对象返回默认值 false', () => {
      expect(toSafeBoolean({ a: 1 })).toBe(false)
    })
    test('数组返回默认值 false', () => {
      expect(toSafeBoolean([1])).toBe(false)
    })
  })

  describe('自定义默认值', () => {
    test('非法输入返回自定义默认值 true', () => {
      expect(toSafeBoolean('invalid', true)).toBe(true)
    })
    test('null 返回自定义默认值 true', () => {
      expect(toSafeBoolean(null, true)).toBe(true)
    })
  })
})
