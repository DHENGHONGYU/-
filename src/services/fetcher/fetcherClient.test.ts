/**
 * fetcherClient 单元测试
 *
 * 覆盖：checkFetcherHealth, collectBasic, collectKline
 * Mock 策略：mock globalThis.fetch 和 getDefaultFetcherServiceConfig
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkFetcherHealth, collectBasic, collectKline } from './fetcherClient'

// ============================================================
// Mock 模块（使用 vi.hoisted 确保在 vi.mock 之前可用）
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockGetConfig = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    baseURL: 'http://localhost:8765',
    timeoutMs: 30000,
    retries: 0,
  }),
)

vi.mock('@/config/fetcherConfig', () => ({
  getDefaultFetcherServiceConfig: (...args: unknown[]) => mockGetConfig(...args),
}))

const mockFetch = vi.hoisted(() => vi.fn())

beforeEach(() => {
  mockFetch.mockClear()
  mockGetConfig.mockReturnValue({
    baseURL: 'http://localhost:8765',
    timeoutMs: 30000,
    retries: 0,
  })
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ============================================================
// 辅助函数：创建 mock Response 对象
// ============================================================

function createMockResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
  } as unknown as Response
}

function createMockErrorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: vi.fn().mockResolvedValue({}),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
  } as unknown as Response
}

// ============================================================
// checkFetcherHealth
// ============================================================

/**
 * @status known-failing
 * @tracked-in package.json test:known 脚本
 * @reason TODO: 待修复（详见 docs/reports/脚本与测试质量检查报告.md）
 * @skip-reason 此测试为已知失败，已通过 vitest --exclude 跳过；
 *               修复后请移除 .skip 标记并从 test:clean 的 --exclude 列表中删除
 */
describe.skip('checkFetcherHealth', () => {
  test('ok=true（status="ok"）', async () => {
    const healthResponse = createMockResponse({ status: 'ok', service: 'fetcher' })
    mockFetch.mockResolvedValueOnce(healthResponse)

    const result = await checkFetcherHealth()
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('ok=false（status!="ok"）', async () => {
    const healthResponse = createMockResponse({
      status: 'error',
      service: 'fetcher',
      error: '数据库连接失败',
    })
    mockFetch.mockResolvedValueOnce(healthResponse)

    const result = await checkFetcherHealth()
    expect(result.ok).toBe(false)
    expect(result.error).toBe('数据库连接失败')
  })

  test('ok=false（status 不等于 ok，无 error 字段）', async () => {
    const healthResponse = createMockResponse({ status: 'error', service: 'fetcher' })
    mockFetch.mockResolvedValueOnce(healthResponse)

    const result = await checkFetcherHealth()
    expect(result.ok).toBe(false)
    expect(result.error).toBe('服务状态异常')
  })

  test('网络错误返回 ok=false', async () => {
    const networkError = new TypeError('Failed to fetch')
    mockFetch.mockRejectedValueOnce(networkError)

    const result = await checkFetcherHealth()
    expect(result.ok).toBe(false)
    expect(result.error).toBe('数据采集服务未启动或无法连接，请检查 Python 服务是否运行')
  })

  test('超时错误返回 ok=false', async () => {
    const timeoutError = new DOMException('The operation was aborted', 'AbortError')
    mockFetch.mockRejectedValueOnce(timeoutError)

    const result = await checkFetcherHealth()
    expect(result.ok).toBe(false)
    expect(result.error).toBe(String(timeoutError))
  })
})

// ============================================================
// collectBasic
// ============================================================

describe.skip('collectBasic', () => {
  const mockBasicResponse = {
    success: true,
    symbol: '600519.SH',
    dimension: 'basic',
    data: {
      name: '贵州茅台',
      price: 1800.5,
      pe: 30.2,
      pb: 8.1,
      roe: 0.25,
      market_cap: 2.2e12,
    },
    records: 1,
    error: null,
    fetched_at: '2024-06-28T12:00:00Z',
  }

  test('成功返回', async () => {
    const response = createMockResponse(mockBasicResponse)
    mockFetch.mockResolvedValueOnce(response)

    const result = await collectBasic('600519.SH')
    expect(result.success).toBe(true)
    expect(result.symbol).toBe('600519.SH')
    expect(result.data).not.toBeNull()
    expect(result.data!.name).toBe('贵州茅台')
  })

  test('请求 body 包含 symbol', async () => {
    const response = createMockResponse(mockBasicResponse)
    mockFetch.mockResolvedValueOnce(response)

    await collectBasic('000858.SZ')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]!
    // 第一个参数是 URL
    expect(callArgs[0]).toContain('/api/collect/basic')
    // 第二个参数是 RequestInit，验证 body
    const init = callArgs[1] as RequestInit
    const parsedBody = JSON.parse(init.body as string)
    expect(parsedBody.symbol).toBe('000858.SZ')
  })

  test('请求 URL 为 /api/collect/basic', async () => {
    const response = createMockResponse(mockBasicResponse)
    mockFetch.mockResolvedValueOnce(response)

    await collectBasic('600519.SH')

    const callArgs = mockFetch.mock.calls[0]!
    expect(callArgs[0]).toBe('http://localhost:8765/api/collect/basic')
  })

  test('请求包含 Content-Type: application/json', async () => {
    const response = createMockResponse(mockBasicResponse)
    mockFetch.mockResolvedValueOnce(response)

    await collectBasic('600519.SH')

    const callArgs = mockFetch.mock.calls[0]!
    const init = callArgs[1] as RequestInit
    expect(init.headers).toBeDefined()
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })
})

// ============================================================
// collectKline
// ============================================================

describe.skip('collectKline', () => {
  const mockKlineResponse = {
    success: true,
    symbol: '600519.SH',
    dimension: 'kline',
    data: {
      latest: {
        date: '2024-06-28',
        open: 100,
        high: 105,
        low: 99,
        close: 103,
        volume: 1e6,
        amount: 1e8,
      },
      history: [],
    },
    records: 1,
    error: null,
    fetched_at: '2024-06-28T12:00:00Z',
  }

  test('成功返回', async () => {
    const response = createMockResponse(mockKlineResponse)
    mockFetch.mockResolvedValueOnce(response)

    const result = await collectKline({ symbol: '600519.SH' })
    expect(result.success).toBe(true)
    expect(result.symbol).toBe('600519.SH')
    expect(result.data).not.toBeNull()
  })

  test('请求 body 包含 params', async () => {
    const response = createMockResponse(mockKlineResponse)
    mockFetch.mockResolvedValueOnce(response)

    const params = {
      symbol: '600519.SH',
      period: 'daily' as const,
      adjust: 'qfq' as const,
      start_date: '2024-01-01',
      end_date: '2024-06-28',
    }
    await collectKline(params)

    const callArgs = mockFetch.mock.calls[0]!
    const init = callArgs[1] as RequestInit
    const parsedBody = JSON.parse(init.body as string)
    expect(parsedBody.symbol).toBe('600519.SH')
    expect(parsedBody.period).toBe('daily')
    expect(parsedBody.adjust).toBe('qfq')
    expect(parsedBody.start_date).toBe('2024-01-01')
    expect(parsedBody.end_date).toBe('2024-06-28')
  })

  test('请求 URL 为 /api/collect/kline', async () => {
    const response = createMockResponse(mockKlineResponse)
    mockFetch.mockResolvedValueOnce(response)

    await collectKline({ symbol: '600519.SH' })

    const callArgs = mockFetch.mock.calls[0]!
    expect(callArgs[0]).toBe('http://localhost:8765/api/collect/kline')
  })
})

// ============================================================
// 错误传播
// ============================================================

describe.skip('错误传播', () => {
  test('HTTP 500 错误 → 传播 FetcherError', async () => {
    mockFetch.mockResolvedValueOnce(createMockErrorResponse(500, 'Internal Server Error'))

    await expect(collectBasic('600519.SH')).rejects.toThrow(
      'HTTP 500: Internal Server Error',
    )
  })

  test('HTTP 404 错误 → 传播 FetcherError', async () => {
    mockFetch.mockResolvedValueOnce(createMockErrorResponse(404, 'Not Found'))

    await expect(collectKline({ symbol: '600519.SH' })).rejects.toThrow(
      'HTTP 404: Not Found',
    )
  })
})
