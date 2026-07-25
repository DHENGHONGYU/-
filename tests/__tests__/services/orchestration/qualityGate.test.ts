/**
 * @fileoverview QualityGate 单元测试
 *
 * vitest globals=true，无需 import describe/it/expect/vi
 * environment=jsdom
 */

// ---- vi.mock 会被 hoisted，工厂内不能引用外部变量 ----

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

const listeners = new Map<string, Array<(payload: unknown) => void>>()

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    on: vi.fn((event: string, callback: (payload: unknown) => void) => {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(callback)
      return () => { /* unsub */ }
    }),
    emit: vi.fn((event: string, payload?: unknown) => {
      const cbs = listeners.get(event) ?? []
      cbs.forEach(cb => cb(payload))
    }),
    off: vi.fn(),
    clearAll: vi.fn(() => listeners.clear()),
  },
}))

vi.mock('@/services/data-collector/qualityMetricsCollector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/data-collector/qualityMetricsCollector')>()
  return {
    ...actual,
    getQualityMetrics: vi.fn(() => ({
      snapshot: vi.fn(() => ({
        successRate: 1.0,
        completeness: 1.0,
        totalCollects: 100,
        successCollects: 100,
        realSuccessRate: 100,
        mockCollects: 0,
        mockSuccesses: 0,
        writeSuccess: 100,
        writeTotal: 100,
        writeRate: 100,
        mockWrites: 0,
        fallbackCount: 0,
        avgLatency: 10,
        totalLatency: 1000,
        sourceCounts: { tushare: 50, tencent: 30, sina: 20, netease: 0, akshare: 0, mock: 0 },
        since: Date.now(),
        lastError: undefined,
      })),
    })),
  }
})

vi.mock('@/services/data-collector/collectionPipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/data-collector/collectionPipeline')>()
  return {
    ...actual,
    runBatchTrace: vi.fn().mockResolvedValue(undefined),
    createDefaultCollectionConfig: vi.fn().mockReturnValue({}),
  }
})

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  ENVELOPE_ACTION: { queryList: 'queryList' },
  STORE_NAME: { stocks: 'stocks' },
}))

vi.mock('@/services/analysis/industryAnalysisService', () => ({
  runFullIndustryAnalysis: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('nanoid', () => ({
  nanoid: () => 'mock-id',
}))

// ---- 导入被测模块（vi.mock 之后） ----
import { QualityGate } from '@/services/orchestration/qualityGate'
import { eventBus } from '@/lib/eventBus'
import { getQualityMetrics } from '@/services/data-collector/qualityMetricsCollector'

// ---- 辅助函数 ----
function emitEvent(event: string, payload?: unknown) {
  const cbs = listeners.get(event) ?? []
  cbs.forEach(cb => cb(payload))
}

// ---- 测试 ----
describe('QualityGate', () => {
  let gate: QualityGate

  beforeEach(() => {
    listeners.clear()
    vi.clearAllMocks()
    gate = new QualityGate()
  })

  afterEach(() => {
    listeners.clear()
  })

  describe('生命周期', () => {
    it('start() 后 active=true，stop() 后 active=false', () => {
      expect(gate.active).toBe(false)

      gate.start()
      expect(gate.active).toBe(true)

      gate.stop()
      expect(gate.active).toBe(false)
    })

    it('start() 注册 2 个事件监听', () => {
      gate.start()

      expect(eventBus.on).toHaveBeenCalledTimes(2)

      const registeredEvents = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.map(
        call => call[0],
      )
      expect(registeredEvents).toContain('collect:complete')
      expect(registeredEvents).toContain('registration:collect:complete')
    })
  })

  describe('质量检查', () => {
    it('checkQuality — 成功率达标且无缺失维度 → passed=true', () => {
      const metrics = {
        successRate: 0.96,
        completeness: 0.95,
      } as any

      const result = gate.checkQuality(metrics)

      expect(result.passed).toBe(true)
      expect(result.missingDimensions).toEqual([])
    })

    it('checkQuality — 成功率低于阈值 → passed=false', () => {
      const metrics = {
        successRate: 0.80, // < 0.95
        completeness: 0.95,
      } as any

      const result = gate.checkQuality(metrics)

      expect(result.passed).toBe(false)
      expect(result.reason).toContain('采集成功率')
    })

    it('checkQuality — 必须维度缺失 → passed=false', () => {
      // 启动 gate 以注册 collect:complete 监听
      gate.start()

      // 模拟收到 collect:complete 事件，但只上报部分维度
      emitEvent('collect:complete', {
        symbol: '600519',
        dimensionCode: 'quote',
        success: true,
      })

      // 此时 dimensionTracker 只有 quote，缺失 kline（必须维度，阈值=1.0）
      const metrics = {
        successRate: 0.96,
        completeness: 0.95,
      } as any

      const result = gate.checkQuality(metrics)

      // kline 的 dimensionCompletenessMap 阈值为 1.0，属于必须维度
      expect(result.passed).toBe(false)
      expect(result.reason).toContain('必须维度缺失')
    })
  })

  describe('事件链路', () => {
    it('收到 REGISTRATION_COLLECT_COMPLETE 后触发 evaluateAndProceed', async () => {
      gate.start()
      vi.useFakeTimers()

      emitEvent('registration:collect:complete', {
        symbols: ['600519', '000858'],
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'quality:gate:checked',
          expect.objectContaining({ passed: true }),
        )
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'quality:gate:passed',
          expect.objectContaining({ passed: true }),
        )
      })

      vi.useRealTimers()
    })

    it('质量不达标时 emit QUALITY_GATE_FAILED', async () => {
      // 覆盖 getQualityMetrics 返回低成功率
      vi.mocked(getQualityMetrics).mockReturnValue({
        snapshot: () => ({
          successRate: 0.70, // < 0.95
          completeness: 0.95,
          totalCollects: 100,
          successCollects: 70,
          realSuccessRate: 70,
          mockCollects: 0,
          mockSuccesses: 0,
          writeSuccess: 100,
          writeTotal: 100,
          writeRate: 100,
          mockWrites: 0,
          fallbackCount: 0,
          avgLatency: 10,
          totalLatency: 1000,
          sourceCounts: { tushare: 50, tencent: 30, sina: 20, netease: 0, akshare: 0, mock: 0 },
          since: Date.now(),
          lastError: undefined,
        }),
      } as any)

      gate.start()
      vi.useFakeTimers()

      emitEvent('registration:collect:complete', {
        symbols: ['600519'],
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'quality:gate:checked',
          expect.objectContaining({ passed: false }),
        )
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'quality:gate:failed',
          expect.objectContaining({ passed: false }),
        )
      })

      vi.useRealTimers()
    })

    it('质量达标时 emit QUALITY_GATE_PASSED', async () => {
      // 确保恢复高成功率的 metrics（前一个测试可能覆盖了 mock）
      vi.mocked(getQualityMetrics).mockReturnValue({
        snapshot: vi.fn(() => ({
          successRate: 1.0,
          completeness: 1.0,
          totalCollects: 100,
          successCollects: 100,
          realSuccessRate: 100,
          mockCollects: 0,
          mockSuccesses: 0,
          writeSuccess: 100,
          writeTotal: 100,
          writeRate: 100,
          mockWrites: 0,
          fallbackCount: 0,
          avgLatency: 10,
          totalLatency: 1000,
          sourceCounts: { tushare: 50, tencent: 30, sina: 20, netease: 0, akshare: 0, mock: 0 },
          since: Date.now(),
          lastError: undefined,
        })),
      } as any)

      gate.start()
      vi.useFakeTimers()

      emitEvent('registration:collect:complete', {
        symbols: ['600519'],
      })

      await vi.waitFor(() => {
        expect(eventBus.emit).toHaveBeenCalledWith(
          'quality:gate:passed',
          expect.objectContaining({ passed: true }),
        )
      })

      vi.useRealTimers()
    })
  })
})
