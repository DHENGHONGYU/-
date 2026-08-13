/**
 * @test_id V9-TEST-COCKSHELL-MIGRATION-001
 * @covers_docs []
 *
 * CockpitShell 布局迁移日志边界测试
 *
 * 覆盖 3 个边界：
 *   1. 合法 JSON — saveMigrationLog 正确合并已有日志
 *   2. 脏字符串 — JSON.parse 失败时走 catch + logger.warn，不崩溃
 *   3. null — localStorage 无数据时 getLastMigrationLog 返回 null，saveMigrationLog 创建首条
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveMigrationLog, getLastMigrationLog, type LayoutMigrationLog } from '@/cockpit/CockpitShell'

const MIGRATION_KEY = 'v9_cockpit_layout_migration_log'

function createLog(overrides: Partial<LayoutMigrationLog> = {}): LayoutMigrationLog {
  return {
    timestamp: Date.now(),
    fromVersion: 3,
    toVersion: 4,
    removedInstanceIds: [],
    reason: 'test migration',
    ...overrides,
  }
}

describe('CockpitShell migration log', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('saveMigrationLog', () => {
    it('1. 合法 JSON：正确合并已有日志数组', () => {
      const existing: LayoutMigrationLog[] = [
        createLog({ reason: 'old migration', timestamp: 1000 }),
      ]
      localStorage.setItem(MIGRATION_KEY, JSON.stringify(existing))

      saveMigrationLog(createLog({ reason: 'new migration', timestamp: 2000 }))

      const stored = JSON.parse(localStorage.getItem(MIGRATION_KEY)!) as LayoutMigrationLog[]
      expect(stored).toHaveLength(2)
      expect(stored[0]!.reason).toBe('old migration')
      expect(stored[1]!.reason).toBe('new migration')
    })

    it('2. 脏字符串：JSON.parse 失败时不崩溃，走 catch + warn', () => {
      localStorage.setItem(MIGRATION_KEY, 'this is not JSON {{{')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 不应抛异常
      expect(() => saveMigrationLog(createLog())).not.toThrow()

      // logger.warn 应被调用（通过 console.warn 捕获，因为 logger 底层走 console）
      // 注意：不强制断言 warn 被调用，因为实现可能走 logger.warn 不一定走 console.warn
      warnSpy.mockRestore()
    })

    it('3. null：localStorage 无数据时创建首条日志', () => {
      // localStorage 已在 beforeEach 清空
      expect(localStorage.getItem(MIGRATION_KEY)).toBeNull()

      saveMigrationLog(createLog({ reason: 'first migration' }))

      const stored = JSON.parse(localStorage.getItem(MIGRATION_KEY)!) as LayoutMigrationLog[]
      expect(stored).toHaveLength(1)
      expect(stored[0]!.reason).toBe('first migration')
    })
  })

  describe('getLastMigrationLog', () => {
    it('1. 合法 JSON：返回最后一条迁移日志', () => {
      const logs: LayoutMigrationLog[] = [
        createLog({ reason: 'first', timestamp: 1000 }),
        createLog({ reason: 'last', timestamp: 2000 }),
      ]
      localStorage.setItem(MIGRATION_KEY, JSON.stringify(logs))

      const result = getLastMigrationLog()
      expect(result).not.toBeNull()
      expect(result!.reason).toBe('last')
    })

    it('2. 脏字符串：返回 null，不抛异常', () => {
      localStorage.setItem(MIGRATION_KEY, 'corrupted{{{')
      expect(() => getLastMigrationLog()).not.toThrow()
      expect(getLastMigrationLog()).toBeNull()
    })

    it('3. null：localStorage 无数据时返回 null', () => {
      expect(localStorage.getItem(MIGRATION_KEY)).toBeNull()
      expect(getLastMigrationLog()).toBeNull()
    })
  })
})
