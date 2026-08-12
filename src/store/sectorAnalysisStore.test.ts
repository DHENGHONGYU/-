/**
 * @test_id V9-TEST-ST-154
 * @covers_docs [V9-DOC-BACK-012]
 */
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest'
import type { RotationSectorScore, IndustryScore } from '@/data/types'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockFetchSectorAnalysisUseCase = vi.hoisted(() => vi.fn())

vi.mock('@/services/useCase/fetchSectorAnalysis.useCase', () => ({
  fetchSectorAnalysisUseCase: mockFetchSectorAnalysisUseCase,
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { subscribe: vi.fn(() => vi.fn()) },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: { saveSectorScores: 'SAVE_SECTOR_SCORES' },
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(),
}))

// ============================================================
// Imports
// ============================================================

import { useSectorAnalysisStore, initSectorAnalysisStoreSubscriptions, destroySectorAnalysisStoreSubscriptions } from './sectorAnalysisStore'
import { dataBridge } from '@/core/databridge'

// ============================================================
// Helpers
// ============================================================

function createMockRotationScore(overrides: Partial<RotationSectorScore> = {}): RotationSectorScore {
  return {
    id: 'TECH_20240101',
    sectorCode: 'TECH',
    sectorName: '科技',
    scoreDate: '2024-01-01',
    f1Jingqi: 80,
    f2Zijin: 70,
    f3Guzhi: 75,
    f4Beta: 60,
    f5Nengliang: 70,
    total: overrides.total ?? 225,
    resonance: 5,
    signal: '持有',
    alertLevel: '常态锁仓',
    declineType: '正常调整',
    poolStocks: [],
    modelUsed: 'v1',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as RotationSectorScore
}

function createMockIndustryScore(overrides: Partial<IndustryScore> = {}): IndustryScore {
  return {
    code: 'A',
    name: '农业',
    score: 85,
    scoredAt: overrides.scoredAt ?? Date.now(),
    ...overrides,
  } as IndustryScore
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchSectorAnalysisUseCase.mockResolvedValue({
    success: true,
    rotationScores: [],
    industryScores: [],
  })
  useSectorAnalysisStore.setState({
    rotationScores: [],
    industryScores: [],
    loading: false,
    error: null,
    lastUpdated: 0,
    isRefreshing: false,
  })
})

// ============================================================
// useSectorAnalysisStore
// ============================================================

describe('useSectorAnalysisStore', () => {
  it('初始状态验证', () => {
    const state = useSectorAnalysisStore.getState()
    expect(state.rotationScores).toEqual([])
    expect(state.industryScores).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  it('fetchSectorAnalysis: 成功加载并排序', async () => {
    const rotations = [
      createMockRotationScore({ sectorCode: 'A', total: 100 }),
      createMockRotationScore({ sectorCode: 'B', total: 300 }),
    ]
    const industries = [
      createMockIndustryScore({ code: 'X', scoredAt: 1000 }),
      createMockIndustryScore({ code: 'Y', scoredAt: 2000 }),
    ]

    mockFetchSectorAnalysisUseCase.mockResolvedValue({
      success: true,
      rotationScores: [rotations[1], rotations[0]],
      industryScores: [industries[1], industries[0]],
    })

    await useSectorAnalysisStore.getState().fetchSectorAnalysis()

    const state = useSectorAnalysisStore.getState()
    expect(state.rotationScores).toHaveLength(2)
    expect(state.rotationScores[0]!.total).toBe(300)
    expect(state.rotationScores[1]!.total).toBe(100)
    expect(state.industryScores).toHaveLength(2)
    expect(state.industryScores[0]!.scoredAt).toBe(2000)
    expect(state.industryScores[1]!.scoredAt).toBe(1000)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBeGreaterThan(0)
  })

  it('fetchSectorAnalysis: 空列表', async () => {
    mockFetchSectorAnalysisUseCase.mockResolvedValue({
      success: true,
      rotationScores: [],
      industryScores: [],
    })

    await useSectorAnalysisStore.getState().fetchSectorAnalysis()

    const state = useSectorAnalysisStore.getState()
    expect(state.rotationScores).toEqual([])
    expect(state.industryScores).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('fetchSectorAnalysis: 数据层异常应设置 error', async () => {
    mockFetchSectorAnalysisUseCase.mockResolvedValue({
      success: false,
      rotationScores: [],
      industryScores: [],
      error: 'DB failure',
    })

    await useSectorAnalysisStore.getState().fetchSectorAnalysis()

    const state = useSectorAnalysisStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('DB failure')
  })

  it('fetchSectorAnalysis: 非 Error 异常应转为字符串', async () => {
    mockFetchSectorAnalysisUseCase.mockRejectedValue('string-error')

    await useSectorAnalysisStore.getState().fetchSectorAnalysis()

    expect(useSectorAnalysisStore.getState().error).toBe('string-error')
  })

  it('setLoading: 更新 loading 状态', () => {
    useSectorAnalysisStore.getState().setLoading(true)
    expect(useSectorAnalysisStore.getState().loading).toBe(true)

    useSectorAnalysisStore.getState().setLoading(false)
    expect(useSectorAnalysisStore.getState().loading).toBe(false)
  })

  it('setError: 设置/清除 error', () => {
    useSectorAnalysisStore.getState().setError('some error')
    expect(useSectorAnalysisStore.getState().error).toBe('some error')

    useSectorAnalysisStore.getState().setError(null)
    expect(useSectorAnalysisStore.getState().error).toBeNull()
  })

  it('clear: 重置到初始状态', () => {
    useSectorAnalysisStore.setState({
      rotationScores: [createMockRotationScore()],
      industryScores: [createMockIndustryScore()],
      loading: true,
      error: 'err',
      lastUpdated: 12345,
    })

    useSectorAnalysisStore.getState().reset()

    const state = useSectorAnalysisStore.getState()
    expect(state.rotationScores).toEqual([])
    expect(state.industryScores).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })

  // --------------------------------------------------------
  // fetchSectorAnalysis 边界场景
  // --------------------------------------------------------

  /** @test_id V9-TEST-ST-154-guard-01 */
  it('fetchSectorAnalysis: isRefreshing 守卫跳过并发调用', async () => {
    useSectorAnalysisStore.setState({ isRefreshing: true })

    await useSectorAnalysisStore.getState().fetchSectorAnalysis()

    // 应跳过，不调用 useCase
    expect(mockFetchSectorAnalysisUseCase).not.toHaveBeenCalled()
    expect(mockLogger.debug).toHaveBeenCalledWith(
      '[sectorAnalysisStore] fetchSectorAnalysis 已在进行中，跳过并发调用',
    )
  })

  /** @test_id V9-TEST-ST-154-err-01 */
  it('fetchSectorAnalysis: Error 实例异常应提取 message', async () => {
    mockFetchSectorAnalysisUseCase.mockRejectedValue(new Error('boom error'))

    await useSectorAnalysisStore.getState().fetchSectorAnalysis()

    expect(useSectorAnalysisStore.getState().error).toBe('boom error')
    expect(useSectorAnalysisStore.getState().isRefreshing).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[sectorAnalysisStore] 数据加载失败',
      { error: 'boom error' },
    )
  })

  /** @test_id V9-TEST-ST-154-refresh-01 */
  it('fetchSectorAnalysis: 增量刷新（isFirstLoad=false）不设置 loading', async () => {
    // 模拟已加载状态（非首次加载）
    useSectorAnalysisStore.setState({
      rotationScores: [createMockRotationScore()],
      industryScores: [createMockIndustryScore()],
      lastUpdated: Date.now(),
    })

    mockFetchSectorAnalysisUseCase.mockResolvedValue({
      success: true,
      rotationScores: [createMockRotationScore({ sectorCode: 'NEW', total: 250 })],
      industryScores: [],
    })

    await useSectorAnalysisStore.getState().fetchSectorAnalysis()

    const state = useSectorAnalysisStore.getState()
    expect(state.loading).toBe(false)
    expect(state.isRefreshing).toBe(false)
    expect(state.rotationScores).toHaveLength(1)
    expect(state.rotationScores[0]!.sectorCode).toBe('NEW')
    // 日志应标记为「增量刷新」
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[sectorAnalysisStore] fetchSectorAnalysis 开始 (增量刷新)',
    )
  })
})

// ============================================================
// DataBridge 订阅：initSectorAnalysisStoreSubscriptions / destroySectorAnalysisStoreSubscriptions
// ============================================================

describe('initSectorAnalysisStoreSubscriptions / destroySectorAnalysisStoreSubscriptions', () => {
  const subscribeMock = dataBridge.subscribe as Mock

  afterEach(() => {
    // 清理模块级订阅引用，避免跨测试污染
    destroySectorAnalysisStoreSubscriptions()
  })

  /** @test_id V9-TEST-ST-154-sub-01 */
  it('init: 订阅 sector_scores 频道并返回取消订阅函数', () => {
    const unsubscribe = initSectorAnalysisStoreSubscriptions()

    expect(subscribeMock).toHaveBeenCalledWith('sector_scores', expect.any(Function))
    expect(typeof unsubscribe).toBe('function')
  })

  /** @test_id V9-TEST-ST-154-sub-02 */
  it('init: 重复调用时先销毁旧订阅（幂等重建）', () => {
    initSectorAnalysisStoreSubscriptions()
    const firstUnsubscribe = subscribeMock.mock.results[0]!.value as Mock

    // 第二次调用应在内部先 destroy 旧订阅
    initSectorAnalysisStoreSubscriptions()

    expect(firstUnsubscribe).toHaveBeenCalled()
    expect(subscribeMock).toHaveBeenCalledTimes(2)
  })

  /** @test_id V9-TEST-ST-154-sub-03 */
  it('init 返回的取消函数调用后触发 destroy', () => {
    const unsubscribe = initSectorAnalysisStoreSubscriptions()
    const innerUnsubscribe = subscribeMock.mock.results[0]!.value as Mock

    unsubscribe()

    expect(innerUnsubscribe).toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-154-sub-04 */
  it('envelope 回调: action === saveSectorScores 时记录日志', () => {
    initSectorAnalysisStoreSubscriptions()
    const callback = subscribeMock.mock.calls[0]![1] as (envelope: unknown) => void

    callback({
      meta: { action: 'SAVE_SECTOR_SCORES', traceId: 'trace-abc' },
      data: {},
    })

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[sectorAnalysisStore] DataBridge event received: saveSectorScore',
      { traceId: 'trace-abc' },
    )
  })

  /** @test_id V9-TEST-ST-154-sub-05 */
  it('envelope 回调: 其他 action 不触发 saveSectorScore 日志', () => {
    initSectorAnalysisStoreSubscriptions()
    const callback = subscribeMock.mock.calls[0]![1] as (envelope: unknown) => void

    callback({
      meta: { action: 'OTHER_ACTION', traceId: 'trace-xyz' },
      data: {},
    })

    expect(mockLogger.info).not.toHaveBeenCalledWith(
      '[sectorAnalysisStore] DataBridge event received: saveSectorScore',
      expect.anything(),
    )
  })

  /** @test_id V9-TEST-ST-154-sub-06 */
  it('destroy: 无订阅时为空操作（不抛异常）', () => {
    expect(() => destroySectorAnalysisStoreSubscriptions()).not.toThrow()
  })

  /** @test_id V9-TEST-ST-154-sub-07 */
  it('destroy: 有订阅时调用取消函数并清理引用', () => {
    initSectorAnalysisStoreSubscriptions()
    const innerUnsubscribe = subscribeMock.mock.results[0]!.value as Mock

    destroySectorAnalysisStoreSubscriptions()

    expect(innerUnsubscribe).toHaveBeenCalled()

    // 再次 destroy 不应重复调用
    innerUnsubscribe.mockClear()
    destroySectorAnalysisStoreSubscriptions()
    expect(innerUnsubscribe).not.toHaveBeenCalled()
  })
})
