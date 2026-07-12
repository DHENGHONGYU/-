import { describe, it, expect } from 'vitest'
import { generateId, now } from '@/data/db-utils'

/**
 * db-utils 工具函数模块测试
 *
 * 验证目标（PR-6 步骤 1.1）：
 * 1. generateId 行为契约：16 字符、唯一性、URL 安全字符集
 * 2. now 行为契约：Unix 毫秒时间戳、number 类型
 * 3. 与原 db.ts 实现的行为一致性（拆分前后兼容）
 */
describe('db-utils 工具函数模块', () => {
  describe('generateId - ID 生成器', () => {
    it('返回 16 字符长度的字符串', () => {
      const id = generateId()
      expect(id).toHaveLength(16)
    })

    it('生成的 ID 唯一性（10000 次调用无碰撞）', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 10000; i++) {
        ids.add(generateId())
      }
      expect(ids.size).toBe(10000)
    })

    it('仅包含 URL 安全字符（A-Za-z0-9_-）', () => {
      const id = generateId()
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('与原 db.ts 实现兼容（nanoid(16) 行为一致）', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
      expect(id1).toHaveLength(16)
      expect(id2).toHaveLength(16)
    })

    it('返回 string 类型', () => {
      expect(typeof generateId()).toBe('string')
    })
  })

  describe('now - 时间戳工具', () => {
    it('返回 Unix 毫秒时间戳', () => {
      const before = Date.now()
      const result = now()
      const after = Date.now()
      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })

    it('返回 number 类型', () => {
      expect(typeof now()).toBe('number')
    })

    it('与 Date.now() 行为一致（误差 < 50ms）', () => {
      expect(Math.abs(now() - Date.now())).toBeLessThan(50)
    })

    it('连续调用返回非递减值', () => {
      const t1 = now()
      const t2 = now()
      expect(t2).toBeGreaterThanOrEqual(t1)
    })
  })
})
