/**
 * @test_id V9-TEST-ST-???
 * @covers_docs []
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { CollectionHistoryEntry, GlobalScheduleConfig, SyncState } from '@/types/modules/data-sync.types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
const mockWithBroadcast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))
vi.mock('@/lib/withBroadcast', () => ({
  withBroadcast: (...args: unknown[]) => mockWithBroadcast(...args),
  createBroadcaster: vi.fn(),
}))
vi.mock('@/config/dbConfig', () => ({ STORE_NAME: { collectionHistory: 'collection_history' } }))
vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { COLLECTION_WIZARD_CHANGED: 'collection-wizard-changed' },
}))

// ============================================================
// Imports
// ============================================================

import { useDataSyncStore } from './dataSyncStore'

// ============================================================
// Helpers
// ============================================================

function createMockHistoryEntry(overrides: Partial<CollectionHistoryEntry> = {}): CollectionHistoryEntry {
  return {
    id: 'hist-001',
    timestamp: '2026-07-22T10:00:00Z',
    date: '2026-07-22',
    channel: 'auto-collect',
    collectionInfo: { symbols: ['AAPL'], dimensions: ['price'], dataSource: 'eastmoney' },
    updateInfo: {
      mode: 'batch',
      recordsAdded: 10,
      recordsModified: 2,
      recordsDeleted: 0,
      recordsUnchanged: 50,
      conflictsDetected: 1,
      conflictsResolved: 0,
    },
    qualityInfo: { successRate: 0.95, completeness: 0.9 },
    status: 'success',
    ...overrides,
  }
}

function createMockSchedule(overrides: Partial<GlobalScheduleConfig> = {}): GlobalScheduleConfig {
  return {
    scheduleId: 'sched-001',
    symbols: ['AAPL', 'GOOGL'],
    dimensions: ['price', 'volume'],
    frequency: 'daily',
    sourceScope: { enabled: ['eastmoney'], fallbackChain: ['eastmoney'], allowMockFallback: false },
    conflictPolicy: 'last-write-wins',
    updateMode: 'incremental',
    enabled: true,
    runCount: 5,
    consecutiveFailures: 0,
    ...overrides,
  }
}

describe('useDataSyncStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDataSyncStore.getState().reset()
  })

  it('初始状态验证', () => {
    const state = useDataSyncStore.getState()
    expect(state.syncState).toBe('idle')
    expect(state.lastSyncAt).toBeNull()
    expect(state.lastSyncChannel).toBeNull()
    expect(state.history).toEqual([])
    expect(state.historyLoading).toBe(false)
    expect(state.schedules).toEqual([])
    expect(state.totalAutoCollects).toBe(0)
    expect(state.totalFileImports).toBe(0)
    expect(state.totalConflicts).toBe(0)
  })

  it('setSyncState: 变更同步状态', () => {
    useDataSyncStore.getState().setSyncState('checking' as SyncState)
    expect(useDataSyncStore.getState().syncState).toBe('checking')
    expect(mockWithBroadcast).toHaveBeenCalled()
  })

  it('addHistoryEntry: 添加历史记录并更新统计', () => {
    const entry = createMockHistoryEntry()
    useDataSyncStore.getState().addHistoryEntry(entry)

    const state = useDataSyncStore.getState()
    expect(state.history).toHaveLength(1)
    expect(state.history[0]!.id).toBe('hist-001')
    expect(state.lastSyncAt).toBe('2026-07-22T10:00:00Z')
    expect(state.lastSyncChannel).toBe('auto-collect')
    expect(state.totalAutoCollects).toBe(1)
    expect(state.totalFileImports).toBe(0)
    expect(state.totalConflicts).toBe(1)
  })

  it('addHistoryEntry: file-import 通道更新对应计数', () => {
    const entry = createMockHistoryEntry({
      id: 'hist-002',
      channel: 'file-import',
      updateInfo: { ...createMockHistoryEntry().updateInfo, conflictsDetected: 0 },
    })
    useDataSyncStore.getState().addHistoryEntry(entry)

    const state = useDataSyncStore.getState()
    expect(state.totalFileImports).toBe(1)
    expect(state.totalAutoCollects).toBe(0)
    expect(state.totalConflicts).toBe(0)
  })

  it('loadHistory: 设置 historyLoading 状态', async () => {
    await useDataSyncStore.getState().loadHistory()
    expect(useDataSyncStore.getState().historyLoading).toBe(false)
  })

  it('addSchedule: 添加调度配置（同 ID 覆盖）', () => {
    const schedule1 = createMockSchedule()
    const schedule2 = createMockSchedule({ frequency: 'weekly' })

    useDataSyncStore.getState().addSchedule(schedule1)
    expect(useDataSyncStore.getState().schedules).toHaveLength(1)

    // 同 scheduleId 添加应覆盖旧配置
    useDataSyncStore.getState().addSchedule(schedule2)
    expect(useDataSyncStore.getState().schedules).toHaveLength(1)
    expect(useDataSyncStore.getState().schedules[0]!.frequency).toBe('weekly')
  })

  it('reset: 重置到初始状态', () => {
    useDataSyncStore.getState().setSyncState('auto-collecting' as SyncState)
    useDataSyncStore.getState().addHistoryEntry(createMockHistoryEntry())
    useDataSyncStore.getState().addSchedule(createMockSchedule())

    useDataSyncStore.getState().reset()

    const state = useDataSyncStore.getState()
    expect(state.syncState).toBe('idle')
    expect(state.lastSyncAt).toBeNull()
    expect(state.history).toEqual([])
    expect(state.schedules).toEqual([])
    expect(state.totalAutoCollects).toBe(0)
    expect(state.totalFileImports).toBe(0)
    expect(state.totalConflicts).toBe(0)
  })
})
