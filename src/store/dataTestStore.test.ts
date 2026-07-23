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

  // ============================================================
  // setter 广播事件
  // ============================================================

  /** @test_id V9-TEST-ST-DATA-TEST-setter-broadcast-01 */
  it('setSingleResult: 应广播 DATA_TEST_CHANGED 事件', () => {
    useDataTestStore.getState().setSingleResult('{"data": "test"}')
    expect(mockWithBroadcast).toHaveBeenCalledWith('data-test:changed', {
      action: 'setSingleResult',
    })
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-broadcast-02 */
  it('setTasks: 应广播 DATA_TEST_CHANGED 事件并携带 count', () => {
    const tasks = [
      { symbol: 'A', status: 'pending' as const, message: '' },
      { symbol: 'B', status: 'success' as const, message: 'ok' },
    ]
    useDataTestStore.getState().setTasks(tasks)
    expect(mockWithBroadcast).toHaveBeenCalledWith('data-test:changed', {
      action: 'setTasks',
      count: 2,
    })
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-broadcast-03 */
  it('updateTask: 应广播 DATA_TEST_CHANGED 事件并携带 index 和 status', () => {
    useDataTestStore.setState({
      tasks: [{ symbol: 'A', status: 'pending' as const, message: '' }],
    })
    useDataTestStore.getState().updateTask(0, {
      symbol: 'A',
      status: 'success',
      message: 'done',
    })
    expect(mockWithBroadcast).toHaveBeenCalledWith('data-test:changed', {
      action: 'updateTask',
      index: 0,
      status: 'success',
    })
    expect(useDataTestStore.getState().tasks[0]!.status).toBe('success')
  })

  // ============================================================
  // parseSymbols 各种分隔符（通过 runBatchTrace 间接测试）
  // ============================================================

  /** @test_id V9-TEST-ST-DATA-TEST-parse-01 */
  it('runBatchTrace: 支持逗号分隔的 batchText', async () => {
    const results: TraceResult[] = [buildTraceResult({ symbol: '600519.SH' })]
    mockRunBatchTrace.mockResolvedValue(results)

    useDataTestStore.setState({ batchText: '600519.SH,000001.SZ' })
    await useDataTestStore.getState().runBatchTrace(dummyConfig)

    expect(mockRunBatchTrace).toHaveBeenCalledWith(
      expect.objectContaining({ symbols: ['600519.SH', '000001.SZ'] }),
    )
  })

  /** @test_id V9-TEST-ST-DATA-TEST-parse-02 */
  it('runBatchTrace: 支持分号分隔的 batchText', async () => {
    const results: TraceResult[] = [
      buildTraceResult({ symbol: '600519.SH' }),
      buildTraceResult({ symbol: '000001.SZ' }),
    ]
    mockRunBatchTrace.mockResolvedValue(results)

    useDataTestStore.setState({ batchText: '600519.SH;000001.SZ' })
    await useDataTestStore.getState().runBatchTrace(dummyConfig)

    expect(mockRunBatchTrace).toHaveBeenCalledWith(
      expect.objectContaining({ symbols: ['600519.SH', '000001.SZ'] }),
    )
  })

  /** @test_id V9-TEST-ST-DATA-TEST-parse-03 */
  it('runBatchTrace: 支持中文顿号分隔的 batchText', async () => {
    const results: TraceResult[] = [
      buildTraceResult({ symbol: '600519.SH' }),
      buildTraceResult({ symbol: '000001.SZ' }),
    ]
    mockRunBatchTrace.mockResolvedValue(results)

    useDataTestStore.setState({ batchText: '600519.SH、000001.SZ' })
    await useDataTestStore.getState().runBatchTrace(dummyConfig)

    expect(mockRunBatchTrace).toHaveBeenCalledWith(
      expect.objectContaining({ symbols: ['600519.SH', '000001.SZ'] }),
    )
  })

  /** @test_id V9-TEST-ST-DATA-TEST-parse-04 */
  it('runBatchTrace: trim 空白并转大写', async () => {
    const results: TraceResult[] = [buildTraceResult({ symbol: '600519.SH' })]
    mockRunBatchTrace.mockResolvedValue(results)

    useDataTestStore.setState({ batchText: '  600519.sh  ' })
    await useDataTestStore.getState().runBatchTrace(dummyConfig)

    expect(mockRunBatchTrace).toHaveBeenCalledWith(
      expect.objectContaining({ symbols: ['600519.SH'] }),
    )
  })

  // ============================================================
  // runBatchTrace: 成功但 source 为 undefined 的消息格式
  // ============================================================

  /** @test_id V9-TEST-ST-DATA-TEST-batch-no-source-01 */
  it('runBatchTrace: 成功结果 source 为 undefined 时消息不包含括号', async () => {
    const results: TraceResult[] = [buildTraceResult({ source: undefined })]
    mockRunBatchTrace.mockResolvedValue(results)

    useDataTestStore.setState({ batchText: '600519.SH' })
    await useDataTestStore.getState().runBatchTrace(dummyConfig)

    expect(useDataTestStore.getState().tasks[0]!.message).toBe('成功')
  })

  /** @test_id V9-TEST-ST-DATA-TEST-batch-error-no-msg-01 */
  it('runBatchTrace: 失败结果 error 为 undefined 时消息为"失败"', async () => {
    const results: TraceResult[] = [
      buildTraceResult({ success: false, error: undefined }),
    ]
    mockRunBatchTrace.mockResolvedValue(results)

    useDataTestStore.setState({ batchText: '600519.SH' })
    await useDataTestStore.getState().runBatchTrace(dummyConfig)

    expect(useDataTestStore.getState().tasks[0]!.status).toBe('error')
    expect(useDataTestStore.getState().tasks[0]!.message).toBe('失败')
  })

  // ============================================================
  // checkHealth: 非标准错误类型
  // ============================================================

  /** @test_id V9-TEST-ST-DATA-TEST-health-string-err-01 */
  it('checkHealth: 非 Error 类型异常时应设置 health=false', async () => {
    mockCheckFetcherHealth.mockRejectedValue('连接超时')

    await useDataTestStore.getState().checkHealth()

    expect(useDataTestStore.getState().health).toBe(false)
    expect(useDataTestStore.getState().checking).toBe(false)
  })

  // ============================================================
  // runSingleTrace: 非 Error 类型异常
  // ============================================================

  /** @test_id V9-TEST-ST-DATA-TEST-single-string-err-01 */
  it('runSingleTrace: 非 Error 类型异常时 singleResult 应包含错误信息', async () => {
    mockRunSingleTrace.mockRejectedValue('未知错误')

    useDataTestStore.setState({ singleSymbol: '600519.SH', selectedDimension: '01' })

    await useDataTestStore.getState().runSingleTrace(dummyConfig)

    const state = useDataTestStore.getState()
    expect(state.singleStatus).toBe('done')
    expect(state.singleResult).toContain('未知错误')
  })

  // ============================================================
  // 简单 setter 函数（未覆盖函数补充，提升 function 覆盖率）
  // ============================================================

  /** @test_id V9-TEST-ST-DATA-TEST-setter-01 */
  it('setSingleSymbol: 更新 singleSymbol', () => {
    useDataTestStore.getState().setSingleSymbol('600519.SH')
    expect(useDataTestStore.getState().singleSymbol).toBe('600519.SH')
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-02 */
  it('setSelectedDimension: 更新 selectedDimension', () => {
    useDataTestStore.getState().setSelectedDimension('05')
    expect(useDataTestStore.getState().selectedDimension).toBe('05')
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-03 */
  it('setSingleStatus: 更新 singleStatus', () => {
    useDataTestStore.getState().setSingleStatus('running')
    expect(useDataTestStore.getState().singleStatus).toBe('running')
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-04 */
  it('setBatchText: 更新 batchText', () => {
    useDataTestStore.getState().setBatchText('600519.SH,000001.SZ')
    expect(useDataTestStore.getState().batchText).toBe('600519.SH,000001.SZ')
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-05 */
  it('setBatchRunning: 更新 batchRunning', () => {
    useDataTestStore.getState().setBatchRunning(true)
    expect(useDataTestStore.getState().batchRunning).toBe(true)
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-06 */
  it('setProgress: 更新 progress', () => {
    useDataTestStore.getState().setProgress(75)
    expect(useDataTestStore.getState().progress).toBe(75)
  })

  /** @test_id V9-TEST-ST-DATA-TEST-setter-07 */
  it('setTraceResults: 更新 traceResults', () => {
    const results = [buildTraceResult({ symbol: '600519.SH' })]
    useDataTestStore.getState().setTraceResults(results)
    expect(useDataTestStore.getState().traceResults).toEqual(results)
  })
})
