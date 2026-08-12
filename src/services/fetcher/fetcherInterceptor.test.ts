/**
 * @test_id V9-TEST-ST-080
 * fetcherInterceptor 单元测试
 *
 * 覆盖：calculateBackoff, setInterceptorConfig / getInterceptorConfig,
 *       interceptedFetch（成功响应、5xx 重试、429 重试、401/403 回调、
 *       404 不重试、网络错误、AbortError → TIMEOUT、最终 HttpError、maxRetries=0）
  * @covers_docs [V9-DOC-PROJ-092]
*/

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateBackoff,
  setInterceptorConfig,
  getInterceptorConfig,
  interceptedFetch,
} from './fetcherInterceptor'
import { HttpError, HttpErrorType } from './fetcherErrors'

// ============================================================
// Mock 全局 fetch
// ============================================================

let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
  // 重置拦截器配置到默认值
  setInterceptorConfig({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryOnServerError: true,
    retryOnRateLimit: true,
    retryOnNetworkError: true,
    onUnauthorized: undefined,
    onForbidden: undefined,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ============================================================
// calculateBackoff
// ============================================================

describe('calculateBackoff', () => {
  let mathRandomSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, 'random')
  })

  afterEach(() => {
    mathRandomSpy.mockRestore()
  })

  test('attempt=0, baseDelay=1000, maxDelay=10000 → 1000（无抖动时）', () => {
    mathRandomSpy.mockReturnValue(0.5)
    const result = calculateBackoff(0, 1000, 10000)
    expect(result).toBe(1000) // jitter = 1000 * 0.2 * 0 = 0
  })

  test('attempt=0, random=1.0 → 1000 + 100 = 1100', () => {
    mathRandomSpy.mockReturnValue(1.0)
    const result = calculateBackoff(0, 1000, 10000)
    // jitter = 1000 * 0.2 * (1.0 - 0.5) = 100, total = 1100
    expect(result).toBe(1100)
  })

  test('attempt=0, random=0.0 → 1000 - 100 = 900', () => {
    mathRandomSpy.mockReturnValue(0.0)
    const result = calculateBackoff(0, 1000, 10000)
    // jitter = 1000 * 0.2 * (0.0 - 0.5) = -100, total = 900
    expect(result).toBe(900)
  })

  test('attempt=1, baseDelay=1000, maxDelay=10000 → 2000', () => {
    mathRandomSpy.mockReturnValue(0.5)
    const result = calculateBackoff(1, 1000, 10000)
    // delay = min(1000 * 2, 10000) = 2000, jitter = 0, total = 2000
    expect(result).toBe(2000)
  })

  test('attempt=2 → 4000', () => {
    mathRandomSpy.mockReturnValue(0.5)
    const result = calculateBackoff(2, 1000, 10000)
    // delay = min(1000 * 4, 10000) = 4000, jitter = 0, total = 4000
    expect(result).toBe(4000)
  })

  test('达到 maxDelay 时截断', () => {
    mathRandomSpy.mockReturnValue(0.5)
    // baseDelay=1000, attempt=10 → 1000 * 1024 = 1024000 → 截断为 maxDelay=10000
    const result = calculateBackoff(10, 1000, 10000)
    expect(result).toBe(10000)
  })

  test('返回值为整数（Math.floor）', () => {
    mathRandomSpy.mockReturnValue(0.3)
    const result = calculateBackoff(0, 1000, 10000)
    // delay = 1000, jitter = 1000 * 0.2 * (0.3 - 0.5) = -40, total = 960
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBe(960)
  })
})

// ============================================================
// setInterceptorConfig / getInterceptorConfig
// ============================================================

describe('setInterceptorConfig / getInterceptorConfig', () => {
  test('默认配置正确', () => {
    const config = getInterceptorConfig()
    expect(config.maxRetries).toBe(3)
    expect(config.baseDelay).toBe(1000)
    expect(config.maxDelay).toBe(10000)
    expect(config.retryOnServerError).toBe(true)
    expect(config.retryOnRateLimit).toBe(true)
    expect(config.retryOnNetworkError).toBe(true)
    expect(config.onUnauthorized).toBeUndefined()
    expect(config.onForbidden).toBeUndefined()
  })

  test('setInterceptorConfig 部分更新', () => {
    // 部分更新
    setInterceptorConfig({ maxRetries: 5, baseDelay: 2000 })

    const config = getInterceptorConfig()
    expect(config.maxRetries).toBe(5)
    expect(config.baseDelay).toBe(2000)
    // 未更新的字段保持默认值
    expect(config.maxDelay).toBe(10000)
    expect(config.retryOnServerError).toBe(true)
    expect(config.retryOnRateLimit).toBe(true)
  })

  test('getInterceptorConfig 返回副本（不影响原对象）', () => {
    const config1 = getInterceptorConfig()
    // 修改返回的副本
    ;(config1 as unknown as Record<string, unknown>).maxRetries = 99

    const config2 = getInterceptorConfig()
    expect(config2.maxRetries).toBe(3) // 原对象不受影响
  })
})

// ============================================================
// interceptedFetch
// ============================================================

describe('interceptedFetch', () => {
  const createMockResponse = (status: number, statusText: string = '') => {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: vi.fn().mockResolvedValue({ data: 'ok' }),
    } as unknown as Response
  }

  test('成功响应 → 返回 response', async () => {
    const mockResponse = createMockResponse(200, 'OK')
    mockFetch.mockResolvedValueOnce(mockResponse)

    const result = await interceptedFetch('http://localhost/health')
    expect(result).toBe(mockResponse)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('5xx → 重试 maxRetries 次', async () => {
    setInterceptorConfig({ maxRetries: 3, baseDelay: 1, maxDelay: 1 })
    const mockResponse = createMockResponse(500, 'Internal Server Error')
    mockFetch
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockResponse)

    // 4 次 fetch 调用: attempt 0,1,2,3 (共 4 次)
    try {
      await interceptedFetch('http://localhost/api')
    } catch {
      // 预期抛出错误
    }

    expect(mockFetch).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
  }, 10000)

  test('429 → 重试', async () => {
    setInterceptorConfig({ maxRetries: 2, baseDelay: 1, maxDelay: 1 })

    const rateLimitResponse = createMockResponse(429, 'Too Many Requests')
    const okResponse = createMockResponse(200, 'OK')

    mockFetch
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(okResponse)

    const result = await interceptedFetch('http://localhost/api')
    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 10000)

  test('401 → 不重试，触发 onUnauthorized', async () => {
    const onUnauthorized = vi.fn()
    setInterceptorConfig({ maxRetries: 3, baseDelay: 1, maxDelay: 1, onUnauthorized })

    mockFetch.mockResolvedValueOnce(createMockResponse(401, 'Unauthorized'))

    await expect(interceptedFetch('http://localhost/api')).rejects.toThrow()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1) // 不重试
  })

  test('403 → 不重试，触发 onForbidden', async () => {
    const onForbidden = vi.fn()
    setInterceptorConfig({ maxRetries: 3, baseDelay: 1, maxDelay: 1, onForbidden })

    mockFetch.mockResolvedValueOnce(createMockResponse(403, 'Forbidden'))

    await expect(interceptedFetch('http://localhost/api')).rejects.toThrow()
    expect(onForbidden).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1) // 不重试
  })

  test('404 → 不重试', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(404, 'Not Found'))

    await expect(interceptedFetch('http://localhost/api')).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(1) // 不重试
  })

  test('网络错误 → 重试', async () => {
    setInterceptorConfig({
      maxRetries: 2,
      baseDelay: 1,
      maxDelay: 1,
      retryOnNetworkError: true,
    })

    const networkError = new TypeError('Failed to fetch')
    const okResponse = createMockResponse(200, 'OK')

    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(okResponse)

    const result = await interceptedFetch('http://localhost/api')
    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 10000)

  test('AbortError → TIMEOUT 类型', async () => {
    setInterceptorConfig({ maxRetries: 0, baseDelay: 1, maxDelay: 1 })

    const abortError = new DOMException('The operation was aborted', 'AbortException')
    mockFetch.mockRejectedValueOnce(abortError)

    try {
      await interceptedFetch('http://localhost/api')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).type).toBe(HttpErrorType.TIMEOUT)
      expect((err as HttpError).message).toBe('请求超时')
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('最终失败后抛出 HttpError', async () => {
    setInterceptorConfig({ maxRetries: 2, baseDelay: 1, maxDelay: 1 })

    const serverErrorResponse = createMockResponse(500, 'Internal Server Error')
    mockFetch
      .mockResolvedValueOnce(serverErrorResponse)
      .mockResolvedValueOnce(serverErrorResponse)
      .mockResolvedValueOnce(serverErrorResponse)

    try {
      await interceptedFetch('http://localhost/api')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).type).toBe(HttpErrorType.SERVER_ERROR)
      expect((err as HttpError).statusCode).toBe(500)
    }

    expect(mockFetch).toHaveBeenCalledTimes(3)
  }, 10000)

  test('maxRetries=0 → 不重试', async () => {
    setInterceptorConfig({ maxRetries: 0, baseDelay: 1, maxDelay: 1 })

    const serverErrorResponse = createMockResponse(500, 'Internal Server Error')
    mockFetch.mockResolvedValueOnce(serverErrorResponse)

    try {
      await interceptedFetch('http://localhost/api')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).statusCode).toBe(500)
    }

    expect(mockFetch).toHaveBeenCalledTimes(1) // 只调用一次，不重试
  })

  test('retryOnServerError=false → 5xx 不重试', async () => {
    setInterceptorConfig({
      maxRetries: 3,
      baseDelay: 1,
      maxDelay: 1,
      retryOnServerError: false,
    })

    const serverErrorResponse = createMockResponse(500, 'Internal Server Error')
    mockFetch.mockResolvedValueOnce(serverErrorResponse)

    try {
      await interceptedFetch('http://localhost/api')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).statusCode).toBe(500)
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('retryOnRateLimit=false → 429 不重试', async () => {
    setInterceptorConfig({
      maxRetries: 3,
      baseDelay: 1,
      maxDelay: 1,
      retryOnRateLimit: false,
    })

    const rateLimitResponse = createMockResponse(429, 'Too Many Requests')
    mockFetch.mockResolvedValueOnce(rateLimitResponse)

    try {
      await interceptedFetch('http://localhost/api')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).type).toBe(HttpErrorType.RATE_LIMITED)
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('retryOnNetworkError=false → 网络错误不重试', async () => {
    setInterceptorConfig({
      maxRetries: 3,
      baseDelay: 1,
      maxDelay: 1,
      retryOnNetworkError: false,
    })

    const networkError = new TypeError('Failed to fetch')
    mockFetch.mockRejectedValueOnce(networkError)

    try {
      await interceptedFetch('http://localhost/api')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).type).toBe(HttpErrorType.NETWORK_ERROR)
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  test('网络错误最终失败后抛出 HttpError', async () => {
    setInterceptorConfig({
      maxRetries: 1,
      baseDelay: 1,
      maxDelay: 1,
      retryOnNetworkError: true,
    })

    const networkError = new TypeError('Failed to fetch')
    mockFetch
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)

    try {
      await interceptedFetch('http://localhost/api')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError)
      expect((err as HttpError).type).toBe(HttpErrorType.NETWORK_ERROR)
      expect((err as HttpError).message).toBe('网络连接失败')
    }

    expect(mockFetch).toHaveBeenCalledTimes(2)
  }, 10000)

  test('onUnauthorized 未设置时 401 不触发回调', async () => {
    setInterceptorConfig({
      maxRetries: 3,
      baseDelay: 1,
      maxDelay: 1,
      onUnauthorized: undefined, // 显式 undefined
    })

    mockFetch.mockResolvedValueOnce(createMockResponse(401, 'Unauthorized'))

    await expect(interceptedFetch('http://localhost/api')).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(1) // 不重试
  })

  test('interceptedFetch 使用 AbortController signal 调用 fetch', async () => {
    const mockResponse = createMockResponse(200, 'OK')
    mockFetch.mockResolvedValueOnce(mockResponse)

    await interceptedFetch('http://localhost/api')

    // 验证 fetch 被调用时传入了 signal
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]!
    // 第二个参数（init）应包含 signal
    expect(callArgs[1]).toBeDefined()
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal)
  })
})
