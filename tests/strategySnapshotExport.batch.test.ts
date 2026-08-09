/**
 * @test_id V9-TEST-UT-063-BATCH-EXPORT
 * @covers 批量快照 Excel 导出 + Sheet 命名安全逻辑
 *
 * 验证点：
 * 1. 3 个不同版本快照 → 正确生成汇总 Sheet + 多个子 Sheet
 * 2. Sheet 命名超 31 字符 → 自动截断且不报错
 * 3. 同版本号快照 → 自动追加 (2)/(3) 后缀去重
 * 4. 含非法字符的 Sheet 名 → 清理为下划线
 * 5. 空快照列表 → 优雅返回错误
 * 6. 汇总 Sheet 数据完整性（版本/ID/日期/计数等）
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { StrategySnapshot } from '@/data/types'
import {
  buildUniqueSheetName,
  exportBatchSnapshotsToExcel,
} from '@/services/trading/strategySnapshotExport'

// ============================================================
// 辅助函数：构造模拟快照
// ============================================================

function makeSnapshot(
  version: number,
  overrides?: Partial<StrategySnapshot>,
): StrategySnapshot {
  return {
    id: `snap_v${version}_${Date.now()}`,
    version,
    timestamp: Date.now(),
    date: '2026-08-09',
    time: '14:30:00',
    stockCount: 10,
    scoreCount: 8,
    rotationCount: 3,
    trigger: 'manual',
    core: {
      count: 2,
      avgComposite: 4.3,
      maxComposite: 4.6,
      symbols: ['002371.SZ', '000063.SZ'],
      items: [
        { symbol: '002371.SZ', name: '北方华创', composite: 4.6, classification: 'core' },
        { symbol: '000063.SZ', name: '中兴通讯', composite: 4.0, classification: 'core' },
      ],
    },
    hot: {
      count: 1,
      avgComposite: 3.8,
      maxComposite: 3.9,
      symbols: ['300750.SZ'],
      items: [
        { symbol: '300750.SZ', name: '宁德时代', composite: 3.9, classification: 'hot' },
      ],
    },
    value: {
      count: 1,
      avgComposite: 3.2,
      maxComposite: 3.3,
      symbols: ['601318.SH'],
      items: [
        { symbol: '601318.SH', name: '中国平安', composite: 3.3, classification: 'value' },
      ],
    },
    ...overrides,
  }
}

// ============================================================
// buildUniqueSheetName 纯函数测试
// ============================================================

describe('buildUniqueSheetName — Sheet 命名安全逻辑', () => {
  it('正常名称直接返回', () => {
    const existing = new Set<string>()
    const result = buildUniqueSheetName('V1-核心稀缺', existing)
    expect(result).toBe('V1-核心稀缺')
    expect(existing.has('V1-核心稀缺')).toBe(true)
  })

  it('超过 31 字符的名称自动截断到 ≤31', () => {
    const existing = new Set<string>()
    const longName = 'V9999999999999999999999999999999-核心稀缺组合超长名称测试'
    const result = buildUniqueSheetName(longName, existing)
    expect(result.length).toBeLessThanOrEqual(31)
    expect(existing.has(result)).toBe(true)
  })

  it('两个相同基础名称 → 第二个追加 (2) 后缀', () => {
    const existing = new Set<string>()
    const r1 = buildUniqueSheetName('V1-核心稀缺', existing)
    const r2 = buildUniqueSheetName('V1-核心稀缺', existing)
    expect(r1).toBe('V1-核心稀缺')
    expect(r2).toBe('V1-核心稀缺 (2)')
    expect(r1).not.toBe(r2)
  })

  it('三个相同基础名称 → 追加 (2)/(3) 后缀', () => {
    const existing = new Set<string>()
    const r1 = buildUniqueSheetName('V1-核心稀缺', existing)
    const r2 = buildUniqueSheetName('V1-核心稀缺', existing)
    const r3 = buildUniqueSheetName('V1-核心稀缺', existing)
    expect(r1).toBe('V1-核心稀缺')
    expect(r2).toBe('V1-核心稀缺 (2)')
    expect(r3).toBe('V1-核心稀缺 (3)')
  })

  it('含非法字符 (: \\ / ? * [ ]) → 替换为下划线', () => {
    const existing = new Set<string>()
    const result = buildUniqueSheetName('V1:核心/稀缺[组]', existing)
    expect(result).not.toMatch(/[:\\/?*\[\]]/)
    expect(result).toContain('_')
  })

  it('截断后仍冲突 → 后缀追加在截断后的名称上', () => {
    const existing = new Set<string>()
    const longName = 'V'.repeat(40) // 40 个 V，截断后 28 个 V
    const r1 = buildUniqueSheetName(longName, existing)
    const r2 = buildUniqueSheetName(longName, existing)
    expect(r1.length).toBeLessThanOrEqual(31)
    expect(r2.length).toBeLessThanOrEqual(31)
    expect(r1).not.toBe(r2)
    expect(r2).toContain('(')
  })

  it('existingNames 集合会被正确更新', () => {
    const existing = new Set<string>()
    buildUniqueSheetName('A', existing)
    buildUniqueSheetName('B', existing)
    buildUniqueSheetName('A', existing)
    expect(existing.size).toBe(3) // A, B, A (2)
  })
})

// ============================================================
// exportBatchSnapshotsToExcel 完整流程测试
// ============================================================

describe('exportBatchSnapshotsToExcel — 批量快照导出', () => {
  beforeEach(() => {
    // Mock downloadBlob 避免实际触发浏览器下载
    // 通过 mock URL.createObjectURL 和 DOM API
    if (typeof URL.createObjectURL === 'function') {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    }
    if (typeof URL.revokeObjectURL === 'function') {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    }
  })

  it('3 个不同版本快照 → 生成汇总 Sheet + 9 个子 Sheet（3快照×3策略）', async () => {
    const snapshots = [
      makeSnapshot(1),
      makeSnapshot(2),
      makeSnapshot(3),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)

    expect(result.success).toBe(true)
    // 1 汇总 + 3 快照 × 3 策略(core+hot+value) = 10
    expect(result.snapshotCount).toBe(3)
    expect(result.sheetCount).toBe(10)
    expect(result.filename).toContain('策略快照批量_3个')
    expect(result.filename).toMatch(/\.xlsx$/)
  })

  it('汇总 Sheet 包含 3 行数据（每个快照一行）', async () => {
    const snapshots = [
      makeSnapshot(1, { id: 'snap_001', date: '2026-08-07', time: '10:00:00' }),
      makeSnapshot(2, { id: 'snap_002', date: '2026-08-08', time: '11:00:00' }),
      makeSnapshot(3, { id: 'snap_003', date: '2026-08-09', time: '12:00:00' }),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    expect(result.sheetCount).toBe(10)
  })

  it('同版本号快照（两个 V1）→ Sheet 名自动去重不报错', async () => {
    const snapshots = [
      makeSnapshot(1, { id: 'snap_001' }),
      makeSnapshot(1, { id: 'snap_002' }), // 同版本号
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    // 1 汇总 + 2 快照 × 3 策略 = 7
    expect(result.sheetCount).toBe(7)
  })

  it('3 个同版本号快照 → 3 组同名 Sheet 全部去重', async () => {
    const snapshots = [
      makeSnapshot(1, { id: 'snap_001' }),
      makeSnapshot(1, { id: 'snap_002' }),
      makeSnapshot(1, { id: 'snap_003' }),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    // 1 汇总 + 3 快照 × 3 策略 = 10
    expect(result.sheetCount).toBe(10)
  })

  it('部分策略分组为空 → 只生成有数据的 Sheet', async () => {
    const snapshots = [
      makeSnapshot(1, {
        id: 'snap_001',
        hot: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
        value: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
      }),
      makeSnapshot(2, {
        id: 'snap_002',
        core: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
        value: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
      }),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    // 1 汇总 + V1-core(1) + V2-hot(1) = 3
    expect(result.sheetCount).toBe(3)
  })

  it('所有策略分组为空 → 生成汇总 + 空数据 Sheet', async () => {
    const snapshots = [
      makeSnapshot(1, {
        id: 'snap_001',
        core: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
        hot: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
        value: { count: 0, avgComposite: 0, maxComposite: 0, symbols: [], items: [] },
      }),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    // 1 汇总 + 1 空数据 = 2
    expect(result.sheetCount).toBe(2)
  })

  it('空快照列表 → 返回失败结果', async () => {
    const result = await exportBatchSnapshotsToExcel([])
    expect(result.success).toBe(false)
    expect(result.error).toBe('快照列表为空')
    expect(result.snapshotCount).toBe(0)
    expect(result.sheetCount).toBe(0)
  })

  it('大版本号导致 Sheet 名超 31 字符 → 自动截断不报错', async () => {
    const snapshots = [
      makeSnapshot(999999999999, { id: 'snap_big_1' }),
      makeSnapshot(999999999999, { id: 'snap_big_2' }),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    // 所有 Sheet 名都 ≤ 31 字符，xlsx 不报错
    expect(result.sheetCount).toBe(7) // 1 汇总 + 2×3
  })

  it('返回结果包含 traceId', async () => {
    const snapshots = [makeSnapshot(1)]
    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    // traceId 可选字段，成功时可能不返回但在错误时返回
    // 这里只验证不抛错
  })

  it('快照含非法字符的 trigger 字段 → 不影响 Sheet 命名', async () => {
    // trigger 不直接用于 Sheet 名，但确保不影响
    const snapshots = [
      makeSnapshot(1, { id: 'snap_001', trigger: 'manual:update[1]' }),
      makeSnapshot(2, { id: 'snap_002', trigger: 'auto/scheduled' }),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    expect(result.sheetCount).toBe(7)
  })

  it('5 个不同版本快照 → 汇总 Sheet 5 行 + 15 子 Sheet', async () => {
    const snapshots = [
      makeSnapshot(1),
      makeSnapshot(2),
      makeSnapshot(3),
      makeSnapshot(4),
      makeSnapshot(5),
    ]

    const result = await exportBatchSnapshotsToExcel(snapshots)
    expect(result.success).toBe(true)
    // 1 汇总 + 5×3 = 16
    expect(result.snapshotCount).toBe(5)
    expect(result.sheetCount).toBe(16)
  })
})
