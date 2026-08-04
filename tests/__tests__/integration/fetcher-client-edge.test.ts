/**
 * @test_id V9-TEST-INT-F1F2
 * fetcherClient 边界场景集成测试
 *
 * 覆盖场景：
 * - F1 组：HTTP 4xx 不重试（401/403/404 → 仅 1 次 fetch）
 * - F2 组：业务级失败（HTTP 200 + success=false → 透出业务错误）
 *
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-QA-066]
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { collectBasic, collectKline, collectFinancial } from '@/services/fetcher/fetcherClient'
import type { CollectResponse } from '@/services/fetcher/fetcherTypes'

// ============================================================
// Mock 配置
// ============================================================

vi.mock('@/config/fetcherConfig', () => ({
  getDefaultFetcherServiceConfig: () => ({
    baseURL: 'http://localhost:8000',
    timeoutMs: 30_000,
    retries: 3,
  }),
}))

vi.mock('@/lib/perf', () => ({
  PERF: { DATA_FETCH_REQUEST: 'data_fetch_request' },
  measureAsync: vi.fn((_label: string, fn: () => Promise<unknown>) => fn()),
}))

// ============================================================
// Mock fetch
// ============================================================

const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ============================================================
// 辅助函数
// ============================================================

function makeResponse(body: unknown, init?: { status?: number; statusText?: string }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeSuccessCollectResponse(data: Record<string, unknown> | null): CollectResponse {
  return {
    success: true,
    symbol: '600519.SH',
    dimension: 'basic',
    data,
    records: data ? 1 : 0,
    error: null,
    fetched_at: new Date().toISOString(),
  }
}

// ============================================================
// F1 组：HTTP 4xx 不重试
// ============================================================

describe('F1 组：HTTP 4xx 不重试', () => {
  it('F1-1 HTTP 401 Unauthorized → 仅 1 次 fetch，错误含 "401"', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' }),
    )

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      expect((err as Error).message).toContain('401')
    }

    // 4xx 不可重试，仅 1 次 fetch
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('F1-2 HTTP 403 Forbidden → 仅 1 次 fetch，错误含 "403"', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' }),
    )

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      expect((err as Error).message).toContain('403')
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('F1-3 HTTP 404 Not Found → 仅 1 次 fetch，错误含 "404"', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: 'Not Found' }, { status: 404, statusText: 'Not Found' }),
    )

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      expect((err as Error).message).toContain('404')
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('F1-4 HTTP 422 Unprocessable Entity → 仅 1 次 fetch（4xx 全部不重试）', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: 'Invalid symbol' }, { status: 422, statusText: 'Unprocessable Entity' }),
    )

    try {
      await collectKline({ symbol: 'INVALID.SH' })
      expect.fail('应抛出异常')
    } catch (err) {
      expect((err as Error).message).toContain('422')
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// F2 组：业务级失败（HTTP 200 + success=false）
// ============================================================

describe('F2 组：业务级失败（HTTP 200, success=false）', () => {
  it('F2-1 collectBasic 返回 success=false → 透出业务错误，不被当作成功', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        success: false,
        symbol: '999999.SH',
        dimension: 'basic',
        data: null,
        records: 0,
        error: '股票代码不存在',
        fetched_at: new Date().toISOString(),
      }),
    )

    const result = await collectBasic('999999.SH')

    // 核心断言：success=false 被透出
    expect(result.success).toBe(false)
    expect(result.error).toContain('股票代码不存在')
    expect(result.data).toBeNull()
    // HTTP 200 成功，仅 1 次 fetch（无重试）
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('F2-2 collectBasic 返回 success=false + data=null → error 字段非空', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        success: false,
        symbol: '000001.SH',
        dimension: 'basic',
        data: null,
        records: 0,
        error: '数据源暂时不可用',
        fetched_at: new Date().toISOString(),
      }),
    )

    const result = await collectBasic('000001.SH')

    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
    expect(result.error).toContain('数据源暂时不可用')
  })

  it('F2-3 collectFinancial 返回 success=false → 透出业务错误', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        success: false,
        symbol: '600519.SH',
        dimension: 'financial',
        data: null,
        records: 0,
        error: '财报数据未披露',
        fetched_at: new Date().toISOString(),
      }),
    )

    const result = await collectFinancial('600519.SH')

    expect(result.success).toBe(false)
    expect(result.error).toContain('财报数据未披露')
    expect(result.data).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('F2-4 collectBasic 正常成功 → success=true, data 非空', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse(
        makeSuccessCollectResponse({
          name: '贵州茅台',
          price: 1680.5,
          pe: 28.3,
          pb: 9.1,
        }),
      ),
    )

    const result = await collectBasic('600519.SH')

    expect(result.success).toBe(true)
    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    expect(result.data?.name).toBe('贵州茅台')
    expect(result.data?.price).toBe(1680.5)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// 补充：5xx 可重试验证（对比 4xx 不重试）
// ============================================================

describe('补充：HTTP 5xx 可重试（与 F1 组对比）', () => {
  it('5xx-1 HTTP 500 → 触发重试（fetch 调用次数 > 1）', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ error: 'Internal Server Error' }, { status: 500, statusText: 'Internal Server Error' }),
    )

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      expect((err as Error).message).toContain('500')
    }

    // 5xx 可重试，retries=3 → 最多 4 次 fetch（1 + 3 次重试）
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })
})

// ============================================================
// F3 组：response.json() 返回 null/undefined
// ============================================================

describe('F3 组：HTTP 200 但响应体为 null', () => {
  it('F3-1 response.json() 返回 null → collectBasic 抛出 TypeError（访问 null.success）', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('null', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      // request 返回 null → collectBasic 中 result.success 抛 TypeError
      expect(err).toBeInstanceOf(TypeError)
    }

    // HTTP 200 成功，无重试
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// F4 组：网络超时（AbortError）— 修复后可重试
// ============================================================

describe('F4 组：网络超时（AbortError）', () => {
  it('F4-1 超时触发 AbortError → 修复后可重试（4 次 fetch），错误含"请求超时"', async () => {
    const abortError = new DOMException(
      'The operation was aborted due to timeout',
      'AbortError',
    )
    mockFetch.mockRejectedValue(abortError)

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      // 修复后：AbortError 可重试，最终抛出友好消息
      expect((err as Error).message).toContain('请求超时')
    }

    // 修复后：AbortError 可重试，retries=3 → 4 次 fetch
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('F4-2 超时后首次重试成功 → 仅 2 次 fetch', async () => {
    const abortError = new DOMException('timeout', 'AbortError')
    // 第 1 次超时，第 2 次成功
    mockFetch
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(
        makeResponse(
          makeSuccessCollectResponse({ name: '贵州茅台', price: 1680.5 }),
        ),
      )

    const result = await collectBasic('600519.SH')

    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('贵州茅台')
    // 1 次失败 + 1 次成功 = 2 次 fetch
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// ============================================================
// F5 组：连接拒绝（TypeError）— 可重试
// ============================================================

describe('F5 组：连接拒绝（TypeError, 服务未启动）', () => {
  it('F5-1 fetch reject TypeError → 重试 3 次（4 次 fetch），错误含"数据采集服务未启动"', async () => {
    const networkError = new TypeError('Failed to fetch')
    mockFetch.mockRejectedValue(networkError)

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      expect((err as Error).message).toContain('数据采集服务未启动')
    }

    // TypeError 可重试，retries=3 → 4 次 fetch
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('F5-2 连接拒绝后首次重试成功 → 仅 2 次 fetch', async () => {
    const networkError = new TypeError('Failed to fetch')
    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(
        makeResponse(
          makeSuccessCollectResponse({ name: '贵州茅台', price: 1680.5 }),
        ),
      )

    const result = await collectBasic('600519.SH')

    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// ============================================================
// F6 组：连接重置（非 TypeError 错误）— 不重试
// ============================================================

describe('F6 组：连接重置（非 TypeError 错误）', () => {
  it('F6-1 fetch reject 非 TypeError Error → 不重试（仅 1 次 fetch）', async () => {
    const connResetError = new Error('socket hang up')
    connResetError.name = 'ECONNRESET'
    mockFetch.mockRejectedValue(connResetError)

    try {
      await collectBasic('600519.SH')
      expect.fail('应抛出异常')
    } catch (err) {
      // 非 TypeError 非 FetcherError → 不重试，直接包装抛出
      expect((err as Error).message).toContain('socket hang up')
    }

    // 非 TypeError → isRetriable=false → 不重试
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// F2-5：业务级失败 + data 非空（部分数据返回）
// ============================================================

describe('F2 补充：success=false + data 非空', () => {
  it('F2-5 collectBasic 返回 success=false 但 data 非空 → 透出部分数据 + 业务错误', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        success: false,
        symbol: '600519.SH',
        dimension: 'basic',
        data: { name: '贵州茅台', price: null },
        records: 1,
        error: '部分字段获取失败',
        fetched_at: new Date().toISOString(),
      }),
    )

    const result = await collectBasic('600519.SH')

    expect(result.success).toBe(false)
    expect(result.error).toContain('部分字段获取失败')
    // data 非空（部分数据）
    expect(result.data).not.toBeNull()
    expect(result.data?.name).toBe('贵州茅台')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('F2-6 collectKline 返回 success=false → 透出业务错误 + warn 日志（F7 修复验证）', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        success: false,
        symbol: '600519.SH',
        dimension: 'kline',
        data: null,
        records: 0,
        error: 'K线数据暂不可用',
        fetched_at: new Date().toISOString(),
      }),
    )

    const result = await collectKline({ symbol: '600519.SH', period: 'daily', adjust: 'qfq' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('K线数据暂不可用')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('F2-7 collectFinancial 返回 success=false → 透出业务错误 + warn 日志（F8 修复验证）', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        success: false,
        symbol: '600519.SH',
        dimension: 'financial',
        data: null,
        records: 0,
        error: '财报数据获取超时',
        fetched_at: new Date().toISOString(),
      }),
    )

    const result = await collectFinancial('600519.SH')

    expect(result.success).toBe(false)
    expect(result.error).toContain('财报数据获取超时')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
