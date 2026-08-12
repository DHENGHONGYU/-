/**
 * @test_id V9-TEST-ST-132
 * @module services/useCase/fetchSectorAnalysis.useCase.test
 * @description 板块分析用例单元测试 — 验证轮动评分、行业评分加载与默认计算逻辑
 * @covers_docs [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSectorAnalysisUseCase } from './fetchSectorAnalysis.useCase'
import type { RotationSectorScore } from '@/data/types/types.rotation'
import type { IndustryScore } from '@/data/types/types.score'

// Mock 依赖
const {
  mockGetRotationScores,
  mockGetIndustryScores,
  mockCalculateAndSaveDefaultRotationScores,
  mockCalculateAndSaveDefaultIndustryScores,
  mockLogger,
} = vi.hoisted(() => ({
  mockGetRotationScores: vi.fn(),
  mockGetIndustryScores: vi.fn(),
  mockCalculateAndSaveDefaultRotationScores: vi.fn(),
  mockCalculateAndSaveDefaultIndustryScores: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/services/analysis/sectorAnalysisEngine', () => ({
  getRotationScores: mockGetRotationScores,
  getIndustryScores: mockGetIndustryScores,
  calculateAndSaveDefaultRotationScores: mockCalculateAndSaveDefaultRotationScores,
  calculateAndSaveDefaultIndustryScores: mockCalculateAndSaveDefaultIndustryScores,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// ============================================================
// 辅助函数
// ============================================================

function createMockRotationScore(
  sectorCode: string,
  sectorName: string,
  total: number,
): RotationSectorScore {
  return {
    id: `${sectorCode}__2026-07-21`,
    sectorCode,
    sectorName,
    scoreDate: '2026-07-21',
    f1Jingqi: 60 + Math.random() * 30,
    f2Zijin: 50 + Math.random() * 30,
    f3Guzhi: 40 + Math.random() * 30,
    f4Beta: 55 + Math.random() * 30,
    f5Nengliang: 45 + Math.random() * 30,
    total,
    resonance: 5 + Math.random() * 3,
    signal: total >= 70 ? '强势' : total >= 50 ? '中性' : '弱势',
    alertLevel: '低',
    declineType: '正常调整',
    poolStocks: [{ symbol: '000001.SZ', name: '平安银行', v6Composite: 75 }],
    modelUsed: 'v6-pro',
    createdAt: '2026-07-21T00:00:00.000Z',
  }
}

function createMockIndustryScore(
  code: string,
  name: string,
  scoredAt: number,
): IndustryScore {
  return {
    code,
    name,
    overallScore: 3.5,
    dimensionScores: [
      { name: '景气度', score: 3.5, rationale: '行业增长稳健', evidence: ['营收增长15%'], weight: 0.25 },
      { name: '竞争格局', score: 3.0, rationale: '集中度适中', evidence: ['CR5约40%'], weight: 0.25 },
      { name: '政策环境', score: 4.0, rationale: '政策支持力度大', evidence: ['十五五规划重点'], weight: 0.25 },
      { name: '技术迭代', score: 3.8, rationale: '技术创新活跃', evidence: ['专利数量增长'], weight: 0.25 },
    ],
    summary: `${name}行业整体评分良好`,
    basis: '基于财务数据和政策分析',
    missingFields: [],
    sectorSnapshot: {
      composite: 75,
      recommendation: '增持',
      positionPct: '5-10%',
      subTracks: ['子赛道A', '子赛道B'],
    },
    configSnapshot: {
      model: 'gpt-4',
      baseURL: 'https://api.example.com',
      v6EngineVersion: 'v2.9.5',
      v6Score: 75,
    },
    modelResponse: '{}',
    scoredAt,
  }
}

function mockSuccessQuery(
  rotationScores: RotationSectorScore[],
  industryScores: IndustryScore[],
) {
  mockGetRotationScores.mockResolvedValue({ success: true, data: rotationScores })
  mockGetIndustryScores.mockResolvedValue({ success: true, data: industryScores })
}

// ============================================================
// 测试主体
// ============================================================

describe('fetchSectorAnalysisUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRotationScores.mockResolvedValue({ success: false, error: '未设置 mock' })
    mockGetIndustryScores.mockResolvedValue({ success: false, error: '未设置 mock' })
    mockCalculateAndSaveDefaultRotationScores.mockResolvedValue({ success: false, error: '未设置 mock' })
    mockCalculateAndSaveDefaultIndustryScores.mockResolvedValue({ success: false, error: '未设置 mock' })
  })

  describe('正常流程', () => {
    it('应当成功加载板块分析数据：查询有数据时不触发默认计算', async () => {
      // 准备
      const rotationScores = [
        createMockRotationScore('S001', '人工智能', 85),
        createMockRotationScore('S002', '新能源', 72),
        createMockRotationScore('S003', '半导体', 60),
      ]
      const industryScores = [
        createMockIndustryScore('I001', 'AI算力', Date.now()),
        createMockIndustryScore('I002', '锂电池', Date.now() - 86400000),
      ]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.rotationScores).toHaveLength(3)
      expect(result.industryScores).toHaveLength(2)
      expect(result.error).toBeUndefined()

      // 验证排序：轮动按 total 降序
      expect(result.rotationScores[0]!.total).toBe(85)
      expect(result.rotationScores[1]!.total).toBe(72)
      expect(result.rotationScores[2]!.total).toBe(60)

      // 验证排序：行业按 scoredAt 降序（最新的在前）
      expect(result.industryScores[0]!.scoredAt).toBeGreaterThan(result.industryScores[1]!.scoredAt)

      // 验证不触发默认计算
      expect(mockCalculateAndSaveDefaultRotationScores).not.toHaveBeenCalled()
      expect(mockCalculateAndSaveDefaultIndustryScores).not.toHaveBeenCalled()
    })

    it('应当并行查询两个数据源', async () => {
      // 准备
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]
      const industryScores = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      await fetchSectorAnalysisUseCase()

      // 验证：两个查询都被调用
      expect(mockGetRotationScores).toHaveBeenCalledTimes(1)
      expect(mockGetIndustryScores).toHaveBeenCalledTimes(1)
    })
  })

  describe('空数据触发默认计算', () => {
    it('应当触发默认计算：板块轮动评分为空', async () => {
      // 准备：rotation 为空，industry 有数据
      const defaultRotation = [
        createMockRotationScore('S001', '人工智能', 70),
        createMockRotationScore('S002', '新能源', 65),
      ]

      mockGetRotationScores.mockResolvedValue({ success: true, data: [] })
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })
      mockCalculateAndSaveDefaultRotationScores.mockResolvedValue({
        success: true,
        data: defaultRotation,
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.rotationScores).toHaveLength(2)
      expect(mockCalculateAndSaveDefaultRotationScores).toHaveBeenCalledTimes(1)
      expect(mockCalculateAndSaveDefaultIndustryScores).not.toHaveBeenCalled()
    })

    it('应当触发默认计算：行业评分为空', async () => {
      // 准备：rotation 有数据，industry 为空
      const defaultIndustry = [
        createMockIndustryScore('I001', 'AI算力', Date.now()),
        createMockIndustryScore('I002', '锂电池', Date.now() - 86400000),
      ]

      mockGetRotationScores.mockResolvedValue({
        success: true,
        data: [createMockRotationScore('S001', '人工智能', 85)],
      })
      mockGetIndustryScores.mockResolvedValue({ success: true, data: [] })
      mockCalculateAndSaveDefaultIndustryScores.mockResolvedValue({
        success: true,
        data: defaultIndustry,
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.industryScores).toHaveLength(2)
      expect(mockCalculateAndSaveDefaultRotationScores).not.toHaveBeenCalled()
      expect(mockCalculateAndSaveDefaultIndustryScores).toHaveBeenCalledTimes(1)
    })

    it('应当触发默认计算：两者都为空', async () => {
      // 准备：都为空
      const defaultRotation = [createMockRotationScore('S001', '人工智能', 70)]
      const defaultIndustry = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockGetRotationScores.mockResolvedValue({ success: true, data: [] })
      mockGetIndustryScores.mockResolvedValue({ success: true, data: [] })
      mockCalculateAndSaveDefaultRotationScores.mockResolvedValue({
        success: true,
        data: defaultRotation,
      })
      mockCalculateAndSaveDefaultIndustryScores.mockResolvedValue({
        success: true,
        data: defaultIndustry,
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.rotationScores).toHaveLength(1)
      expect(result.industryScores).toHaveLength(1)
      expect(mockCalculateAndSaveDefaultRotationScores).toHaveBeenCalledTimes(1)
      expect(mockCalculateAndSaveDefaultIndustryScores).toHaveBeenCalledTimes(1)
    })

    it('应当处理 data 为 undefined 的情况（触发默认计算）', async () => {
      // 准备：data 为 undefined（不是空数组）
      const defaultRotation = [createMockRotationScore('S001', '人工智能', 70)]

      mockGetRotationScores.mockResolvedValue({ success: true, data: undefined })
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })
      mockCalculateAndSaveDefaultRotationScores.mockResolvedValue({
        success: true,
        data: defaultRotation,
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(mockCalculateAndSaveDefaultRotationScores).toHaveBeenCalledTimes(1)
    })
  })

  describe('查询失败场景', () => {
    it('应当返回失败：板块轮动评分查询失败', async () => {
      // 准备
      mockGetRotationScores.mockResolvedValue({ success: false, error: '轮动数据表不存在' })
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.rotationScores).toHaveLength(0)
      expect(result.industryScores).toHaveLength(0)
      expect(result.error).toBe('轮动数据表不存在')

      // 验证不触发默认计算（查询失败直接返回，不走空数据分支）
      expect(mockCalculateAndSaveDefaultRotationScores).not.toHaveBeenCalled()
      expect(mockCalculateAndSaveDefaultIndustryScores).not.toHaveBeenCalled()
    })

    it('应当返回失败：行业评分查询失败', async () => {
      // 准备：rotation 查询成功但 industry 查询失败
      mockGetRotationScores.mockResolvedValue({
        success: true,
        data: [createMockRotationScore('S001', '人工智能', 85)],
      })
      mockGetIndustryScores.mockResolvedValue({ success: false, error: '行业评分表损坏' })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('行业评分表损坏')
    })

    it('应当返回默认错误信息：查询失败但 error 字段为空', async () => {
      // 准备：rotation 查询失败但没有 error 字段
      mockGetRotationScores.mockResolvedValue({ success: false })
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('板块轮动评分查询失败')
    })
  })

  describe('默认计算失败场景', () => {
    it('应当返回失败：板块轮动默认计算失败', async () => {
      // 准备
      mockGetRotationScores.mockResolvedValue({ success: true, data: [] })
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })
      mockCalculateAndSaveDefaultRotationScores.mockResolvedValue({
        success: false,
        error: '默认轮动评分计算超时',
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('默认轮动评分计算超时')
      expect(mockCalculateAndSaveDefaultRotationScores).toHaveBeenCalledTimes(1)
    })

    it('应当返回失败：行业评分默认计算失败', async () => {
      // 准备
      mockGetRotationScores.mockResolvedValue({
        success: true,
        data: [createMockRotationScore('S001', '人工智能', 85)],
      })
      mockGetIndustryScores.mockResolvedValue({ success: true, data: [] })
      mockCalculateAndSaveDefaultIndustryScores.mockResolvedValue({
        success: false,
        error: '默认行业评分计算失败',
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('默认行业评分计算失败')
    })

    it('应当返回默认错误信息：默认计算失败但 error 字段为空', async () => {
      // 准备：默认计算失败但没有 error 字段
      mockGetRotationScores.mockResolvedValue({ success: true, data: [] })
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })
      mockCalculateAndSaveDefaultRotationScores.mockResolvedValue({ success: false })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('板块轮动评分默认计算失败')
    })
  })

  describe('异常捕获', () => {
    it('应当捕获异常：getRotationScores 抛出错误', async () => {
      // 准备
      mockGetRotationScores.mockRejectedValue(new Error('数据库连接中断'))
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.rotationScores).toHaveLength(0)
      expect(result.industryScores).toHaveLength(0)
      expect(result.error).toContain('数据库连接中断')
    })

    it('应当捕获异常：getIndustryScores 抛出错误', async () => {
      // 准备
      mockGetRotationScores.mockResolvedValue({
        success: true,
        data: [createMockRotationScore('S001', '人工智能', 85)],
      })
      mockGetIndustryScores.mockRejectedValue(new Error('网络请求失败'))

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toContain('网络请求失败')
    })

    it('应当捕获异常：默认计算函数抛出错误', async () => {
      // 准备
      mockGetRotationScores.mockResolvedValue({ success: true, data: [] })
      mockGetIndustryScores.mockResolvedValue({
        success: true,
        data: [createMockIndustryScore('I001', 'AI算力', Date.now())],
      })
      mockCalculateAndSaveDefaultRotationScores.mockRejectedValue(new Error('计算引擎崩溃'))

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toContain('计算引擎崩溃')
    })

    it('应当处理非 Error 类型异常', async () => {
      // 准备：抛出字符串异常
      mockGetRotationScores.mockRejectedValue('系统异常')

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(false)
      expect(result.error).toBe('系统异常')
    })
  })

  describe('参数传递', () => {
    it('不传参数时应正常工作（使用默认空对象）', async () => {
      // 准备
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]
      const industryScores = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行：不传参数
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.rotationScores).toHaveLength(1)
      expect(result.industryScores).toHaveLength(1)
    })

    it('传入空对象参数时应正常工作', async () => {
      // 准备
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]
      const industryScores = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase({})

      // 验证
      expect(result.success).toBe(true)
    })
  })

  describe('排序逻辑', () => {
    it('板块轮动评分应按 total 降序排列', async () => {
      // 准备：乱序的轮动评分
      const rotationScores = [
        createMockRotationScore('S003', '半导体', 60),
        createMockRotationScore('S001', '人工智能', 85),
        createMockRotationScore('S002', '新能源', 72),
      ]
      const industryScores = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证：降序排列
      expect(result.rotationScores[0]!.sectorCode).toBe('S001')
      expect(result.rotationScores[0]!.total).toBe(85)
      expect(result.rotationScores[1]!.sectorCode).toBe('S002')
      expect(result.rotationScores[1]!.total).toBe(72)
      expect(result.rotationScores[2]!.sectorCode).toBe('S003')
      expect(result.rotationScores[2]!.total).toBe(60)
    })

    it('行业评分应按 scoredAt 降序排列（最新在前）', async () => {
      // 准备：乱序时间的行业评分
      const now = Date.now()
      const industryScores = [
        createMockIndustryScore('I003', '半导体', now - 86400000 * 2), // 2天前
        createMockIndustryScore('I001', 'AI算力', now), // 最新
        createMockIndustryScore('I002', '锂电池', now - 86400000), // 1天前
      ]
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证：最新的在前
      expect(result.industryScores[0]!.code).toBe('I001')
      expect(result.industryScores[1]!.code).toBe('I002')
      expect(result.industryScores[2]!.code).toBe('I003')
    })

    it('scoredAt 缺失的行业评分应排至末尾', async () => {
      // 准备：部分行业评分缺少 scoredAt
      const now = Date.now()
      const industryScores = [
        createMockIndustryScore('I001', 'AI算力', now),
        { ...createMockIndustryScore('I002', '未知行业', 0), scoredAt: undefined as unknown as number },
        createMockIndustryScore('I003', '锂电池', now - 86400000),
      ]
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证：scoredAt 缺失的排到最后
      expect(result.industryScores[0]!.code).toBe('I001')
      expect(result.industryScores[1]!.code).toBe('I003')
      expect(result.industryScores[2]!.code).toBe('I002')
    })

    it('scoredAt 全为 0 时顺序应保持不变', async () => {
      // 准备：所有 scoredAt 都为 0
      const industryScores = [
        createMockIndustryScore('I001', '行业A', 0),
        createMockIndustryScore('I002', '行业B', 0),
        createMockIndustryScore('I003', '行业C', 0),
      ]
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证：全为 0 时顺序不变（返回 0）
      expect(result.industryScores).toHaveLength(3)
      // 因为 compareIndustryByScoredAt 在全 0 时返回 0，排序是稳定的，顺序不变
      expect(result.industryScores[0]!.code).toBe('I001')
      expect(result.industryScores[2]!.code).toBe('I003')
    })

    it('排序不应修改原始数组', async () => {
      // 准备
      const rotationScores = [
        createMockRotationScore('S003', '半导体', 60),
        createMockRotationScore('S001', '人工智能', 85),
      ]
      const originalRotationOrder = rotationScores.map((s) => s.sectorCode)

      const industryScores = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      await fetchSectorAnalysisUseCase()

      // 验证：原始数组顺序不变（使用了展开运算符 [...arr].sort）
      expect(rotationScores.map((s) => s.sectorCode)).toEqual(originalRotationOrder)
    })
  })

  describe('并发请求', () => {
    it('并发多次调用应互不干扰', async () => {
      // 准备：模拟两次并发调用
      const rotation1 = [createMockRotationScore('S001', '人工智能', 85)]
      const rotation2 = [createMockRotationScore('S002', '新能源', 72)]

      const industry1 = [createMockIndustryScore('I001', 'AI算力', Date.now())]
      const industry2 = [createMockIndustryScore('I002', '锂电池', Date.now() - 86400000)]

      mockGetRotationScores
        .mockResolvedValueOnce({ success: true, data: rotation1 })
        .mockResolvedValueOnce({ success: true, data: rotation2 })

      mockGetIndustryScores
        .mockResolvedValueOnce({ success: true, data: industry1 })
        .mockResolvedValueOnce({ success: true, data: industry2 })

      // 执行：并发调用
      const [result1, result2] = await Promise.all([
        fetchSectorAnalysisUseCase(),
        fetchSectorAnalysisUseCase(),
      ])

      // 验证：两个结果互不干扰
      expect(result1.success).toBe(true)
      expect(result1.rotationScores[0]!.sectorCode).toBe('S001')
      expect(result1.industryScores[0]!.code).toBe('I001')

      expect(result2.success).toBe(true)
      expect(result2.rotationScores[0]!.sectorCode).toBe('S002')
      expect(result2.industryScores[0]!.code).toBe('I002')

      expect(mockGetRotationScores).toHaveBeenCalledTimes(2)
      expect(mockGetIndustryScores).toHaveBeenCalledTimes(2)
    })
  })

  describe('边界条件', () => {
    it('应当处理单条数据的场景', async () => {
      // 准备
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]
      const industryScores = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.rotationScores).toHaveLength(1)
      expect(result.industryScores).toHaveLength(1)
    })

    it('应当处理大量数据的场景', async () => {
      // 准备：50 条轮动评分，30 条行业评分
      const rotationScores: RotationSectorScore[] = Array.from({ length: 50 }, (_, i) =>
        createMockRotationScore(`S${String(i + 1).padStart(3, '0')}`, `板块${i + 1}`, 50 + i)
      )
      const industryScores: IndustryScore[] = Array.from({ length: 30 }, (_, i) =>
        createMockIndustryScore(`I${String(i + 1).padStart(3, '0')}`, `行业${i + 1}`, Date.now() - i * 3600000)
      )

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证
      expect(result.success).toBe(true)
      expect(result.rotationScores).toHaveLength(50)
      expect(result.industryScores).toHaveLength(30)
      // 验证排序正确：最高 total 在前
      expect(result.rotationScores[0]!.total).toBe(99)
      expect(result.rotationScores[49]!.total).toBe(50)
    })

    it('应当处理 total 相同的情况（稳定排序）', async () => {
      // 准备：total 相同的轮动评分
      const rotationScores = [
        createMockRotationScore('S001', '人工智能', 70),
        createMockRotationScore('S002', '新能源', 70),
        createMockRotationScore('S003', '半导体', 70),
      ]
      const industryScores = [createMockIndustryScore('I001', 'AI算力', Date.now())]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证：数量正确，顺序保持相对稳定
      expect(result.rotationScores).toHaveLength(3)
      result.rotationScores.forEach((s) => {
        expect(s.total).toBe(70)
      })
    })

    it('scoredAt 为 0 的条目应排在有时间戳的条目之后', async () => {
      // 准备
      const now = Date.now()
      const industryScores = [
        createMockIndustryScore('I002', '旧行业', 0),
        createMockIndustryScore('I001', '新行业', now),
      ]
      const rotationScores = [createMockRotationScore('S001', '人工智能', 85)]

      mockSuccessQuery(rotationScores, industryScores)

      // 执行
      const result = await fetchSectorAnalysisUseCase()

      // 验证：有时间戳的在前，为 0 的在后
      expect(result.industryScores[0]!.code).toBe('I001')
      expect(result.industryScores[1]!.code).toBe('I002')
    })
  })
})
