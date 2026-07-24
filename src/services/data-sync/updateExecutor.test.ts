/**
 * updateExecutor.test.ts
 * 数据更新执行器单元测试
 *
 * 覆盖：
 * - selectUpdateMode: 更新模式选择
 * - executeBatchUpdate: 批量更新执行
 * - executeIncrementalUpdate: 增量更新执行
 * - executeUpdate: 自动选择模式的更新入口
 * - SYNC_EVENTS: 同步事件常量
 * - 更新统计：成功/失败/跳过数
 * - 空列表处理
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  selectUpdateMode,
  executeBatchUpdate,
  executeIncrementalUpdate,
  executeUpdate,
  SYNC_EVENTS,
} from './updateExecutor'
import type { RecordDiff } from '@/types/modules/data-sync.types'

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const mockEmit = vi.fn()
vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    emit: (...args: unknown[]) => mockEmit(...args),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

vi.mock('./conflictResolver', () => ({
  resolveConflictsBatch: vi.fn((diffs: readonly RecordDiff[], _policy: string) => {
    // 模拟：每个冲突都返回一个解决结果
    return diffs
      .filter((d: RecordDiff) => d.status === 'conflict')
      .map((d: RecordDiff) => ({
        symbol: d.symbol,
        resolution: {
          policy: 'last-write-wins',
          resolvedData: d.newData ?? null,
          unresolvedConflicts: [],
          autoResolved: true,
          reason: '测试模拟：冲突已解决',
        },
      }))
  }),
}))

describe('updateExecutor — selectUpdateMode', () => {
  describe('用户偏好优先', () => {
    it('用户指定 batch → 返回 batch', () => {
      const mode = selectUpdateMode(100, 0.5, false, false, 'batch')
      expect(mode).toBe('batch')
    })

    it('用户指定 incremental → 返回 incremental', () => {
      const mode = selectUpdateMode(100, 0.5, false, false, 'incremental')
      expect(mode).toBe('incremental')
    })
  })

  describe('首次导入', () => {
    it('首次导入 → 返回 batch', () => {
      const mode = selectUpdateMode(100, 0.3, false, true)
      expect(mode).toBe('batch')
    })

    it('首次导入即使有冲突也用 batch', () => {
      const mode = selectUpdateMode(100, 0.3, true, true)
      expect(mode).toBe('batch')
    })
  })

  describe('高变更率', () => {
    it('变更率 > 80% → 返回 batch', () => {
      const mode = selectUpdateMode(1000, 0.9, false, false)
      expect(mode).toBe('batch')
    })

    it('变更率 = 80% → 不满足 batch 条件（需要 > 0.8）', () => {
      const mode = selectUpdateMode(1000, 0.8, false, false)
      // 0.8 不大于 0.8 → 不触发 batch
      // 无冲突 + 记录数 >= 100 → incremental
      expect(mode).toBe('incremental')
    })
  })

  describe('有冲突', () => {
    it('存在冲突 → 返回 incremental', () => {
      const mode = selectUpdateMode(1000, 0.3, true, false)
      expect(mode).toBe('incremental')
    })
  })

  describe('小数据量', () => {
    it('记录数 < 100 → 返回 batch', () => {
      const mode = selectUpdateMode(50, 0.3, false, false)
      expect(mode).toBe('batch')
    })

    it('记录数 = 100 → 不满足 < 100，走默认 incremental', () => {
      const mode = selectUpdateMode(100, 0.3, false, false)
      expect(mode).toBe('incremental')
    })
  })

  describe('默认情况', () => {
    it('大数据量低变更率无冲突 → 返回 incremental', () => {
      const mode = selectUpdateMode(1000, 0.3, false, false)
      expect(mode).toBe('incremental')
    })
  })
})

describe('updateExecutor — executeBatchUpdate', () => {
  beforeEach(() => {
    mockEmit.mockClear()
  })

  describe('单条更新', () => {
    it('单条记录 → 成功执行', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      const result = await executeBatchUpdate(records, 'stocks')

      expect(result.status).toBe('success')
      expect(result.mode).toBe('batch')
      expect(result.targetStore).toBe('stocks')
      expect(result.recordsAdded).toBe(1)
    })
  })

  describe('批量更新', () => {
    it('多条记录 → 全部计入 recordsAdded', async () => {
      const records = [
        { symbol: '600519.SH', price: 100 },
        { symbol: '000001.SZ', price: 20 },
        { symbol: '300750.SZ', price: 200 },
      ]
      const result = await executeBatchUpdate(records, 'stocks')

      expect(result.status).toBe('success')
      expect(result.recordsAdded).toBe(3)
      expect(result.recordsModified).toBe(0)
      expect(result.recordsDeleted).toBe(0)
    })
  })

  describe('空列表处理', () => {
    it('空数组 → 成功状态，0 条记录', async () => {
      const result = await executeBatchUpdate([], 'stocks')

      expect(result.status).toBe('success')
      expect(result.recordsAdded).toBe(0)
      expect(result.recordsModified).toBe(0)
      expect(result.recordsUnchanged).toBe(0)
    })
  })

  describe('事件触发', () => {
    it('成功更新 → 触发 UPDATE_START 和 UPDATE_SUCCESS 事件', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      await executeBatchUpdate(records, 'stocks')

      // 至少触发了 UPDATE_START 和 UPDATE_SUCCESS
      const eventNames = mockEmit.mock.calls.map((call: unknown[]) => call[0])
      expect(eventNames).toContain(SYNC_EVENTS.UPDATE_START)
      expect(eventNames).toContain(SYNC_EVENTS.UPDATE_SUCCESS)
    })

    it('UPDATE_START 事件包含 taskId、mode、targetStore', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      await executeBatchUpdate(records, 'daily_quotes')

      const startCall = mockEmit.mock.calls.find(
        (call: unknown[]) => call[0] === SYNC_EVENTS.UPDATE_START,
      )
      expect(startCall).toBeDefined()
      const payload = startCall![1] as Record<string, unknown>
      expect(payload).toHaveProperty('taskId')
      expect(payload.mode).toBe('batch')
      expect(payload.targetStore).toBe('daily_quotes')
      expect(payload.recordCount).toBe(1)
    })
  })

  describe('返回字段完整性', () => {
    it('返回所有必需字段', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      const result = await executeBatchUpdate(records, 'stocks')

      expect(result).toHaveProperty('mode')
      expect(result).toHaveProperty('targetStore')
      expect(result).toHaveProperty('recordsAdded')
      expect(result).toHaveProperty('recordsModified')
      expect(result).toHaveProperty('recordsDeleted')
      expect(result).toHaveProperty('recordsUnchanged')
      expect(result).toHaveProperty('conflictsDetected')
      expect(result).toHaveProperty('conflictsResolved')
      expect(result).toHaveProperty('elapsedMs')
      expect(result).toHaveProperty('status')
    })

    it('elapsedMs 是数字且 >= 0', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      const result = await executeBatchUpdate(records, 'stocks')

      expect(typeof result.elapsedMs).toBe('number')
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('不同 targetStore', () => {
    it('dailyQuotes store → targetStore 正确', async () => {
      const result = await executeBatchUpdate([], 'daily_quotes')
      expect(result.targetStore).toBe('daily_quotes')
    })

    it('financialReports store → targetStore 正确', async () => {
      const result = await executeBatchUpdate([], 'financial_reports')
      expect(result.targetStore).toBe('financial_reports')
    })
  })
})

describe('updateExecutor — executeIncrementalUpdate', () => {
  beforeEach(() => {
    mockEmit.mockClear()
  })

  function makeDiff(
    symbol: string,
    status: 'added' | 'modified' | 'unchanged' | 'deleted' | 'conflict',
  ): RecordDiff {
    return {
      symbol,
      status,
      existingData: status === 'modified' || status === 'conflict' || status === 'unchanged'
        ? { symbol, price: 100 }
        : undefined,
      newData: status === 'added' || status === 'modified' || status === 'conflict'
        ? { symbol, price: 105 }
        : undefined,
      fieldDiffs: [],
    }
  }

  describe('新增记录', () => {
    it('added 状态 → recordsAdded 计数', async () => {
      const diffs = [makeDiff('NEW-001', 'added')]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.recordsAdded).toBe(1)
      expect(result.status).toBe('success')
    })
  })

  describe('修改记录', () => {
    it('modified 状态 → recordsModified 计数', async () => {
      const diffs = [makeDiff('MOD-001', 'modified')]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.recordsModified).toBe(1)
    })
  })

  describe('未变化记录', () => {
    it('unchanged 状态 → recordsUnchanged 计数', async () => {
      const diffs = [makeDiff('UNC-001', 'unchanged')]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.recordsUnchanged).toBe(1)
    })
  })

  describe('删除记录', () => {
    it('deleted 状态 → recordsDeleted 计数', async () => {
      const diffs = [makeDiff('DEL-001', 'deleted')]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.recordsDeleted).toBe(1)
    })
  })

  describe('冲突记录', () => {
    it('conflict 状态 → 计入 conflictsDetected', async () => {
      const diffs = [makeDiff('CON-001', 'conflict')]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.conflictsDetected).toBe(1)
      expect(result.conflictsResolved).toBe(1)
      expect(result.recordsModified).toBe(1)
    })

    it('全部冲突都解决 → status 为 success', async () => {
      const diffs = [
        makeDiff('CON-001', 'conflict'),
        makeDiff('CON-002', 'conflict'),
      ]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.status).toBe('success')
      expect(result.conflictsResolved).toBe(2)
    })
  })

  describe('混合状态', () => {
    it('多种状态混合 → 正确统计各类数量', async () => {
      const diffs = [
        makeDiff('A', 'added'),
        makeDiff('B', 'added'),
        makeDiff('C', 'modified'),
        makeDiff('D', 'unchanged'),
        makeDiff('E', 'deleted'),
        makeDiff('F', 'conflict'),
      ]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.recordsAdded).toBe(2)
      expect(result.recordsModified).toBe(2) // 1 modified + 1 conflict resolved
      expect(result.recordsDeleted).toBe(1)
      expect(result.recordsUnchanged).toBe(1)
      expect(result.conflictsDetected).toBe(1)
      expect(result.conflictsResolved).toBe(1)
    })
  })

  describe('空差异列表', () => {
    it('空数组 → 成功状态，全 0', async () => {
      const result = await executeIncrementalUpdate([], 'stocks')

      expect(result.status).toBe('success')
      expect(result.mode).toBe('incremental')
      expect(result.recordsAdded).toBe(0)
      expect(result.recordsModified).toBe(0)
      expect(result.conflictsDetected).toBe(0)
    })
  })

  describe('事件触发', () => {
    it('增量更新 → 触发 UPDATE_START 和 UPDATE_SUCCESS', async () => {
      const diffs = [makeDiff('A', 'added')]
      await executeIncrementalUpdate(diffs, 'stocks')

      const eventNames = mockEmit.mock.calls.map((call: unknown[]) => call[0])
      expect(eventNames).toContain(SYNC_EVENTS.UPDATE_START)
      expect(eventNames).toContain(SYNC_EVENTS.UPDATE_SUCCESS)
    })

    it('UPDATE_START 事件 mode 为 incremental', async () => {
      const diffs = [makeDiff('A', 'added')]
      await executeIncrementalUpdate(diffs, 'daily_quotes')

      const startCall = mockEmit.mock.calls.find(
        (call: unknown[]) => call[0] === SYNC_EVENTS.UPDATE_START,
      )
      const payload = startCall![1] as Record<string, unknown>
      expect(payload.mode).toBe('incremental')
    })
  })

  describe('冲突策略参数', () => {
    it('使用 last-write-wins 策略 → 不报错', async () => {
      const diffs = [makeDiff('A', 'conflict')]
      const result = await executeIncrementalUpdate(diffs, 'stocks', 'last-write-wins')

      expect(result.status).toBe('success')
      expect(result.conflictsDetected).toBe(1)
    })

    it('默认策略为 last-write-wins', async () => {
      const diffs = [makeDiff('A', 'conflict')]
      const result = await executeIncrementalUpdate(diffs, 'stocks')

      expect(result.status).toBe('success')
    })
  })
})

describe('updateExecutor — executeUpdate', () => {
  beforeEach(() => {
    mockEmit.mockClear()
  })

  function makeDiff(
    symbol: string,
    status: 'added' | 'modified' | 'unchanged' | 'deleted' | 'conflict',
  ): RecordDiff {
    return {
      symbol,
      status,
      existingData: status === 'modified' || status === 'conflict' || status === 'unchanged'
        ? { symbol, price: 100 }
        : undefined,
      newData: status === 'added' || status === 'modified' || status === 'conflict'
        ? { symbol, price: 105 }
        : undefined,
      fieldDiffs: [],
    }
  }

  describe('模式自动选择', () => {
    it('首次导入 → 选择 batch 模式', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      const diffs = [makeDiff('600519.SH', 'added')]

      const result = await executeUpdate(records, diffs, 'stocks', 'last-write-wins', {
        isInitialImport: true,
      })

      expect(result.mode).toBe('batch')
    })

    it('有冲突 → 选择 incremental 模式', async () => {
      const records = [
        { symbol: '600519.SH', price: 105 },
        { symbol: '000001.SZ', price: 20 },
      ]
      const diffs = [
        makeDiff('600519.SH', 'conflict'),
        makeDiff('000001.SZ', 'unchanged'),
      ]

      const result = await executeUpdate(records, diffs, 'stocks')

      expect(result.mode).toBe('incremental')
    })

    it('用户偏好 batch → 使用 batch', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      const diffs = [makeDiff('600519.SH', 'modified')]

      const result = await executeUpdate(records, diffs, 'stocks', 'last-write-wins', {
        userPreference: 'batch',
      })

      expect(result.mode).toBe('batch')
    })

    it('用户偏好 incremental → 使用 incremental', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      const diffs = [makeDiff('600519.SH', 'modified')]

      const result = await executeUpdate(records, diffs, 'stocks', 'last-write-wins', {
        userPreference: 'incremental',
      })

      expect(result.mode).toBe('incremental')
    })
  })

  describe('大数据量低变更率', () => {
    it('自动选择 incremental', async () => {
      // 构造 200 条记录，其中 20 条有变化（变更率 10%）
      const records: Record<string, unknown>[] = []
      const diffs: RecordDiff[] = []
      for (let i = 0; i < 200; i++) {
        const symbol = `STOCK-${i}`
        records.push({ symbol, price: 100 })
        diffs.push(makeDiff(symbol, i < 20 ? 'modified' : 'unchanged'))
      }

      const result = await executeUpdate(records, diffs, 'stocks')

      expect(result.mode).toBe('incremental')
    })
  })

  describe('返回结果', () => {
    it('返回完整的 UpdateExecutionResult', async () => {
      const records = [{ symbol: '600519.SH', price: 100 }]
      const diffs = [makeDiff('600519.SH', 'added')]

      const result = await executeUpdate(records, diffs, 'stocks')

      expect(result).toHaveProperty('mode')
      expect(result).toHaveProperty('targetStore')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('elapsedMs')
      expect(result.targetStore).toBe('stocks')
    })
  })
})

describe('updateExecutor — SYNC_EVENTS 常量', () => {
  it('包含 UPDATE_START', () => {
    expect(SYNC_EVENTS.UPDATE_START).toBeDefined()
    expect(typeof SYNC_EVENTS.UPDATE_START).toBe('string')
  })

  it('包含 UPDATE_SUCCESS', () => {
    expect(SYNC_EVENTS.UPDATE_SUCCESS).toBeDefined()
  })

  it('包含 UPDATE_FAIL', () => {
    expect(SYNC_EVENTS.UPDATE_FAIL).toBeDefined()
  })

  it('包含 UPDATE_COMPLETE', () => {
    expect(SYNC_EVENTS.UPDATE_COMPLETE).toBeDefined()
  })

  it('事件名以 sync:update: 开头', () => {
    for (const key of Object.keys(SYNC_EVENTS)) {
      const value = (SYNC_EVENTS as Record<string, string>)[key]
      expect(value).toMatch(/^sync:update:/)
    }
  })
})
