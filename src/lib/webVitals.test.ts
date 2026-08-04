import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Metric } from "web-vitals"

const mockLoggerInfo = vi.fn()
vi.mock("./logger", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: (...args: any[]) => mockLoggerInfo(...args),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    level: "info",
    name: "webVitals-test",
  }),
}))

const mockOnCLS = vi.fn()
const mockOnFCP = vi.fn()
const mockOnLCP = vi.fn()
const mockOnTTFB = vi.fn()
const mockOnINP = vi.fn()

vi.mock("web-vitals", () => ({
  onCLS: (...args: any[]) => mockOnCLS(...args),
  onFCP: (...args: any[]) => mockOnFCP(...args),
  onLCP: (...args: any[]) => mockOnLCP(...args),
  onTTFB: (...args: any[]) => mockOnTTFB(...args),
  onINP: (...args: any[]) => mockOnINP(...args),
}))

function getCallback(mock: ReturnType<typeof vi.fn>): (metric: Metric) => void {
  expect(mock).toHaveBeenCalledTimes(1)
  return mock.mock.calls[0]![0] as (metric: Metric) => void
}

function makeMetric(name: Metric["name"], delta: number, id: string): Metric {
  return {
    name, value: delta, delta, id, entries: [],
    navigationType: "navigate" as any, rating: "good" as any,
  } as unknown as Metric
}

describe("webVitals", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("reportWebVitals 注册了 5 个指标监听", async () => {
    const { reportWebVitals } = await import("./webVitals")
    reportWebVitals()
    expect(mockOnCLS).toHaveBeenCalledTimes(1)
    expect(mockOnFCP).toHaveBeenCalledTimes(1)
    expect(mockOnLCP).toHaveBeenCalledTimes(1)
    expect(mockOnTTFB).toHaveBeenCalledTimes(1)
    expect(mockOnINP).toHaveBeenCalledTimes(1)
  })

  it("每个监听都传入了回调函数", async () => {
    const { reportWebVitals } = await import("./webVitals")
    reportWebVitals()
    expect(mockOnCLS).toHaveBeenCalledWith(expect.any(Function))
    expect(mockOnFCP).toHaveBeenCalledWith(expect.any(Function))
    expect(mockOnLCP).toHaveBeenCalledWith(expect.any(Function))
    expect(mockOnTTFB).toHaveBeenCalledWith(expect.any(Function))
    expect(mockOnINP).toHaveBeenCalledWith(expect.any(Function))
  })

  it("CLS 回调触发：logger.info 写入 [WebVitals] CLS + 格式化 delta + id", async () => {
    const { reportWebVitals } = await import("./webVitals")
    reportWebVitals()
    const cb = getCallback(mockOnCLS)
    cb(makeMetric("CLS", 0.03456, "vite-cls-777"))
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1)
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("[WebVitals] CLS")
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("0.03")
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("(id=vite-cls-777)")
  })

  it("FCP 回调触发", async () => {
    const { reportWebVitals } = await import("./webVitals")
    reportWebVitals()
    getCallback(mockOnFCP)(makeMetric("FCP", 1234.5, "vite-fcp-1"))
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("[WebVitals] FCP")
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("1234.50")
  })

  it("LCP 回调触发", async () => {
    const { reportWebVitals } = await import("./webVitals")
    reportWebVitals()
    getCallback(mockOnLCP)(makeMetric("LCP", 2500, "vite-lcp-9"))
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("[WebVitals] LCP")
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("2500.00")
  })

  it("TTFB 回调触发", async () => {
    const { reportWebVitals } = await import("./webVitals")
    reportWebVitals()
    getCallback(mockOnTTFB)(makeMetric("TTFB", 800.123, "vite-ttfb-0"))
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("[WebVitals] TTFB")
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("800.12")
  })

  it("INP 回调触发", async () => {
    const { reportWebVitals } = await import("./webVitals")
    reportWebVitals()
    getCallback(mockOnINP)(makeMetric("INP", 96.999, "vite-inp-42"))
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("[WebVitals] INP")
    expect(mockLoggerInfo.mock.calls[0]![0]).toContain("97.00")
  })
})
