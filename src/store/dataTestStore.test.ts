/**
 * @test_id V9-TEST-ST-DATA-TEST
 * @fileoverview dataTestStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. checkHealth 成功 / 失败
 * 3. runSingleTrace 成功 / 失败 / 无 symbol 跳过
 * 4. reset —— 恢复初始状态
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockWithBroadcast = vi.hoisted(() => vi.fn())
vi.mock('@/store/helpers/withBroadcast', () => ({ withBroadcast: mockWithBroadcast }))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { DATA_TEST_CHANGED: 'data-test:changed' },
}))

const mockCheckFetcherHealth = vi.hoisted(() => vi.fn())
vi.mock('@/services/fetcher/fetcherService', () => ({
  checkFetcherHealth: mockCheckFetcherHealth,
}))

const mockRunSingleTrace = vi.hoisted(() => vi.fn())
const mockRunBatchTrace = vi.hoisted(() => vi.fn())
vi.mock('@/services/data-collector/collectionPipeline', () => ({
  runSingleTrace: mockRunSingleTrace,
  runBatchTrace: mockRunBatchTrace,
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useDataTestStore } from './dataTestStore'
import type { CollectionConfig } from '@/types/modules/collection.types'
import type { TraceResult } from '@/services/data-collector/collectionPipeline'

// ============================================================
// Helpers
// ============================================================

function buildTraceResult(overrides: Partial<TraceResult> = {}): TraceResult {
  return {
    success: true,
    symbol: '600519.SH',
    dimensionCode: '01',
    latency: 120,
    fallbackCount: 0,
    source: 'akshare',
    ...overrides,
  } as TraceResult
}

const dummyConfig: CollectionConfig = {
  dimensions: [],
  globalTimeout: 10000,
  retries: 1,
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  useDataTestStore.setState({
    health: null,
    checking: false,
    singleSymbol: '',
    selectedDimension: '01',
    singleResult: '',
    singleStatus: 'idle',
    batchText: '',
    tasks: [],
    batchRunning: false,
    progress: 0,
    traceResults: [],
  }, false)

  vi.clearAllMocks()
  mockCheckFetcherHealth.mockReset()
  mockRunSingleTrace.mockReset()
  mockRunBatchTrace.mockReset()
  mockWithBroadcast.mockReset()
})

// ============================================================
// Tests
// ============================================================

describe('useDataTestStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = useDataTestStore.getState()
      expect(state.health).toBeNull()
      expect(state.checking).toBe(false)
      expect(state.singleSymbol).toBe('')
      expect(state.selectedDimension).toBe('01')
      expect(state.singleResult).toBe('')
      expect(state.singleStatus).toBe('idle')
      expect(state.batchText).toBe('')
      expect(state.tasks).toEqual([])
      expect(state.batchRunning).toBe(false)
      expect(state.progress).toBe(0)
      expect(state.traceResults).toEqual([])
    })
  })

  describe('checkHealth', () => {
    it('成功(ok=true)：应设置 health=true, checking=false', async () => {
      mockCheckFetcherHealth.mockResolvedValue({ ok: true })

      await useDataTestStore.getState().checkHealth()

      const state = useDataTestStore.getState()
      expect(state.health).toBe(true)
      expect(state.checking).toBe(false)
    })

    it('成功(ok=false)：应设置 health=false', async () => {
      mockCheckFetcherHealth.mockResolvedValue({ ok: false })

      await useDataTestStore.getState().checkHealth()

      expect(useDataTestStore.getState().health).toBe(false)
      expect(useDataTestStore.getState().checking).toBe(false)
    })

    it('异常：应设置 health=false', async () => {
      mockCheckFetcherHealth.mockRejectedValue(new Error('健康检查超时'))

      await useDataTestStore.getState().checkHealth()

      expect(useDataTestStore.getState().health).toBe(false)
      expect(useDataTestStore.getState().checking).toBe(false)
    })
  })

  describe('runSingleTrace', () => {
    it('成功：应设置 singleResult、singleStatus=done、traceResults', async () => {
      const traceResult = buildTraceResult()
      mockRunSingleTrace.mockResolvedValue(traceResult)

      useDataTestStore.setState({ singleSymbol: '600519.SH', selectedDimension: '01' })

      await useDataTestStore.getState().runSingleTrace(dummyConfig)

      const state = useDataTestStore.getState()
      expect(state.singleStatus).toBe('done')
      expect(state.singleResult).toContain('600519.SH')
      expect(state.traceResults).toHaveLength(1)
      expect(state.traceResults[0]).toEqual(traceResult)
    })

    it('失败：应设置 singleResult 包含错误信息，singleStatus=done', async () => {
      mockRunSingleTrace.mockRejectedValue(new Error('数据源不可达'))

      useDataTestStore.setState({ singleSymbol: '600519.SH', selectedDimension: '01' })

      await useDataTestStore.getState().runSingleTrace(dummyConfig)

      const state = useDataTestStore.getState()
      expect(state.singleStatus).toBe('done')
      expect(state.singleResult).toContain('数据源不可达')
    })

    it('singleSymbol 为空时应跳过执行', async () => {
      useDataTestStore.setState({ singleSymbol: '' })

      await useDataTestStore.getState().runSingleTrace(dummyConfig)

      expect(mockRunSingleTrace).not.toHaveBeenCalled()
      expect(useDataTestStore.getState().singleStatus).toBe('idle')
    })
  })

  describe('runBatchTrace', () => {
    it('成功：应更新 tasks、traceResults 和 progress', async () => {
      const results: TraceResult[] = [
        buildTraceResult({ symbol: '600519.SH' }),
        buildTraceResult({ symbol: '000001.SZ', success: false, error: '采集失败' }),
      ]
      mockRunBatchTrace.mockResolvedValue(results)

      useDataTestStore.setState({ batchText: '600519.SH\n000001.SZ' })

      await useDataTestStore.getState().runBatchTrace(dummyConfig)

      const state = useDataTestStore.getState()
      expect(state.batchRunning).toBe(false)
      expect(state.progress).toBe(100)
      expect(state.traceResults).toHaveLength(2)
      expect(state.tasks).toHaveLength(2)
      expect(state.tasks[0].status).toBe('success')
      expect(state.tasks[1].status).toBe('error')
    })

    it('batchText 为空时应跳过执行', async () => {
      useDataTestStore.setState({ batchText: '' })

      await useDataTestStore.getState().runBatchTrace(dummyConfig)

      expect(mockRunBatchTrace).not.toHaveBeenCalled()
      expect(useDataTestStore.getState().batchRunning).toBe(false)
    })
  })

  describe('reset', () => {
    it('应重置所有状态到初始值并广播事件', () => {
      useDataTestStore.setState({
        health: true,
        checking: true,
        singleSymbol: '600519.SH',
        selectedDimension: '05',
        singleResult: 'some result',
        singleStatus: 'done',
        batchText: '600519.SH',
        tasks: [{ symbol: '600519.SH', status: 'pending', message: '' }],
        batchRunning: true,
        progress: 50,
        traceResults: [buildTraceResult()],
      })

      useDataTestStore.getState().reset()

      const state = useDataTestStore.getState()
      expect(state.health).toBeNull()
      expect(state.checking).toBe(false)
      expect(state.singleSymbol).toBe('')
      expect(state.selectedDimension).toBe('01')
      expect(state.singleResult).toBe('')
      expect(state.singleStatus).toBe('idle')
      expect(state.batchText).toBe('')
      expect(state.tasks).toEqual([])
      expect(state.batchRunning).toBe(false)
      expect(state.progress).toBe(0)
      expect(state.traceResults).toEqual([])
      expect(mockWithBroadcast).toHaveBeenCalledWith('data-test:changed', { action: 'reset' })
    })
  })
})
