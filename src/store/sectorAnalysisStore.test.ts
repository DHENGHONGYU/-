import { vi, describe, it, expect, beforeEach } from 'vitest'
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

import { useSectorAnalysisStore } from './sectorAnalysisStore'

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

    useSectorAnalysisStore.getState().clear()

    const state = useSectorAnalysisStore.getState()
    expect(state.rotationScores).toEqual([])
    expect(state.industryScores).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.lastUpdated).toBe(0)
  })
})
