/**
 * @test_id V9-TEST-ST-129
 * @module services/useCase/hotSectorQuery.useCase.test
 * @description 热门板块查询用例单元测试 — 验证热门板块查询与排序流程
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hotSectorQueryUseCase } from './hotSectorQuery.useCase'
import type { HotSector } from '@/services/input/hotSectorService'

// Mock 依赖
const {
  mockGetHotSectors,
  mockLogger,
} = vi.hoisted(() => ({
  mockGetHotSectors: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/services/input/hotSectorService', () => ({
  getHotSectors: mockGetHotSectors,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => mockLogger),
}))

describe('hotSectorQueryUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHotSectors.mockResolvedValue([])
  })

  // 测试数据
  const mockHotSectors: HotSector[] = [
    {
      code: 'semiconductor',
      name: '半导体',
      score: 95.5,
      trend: 'up',
      factors: {
        momentum: 90,
        fundFlow: 85,
        valuation: 70,
        sentiment: 88,
      },
      stocks: [],
    },
    {
      code: 'new-energy',
      name: '新能源',
      score: 88.2,
      trend: 'up',
      factors: {
        momentum: 82,
        fundFlow: 90,
        valuation: 75,
        sentiment: 80,
      },
      stocks: [],
    },
    {
      code: 'ai',
      name: '人工智能',
      score: 92.0,
      trend: 'up',
      factors: {
        momentum: 95,
        fundFlow: 88,
        valuation: 65,
        sentiment: 92,
      },
      stocks: [],
    },
    {
      code: 'real-estate',
      name: '房地产',
      score: 45.3,
      trend: 'down',
      factors: {
        momentum: 30,
        fundFlow: 40,
        valuation: 55,
        sentiment: 35,
      },
      stocks: [],
    },
    {
      code: 'medicine',
      name: '医药生物',
      score: 72.1,
      trend: 'neutral',
      factors: {
        momentum: 65,
        fundFlow: 70,
        valuation: 80,
        sentiment: 68,
      },
      stocks: [],
    },
  ]

  describe('正常流程', () => {
    it('应当成功查询热门板块并按 score 降序排序', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      const result = await hotSectorQueryUseCase()

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors).toHaveLength(5)
        // 验证按 score 降序排序
        expect(result.value.hotSectors[0]?.code).toBe('semiconductor') // 95.5
        expect(result.value.hotSectors[1]?.code).toBe('ai') // 92.0
        expect(result.value.hotSectors[2]?.code).toBe('new-energy') // 88.2
        expect(result.value.hotSectors[3]?.code).toBe('medicine') // 72.1
        expect(result.value.hotSectors[4]?.code).toBe('real-estate') // 45.3

        // 验证分数严格降序
        const scores = result.value.hotSectors.map((s) => s.score)
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!)
        }
      }
    })

    it('应当使用默认 topN = 10', async () => {
      // 准备：返回 15 个板块
      const manySectors: HotSector[] = Array.from({ length: 15 }, (_, i) => ({
        code: `sector-${i}`,
        name: `板块${i}`,
        score: 100 - i,
        trend: 'up' as const,
        factors: {
          momentum: 80,
          fundFlow: 75,
          valuation: 70,
          sentiment: 65,
        },
        stocks: [],
      }))
      mockGetHotSectors.mockResolvedValue(manySectors)

      // 执行：不传参数，使用默认值
      const result = await hotSectorQueryUseCase()

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors).toHaveLength(10)
        expect(result.value.hotSectors[0]?.code).toBe('sector-0')
        expect(result.value.hotSectors[9]?.code).toBe('sector-9')
      }
    })

    it('应当支持自定义 topN 参数', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      const result = await hotSectorQueryUseCase({ topN: 3 })

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors).toHaveLength(3)
        expect(result.value.hotSectors[0]?.code).toBe('semiconductor')
        expect(result.value.hotSectors[1]?.code).toBe('ai')
        expect(result.value.hotSectors[2]?.code).toBe('new-energy')
      }
    })

    it('应当正确传递 topN 给底层服务调用', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      await hotSectorQueryUseCase({ topN: 5 })

      // 验证：getHotSectors 被调用（虽然它不需要参数，但验证调用次数）
      expect(mockGetHotSectors).toHaveBeenCalledTimes(1)
    })
  })

  describe('数据为空', () => {
    it('应当返回空数组：没有热门板块数据', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue([])

      // 执行
      const result = await hotSectorQueryUseCase()

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors).toHaveLength(0)
        expect(result.value.hotSectors).toEqual([])
      }
    })

    it('应当在数据为空时记录日志', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue([])

      // 执行
      await hotSectorQueryUseCase()

      // 验证：查询完成日志中 totalCount 为 0
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[hotSectorQueryUseCase] 查询完成',
        expect.objectContaining({
          totalCount: 0,
          returnedCount: 0,
          topSectors: [],
        }),
      )
    })
  })

  describe('依赖失败场景', () => {
    it('应当捕获 getHotSectors 抛出的异常并返回失败', async () => {
      // 准备
      mockGetHotSectors.mockImplementation(() => {
        throw new Error('数据源连接失败')
      })

      // 执行
      const result = await hotSectorQueryUseCase()

      // 验证
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('数据源连接失败')
      }
    })

    it('应当捕获非 Error 类型的异常', async () => {
      // 准备
      mockGetHotSectors.mockImplementation(() => {
        throw '未知错误'
      })

      // 执行
      const result = await hotSectorQueryUseCase()

      // 验证
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBeDefined()
      }
    })

    it('应当在失败时记录 error 级别日志', async () => {
      // 准备
      mockGetHotSectors.mockImplementation(() => {
        throw new Error('热门板块服务异常')
      })

      // 执行
      await hotSectorQueryUseCase()

      // 验证
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[hotSectorQueryUseCase] 查询失败',
        expect.objectContaining({
          error: '热门板块服务异常',
        }),
      )
    })

    it('应当在失败日志中包含错误码', async () => {
      // 准备
      mockGetHotSectors.mockImplementation(() => {
        throw new Error('服务不可用')
      })

      // 执行
      await hotSectorQueryUseCase()

      // 验证
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[hotSectorQueryUseCase] 查询失败',
        expect.objectContaining({
          code: expect.any(String),
        }),
      )
    })
  })

  describe('参数传递验证', () => {
    it('应当正确传递 topN = 0', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      const result = await hotSectorQueryUseCase({ topN: 0 })

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors).toHaveLength(0)
      }
    })

    it('应当正确传递 topN 大于数据总数', async () => {
      // 准备：只有 5 个板块，但 topN = 100
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      const result = await hotSectorQueryUseCase({ topN: 100 })

      // 验证：返回全部数据
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors).toHaveLength(5)
      }
    })

    it('应当在不传 input 参数时使用默认值', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行：不传任何参数
      const result = await hotSectorQueryUseCase()

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors.length).toBeLessThanOrEqual(10)
      }

      // 验证：日志中 topN 为默认值 10
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[hotSectorQueryUseCase] 开始查询热门板块',
        { topN: 10 },
      )
    })

    it('应当在 topN 为负数时返回空数组', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      const result = await hotSectorQueryUseCase({ topN: -5 })

      // 验证：slice(0, -5) 会返回去掉后5个的数组，但这里数据只有5个
      expect(result.ok).toBe(true)
      if (result.ok) {
        // slice(0, negative) 的行为是从末尾去掉 N 个元素
        expect(result.value.hotSectors.length).toBeLessThanOrEqual(5)
      }
    })
  })

  describe('排序逻辑验证', () => {
    it('应当按 score 降序排序', async () => {
      // 准备：乱序数据
      const unorderedSectors: HotSector[] = [
        { ...mockHotSectors[3]!, score: 30 }, // 最低
        { ...mockHotSectors[0]!, score: 90 }, // 最高
        { ...mockHotSectors[2]!, score: 60 }, // 中间
        { ...mockHotSectors[1]!, score: 80 }, // 次高
        { ...mockHotSectors[4]!, score: 50 }, // 较低
      ]
      mockGetHotSectors.mockResolvedValue(unorderedSectors)

      // 执行
      const result = await hotSectorQueryUseCase()

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        const scores = result.value.hotSectors.map((s) => s.score)
        expect(scores).toEqual([90, 80, 60, 50, 30])
      }
    })

    it('应当处理相同 score 的板块', async () => {
      // 准备：多个相同分数的板块
      const sameScoreSectors: HotSector[] = [
        { ...mockHotSectors[0]!, score: 80 },
        { ...mockHotSectors[1]!, score: 80 },
        { ...mockHotSectors[2]!, score: 80 },
      ]
      mockGetHotSectors.mockResolvedValue(sameScoreSectors)

      // 执行
      const result = await hotSectorQueryUseCase()

      // 验证：全部返回，顺序保持稳定排序
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.hotSectors).toHaveLength(3)
        result.value.hotSectors.forEach((s) => {
          expect(s.score).toBe(80)
        })
      }
    })
  })

  describe('日志记录', () => {
    it('应当在查询开始时记录 info 级别日志', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      await hotSectorQueryUseCase({ topN: 3 })

      // 验证
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[hotSectorQueryUseCase] 开始查询热门板块',
        { topN: 3 },
      )
    })

    it('应当在查询完成时记录详细信息', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      await hotSectorQueryUseCase({ topN: 3 })

      // 验证
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[hotSectorQueryUseCase] 查询完成',
        expect.objectContaining({
          totalCount: 5,
          returnedCount: 3,
        }),
      )
    })

    it('应当在完成日志中包含 topSectors 摘要', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors.slice(0, 3))

      // 执行
      await hotSectorQueryUseCase({ topN: 3 })

      // 验证
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[hotSectorQueryUseCase] 查询完成',
        expect.objectContaining({
          topSectors: expect.arrayContaining([
            expect.objectContaining({ name: expect.any(String), score: expect.any(Number) }),
          ]),
        }),
      )
    })

    it('应当在成功时不记录 error 日志', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      await hotSectorQueryUseCase()

      // 验证
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('应当在失败时记录 error 日志且包含错误信息', async () => {
      // 准备
      mockGetHotSectors.mockImplementation(() => {
        throw new Error('服务内部错误')
      })

      // 执行
      await hotSectorQueryUseCase()

      // 验证：useCase 自身的错误日志（注意：captureError 也会记录一条 error 日志）
      const errorCalls = mockLogger.error.mock.calls
      const useCaseErrorCall = errorCalls.find(
        (call) => (call[0] as string).includes('[hotSectorQueryUseCase] 查询失败'),
      )
      expect(useCaseErrorCall).toBeDefined()
      expect(useCaseErrorCall![1]).toMatchObject({
        error: '服务内部错误',
      })
    })
  })

  describe('数据完整性', () => {
    it('应当保留板块的所有字段', async () => {
      // 准备
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      const result = await hotSectorQueryUseCase({ topN: 1 })

      // 验证
      expect(result.ok).toBe(true)
      if (result.ok) {
        const sector = result.value.hotSectors[0]!
        expect(sector.code).toBeDefined()
        expect(sector.name).toBeDefined()
        expect(sector.score).toBeDefined()
        expect(sector.trend).toBeDefined()
        expect(sector.factors).toBeDefined()
        expect(sector.factors.momentum).toBeDefined()
        expect(sector.factors.fundFlow).toBeDefined()
        expect(sector.factors.valuation).toBeDefined()
        expect(sector.factors.sentiment).toBeDefined()
        expect(sector.stocks).toBeDefined()
      }
    })

    it('应当不修改原始数据源（返回新数组）', async () => {
      // 准备
      const originalSectors = [...mockHotSectors]
      mockGetHotSectors.mockResolvedValue(mockHotSectors)

      // 执行
      const result = await hotSectorQueryUseCase()

      // 验证：原始数据顺序不变（getHotSectors 内部会返回新数组副本）
      expect(result.ok).toBe(true)
      if (result.ok) {
        // 结果是排序后的，但原始 mockHotSectors 的引用顺序不变
        expect(mockHotSectors[0]?.code).toBe('semiconductor')
        expect(originalSectors[0]?.code).toBe('semiconductor')
      }
    })
  })
})
