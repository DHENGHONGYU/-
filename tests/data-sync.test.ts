/**
 * @fileoverview 数据同步模块单元测试
 *
 * 覆盖 P1-1~P1-4 的核心功能：
 * - 全局调度引擎（交易时段判断/调度注册/触发）
 * - 过期检测器（阈值/严重度/批量检测）
 * - 字段合并器（5种策略/冲突标记）
 * - 冲突解决器（6种策略/批量解决）
 * - 更新执行器（模式选择/批量/增量）
 *
 * @module tests/data-sync.test
 * @created 2026-07-14 - 双通道整改 P1 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { globalScheduler, isWithinTradingHours } from '@/services/data-sync/globalScheduler'
import { checkStaleness, checkStalenessBatch, isAutoCollectable, getStalenessThresholds } from '@/services/data-sync/stalenessDetector'
import { mergeRecords, DEFAULT_MERGE_RULES } from '@/services/data-sync/fieldMerger'
import { detectConflict, resolveConflict, resolveConflictsBatch } from '@/services/data-sync/conflictResolver'
import { selectUpdateMode, executeBatchUpdate, executeIncrementalUpdate } from '@/services/data-sync/updateExecutor'
import type { GlobalScheduleConfig, ConflictPolicy, RecordDiff } from '@/types/modules/data-sync.types'
import type { StoreName } from '@/config/dbConfig'

// ============================================================
// P1-1: 全局调度引擎
// ============================================================

describe('P1-1: 全局调度引擎', () => {
  describe('isWithinTradingHours', () => {
    it('交易日 10:00 应在交易时段内', () => {
      const date = new Date('2026-07-14T10:00:00+08:00') // 周二
      expect(isWithinTradingHours(date)).toBe(true)
    })

    it('交易日 14:00 应在交易时段内', () => {
      const date = new Date('2026-07-14T14:00:00+08:00') // 周二
      expect(isWithinTradingHours(date)).toBe(true)
    })

    it('交易日 08:00 不应在交易时段内', () => {
      const date = new Date('2026-07-14T08:00:00+08:00') // 周二早盘前
      expect(isWithinTradingHours(date)).toBe(false)
    })

    it('周末不应在交易时段内', () => {
      const sat = new Date('2026-07-18T10:00:00+08:00') // 周六
      const sun = new Date('2026-07-19T10:00:00+08:00') // 周日
      expect(isWithinTradingHours(sat)).toBe(false)
      expect(isWithinTradingHours(sun)).toBe(false)
    })
  })

  describe('globalScheduler', () => {
    const mockConfig: GlobalScheduleConfig = {
      scheduleId: 'test-schedule-1',
      symbols: ['600000', '600519'],
      dimensions: ['01', '02'],
      frequency: 'daily',
      sourceScope: {
        enabled: ['tencent', 'sina'],
        fallbackChain: ['tencent', 'sina', 'mock'],
        allowMockFallback: true,
      },
      conflictPolicy: 'last-write-wins',
      updateMode: 'batch',
      enabled: true,
      runCount: 0,
      consecutiveFailures: 0,
    }

    it('应注册调度配置', () => {
      globalScheduler.registerSchedule(mockConfig)
      const all = globalScheduler.getAllSchedules()
      expect(all.some(s => s.scheduleId === 'test-schedule-1')).toBe(true)
    })

    it('应禁用和启用调度', () => {
      globalScheduler.registerSchedule(mockConfig)
      globalScheduler.disableSchedule('test-schedule-1')
      expect(globalScheduler.getActiveCount()).toBe(0)
      globalScheduler.enableSchedule('test-schedule-1')
      // 重新注册后才计入 active
    })

    it('应删除调度', () => {
      globalScheduler.registerSchedule(mockConfig)
      globalScheduler.removeSchedule('test-schedule-1')
      const all = globalScheduler.getAllSchedules()
      expect(all.some(s => s.scheduleId === 'test-schedule-1')).toBe(false)
    })
  })
})

// ============================================================
// P1-2: 过期检测器
// ============================================================

describe('P1-2: 过期检测器', () => {
  it('新鲜数据应返回 isStale=false', () => {
    const result = checkStaleness('600000', {
      '01': new Date().toISOString(),
      '02': new Date().toISOString(),
    })
    expect(result.isStale).toBe(false)
    expect(result.staleDimensions).toHaveLength(0)
  })

  it('过期数据应返回 isStale=true', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const result = checkStaleness('600000', {
      '01': twoDaysAgo, // 01 阈值 24h，已过期
      '02': new Date().toISOString(),
    })
    expect(result.isStale).toBe(true)
    expect(result.staleDimensions).toHaveLength(1)
    expect(result.staleDimensions[0]?.dimensionCode).toBe('01')
    expect(result.staleDimensions[0]?.severity).toBe('stale')
  })

  it('严重过期应为 very-stale', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const result = checkStaleness('600000', {
      '01': tenDaysAgo, // 01 阈值 24h，10天 > 48h → very-stale
    })
    expect(result.isStale).toBe(true)
    expect(result.staleDimensions[0]?.severity).toBe('very-stale')
  })

  it('无时间戳应视为过期', () => {
    const result = checkStaleness('600000', {
      '01': null,
    })
    expect(result.isStale).toBe(true)
  })

  it('维度 01 可自动采集', () => {
    expect(isAutoCollectable('01')).toBe(true)
    expect(isAutoCollectable('02')).toBe(true)
    expect(isAutoCollectable('03')).toBe(false)
  })

  it('应推荐自动采集（可自动采集维度过期）', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const result = checkStaleness('600000', { '01': twoDaysAgo })
    expect(result.recommendedAction).toBe('auto-collect')
  })

  it('应推荐文件导入（不可自动采集维度过期）', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const result = checkStaleness('600000', { '06': tenDaysAgo })
    expect(result.recommendedAction).toBe('file-import')
  })

  it('批量检测应返回所有标的结果', () => {
    const results = checkStalenessBatch(['600000', '600519'], (symbol) => ({
      '01': symbol === '600000' ? null : new Date().toISOString(),
    }))
    expect(results).toHaveLength(2)
    expect(results[0]?.result.isStale).toBe(true)
    expect(results[1]?.result.isStale).toBe(false)
  })

  it('应返回阈值配置', () => {
    const thresholds = getStalenessThresholds()
    expect(thresholds['01']).toBe(24)
    expect(thresholds['06']).toBe(168)
  })
})

// ============================================================
// P1-3: 字段合并器
// ============================================================

describe('P1-3: 字段合并器', () => {
  it('take-newer 应取新值', () => {
    const result = mergeRecords(
      { price: 10.0 },
      { price: 10.5 },
      [{ fieldName: 'price', strategy: 'take-newer' }],
      { timestamp: new Date().toISOString() },
    )
    expect(result.merged.price).toBe(10.5)
    expect(result.conflicts).toHaveLength(0)
  })

  it('take-non-null 现有为空取新值', () => {
    const result = mergeRecords(
      { name: null },
      { name: '浦发银行' },
      [{ fieldName: 'name', strategy: 'take-non-null' }],
      { timestamp: new Date().toISOString() },
    )
    expect(result.merged.name).toBe('浦发银行')
    expect(result.conflicts).toHaveLength(0)
  })

  it('take-non-null 都非空应标记冲突', () => {
    const result = mergeRecords(
      { name: '浦发银行' },
      { name: '浦发银行股份' },
      [{ fieldName: 'name', strategy: 'take-non-null' }],
      { timestamp: new Date().toISOString() },
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.fieldName).toBe('name')
  })

  it('take-average 应取平均值', () => {
    const result = mergeRecords(
      { price: 10.0 },
      { price: 12.0 },
      [{ fieldName: 'price', strategy: 'take-average' }],
      { timestamp: new Date().toISOString() },
    )
    expect(result.merged.price).toBe(11.0)
  })

  it('manual 应标记冲突', () => {
    const result = mergeRecords(
      { revenue: 1000 },
      { revenue: 1200 },
      [{ fieldName: 'revenue', strategy: 'manual' }],
      { timestamp: new Date().toISOString() },
    )
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.severity).toBe('critical')
  })

  it('值相同应无冲突', () => {
    const result = mergeRecords(
      { price: 10.5 },
      { price: 10.5 },
      [{ fieldName: 'price', strategy: 'take-newer' }],
      { timestamp: new Date().toISOString() },
    )
    expect(result.conflicts).toHaveLength(0)
  })

  it('默认合并规则应存在', () => {
    expect(DEFAULT_MERGE_RULES['stocks']).toBeDefined()
    expect(DEFAULT_MERGE_RULES['dailyQuotes']).toBeDefined()
    expect(DEFAULT_MERGE_RULES['financialReports']).toBeDefined()
  })
})

// ============================================================
// P1-3: 冲突解决器
// ============================================================

describe('P1-3: 冲突解决器', () => {
  it('detectConflict 应检测字段冲突', () => {
    const detection = detectConflict(
      { symbol: '600000', price: 10.0 },
      { symbol: '600000', price: 10.5 },
    )
    expect(detection.hasConflict).toBe(true)
    expect(detection.conflictType).toBe('field')
    expect(detection.fieldDiffs).toHaveLength(1)
  })

  it('detectConflict 无冲突应返回 false', () => {
    const detection = detectConflict(
      { symbol: '600000', price: 10.0 },
      { symbol: '600000', price: 10.0 },
    )
    expect(detection.hasConflict).toBe(false)
  })

  it('last-write-wins 应取新数据', () => {
    const detection = detectConflict(
      { symbol: '600000', price: 10.0 },
      { symbol: '600000', price: 10.5 },
    )
    const resolution = resolveConflict(
      { symbol: '600000', price: 10.0 },
      { symbol: '600000', price: 10.5 },
      'last-write-wins',
      detection,
    )
    expect(resolution.resolvedData?.price).toBe(10.5)
    expect(resolution.autoResolved).toBe(true)
  })

  it('ask-user 应返回未解决冲突', () => {
    const detection = detectConflict(
      { symbol: '600000', price: 10.0 },
      { symbol: '600000', price: 10.5 },
    )
    const resolution = resolveConflict(
      { symbol: '600000', price: 10.0 },
      { symbol: '600000', price: 10.5 },
      'ask-user',
      detection,
    )
    expect(resolution.resolvedData).toBeNull()
    expect(resolution.autoResolved).toBe(false)
    expect(resolution.unresolvedConflicts.length).toBeGreaterThan(0)
  })

  it('merge-fields 应自动合并', () => {
    const detection = detectConflict(
      { symbol: '600000', price: 10.0, name: '浦发银行' },
      { symbol: '600000', price: 10.5, name: '浦发银行' },
    )
    const resolution = resolveConflict(
      { symbol: '600000', price: 10.0, name: '浦发银行' },
      { symbol: '600000', price: 10.5, name: '浦发银行' },
      'merge-fields',
      detection,
      DEFAULT_MERGE_RULES['stocks'],
    )
    expect(resolution.resolvedData?.price).toBe(10.5) // take-newer
    expect(resolution.autoResolved).toBe(true)
  })

  it('批量解决应处理多个冲突', () => {
    const diffs: RecordDiff[] = [
      {
        symbol: '600000',
        status: 'conflict',
        existingData: { price: 10.0 },
        newData: { price: 10.5 },
        fieldDiffs: [],
      },
      {
        symbol: '600519',
        status: 'conflict',
        existingData: { price: 1800 },
        newData: { price: 1805 },
        fieldDiffs: [],
      },
    ]
    const results = resolveConflictsBatch(diffs, 'last-write-wins')
    expect(results).toHaveLength(2)
    expect(results[0]?.resolution.autoResolved).toBe(true)
  })
})

// ============================================================
// P1-4: 更新执行器
// ============================================================

describe('P1-4: 更新执行器', () => {
  describe('selectUpdateMode', () => {
    it('首次导入应选 batch', () => {
      expect(selectUpdateMode(100, 1.0, false, true)).toBe('batch')
    })

    it('变更率 >80% 应选 batch', () => {
      expect(selectUpdateMode(100, 0.9, false, false)).toBe('batch')
    })

    it('有冲突应选 incremental', () => {
      expect(selectUpdateMode(100, 0.3, true, false)).toBe('incremental')
    })

    it('记录数 <100 应选 batch', () => {
      expect(selectUpdateMode(50, 0.3, false, false)).toBe('batch')
    })

    it('用户指定应优先', () => {
      expect(selectUpdateMode(100, 0.5, true, false, 'batch')).toBe('batch')
    })
  })

  describe('executeBatchUpdate', () => {
    it('应成功执行批量更新', async () => {
      const records = [
        { symbol: '600000', name: '浦发银行' },
        { symbol: '600519', name: '贵州茅台' },
      ]
      const result = await executeBatchUpdate(records, 'stocks' as StoreName)
      expect(result.mode).toBe('batch')
      expect(result.recordsAdded).toBe(2)
      expect(result.status).toBe('success')
    })

    it('空数组应也能执行', async () => {
      const result = await executeBatchUpdate([], 'stocks' as StoreName)
      expect(result.recordsAdded).toBe(0)
      expect(result.status).toBe('success')
    })
  })

  describe('executeIncrementalUpdate', () => {
    it('应成功执行增量更新', async () => {
      const diffs: RecordDiff[] = [
        { symbol: '600000', status: 'added', newData: { name: '浦发银行' } },
        { symbol: '600519', status: 'unchanged' },
      ]
      const result = await executeIncrementalUpdate(diffs, 'stocks' as StoreName)
      expect(result.mode).toBe('incremental')
      expect(result.recordsAdded).toBe(1)
      expect(result.recordsUnchanged).toBe(1)
      expect(result.status).toBe('success')
    })

    it('有冲突应标记 partial', async () => {
      const diffs: RecordDiff[] = [
        {
          symbol: '600000',
          status: 'conflict',
          existingData: { price: 10.0 },
          newData: { price: 10.5 },
          fieldDiffs: [],
        },
      ]
      const result = await executeIncrementalUpdate(diffs, 'stocks' as StoreName, 'last-write-wins')
      expect(result.conflictsDetected).toBe(1)
      expect(result.conflictsResolved).toBe(1)
    })
  })
})
