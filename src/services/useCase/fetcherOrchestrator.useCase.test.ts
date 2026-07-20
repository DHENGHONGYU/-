/**
 * @test_id V9-TEST-ST-128
 * @module services/useCase/fetcherOrchestrator.useCase.test
 * @description 数据采集编排用例单元测试 — 验证基础数据与K线数据获取流程
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-PROJ-092, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchBasicDataUseCase, fetchKlineDataUseCase } from './fetcherOrchestrator.useCase'
import type { Stock } from '@/data/types'
import type { FetchKlineOptions } from '@/services/fetcher/fetcherService'

// Mock 依赖
const {
  mockFetchStockBasic,
  mockFetchStockKline,
  mockLogger,
} = vi.hoisted(() => ({
  mockFetchStockBasic: vi.fn(),
  mockFetchStockKline: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/services/fetcher/fetcherService', () => ({
  fetchStockBasic: mockFetchStockBasic,
  fetchStockKline: mockFetchStockKline,
}))

vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => mockLogger),
}))

describe('fetcherOrchestratorUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchStockBasic.mockResolvedValue({ success: false, error: 'not mocked' })
    mockFetchStockKline.mockResolvedValue({ success: false, error: 'not mocked' })
  })

  // 测试数据
  const mockStock: Stock = {
    symbol: '000001.SZ',
    name: '平安银行',
    price: 12.5,
    dataVersion: 1001,
  }

  // ============================================================
  // fetchBasicDataUseCase
  // ============================================================
  describe('fetchBasicDataUseCase', () => {
    describe('正常流程', () => {
      it('应当成功获取股票基础数据', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.symbol).toBe('000001.SZ')
        expect(result.data?.name).toBe('平安银行')
        expect(result.data?.price).toBe(12.5)
        expect(result.data?.dataVersion).toBe(1001)

        // 验证服务调用参数
        expect(mockFetchStockBasic).toHaveBeenCalledTimes(1)
        expect(mockFetchStockBasic).toHaveBeenCalledWith('000001.SZ')
      })

      it('应当正确传递 symbol 参数给底层服务', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchBasicDataUseCase({ symbol: '600519.SH' })

        // 验证
        expect(mockFetchStockBasic).toHaveBeenCalledWith('600519.SH')
      })
    })

    describe('服务返回失败', () => {
      it('应当返回失败结果：服务返回 success: false', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: false,
          error: '股票代码不存在',
        })

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: '999999.SZ' })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('股票代码不存在')
        expect(result.data).toBeUndefined()
      })

      it('应当透传服务返回的错误信息', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: false,
          error: '网络请求超时',
        })

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('网络请求超时')
      })
    })

    describe('异常捕获', () => {
      it('应当捕获服务抛出的异常并返回失败', async () => {
        // 准备
        mockFetchStockBasic.mockRejectedValueOnce(new Error('网络连接失败'))

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('网络连接失败')
        expect(result.data).toBeUndefined()
      })

      it('应当处理非 Error 类型的抛出值', async () => {
        // 准备：抛出字符串
        mockFetchStockBasic.mockRejectedValueOnce('未知错误')

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('未知错误')
      })
    })

    describe('边界条件 - symbol 参数', () => {
      it('应当处理空字符串 symbol', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: false,
          error: '股票代码不能为空',
        })

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: '' })

        // 验证
        expect(result.success).toBe(false)
        expect(mockFetchStockBasic).toHaveBeenCalledWith('')
      })

      it('应当处理非法格式 symbol', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: false,
          error: '无效的股票代码格式',
        })

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: 'invalid-symbol' })

        // 验证
        expect(result.success).toBe(false)
        expect(mockFetchStockBasic).toHaveBeenCalledWith('invalid-symbol')
      })

      it('应当处理纯数字 symbol', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: false,
          error: '股票代码格式错误',
        })

        // 执行
        const result = await fetchBasicDataUseCase({ symbol: '123456' })

        // 验证
        expect(result.success).toBe(false)
        expect(mockFetchStockBasic).toHaveBeenCalledWith('123456')
      })
    })

    describe('日志记录', () => {
      it('应当在成功时记录 info 级别日志', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchBasicDataUseCase({ symbol: '000001.SZ' })

        // 验证：开始日志
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchBasicData 开始',
          { symbol: '000001.SZ' },
        )

        // 验证：成功日志
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchBasicData 成功',
          { symbol: '000001.SZ', dataVersion: 1001 },
        )

        expect(mockLogger.warn).not.toHaveBeenCalled()
        expect(mockLogger.error).not.toHaveBeenCalled()
      })

      it('应当在失败时记录 warn 级别日志', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: false,
          error: '股票代码不存在',
        })

        // 执行
        await fetchBasicDataUseCase({ symbol: '999999.SZ' })

        // 验证：开始日志
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchBasicData 开始',
          { symbol: '999999.SZ' },
        )

        // 验证：失败警告日志
        expect(mockLogger.warn).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchBasicData 失败',
          { symbol: '999999.SZ', error: '股票代码不存在' },
        )

        expect(mockLogger.error).not.toHaveBeenCalled()
      })

      it('应当在异常时记录 error 级别日志', async () => {
        // 准备
        mockFetchStockBasic.mockRejectedValueOnce(new Error('网络连接失败'))

        // 执行
        await fetchBasicDataUseCase({ symbol: '000001.SZ' })

        // 验证：异常错误日志
        expect(mockLogger.error).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchBasicData 异常',
          { symbol: '000001.SZ', error: '网络连接失败' },
        )

        expect(mockLogger.warn).not.toHaveBeenCalled()
      })

      it('应当在日志中携带 symbol 上下文', async () => {
        // 准备
        mockFetchStockBasic.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchBasicDataUseCase({ symbol: '600519.SH' })

        // 验证：所有日志都包含 symbol
        mockLogger.info.mock.calls.forEach((call) => {
          const context = call[1] as Record<string, unknown>
          if (context && 'symbol' in context) {
            expect(context.symbol).toBe('600519.SH')
          }
        })
      })
    })
  })

  // ============================================================
  // fetchKlineDataUseCase
  // ============================================================
  describe('fetchKlineDataUseCase', () => {
    describe('正常流程', () => {
      it('应当成功获取股票K线数据', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        const result = await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.symbol).toBe('000001.SZ')
        expect(result.data?.dataVersion).toBe(1001)

        // 验证服务调用
        expect(mockFetchStockKline).toHaveBeenCalledTimes(1)
        expect(mockFetchStockKline).toHaveBeenCalledWith('000001.SZ', undefined)
      })

      it('应当正确传递 options 参数', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        const options: FetchKlineOptions = {
          period: 'weekly',
          adjust: 'qfq',
          startDate: '2024-01-01',
          endDate: '2024-06-30',
        }

        // 执行
        await fetchKlineDataUseCase({ symbol: '000001.SZ', options })

        // 验证
        expect(mockFetchStockKline).toHaveBeenCalledWith('000001.SZ', options)
      })

      it('应当正确传递 period 参数', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchKlineDataUseCase({
          symbol: '000001.SZ',
          options: { period: 'monthly' },
        })

        // 验证
        expect(mockFetchStockKline).toHaveBeenCalledWith(
          '000001.SZ',
          expect.objectContaining({ period: 'monthly' }),
        )
      })

      it('应当正确传递 adjust 参数', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchKlineDataUseCase({
          symbol: '000001.SZ',
          options: { adjust: 'hfq' },
        })

        // 验证
        expect(mockFetchStockKline).toHaveBeenCalledWith(
          '000001.SZ',
          expect.objectContaining({ adjust: 'hfq' }),
        )
      })

      it('应当正确传递日期范围参数', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        const options: FetchKlineOptions = {
          startDate: '2023-01-01',
          endDate: '2023-12-31',
        }

        // 执行
        await fetchKlineDataUseCase({ symbol: '600519.SH', options })

        // 验证
        expect(mockFetchStockKline).toHaveBeenCalledWith(
          '600519.SH',
          expect.objectContaining({
            startDate: '2023-01-01',
            endDate: '2023-12-31',
          }),
        )
      })

      it('应当在不传 options 时使用默认行为', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(mockFetchStockKline).toHaveBeenCalledWith('000001.SZ', undefined)
      })
    })

    describe('服务返回失败', () => {
      it('应当返回失败结果：K线服务返回 success: false', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: false,
          error: 'K线数据获取失败',
        })

        // 执行
        const result = await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('K线数据获取失败')
        expect(result.data).toBeUndefined()
      })

      it('应当透传K线服务的错误信息', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: false,
          error: '数据源不可用',
        })

        // 执行
        const result = await fetchKlineDataUseCase({
          symbol: '000001.SZ',
          options: { period: 'daily' },
        })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('数据源不可用')
      })
    })

    describe('异常捕获', () => {
      it('应当捕获K线服务抛出的异常并返回失败', async () => {
        // 准备
        mockFetchStockKline.mockRejectedValueOnce(new Error('K线服务异常'))

        // 执行
        const result = await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('K线服务异常')
        expect(result.data).toBeUndefined()
      })

      it('应当处理非 Error 类型的抛出值', async () => {
        // 准备
        mockFetchStockKline.mockRejectedValueOnce(404)

        // 执行
        const result = await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证
        expect(result.success).toBe(false)
        expect(result.error).toBe('404')
      })
    })

    describe('边界条件 - symbol 参数', () => {
      it('应当处理空字符串 symbol', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: false,
          error: '股票代码不能为空',
        })

        // 执行
        const result = await fetchKlineDataUseCase({ symbol: '' })

        // 验证
        expect(result.success).toBe(false)
        expect(mockFetchStockKline).toHaveBeenCalledWith('', undefined)
      })

      it('应当处理非法格式 symbol', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: false,
          error: '无效的股票代码',
        })

        // 执行
        const result = await fetchKlineDataUseCase({ symbol: 'abc.def' })

        // 验证
        expect(result.success).toBe(false)
        expect(mockFetchStockKline).toHaveBeenCalledWith('abc.def', undefined)
      })
    })

    describe('边界条件 - options 参数', () => {
      it('应当处理空 options 对象', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        const result = await fetchKlineDataUseCase({ symbol: '000001.SZ', options: {} })

        // 验证
        expect(result.success).toBe(true)
        expect(mockFetchStockKline).toHaveBeenCalledWith('000001.SZ', {})
      })

      it('应当处理仅含部分字段的 options', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        const result = await fetchKlineDataUseCase({
          symbol: '000001.SZ',
          options: { period: 'weekly' },
        })

        // 验证
        expect(result.success).toBe(true)
        expect(mockFetchStockKline).toHaveBeenCalledWith(
          '000001.SZ',
          expect.objectContaining({ period: 'weekly' }),
        )
      })
    })

    describe('日志记录', () => {
      it('应当在成功时记录 info 级别日志', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证：开始日志（默认 daily）
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchKlineData 开始',
          { symbol: '000001.SZ', period: 'daily' },
        )

        // 验证：成功日志
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchKlineData 成功',
          { symbol: '000001.SZ', dataVersion: 1001 },
        )

        expect(mockLogger.warn).not.toHaveBeenCalled()
        expect(mockLogger.error).not.toHaveBeenCalled()
      })

      it('应当在日志中记录指定的 period', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchKlineDataUseCase({
          symbol: '000001.SZ',
          options: { period: 'weekly' },
        })

        // 验证
        expect(mockLogger.info).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchKlineData 开始',
          { symbol: '000001.SZ', period: 'weekly' },
        )
      })

      it('应当在失败时记录 warn 级别日志', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: false,
          error: 'K线数据获取失败',
        })

        // 执行
        await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证：失败警告日志
        expect(mockLogger.warn).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchKlineData 失败',
          { symbol: '000001.SZ', error: 'K线数据获取失败' },
        )

        expect(mockLogger.error).not.toHaveBeenCalled()
      })

      it('应当在异常时记录 error 级别日志', async () => {
        // 准备
        mockFetchStockKline.mockRejectedValueOnce(new Error('K线服务崩溃'))

        // 执行
        await fetchKlineDataUseCase({ symbol: '000001.SZ' })

        // 验证：异常错误日志
        expect(mockLogger.error).toHaveBeenCalledWith(
          '[fetcherOrchestratorUseCase] fetchKlineData 异常',
          { symbol: '000001.SZ', error: 'K线服务崩溃' },
        )

        expect(mockLogger.warn).not.toHaveBeenCalled()
      })

      it('应当在日志中携带 symbol 上下文', async () => {
        // 准备
        mockFetchStockKline.mockResolvedValueOnce({
          success: true,
          data: mockStock,
        })

        // 执行
        await fetchKlineDataUseCase({ symbol: '600519.SH' })

        // 验证：所有日志都包含 symbol
        mockLogger.info.mock.calls.forEach((call) => {
          const context = call[1] as Record<string, unknown>
          if (context && 'symbol' in context) {
            expect(context.symbol).toBe('600519.SH')
          }
        })
      })
    })
  })
})
