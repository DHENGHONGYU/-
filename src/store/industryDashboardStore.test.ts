/**
 * @test_id V9-TEST-ST-IND-001
 * @covers_docs [V9-DOC-PROJ-124, V9-DOC-BACK-006, V9-DOC-PROJ-001]
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useIndustryDashboardStore } from './industryDashboardStore'
import type {
  IndustryV4AnalysisEnhanced,
  IndustryRotationSignal,
} from '@/data/types/types.sector'

// ============================================================
// Mocks
// ============================================================

const mockFetchIndustryDashboardUseCase = vi.hoisted(() => vi.fn())

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('@/services/useCase/fetchIndustryDashboard.useCase', () => ({
  fetchIndustryDashboardUseCase: mockFetchIndustryDashboardUseCase,
}))

// ============================================================
// Helpers
// ============================================================

function createMockV4Analysis(overrides: Partial<IndustryV4AnalysisEnhanced> = {}): IndustryV4AnalysisEnhanced {
  return {
    industryCode: 'ind-001',
    industryName: '人工智能',
    tier: 'tier2',
    v4Composite: 4.2,
    dimensions: {
      prosperity: { name: '景气度', score: 4.5, weight: 0.3, rationale: '增长强劲', evidence: ['营收增长30%'], subIndicators: [] },
      competition: { name: '竞争格局', score: 3.8, weight: 0.25, rationale: '集中度较高', evidence: ['CR5=60%'], subIndicators: [] },
      policy: { name: '政策环境', score: 4.0, weight: 0.25, rationale: '政策支持', evidence: ['十四五规划'], subIndicators: [] },
      technology: { name: '技术成熟度', score: 4.5, weight: 0.2, rationale: '技术迭代快', evidence: ['大模型突破'], subIndicators: [] },
    },
    subIndicators: {
      revenueGrowth: 30,
      profitGrowth: 25,
      capacityUtilization: 85,
      inventoryTurnover: 6.5,
    },
    ...overrides,
  } as IndustryV4AnalysisEnhanced
}

function createMockRotationSignal(overrides: Partial<IndustryRotationSignal> = {}): IndustryRotationSignal {
  return {
    industryCode: 'ind-001',
    industryName: '人工智能',
    signal: 'buy',
    signalStrength: 0.75,
    compositeScore: 4.2,
    scores: {
      v4: 4.2,
      trend: 3.8,
      valuation: 3.5,
      momentum: 4.0,
    },
    rationale: '行业景气度高，政策支持力度大',
    risks: ['估值偏高', '技术迭代风险'],
    generatedAt: Date.now(),
    ...overrides,
  }
}

// ============================================================
// Tests
// ============================================================

describe('useIndustryDashboardStore', () => {
  beforeEach(() => {
    useIndustryDashboardStore.getState().reset()
    vi.clearAllMocks()
  })

  // --------------------------------------------------------
  // 1. 初始状态
  // --------------------------------------------------------
  describe('初始状态', () => {
    it('所有字段默认值正确', () => {
      const state = useIndustryDashboardStore.getState()
      expect(state.v4Analyses).toEqual([])
      expect(state.rotationSignals).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.emptyReason).toBeNull()
      expect(state.lastUpdated).toBe(0)
      expect(state.isRefreshing).toBe(false)
    })
  })

  // --------------------------------------------------------
  // 2. fetchDashboard 成功加载（首次加载）
  // --------------------------------------------------------
  describe('fetchDashboard - 首次加载成功', () => {
    it('loading 状态变化、数据正确写入、lastUpdated 更新、isRefreshing 重置', async () => {
      const mockV4 = [createMockV4Analysis()]
      const mockSignals = [createMockRotationSignal()]
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: mockV4,
        rotationSignals: mockSignals,
      })

      const beforeTime = Date.now()
      await useIndustryDashboardStore.getState().fetchDashboard()
      const afterTime = Date.now()

      const state = useIndustryDashboardStore.getState()
      expect(state.loading).toBe(false)
      expect(state.isRefreshing).toBe(false)
      expect(state.v4Analyses).toEqual(mockV4)
      expect(state.rotationSignals).toEqual(mockSignals)
      expect(state.error).toBeNull()
      expect(state.lastUpdated).toBeGreaterThanOrEqual(beforeTime)
      expect(state.lastUpdated).toBeLessThanOrEqual(afterTime)
    })

    it('加载过程中 loading 为 true', async () => {
      let resolveFetch: ((value: unknown) => void) | undefined
      const fetchPromise = new Promise((r) => { resolveFetch = r })
      mockFetchIndustryDashboardUseCase.mockReturnValue(fetchPromise)

      const actionPromise = useIndustryDashboardStore.getState().fetchDashboard()

      // 等待微任务，确保 set 已执行
      await Promise.resolve()
      expect(useIndustryDashboardStore.getState().loading).toBe(true)
      expect(useIndustryDashboardStore.getState().isRefreshing).toBe(true)

      resolveFetch!({
        success: true,
        v4Analyses: [],
        rotationSignals: [],
      })
      await actionPromise

      expect(useIndustryDashboardStore.getState().loading).toBe(false)
      expect(useIndustryDashboardStore.getState().isRefreshing).toBe(false)
    })
  })

  // --------------------------------------------------------
  // 3. fetchDashboard 增量刷新
  // --------------------------------------------------------
  describe('fetchDashboard - 增量刷新', () => {
    it('已有数据时 loading 仍为 false，isRefreshing 为 true', async () => {
      // 先加载一次数据
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [createMockV4Analysis()],
        rotationSignals: [createMockRotationSignal()],
      })
      await useIndustryDashboardStore.getState().fetchDashboard()

      // 准备第二次刷新（增量）
      let resolveFetch: ((value: unknown) => void) | undefined
      const fetchPromise = new Promise((r) => { resolveFetch = r })
      mockFetchIndustryDashboardUseCase.mockReturnValue(fetchPromise)

      const actionPromise = useIndustryDashboardStore.getState().fetchDashboard()

      // 等待微任务
      await Promise.resolve()
      const state = useIndustryDashboardStore.getState()
      expect(state.loading).toBe(false) // 已有数据，不显示 loading
      expect(state.isRefreshing).toBe(true) // 但 isRefreshing 为 true

      resolveFetch!({
        success: true,
        v4Analyses: [createMockV4Analysis({ industryCode: 'ind-002' })],
        rotationSignals: [createMockRotationSignal({ industryCode: 'ind-002' })],
      })
      await actionPromise

      expect(useIndustryDashboardStore.getState().isRefreshing).toBe(false)
    })
  })

  // --------------------------------------------------------
  // 4. fetchDashboard 失败
  // --------------------------------------------------------
  describe('fetchDashboard - 失败', () => {
    it('业务失败：error 设置、数据清空、isRefreshing 重置', async () => {
      // 先加载数据
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [createMockV4Analysis()],
        rotationSignals: [createMockRotationSignal()],
      })
      await useIndustryDashboardStore.getState().fetchDashboard()
      expect(useIndustryDashboardStore.getState().v4Analyses.length).toBeGreaterThan(0)

      // 模拟失败
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: false,
        v4Analyses: [],
        rotationSignals: [],
        error: '网络连接失败',
      })
      await useIndustryDashboardStore.getState().fetchDashboard()

      const state = useIndustryDashboardStore.getState()
      expect(state.error).toBe('网络连接失败')
      expect(state.v4Analyses).toEqual([])
      expect(state.rotationSignals).toEqual([])
      expect(state.isRefreshing).toBe(false)
      expect(state.loading).toBe(false)
    })

    it('异常抛出：捕获异常并设置 error', async () => {
      mockFetchIndustryDashboardUseCase.mockRejectedValue(new Error('服务异常'))

      await useIndustryDashboardStore.getState().fetchDashboard()

      const state = useIndustryDashboardStore.getState()
      expect(state.error).toBe('服务异常')
      expect(state.v4Analyses).toEqual([])
      expect(state.rotationSignals).toEqual([])
      expect(state.isRefreshing).toBe(false)
      expect(state.loading).toBe(false)
    })

    it('业务失败 error 为 undefined 时使用默认值', async () => {
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: false,
        v4Analyses: [],
        rotationSignals: [],
      })

      await useIndustryDashboardStore.getState().fetchDashboard()

      const state = useIndustryDashboardStore.getState()
      expect(state.error).toBe('加载失败')
    })
  })

  // --------------------------------------------------------
  // 5. fetchDashboard 空数据（emptyReason）
  // --------------------------------------------------------
  describe('fetchDashboard - 空数据 emptyReason', () => {
    it('返回空数据时 emptyReason 正确设置', async () => {
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [],
        rotationSignals: [],
        emptyReason: '暂无行业数据，请先导入股票池',
      })

      await useIndustryDashboardStore.getState().fetchDashboard()

      const state = useIndustryDashboardStore.getState()
      expect(state.emptyReason).toBe('暂无行业数据，请先导入股票池')
      expect(state.v4Analyses).toEqual([])
      expect(state.rotationSignals).toEqual([])
    })

    it('emptyReason 为 undefined 时设为 null', async () => {
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [createMockV4Analysis()],
        rotationSignals: [createMockRotationSignal()],
      })

      await useIndustryDashboardStore.getState().fetchDashboard()

      expect(useIndustryDashboardStore.getState().emptyReason).toBeNull()
    })
  })

  // --------------------------------------------------------
  // 6. 防重入：并发调用 fetchDashboard 只执行一次
  // --------------------------------------------------------
  describe('防重入 - 并发调用', () => {
    it('并发调用 fetchDashboard 只执行一次', async () => {
      let resolveFetch: ((value: unknown) => void) | undefined
      const fetchPromise = new Promise((r) => { resolveFetch = r })
      mockFetchIndustryDashboardUseCase.mockReturnValue(fetchPromise)

      const promise1 = useIndustryDashboardStore.getState().fetchDashboard()
      const promise2 = useIndustryDashboardStore.getState().fetchDashboard()

      // 等待微任务
      await Promise.resolve()
      // useCase 只被调用一次
      expect(mockFetchIndustryDashboardUseCase).toHaveBeenCalledTimes(1)

      resolveFetch!({
        success: true,
        v4Analyses: [],
        rotationSignals: [],
      })
      await Promise.all([promise1, promise2])

      // 最终 useCase 仍然只调用了一次
      expect(mockFetchIndustryDashboardUseCase).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------------------
  // 7. setLoading / setError 直接调用
  // --------------------------------------------------------
  describe('setLoading / setError', () => {
    it('setLoading 直接设置 loading 状态', () => {
      useIndustryDashboardStore.getState().setLoading(true)
      expect(useIndustryDashboardStore.getState().loading).toBe(true)

      useIndustryDashboardStore.getState().setLoading(false)
      expect(useIndustryDashboardStore.getState().loading).toBe(false)
    })

    it('setError 直接设置 error 状态', () => {
      useIndustryDashboardStore.getState().setError('测试错误')
      expect(useIndustryDashboardStore.getState().error).toBe('测试错误')

      useIndustryDashboardStore.getState().setError(null)
      expect(useIndustryDashboardStore.getState().error).toBeNull()
    })
  })

  // --------------------------------------------------------
  // 8. reset 重置到初始状态
  // --------------------------------------------------------
  describe('reset', () => {
    it('重置到初始状态', async () => {
      // 先填充数据
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [createMockV4Analysis()],
        rotationSignals: [createMockRotationSignal()],
      })
      await useIndustryDashboardStore.getState().fetchDashboard()

      const stateBefore = useIndustryDashboardStore.getState()
      expect(stateBefore.v4Analyses.length).toBeGreaterThan(0)
      expect(stateBefore.lastUpdated).toBeGreaterThan(0)

      // 重置
      useIndustryDashboardStore.getState().reset()

      const stateAfter = useIndustryDashboardStore.getState()
      expect(stateAfter.v4Analyses).toEqual([])
      expect(stateAfter.rotationSignals).toEqual([])
      expect(stateAfter.loading).toBe(false)
      expect(stateAfter.error).toBeNull()
      expect(stateAfter.emptyReason).toBeNull()
      expect(stateAfter.lastUpdated).toBe(0)
      expect(stateAfter.isRefreshing).toBe(false)
    })
  })

  // --------------------------------------------------------
  // 9. forceRefresh 参数正确传递给 useCase
  // --------------------------------------------------------
  describe('forceRefresh 参数', () => {
    it('默认不传递 forceRefresh 时为 false/undefined', async () => {
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [],
        rotationSignals: [],
      })

      await useIndustryDashboardStore.getState().fetchDashboard()

      expect(mockFetchIndustryDashboardUseCase).toHaveBeenCalledWith({ forceRefresh: false })
    })

    it('forceRefresh=true 正确传递给 useCase', async () => {
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [],
        rotationSignals: [],
      })

      await useIndustryDashboardStore.getState().fetchDashboard(true)

      expect(mockFetchIndustryDashboardUseCase).toHaveBeenCalledWith({ forceRefresh: true })
    })
  })

  // --------------------------------------------------------
  // 10. 错误日志记录
  // --------------------------------------------------------
  describe('错误日志记录', () => {
    it('业务失败时记录 error 日志', async () => {
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: false,
        v4Analyses: [],
        rotationSignals: [],
        error: '加载失败',
      })

      await useIndustryDashboardStore.getState().fetchDashboard()

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[industryDashboardStore] 数据加载失败',
        { error: '加载失败' }
      )
    })

    it('异常抛出时记录 error 日志', async () => {
      mockFetchIndustryDashboardUseCase.mockRejectedValue(new Error('网络异常'))

      await useIndustryDashboardStore.getState().fetchDashboard()

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[industryDashboardStore] 加载异常',
        { error: '网络异常' }
      )
    })

    it('首次加载时记录 info 日志', async () => {
      mockFetchIndustryDashboardUseCase.mockResolvedValue({
        success: true,
        v4Analyses: [createMockV4Analysis()],
        rotationSignals: [createMockRotationSignal()],
      })

      await useIndustryDashboardStore.getState().fetchDashboard()

      // 检查 info 日志的第一次调用（开始）
      expect(mockLogger.info.mock.calls[0]?.[0]).toContain('fetchDashboard 开始')
      // 检查 info 日志的第二次调用（完成）
      expect(mockLogger.info.mock.calls[1]?.[0]).toContain('数据加载完成')
    })

    it('并发跳过调用时记录 debug 日志', async () => {
      let resolveFetch: ((value: unknown) => void) | undefined
      const fetchPromise = new Promise((r) => { resolveFetch = r })
      mockFetchIndustryDashboardUseCase.mockReturnValue(fetchPromise)

      const promise1 = useIndustryDashboardStore.getState().fetchDashboard()
      const promise2 = useIndustryDashboardStore.getState().fetchDashboard()

      await Promise.resolve()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('跳过并发调用')
      )

      resolveFetch!({
        success: true,
        v4Analyses: [],
        rotationSignals: [],
      })
      await Promise.all([promise1, promise2])
    })
  })
})
