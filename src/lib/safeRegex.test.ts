/**
 * lib/safeRegex — 单元测试
 *
 * 只增不删策略（TD-022 覆盖率增量 Round 3）：新增独立测试文件，不编辑/不删除已有测试。
 *
 * safeRegex(pattern, flags?) → RegExp
 * 4 个分支（对应 L19-L29）：
 *   ① if (!pattern || pattern.length === 0) → throw 空
 *   ② else if (pattern.length > 256)      → throw 超长
 *   ③ else if (flags 无效 /^[igmsuy]*$/)  → throw 无效标志
 *   ④ else return new RegExp(pattern, flags)
 *
 * 目的：补上 3 条 throw 分支 → 把 src/lib/ 桶 BR 从 73.5% → 推过 75% 阈值。
 */
import { describe, it, expect } from 'vitest'
import { safeRegex } from './safeRegex'

describe('lib/safeRegex', () => {
  describe('成功分支（return RegExp）', () => {
    it('pattern 有效 + flags 缺省 → 返回 RegExp，flags 默认 undefined', () => {
      const r = safeRegex('\\d+')
      expect(r).toBeInstanceOf(RegExp)
      expect(r.source).toBe('\\d+')
      expect(r.flags).toBe('')
      expect(r.test('abc123')).toBe(true)
      expect(r.test('abc')).toBe(false)
    })

    it('flags 包含 i（单一）', () => {
      const r = safeRegex('hello', 'i')
      expect(r.source).toBe('hello')
      expect(r.flags).toBe('i')
      expect(r.test('HELLO')).toBe(true)
    })

    it('flags 包含 g（单一）', () => {
      const r = safeRegex('a', 'g')
      expect(r.flags).toBe('g')
      expect('ababa'.match(r)?.length).toBe(3)
    })

    it('flags 混合 igmsuy（全 6 种合法标志的组合）', () => {
      const r = safeRegex('.', 'igm')
      expect(r.flags).toBe('gim') // V8 规范化 flags 顺序
    })

    it('pattern 长度 = 256（= MAX 边界，命中 L23 if 的假分支）', () => {
      const p = 'a'.repeat(256)
      expect(() => safeRegex(p)).not.toThrow()
      const r = safeRegex(p)
      expect(r.source).toBe(p)
    })

    it('pattern 长度 = 1（= L20 length===0 假分支，L23 超长假分支）', () => {
      const r = safeRegex('x')
      expect(r.test('x')).toBe(true)
    })

    it('pattern 含正则元字符（.、[、*、$）时正确当作正则处理', () => {
      const r = safeRegex('^a.b$')
      expect(r.test('aXb')).toBe(true)
      expect(r.test('xab')).toBe(false) // ^ 不命中
    })
  })

  describe('分支①：空 pattern → throw "[safeRegex] 模式不能为空"', () => {
    it('pattern = ""（空字符串，length 0）', () => {
      expect(() => safeRegex('')).toThrowError('[safeRegex] 模式不能为空')
    })

    it('pattern falsy 分支：pattern = null（通过 TS 类型 cast 触发 !pattern 分支）', () => {
      expect(() => (safeRegex as any)(null)).toThrowError('[safeRegex] 模式不能为空')
    })

    it('pattern falsy 分支：pattern = undefined', () => {
      expect(() => (safeRegex as any)(undefined)).toThrowError('[safeRegex] 模式不能为空')
    })
  })

  describe('分支②：超长 pattern（>256）→ throw 长度信息', () => {
    it('pattern 长度 = 257（MAX+1）', () => {
      const p = 'a'.repeat(257)
      expect(() => safeRegex(p)).toThrowError('[safeRegex] 模式过长: 257 > 256')
    })

    it('pattern 长度 = 1000（超很长）', () => {
      const p = 'x'.repeat(1000)
      expect(() => safeRegex(p)).toThrowError('[safeRegex] 模式过长: 1000 > 256')
    })
  })

  describe('分支③：flags 非法（不在 igmsuy 内）→ throw 无效标志', () => {
    it('flags 含 x（非合法标志）', () => {
      expect(() => safeRegex('abc', 'x')).toThrowError('[safeRegex] 无效标志: x')
    })

    it('flags 含 e', () => {
      expect(() => safeRegex('abc', 'e')).toThrowError('[safeRegex] 无效标志: e')
    })

    it('flags 合法 + 非法混合（"igx"）', () => {
      expect(() => safeRegex('abc', 'igx')).toThrowError('[safeRegex] 无效标志: igx')
    })

    it('flags 含中文或其它 Unicode', () => {
      expect(() => safeRegex('abc', '啊')).toThrowError('[safeRegex] 无效标志: 啊')
    })
  })

  describe('边界：其它 corner cases', () => {
    it('flags = ""（空 flags）→ 视作无任何 flags，不抛', () => {
      const r = safeRegex('x', '')
      expect(r.flags).toBe('')
      expect(r.test('x')).toBe(true)
    })

    it('flags undefined（缺省）与 flags "" 等价', () => {
      const r1 = safeRegex('y', undefined)
      const r2 = safeRegex('y')
      expect(r1.source).toBe(r2.source)
      expect(r1.flags).toBe(r2.flags)
    })

    it('new RegExp() 抛出的语法错误会透传（不在 safeRegex 的 3 条 throw 内，走底层引擎分支）', () => {
      // "[a-z" 是无效的正则（缺 ]），不是 safeRegex 的 throw 分支，是 RegExp 引擎抛
      expect(() => safeRegex('[a-z')).toThrow()
      // 注意：这里抛的是 SyntaxError，不是 safeRegex 定义的三条 Error（message 不含 [safeRegex]）
      try {
        safeRegex('[a-z')
        expect.fail('should have thrown')
      } catch (e: any) {
        expect(e.message).not.toContain('[safeRegex]')
      }
    })
  })
})
