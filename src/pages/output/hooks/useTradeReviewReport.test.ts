/**
 * @fileoverview useTradeReviewReport Hook 单元测试
 * 覆盖 Store 选择器优化、useMemo 缓存、数据加载、报告生成、下载等场景
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// --- Mock 依赖 ---

const mockToast = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// Store 状态控制
let mockStoreState: {
  latestReport: unknown
  loadOrders: ReturnType<typeof vi.fn>
  generateReviewReport: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
} = {
  latestReport: null,
  loadOrders: vi.fn(),
  generateReviewReport: vi.fn(),
  refresh: vi.fn(),
}

vi.mock('@/store/disciplineStore', () => ({
  useDisciplineStore: Object.assign(
    (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
    { getState: () => mockStoreState },
  ),
}))

vi.mock('@/store/themeStore', () => ({
  useThemeStore: (selector: (s: { resolvedMode: string }) => unknown) =>
    selector({ resolvedMode: 'light' }),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}))

// --- Import after mocks ---
import { useTradeReviewReport } from '@/pages/output/hooks/useTradeReviewReport'

function renderReviewHook() {
  return renderHook(() => useTradeReviewReport())
}

function makeMockReport() {
  return {
    generatedAt: Date.now(),
    summary: {
      totalTrades: 5,
      profitableTrades: 3,
      losingTrades: 2,
      winRate: 60.0,
      profitLossRatio: 1.5,
      avgProfit: 3.2,
      avgLoss: -2.1,
      totalPnL: 500,
      totalPnLPercent: 5.0,
      disciplineScore: 75.5,
      totalErrors: 2,
    },
    errorAnalysis: {
      topErrors: [],
      errorTrend: '稳定',
      psychologicalProfile: {
        primaryType: 'chase_type',
        name: '追涨型',
        characteristics: ['追高买入'],
        rootCause: 'FOMO',
        improvementDirection: '建立计划',
      },
      riskProfile: {
        riskAppetite: 'moderate',
        maxDrawdown: 10,
        concentrationLevel: 'medium',
        suggestions: [],
      },
    },
    disciplineAnalysis: {
      planAdherenceRate: 70.0,
      stopLossExecutionRate: 80.0,
      positionManagementScore: 65.0,
      emotionControlScore: 60.0,
      overallScore: 68.0,
      improvements: ['严格执行止损'],
    },
    skillDevelopment: {
      currentLevel: 'intermediate',
      prioritySkills: [],
      recommendedResources: [],
      userId: 'test',
      dimensions: [],
      milestones: [],
      learningPath: [],
      overallLevel: 'intermediate',
      updatedAt: Date.now(),
    },
    actionPlan: {
      immediate: ['复盘最近交易'],
      shortTerm: ['写交易日志'],
      longTerm: ['建立交易系统'],
    },
    aiInsight: {
      pnlAttribution: [],
      dataPatterns: [],
      personalizedAdvice: [],
    },
  }
}

describe('useTradeReviewReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = {
      latestReport: null,
      loadOrders: vi.fn().mockResolvedValue([]),
      generateReviewReport: vi.fn(),
      refresh: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // Store 选择器优化验证
  // ============================================================

  describe('Store 选择器优化', () => {
    it('通过选择器获取 latestReport，初始为 null', () => {
      const { result } = renderReviewHook()
      expect(result.current.review).toBeNull()
    })

    it('latestReport 存在时 review 不为 null', async () => {
      mockStoreState.latestReport = makeMockReport()
      const { result } = renderReviewHook()
      await waitFor(() => {
        expect(result.current.review).not.toBeNull()
      })
    })

    it('通过选择器获取 loadOrders 并在挂载时调用', async () => {
      const { result } = renderReviewHook()
      await waitFor(() => {
        expect(mockStoreState.loadOrders).toHaveBeenCalled()
      })
      expect(result.current.loading).toBe(false)
    })

    it('通过选择器获取 refresh 并在挂载时调用', async () => {
      renderReviewHook()
      await waitFor(() => {
        expect(mockStoreState.refresh).toHaveBeenCalled()
      })
    })

    it('通过选择器获取 generateReviewReport', async () => {
      mockStoreState.loadOrders = vi.fn().mockResolvedValue([
        { id: '1', symbol: '000001', price: 10, createdAt: Date.now() },
      ])
      const { result } = renderReviewHook()

      await waitFor(() => {
        expect(result.current.orders).toHaveLength(1)
      })

      act(() => {
        result.current.generateReport()
      })

      expect(mockStoreState.generateReviewReport).toHaveBeenCalled()
    })
  })

  // ============================================================
  // useMemo 缓存优化验证
  // ============================================================

  describe('useMemo 缓存优化', () => {
    it('review 对象在 latestReport 不变时引用稳定', async () => {
      mockStoreState.latestReport = makeMockReport()
      const { result, rerender } = renderReviewHook()

      const firstReview = result.current.review
      rerender()
      const secondReview = result.current.review

      // latestReport 未变 → useMemo 返回同一引用
      expect(secondReview).toBe(firstReview)
    })

    it('review 对象在 latestReport 变化时重新计算', async () => {
      mockStoreState.latestReport = makeMockReport()
      const { result, rerender } = renderReviewHook()

      const firstReview = result.current.review

      // 改变 latestReport
      mockStoreState.latestReport = { ...makeMockReport(), generatedAt: Date.now() + 1000 }
      rerender()

      const secondReview = result.current.review

      expect(secondReview).not.toBe(firstReview)
      expect(secondReview).not.toBeNull()
    })

    it('latestReport 为 null 时 review 为 null', () => {
      const { result } = renderReviewHook()
      expect(result.current.review).toBeNull()
    })

    it('downloadReport 在 review 不变时引用稳定', async () => {
      mockStoreState.latestReport = makeMockReport()
      const { result, rerender } = renderReviewHook()

      const firstDownload = result.current.downloadReport
      rerender()
      const secondDownload = result.current.downloadReport

      expect(secondDownload).toBe(firstDownload)
    })
  })

  // ============================================================
  // 数据加载逻辑
  // ============================================================

  describe('数据加载', () => {
    it('loadOrders 成功时更新 orders 状态', async () => {
      const mockOrders = [
        { id: '1', symbol: '000001', price: 10, createdAt: Date.now() },
        { id: '2', symbol: '000002', price: 20, createdAt: Date.now() },
      ]
      mockStoreState.loadOrders = vi.fn().mockResolvedValue(mockOrders)

      const { result } = renderReviewHook()

      await waitFor(() => {
        expect(result.current.orders).toHaveLength(2)
      })
      expect(result.current.loading).toBe(false)
    })

    it('loadOrders 失败时显示错误 toast', async () => {
      mockStoreState.loadOrders = vi.fn().mockRejectedValue(new Error('网络错误'))

      const { result } = renderReviewHook()

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'error',
            title: '加载交易记录失败',
          }),
        )
      })
      expect(result.current.loading).toBe(false)
    })

    it('加载订单后若无 latestReport 则自动生成报告', async () => {
      const mockOrders = [
        { id: '1', symbol: '000001', price: 10, createdAt: Date.now() },
      ]
      mockStoreState.loadOrders = vi.fn().mockResolvedValue(mockOrders)
      mockStoreState.latestReport = null

      renderReviewHook()

      await waitFor(() => {
        expect(mockStoreState.generateReviewReport).toHaveBeenCalledWith(mockOrders)
      })
    })

    it('加载订单后若已有 latestReport 则不自动生成', async () => {
      const mockOrders = [
        { id: '1', symbol: '000001', price: 10, createdAt: Date.now() },
      ]
      mockStoreState.loadOrders = vi.fn().mockResolvedValue(mockOrders)
      mockStoreState.latestReport = makeMockReport()

      renderReviewHook()

      // 等待 loadOrders 完成
      await waitFor(() => {
        expect(mockStoreState.loadOrders).toHaveBeenCalled()
      })

      // 不应自动调用 generateReviewReport
      expect(mockStoreState.generateReviewReport).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 报告生成逻辑
  // ============================================================

  describe('报告生成', () => {
    it('无订单时调用 generateReport 显示错误提示', () => {
      const { result } = renderReviewHook()

      act(() => {
        result.current.generateReport()
      })

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: '无交易记录',
        }),
      )
      expect(mockStoreState.generateReviewReport).not.toHaveBeenCalled()
    })

    it('有订单时调用 generateReport 触发生成', async () => {
      const mockOrders = [
        { id: '1', symbol: '000001', price: 10, createdAt: Date.now() },
      ]
      mockStoreState.loadOrders = vi.fn().mockResolvedValue(mockOrders)

      const { result } = renderReviewHook()

      await waitFor(() => {
        expect(result.current.orders).toHaveLength(1)
      })

      act(() => {
        result.current.generateReport()
      })

      expect(mockStoreState.generateReviewReport).toHaveBeenCalledWith(mockOrders)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '复盘报告生成成功',
        }),
      )
    })

    it('生成报告抛出异常时显示错误 toast', async () => {
      mockStoreState.loadOrders = vi.fn().mockResolvedValue([
        { id: '1', symbol: '000001', price: 10, createdAt: Date.now() },
      ])
      mockStoreState.generateReviewReport = vi.fn(() => {
        throw new Error('生成失败')
      })

      const { result } = renderReviewHook()

      await waitFor(() => {
        expect(result.current.orders).toHaveLength(1)
      })

      act(() => {
        result.current.generateReport()
      })

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          title: '生成复盘报告失败',
        }),
      )
    })
  })

  // ============================================================
  // 下载报告逻辑
  // ============================================================

  describe('下载报告', () => {
    it('无 review 时 downloadReport 不执行', () => {
      const { result } = renderReviewHook()

      act(() => {
        result.current.downloadReport()
      })

      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '下载成功' }),
      )
    })

    it('有 review 时 downloadReport 触发下载', async () => {
      mockStoreState.latestReport = makeMockReport()
      const { result } = renderReviewHook()

      await waitFor(() => {
        expect(result.current.review).not.toBeNull()
      })

      // mock DOM API
      const mockClick = vi.fn()
      const mockRevokeObjectURL = vi.fn()
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test')
      vi.stubGlobal('URL', {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      })
      const mockAnchor = { click: mockClick, href: '', download: '' }
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement)

      act(() => {
        result.current.downloadReport()
      })

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test')
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '下载成功' }),
      )

      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })
  })

  // ============================================================
  // 返回值结构
  // ============================================================

  describe('返回值结构', () => {
    it('返回正确的字段集合', () => {
      const { result } = renderReviewHook()

      expect(result.current).toHaveProperty('orders')
      expect(result.current).toHaveProperty('loading')
      expect(result.current).toHaveProperty('generating')
      expect(result.current).toHaveProperty('review')
      expect(result.current).toHaveProperty('loadOrders')
      expect(result.current).toHaveProperty('generateReport')
      expect(result.current).toHaveProperty('downloadReport')
    })

    it('初始状态正确', async () => {
      const { result } = renderReviewHook()

      expect(result.current.orders).toEqual([])
      expect(result.current.review).toBeNull()
      // loading 在 useEffect 触发后为 true，异步完成后回到 false
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      expect(result.current.generating).toBe(false)
    })
  })
})
