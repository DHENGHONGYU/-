/**
 * @test_id V9-TEST-UT-094
 * 纯编排核心单元测试
 *
 * 覆盖目标：phaseOrchestrator.ts 100% 行/分支覆盖率
 *
 * 测试范围：
 *   1. PhaseOrchestrator.run() — 顺序执行、空步骤、上下文透传
 *   2. collectDimension() — 全部维度路由 + 并行/串行 + 采集异常 + 写入异常 + stale 标记
 *   3. Phase1Step / Phase2Step / Phase3Step / Phase4Step — 各 Phase 步骤逻辑
 *   4. createDefaultSteps() — 工厂函数
  * @covers_docs [V9-DOC-PROJ-092]
*/

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock eventBus（Phase4Step 会调用 emit）
vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}))

import { eventBus } from '@/lib/eventBus'
import type { StockQuote, KlineItem } from '@/services/fetcher/directDataAPI'
import {
  PhaseOrchestrator,
  collectDimension,
  createDefaultSteps,
} from '@/services/fetcher/orchestrator/phaseOrchestrator'
import { DEFAULT_KLINE_DAYS } from '@/services/fetcher/orchestrator/ports'
import type {
  IMarketDataFetcher,
  IDataBridgeWriter,
  OrchestratorContext,
} from '@/services/fetcher/orchestrator/ports'

// ============================================================
// 测试常量（禁止 magic numbers）
// ============================================================

const MOCK_PRICE = 100
const MOCK_CHANGE = 1
const MOCK_OPEN = 99
const MOCK_HIGH = 101
const MOCK_LOW = 98
const MOCK_VOLUME = 1000000
const MOCK_AMOUNT = 100000000
const MOCK_KLINE_COUNT = 3
const MOCK_LATENCY = 10
const SESSION_ID = 'test-session-001'
const SYMBOL_1 = '600519'
const SYMBOL_2 = '000001'
const SYMBOL_3 = '000002'
/** Phase 1-3 总维度数: 3+3+2=8 */
const TOTAL_PHASE1_3_DIMENSIONS = 8

// ============================================================
// 测试工具：创建 Mock 依赖
// ============================================================

function createMockFetcher(overrides?: Partial<IMarketDataFetcher>): IMarketDataFetcher & {
  fetchQuote: ReturnType<typeof vi.fn>
  fetchKline: ReturnType<typeof vi.fn>
} {
  return {
    fetchQuote: vi.fn(),
    fetchKline: vi.fn(),
    ...overrides,
  } as IMarketDataFetcher & {
    fetchQuote: ReturnType<typeof vi.fn>
    fetchKline: ReturnType<typeof vi.fn>
  }
}

function createMockWriter(overrides?: Partial<IDataBridgeWriter>): IDataBridgeWriter & {
  writeQuote: ReturnType<typeof vi.fn>
  writeKline: ReturnType<typeof vi.fn>
} {
  return {
    writeQuote: vi.fn(),
    writeKline: vi.fn(),
    ...overrides,
  } as IDataBridgeWriter & {
    writeQuote: ReturnType<typeof vi.fn>
    writeKline: ReturnType<typeof vi.fn>
  }
}

function createMockContext(
  symbols: string[] = [SYMBOL_1, SYMBOL_2],
  fetcher?: IMarketDataFetcher,
  writer?: IDataBridgeWriter,
  collectBasic?: (code: string) => Promise<boolean>,
): OrchestratorContext {
  return {
    sessionId: SESSION_ID,
    symbols,
    fetcher: fetcher ?? createMockFetcher(),
    writer: writer ?? createMockWriter(),
    collectBasic: collectBasic ?? vi.fn().mockResolvedValue(true),
    phaseSummaries: [],
    allResults: [],
    sessionStart: Date.now(),
  }
}

function createMockQuote(code: string, source: StockQuote['source'] = 'tencent'): StockQuote {
  return {
    code,
    name: `TEST_${code}`,
    price: MOCK_PRICE,
    change: MOCK_CHANGE,
    changePercent: MOCK_CHANGE,
    open: MOCK_OPEN,
    high: MOCK_HIGH,
    low: MOCK_LOW,
    prevClose: MOCK_OPEN,
    volume: MOCK_VOLUME,
    amount: MOCK_AMOUNT,
    timestamp: Date.now(),
    source,
  }
}

function createMockKline(count = MOCK_KLINE_COUNT): KlineItem[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    open: MOCK_PRICE + i,
    high: MOCK_HIGH + i,
    low: MOCK_LOW + i,
    close: MOCK_PRICE + i,
    volume: MOCK_VOLUME,
    amount: MOCK_AMOUNT,
  }))
}

// ============================================================
// 测试开始
// ============================================================

describe('PhaseOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('run() — 顺序执行', () => {
    it('应按顺序执行所有步骤并透传上下文', async () => {
      const callOrder: string[] = []
      const steps = [
        { name: 'A', execute: vi.fn(async (ctx: OrchestratorContext) => { callOrder.push('A'); return ctx }) },
        { name: 'B', execute: vi.fn(async (ctx: OrchestratorContext) => { callOrder.push('B'); return ctx }) },
        { name: 'C', execute: vi.fn(async (ctx: OrchestratorContext) => { callOrder.push('C'); return ctx }) },
      ]
      const orchestrator = new PhaseOrchestrator(steps as never)
      const ctx = createMockContext()

      const result = await orchestrator.run(ctx)

      expect(callOrder).toEqual(['A', 'B', 'C'])
      expect(result).toBe(ctx)
      expect(steps[0]!.execute).toHaveBeenCalledTimes(1)
    })

    it('空步骤数组应直接返回原始上下文', async () => {
      const orchestrator = new PhaseOrchestrator([])
      const ctx = createMockContext()

      const result = await orchestrator.run(ctx)

      expect(result).toBe(ctx)
    })

    it('步骤异常应向上抛出（不吞异常）', async () => {
      const steps = [
        { name: 'A', execute: vi.fn(async (ctx: OrchestratorContext) => ctx) },
        { name: 'B', execute: vi.fn(async () => { throw new Error('step B failed') }) },
      ]
      const orchestrator = new PhaseOrchestrator(steps as never)
      const ctx = createMockContext()

      await expect(orchestrator.run(ctx)).rejects.toThrow('step B failed')
    })
  })
})

// ============================================================
// collectDimension() 测试
// ============================================================

describe('collectDimension()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('维度路由 — Phase 1', () => {
    it('01_basic 维度: fetchQuote → writeQuote', async () => {
      const fetcher = createMockFetcher()
      const writer = createMockWriter()
      const quote = createMockQuote(SYMBOL_1)
      fetcher.fetchQuote.mockResolvedValue(quote)

      const result = await collectDimension('01_basic', [SYMBOL_1], { fetcher, writer, collectBasic: vi.fn() })

      expect(fetcher.fetchQuote).toHaveBeenCalledWith(SYMBOL_1)
      expect(writer.writeQuote).toHaveBeenCalledWith(quote)
      expect(writer.writeKline).not.toHaveBeenCalled()
      expect(result.success).toEqual([SYMBOL_1])
      expect(result.failed).toEqual([])
      expect(result.partial).toBe(false)
      expect(result.stale).toBe(false)
    })

    it('02_kline 维度: fetchKline → writeKline', async () => {
      const fetcher = createMockFetcher()
      const writer = createMockWriter()
      const kline = createMockKline()
      fetcher.fetchKline.mockResolvedValue(kline)

      const result = await collectDimension('02_kline', [SYMBOL_1], { fetcher, writer, collectBasic: vi.fn() })

      expect(fetcher.fetchKline).toHaveBeenCalledWith(SYMBOL_1, DEFAULT_KLINE_DAYS)
      expect(writer.writeKline).toHaveBeenCalledWith(SYMBOL_1, kline)
      expect(writer.writeQuote).not.toHaveBeenCalled()
      expect(result.success).toEqual([SYMBOL_1])
    })

    it('07_index 维度: fetchQuote → writeQuote', async () => {
      const fetcher = createMockFetcher()
      const writer = createMockWriter()
      fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_2))

      const result = await collectDimension('07_index', [SYMBOL_2], { fetcher, writer, collectBasic: vi.fn() })

      expect(fetcher.fetchQuote).toHaveBeenCalledWith(SYMBOL_2)
      expect(result.success).toEqual([SYMBOL_2])
    })
  })

  describe('维度路由 — Phase 2/3 (collectBasic → stub)', () => {
    it('03_chip 维度: collectBasic 成功 → stub 标记', async () => {
      const collectBasic = vi.fn().mockResolvedValue(true)
      const fetcher = createMockFetcher()
      const writer = createMockWriter()

      const result = await collectDimension('03_chip', [SYMBOL_1], { fetcher, writer, collectBasic })

      expect(collectBasic).toHaveBeenCalledWith(SYMBOL_1)
      expect(fetcher.fetchQuote).not.toHaveBeenCalled()
      // stub 维度不计入 success，而是计入 stubDimensions 并标记 partial
      expect(result.success).toEqual([])
      expect(result.stubDimensions).toEqual(['03_chip'])
      expect(result.partial).toBe(true)
    })

    it('04_events 维度: collectBasic 成功 → stub 标记', async () => {
      const collectBasic = vi.fn().mockResolvedValue(true)

      const result = await collectDimension('04_events', [SYMBOL_1], { fetcher: createMockFetcher(), writer: createMockWriter(), collectBasic })

      expect(result.success).toEqual([])
      expect(result.stubDimensions).toEqual(['04_events'])
      expect(result.partial).toBe(true)
    })

    it('05_news 维度: collectBasic 失败 → 标记 partial', async () => {
      const collectBasic = vi.fn().mockResolvedValue(false)

      const result = await collectDimension('05_news', [SYMBOL_1], { fetcher: createMockFetcher(), writer: createMockWriter(), collectBasic })

      expect(result.failed).toEqual([SYMBOL_1])
      expect(result.partial).toBe(true)
    })

    it('08_research 维度: collectBasic 抛异常 → 标记 partial', async () => {
      const collectBasic = vi.fn().mockRejectedValue(new Error('network error'))

      const result = await collectDimension('08_research', [SYMBOL_1], { fetcher: createMockFetcher(), writer: createMockWriter(), collectBasic })

      expect(result.failed).toEqual([SYMBOL_1])
      expect(result.partial).toBe(true)
    })
  })

  describe('采集异常处理', () => {
    it('fetchQuote 抛异常 → failed + partial', async () => {
      const fetcher = createMockFetcher()
      fetcher.fetchQuote.mockRejectedValue(new Error('timeout'))

      const result = await collectDimension('01_basic', [SYMBOL_1], { fetcher, writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.failed).toEqual([SYMBOL_1])
      expect(result.partial).toBe(true)
    })

    it('非 Error 类型异常 → 使用 String()', async () => {
      const fetcher = createMockFetcher()
      fetcher.fetchQuote.mockRejectedValue('string error')

      const result = await collectDimension('01_basic', [SYMBOL_1], { fetcher, writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.failed).toEqual([SYMBOL_1])
      expect(result.partial).toBe(true)
    })
  })

  describe('写入异常处理', () => {
    it('writeQuote 抛异常 → failed + partial', async () => {
      const fetcher = createMockFetcher()
      const writer = createMockWriter()
      fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_1))
      writer.writeQuote.mockRejectedValue(new Error('DB write failed'))

      const result = await collectDimension('01_basic', [SYMBOL_1], { fetcher, writer, collectBasic: vi.fn() })

      expect(result.failed).toEqual([SYMBOL_1])
      expect(result.partial).toBe(true)
    })

    it('writeKline 抛异常 → failed + partial', async () => {
      const fetcher = createMockFetcher()
      const writer = createMockWriter()
      fetcher.fetchKline.mockResolvedValue(createMockKline())
      writer.writeKline.mockRejectedValue(new Error('DB write failed'))

      const result = await collectDimension('02_kline', [SYMBOL_1], { fetcher, writer, collectBasic: vi.fn() })

      expect(result.failed).toEqual([SYMBOL_1])
      expect(result.partial).toBe(true)
    })
  })

  describe('stale 标记', () => {
    it('source 为 mock → stale = true', async () => {
      const fetcher = createMockFetcher()
      fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_1, 'mock'))

      const result = await collectDimension('01_basic', [SYMBOL_1], { fetcher, writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.stale).toBe(true)
    })

    it('source 非 mock → stale = false', async () => {
      const fetcher = createMockFetcher()
      fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_1, 'tencent'))

      const result = await collectDimension('01_basic', [SYMBOL_1], { fetcher, writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.stale).toBe(false)
    })
  })

  describe('多标的 + 并行/串行', () => {
    it('Phase 1 维度: 多标的全成功', async () => {
      const fetcher = createMockFetcher()
      fetcher.fetchQuote.mockImplementation(async (code: string) => createMockQuote(code))

      const result = await collectDimension('01_basic', [SYMBOL_1, SYMBOL_2, SYMBOL_3], { fetcher, writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.success).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(result.partial).toBe(false)
    })

    it('Phase 1 维度: 部分标的部分成功', async () => {
      const fetcher = createMockFetcher()
      fetcher.fetchQuote
        .mockResolvedValueOnce(createMockQuote(SYMBOL_1))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(createMockQuote(SYMBOL_3))

      const result = await collectDimension('01_basic', [SYMBOL_1, SYMBOL_2, SYMBOL_3], { fetcher, writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.success).toHaveLength(2)
      expect(result.failed).toEqual([SYMBOL_2])
      expect(result.partial).toBe(true)
    })

    it('Phase 2 维度: 串行执行 collectBasic → 全部 stub', async () => {
      const callOrder: string[] = []
      const collectBasic = vi.fn(async (code: string) => {
        callOrder.push(code)
        return true
      })

      const result = await collectDimension('03_chip', ['A', 'B', 'C'], { fetcher: createMockFetcher(), writer: createMockWriter(), collectBasic })

      // 串行执行 → 调用顺序应保持
      expect(callOrder).toEqual(['A', 'B', 'C'])
      // stub 维度不计入 success
      expect(result.success).toHaveLength(0)
      expect(result.stubDimensions).toEqual(['03_chip'])
      expect(result.partial).toBe(true)
    })

    it('空 symbols 数组 → 空结果', async () => {
      const result = await collectDimension('01_basic', [], { fetcher: createMockFetcher(), writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.success).toEqual([])
      expect(result.failed).toEqual([])
      expect(result.partial).toBe(false)
    })
  })

  describe('latency 计算', () => {
    it('应返回非负 latency', async () => {
      const fetcher = createMockFetcher()
      fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_1))

      const result = await collectDimension('01_basic', [SYMBOL_1], { fetcher, writer: createMockWriter(), collectBasic: vi.fn() })

      expect(result.latency).toBeGreaterThanOrEqual(0)
    })
  })
})

// ============================================================
// Phase1Step 测试
// ============================================================

describe('Phase1Step', () => {
  beforeEach(() => vi.clearAllMocks())

  it('并行执行 3 个维度 (01_basic, 02_kline, 07_index)', async () => {
    const fetcher = createMockFetcher()
    const writer = createMockWriter()
    fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_1))
    fetcher.fetchKline.mockResolvedValue(createMockKline())

    const ctx = createMockContext([SYMBOL_1], fetcher, writer)
    const steps = createDefaultSteps()
    const phase1 = steps[0]!

    await phase1.execute(ctx)

    expect(ctx.phaseSummaries).toHaveLength(1)
    expect(ctx.phaseSummaries[0]!.phase).toBe('phase1')
    expect(ctx.phaseSummaries[0]!.dimensions).toEqual(['01_basic', '02_kline', '07_index'])
    expect(ctx.phaseSummaries[0]!.totalSymbols).toBe(3) // 1 symbol × 3 dimensions
    expect(ctx.allResults).toHaveLength(3)
  })

  it('Phase 1 摘要应正确汇总成功/失败', async () => {
    const fetcher = createMockFetcher()
    const writer = createMockWriter()
    fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_1))
    fetcher.fetchKline.mockResolvedValue(createMockKline())

    const ctx = createMockContext([SYMBOL_1], fetcher, writer)
    const steps = createDefaultSteps()
    await steps[0]!.execute(ctx)

    const summary = ctx.phaseSummaries[0]!
    expect(summary.successCount).toBe(3) // 3 维度各 1 标的
    expect(summary.failedCount).toBe(0)
  })
})

// ============================================================
// Phase2Step 测试
// ============================================================

describe('Phase2Step', () => {
  beforeEach(() => vi.clearAllMocks())

  it('串行执行 3 个维度 (03_chip, 06_industry, 08_research)', async () => {
    const collectBasic = vi.fn().mockResolvedValue(true)
    const ctx = createMockContext([SYMBOL_1], undefined, undefined, collectBasic)
    const steps = createDefaultSteps()
    const phase2 = steps[1]!

    await phase2.execute(ctx)

    expect(ctx.phaseSummaries).toHaveLength(1)
    expect(ctx.phaseSummaries[0]!.phase).toBe('phase2')
    expect(ctx.phaseSummaries[0]!.dimensions).toEqual(['03_chip', '06_industry', '08_research'])
    expect(ctx.allResults).toHaveLength(3)
    expect(collectBasic).toHaveBeenCalledTimes(3) // 3 维度 × 1 标的
  })
})

// ============================================================
// Phase3Step 测试
// ============================================================

describe('Phase3Step', () => {
  beforeEach(() => vi.clearAllMocks())

  it('并行执行 2 个维度 (04_events, 05_news)', async () => {
    const collectBasic = vi.fn().mockResolvedValue(true)
    const ctx = createMockContext([SYMBOL_1], undefined, undefined, collectBasic)
    const steps = createDefaultSteps()
    const phase3 = steps[2]!

    await phase3.execute(ctx)

    expect(ctx.phaseSummaries).toHaveLength(1)
    expect(ctx.phaseSummaries[0]!.phase).toBe('phase3')
    expect(ctx.phaseSummaries[0]!.dimensions).toEqual(['04_events', '05_news'])
    expect(ctx.allResults).toHaveLength(2)
    expect(collectBasic).toHaveBeenCalledTimes(2) // 2 维度 × 1 标的
  })
})

// ============================================================
// Phase4Step 测试
// ============================================================

describe('Phase4Step', () => {
  beforeEach(() => vi.clearAllMocks())

  it('聚合 allResults 并 emit COLLECT_ALL_COMPLETED 事件', async () => {
    const ctx = createMockContext([SYMBOL_1])
    // 预填充 allResults 模拟 Phase 1-3 的结果
    ctx.allResults = [
      { dimension: '01_basic', success: [SYMBOL_1], failed: [], latency: MOCK_LATENCY, source: 'tencent', partial: false, stale: false, stubDimensions: [] },
      { dimension: '02_kline', success: [SYMBOL_1], failed: [], latency: MOCK_LATENCY * 2, source: 'netease', partial: false, stale: false, stubDimensions: [] },
    ]
    const steps = createDefaultSteps()
    const phase4 = steps[3]!

    await phase4.execute(ctx)

    expect(eventBus.emit).toHaveBeenCalledWith('COLLECT_ALL_COMPLETED', expect.objectContaining({
      sessionId: SESSION_ID,
      totalSuccess: 2,
      totalFailed: 0,
      stale: false,
      partial: false,
    }))
    const summary = ctx.phaseSummaries[0]!
    expect(summary.phase).toBe('phase4')
    expect(summary.successCount).toBe(2)
    expect(summary.failedCount).toBe(0)
  })

  it('存在 stale 数据时, 事件应标记 stale: true', async () => {
    const ctx = createMockContext([SYMBOL_1])
    ctx.allResults = [
      { dimension: '01_basic', success: [SYMBOL_1], failed: [], latency: MOCK_LATENCY, source: 'mock', partial: false, stale: true, stubDimensions: [] },
    ]
    const steps = createDefaultSteps()

    await steps[3]!.execute(ctx)

    expect(eventBus.emit).toHaveBeenCalledWith('COLLECT_ALL_COMPLETED', expect.objectContaining({
      stale: true,
    }))
  })

  it('存在 partial 数据时, 事件应标记 partial: true', async () => {
    const ctx = createMockContext([SYMBOL_1, SYMBOL_2])
    ctx.allResults = [
      { dimension: '01_basic', success: [SYMBOL_1], failed: [SYMBOL_2], latency: MOCK_LATENCY, source: 'tencent', partial: true, stale: false, stubDimensions: [] },
    ]
    const steps = createDefaultSteps()

    await steps[3]!.execute(ctx)

    expect(eventBus.emit).toHaveBeenCalledWith('COLLECT_ALL_COMPLETED', expect.objectContaining({
      partial: true,
      totalSuccess: 1,
      totalFailed: 1,
    }))
  })

  it('空 allResults → 全部为 0', async () => {
    const ctx = createMockContext([])
    const steps = createDefaultSteps()

    await steps[3]!.execute(ctx)

    expect(eventBus.emit).toHaveBeenCalledWith('COLLECT_ALL_COMPLETED', expect.objectContaining({
      totalSuccess: 0,
      totalFailed: 0,
      stale: false,
      partial: false,
    }))
  })
})

// ============================================================
// createDefaultSteps() 测试
// ============================================================

describe('createDefaultSteps()', () => {
  it('应返回 4 个步骤, 名称分别为 phase1~phase4', () => {
    const steps = createDefaultSteps()

    expect(steps).toHaveLength(4)
    expect(steps[0]!.name).toBe('phase1')
    expect(steps[1]!.name).toBe('phase2')
    expect(steps[2]!.name).toBe('phase3')
    expect(steps[3]!.name).toBe('phase4')
  })
})

// ============================================================
// 端到端：PhaseOrchestrator + createDefaultSteps 完整流程
// ============================================================

describe('端到端: 完整 Phase 1-4 编排', () => {
  beforeEach(() => vi.clearAllMocks())

  it('完整执行 Phase 1→2→3→4, 生成 4 个摘要 + emit 事件', async () => {
    const fetcher = createMockFetcher()
    const writer = createMockWriter()
    const collectBasic = vi.fn().mockResolvedValue(true)
    fetcher.fetchQuote.mockResolvedValue(createMockQuote(SYMBOL_1))
    fetcher.fetchKline.mockResolvedValue(createMockKline())

    const ctx = createMockContext([SYMBOL_1], fetcher, writer, collectBasic)
    const steps = createDefaultSteps()
    const orchestrator = new PhaseOrchestrator(steps)

    const result = await orchestrator.run(ctx)

    // 4 个 Phase 摘要
    expect(result.phaseSummaries).toHaveLength(4)
    expect(result.phaseSummaries.map((p) => p.phase)).toEqual([
      'phase1', 'phase2', 'phase3', 'phase4',
    ])
    // allResults 包含 Phase 1-3 的维度结果 (3+3+2=8)
    expect(result.allResults).toHaveLength(TOTAL_PHASE1_3_DIMENSIONS)
    // Phase 4 触发事件
    expect(eventBus.emit).toHaveBeenCalledWith('COLLECT_ALL_COMPLETED', expect.objectContaining({
      sessionId: SESSION_ID,
    }))
  })
})
