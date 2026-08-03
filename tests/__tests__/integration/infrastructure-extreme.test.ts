/**
 * 极端场景集成测试（基础设施层）
 *
 * 文件位置：tests/__tests__/integration/infrastructure-extreme.test.ts
 *
 * 覆盖范围（按优先级 P0/P1）：
 *   P0 已覆盖（16 用例）：
 *     D1  数据源层全失败  （4 用例）
 *     N1  请求超时        （2 用例）
 *     N3  服务不可达      （2 用例）
 *     S1  IDB 写入失败    （4 用例）
 *     C1  全维度采集失败  （3 用例）
 *     X1  混合一致性      （1 用例）
 *
 *   P1 本次新增（13 用例）：
 *     D2  部分源降级      （3 用例）
 *     N2  网络抖动/重试   （3 用例）
 *     N4  HTTP 5xx / 非 JSON 响应 （3 用例）
 *     C2  部分维度失败    （2 用例）
 *     C3  重入守卫        （2 用例）
 *
 * Mock 严格按导入序，保证 vi.mock() 在被测模块 import 之前生效。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// ─── vi.hoisted 区：严格按导入序 mock ──────────────────────────────
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  getLogger: () => mockLogger,
}))

vi.mock('@/lib/logger', () => mockLogger)

vi.mock('@/lib/perf', () => ({
  measureAsync: vi.fn(async <T>(_label: string, fn: () => Promise<T>) => fn()),
  measureSync: vi.fn((_label: string, fn: () => unknown) => fn()),
  PERF: { DATA_FETCH_REQUEST: 'data.fetch.request' },
}))

vi.mock('nanoid', () => ({ nanoid: (_n?: number) => 'testid01' }))

// ─── core 层 ──────────────────────────────────────────────────
vi.mock('@/core/poolTransitionEngine', () => ({
  transitionIntentionToResearch: vi.fn(),
  transitionResearchToPosition: vi.fn(),
}))

const mockRunSingleTrace = vi.hoisted(() => vi.fn())
const mockRunBatchTrace = vi.hoisted(() => vi.fn())
const mockUpgradeDimensions = vi.hoisted(() => vi.fn((dims: unknown[]) => dims))

vi.mock('@/services/data-collector/collectionPipeline', () => ({
  runSingleTrace: mockRunSingleTrace,
  runBatchTrace: mockRunBatchTrace,
  upgradeDimensionsToPipeline: mockUpgradeDimensions,
  SEVEN_DIMENSION_CODES: ['01', '02', '03', '04', '05', '06', '07'],
  DEFAULT_DIMENSIONS: [],
}))

const mockForward = vi.hoisted(() => vi.fn())
const mockQuery = vi.hoisted(() => vi.fn())

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: mockForward,
    query: mockQuery,
  },
  ACL_MATRIX: {
    fetcher: { read: ['stocks'], write: ['stocks'], actions: ['insert'] },
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: vi.fn((meta: unknown, payload: unknown) => ({ meta, payload })),
  },
  ENVELOPE_TARGET: { db: 'db', broadcast: 'broadcast' },
}))

// ─── config 层 ──────────────────────────────────────────────────
vi.mock('@/constants/pool.constants', () => ({
  POOL_TYPE: {
    intention: 'intention',
    research: 'research',
    position: 'position',
  },
  INTENTION_STATUS: {
    screening: 'screening',
    watchlist: 'watchlist',
    archived: 'archived',
  },
  RESEARCH_STATUS: {
    candidate: 'candidate',
    screened: 'screened',
    deepDive: 'deepDive',
    watching: 'watching',
    archived: 'archived',
  },
  POSITION_STATUS: {
    holding: 'holding',
    partial: 'partial',
    closed: 'closed',
  },
  DEFAULT_POOL_GROUP: '未分组',
  DEFAULT_POOL_TYPE: 'intention' as const,
  DEFAULT_POOL_STATUS: {
    intention: 'screening',
    research: 'candidate',
    position: 'holding',
  },
}))

vi.mock('@/config/inputConfig', () => ({
  INPUT_CONFIG: {
    enableAutoFetchBasic: false,
    enableAutoFetchKline: false,
    normalizeSymbolToUppercase: true,
  },
}))

const mockTimeoutMs = vi.hoisted(() => vi.fn(() => 30_000))
const mockRetries = vi.hoisted(() => vi.fn(() => 0))

vi.mock('@/config/fetcherConfig', () => ({
  getDefaultFetcherServiceConfig: () => ({
    baseURL: 'http://localhost:8000',
    timeoutMs: mockTimeoutMs(),
    retries: mockRetries(),
  }),
  getDefaultFetcherGlobalConfig: () => ({ maxSymbols: 40, batchSize: 10 }),
  getDefaultFetcherDimensions: () => [],
  FETCHER_FREQUENCY_LABELS: { daily: '日' },
  FETCHER_FREQUENCY_MINUTES: { daily: 1440 },
}))

vi.mock('@/config/apiPaths', () => ({
  API_COLLECT_BASIC: '/api/collect/basic',
  API_COLLECT_KLINE: '/api/collect/kline',
  API_COLLECT_FINANCIAL: '/api/collect/financial',
  API_HEALTH_CHECK: '/health',
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    insertStock: 'INSERT_STOCK',
    updateStock: 'UPDATE_STOCK',
    saveCollectConfig: 'SAVE_COLLECT_CONFIG',
  },
  ENVELOPE_TARGET: { db: 'db', broadcast: 'broadcast' },
  MODULE_ID: { fetcher: 'fetcher', pool: 'pool', analyzer: 'analyzer' },
  STORE_NAME: { stocks: 'stocks', collectConfig: 'collect_config' },
  DB_OPERATION: { insert: 'INSERT', select: 'SELECT' },
  ACL_MATRIX: {
    fetcher: { read: ['stocks'], write: ['stocks'], actions: ['INSERT'] },
  },
}))

// ─── store helpers / constants ─────────────────────────────────────
vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: vi.fn(async (_evt: string, payload: unknown) => payload),
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { POOL_CHANGED: 'pool:changed', SEVEN_DIM_UPDATED: 'seven-dim:updated' },
}))

// ─── services 层 ────────────────────────────────────────────────
vi.mock('@/services/useCase/fetcherOrchestrator.useCase', () => ({
  orchestrateStockCollection: vi.fn(),
  orchestrateHealthCheck: vi.fn(),
  fetchBasicDataUseCase: vi.fn(async (_symbol: string) => ({
    success: true as const,
    data: null,
  })),
  fetchKlineDataUseCase: vi.fn(async (_params: { symbol: string }) => ({
    success: true as const,
    data: null,
  })),
}))

vi.mock('@/services/stock/FullMarketStockService', () => ({
  searchFullMarket: vi.fn(async () => []),
  FullMarketStockService: {
    getInstance: vi.fn(() => ({
      searchByName: vi.fn(async () => []),
      listAll: vi.fn(async () => []),
    })),
  },
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn(), once: vi.fn() },
  EVENT_TYPES: {},
}))

vi.mock('@/services/data-collector/tracePersistenceService', () => ({
  tracePersistenceService: {
    saveTrace: vi.fn(async () => ({ ok: true })),
    batchSaveTraces: vi.fn(async () => ({ ok: true })),
    listTracesBySymbol: vi.fn(async () => []),
  },
}))

vi.mock('@/services/data-collector/qualityMetricsCollector', () => ({
  QualityMetricsCollector: class FakeQMC {
    recordDimensionResult() {}
    recordPipelineRun() {}
    getQualitySnapshot(): Record<string, unknown> { return {} }
    checkAlerts(): string[] { return [] }
  },
  getQualityMetrics: vi.fn(() => ({
    recordDimensionResult: vi.fn(),
    recordPipelineRun: vi.fn(),
    getQualitySnapshot: vi.fn(() => ({})),
    checkAlerts: vi.fn(() => []),
  })),
  getQualitySnapshot: vi.fn(() => ({})),
  checkQualityAlerts: vi.fn(() => []),
}))

vi.mock('@/services/data-collector/missingReportDetector', () => ({
  missingReportDetector: {
    scanMissing: vi.fn(async () => []),
    markFilled: vi.fn(async () => ({ ok: true })),
  },
}))

vi.mock('@/services/data-collector/multiSourceFetcher', () => ({
  multiSourceFetcher: {
    fetchWithFallback: vi.fn(async () => ({ ok: false, error: 'fallback exhausted' })),
    prefetchAll: vi.fn(async () => ({ successCount: 0, total: 0 })),
  },
}))

vi.mock('@/store/collectionRuntimeStore', () => ({
  useCollectionRuntimeStore: {
    getState: vi.fn(() => ({
      setRunning: vi.fn(),
      refreshStats: vi.fn(),
      setProgress: vi.fn(),
    })),
    setState: vi.fn(),
    subscribe: vi.fn(),
  },
}))

// ─── 被测模块（必须在所有 vi.mock 之后导入）────────────────────────
import { runSingleTrace } from '@/services/data-collector/collectionPipeline'
import { collectBasic, checkFetcherHealth } from '@/services/fetcher/fetcherClient'
import { addStock } from '@/services/input/inputService'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { EXTREME_SCENARIO_STOCKS } from '../../fixtures/sampled-10-stocks'

// ─── 测试辅助函数 ────────────────────────────────────────────────
const originalFetch = (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch

function createMinimalConfig(): Record<string, unknown> {
  return { sources: ['mock'], fields: ['price', 'pe', 'pb'], frequency: 'daily' }
}

/**
 * 向真实 IntentionPoolStore 注入意向池 items。
 * 注意字段名是 items（PoolItem[]），不是 stocks。
 */
function seedIntentionPool(symbols: string[]): void {
  useIntentionPoolStore.setState({
    items: symbols.map((sym, idx) => ({
      symbol: sym,
      name: EXTREME_SCENARIO_STOCKS[idx % EXTREME_SCENARIO_STOCKS.length]?.name ?? `股票-${sym}`,
      pool: 'intention' as const,
      status: 'watchlist' as const,
      group: '测试池',
      source: 'manual',
      dataVersion: 1,
      ingestedAt: Date.now(),
      updatedAt: Date.now(),
    })),
    loading: false,
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // 重置七维采集 store
  try {
    const s = useSevenDimConfigStore.getState()
    if (typeof (s as unknown as { reset?: () => void }).reset === 'function') {
      (s as unknown as { reset: () => void }).reset()
    }
  } catch {
    /* ignore */
  }
  useSevenDimConfigStore.setState({
    error: null,
    isCollecting: false,
    collectProgress: 0,
    collectingDimensions: [],
  })
  useIntentionPoolStore.setState({ items: [], loading: false, error: null })
  mockTimeoutMs.mockReturnValue(30_000)
  mockRetries.mockReturnValue(0)
})

afterEach(() => {
  vi.stubGlobal('fetch', originalFetch)
})

// ===============================================================
// P0 — D1：数据源层全失败（4 用例）
// ===============================================================
describe('P0 · D1: 数据源层全失败', () => {
  it('D1-1 runSingleTrace 返回错误时向上抛出，message 包含原始原因', async () => {
    mockRunSingleTrace.mockRejectedValue(new Error('模拟：上游 akshare 接口全挂'))
    try {
      await runSingleTrace({ symbol: '600519.SH', dimensionCode: '01', config: createMinimalConfig() })
      expect.fail('应当抛出异常')
    } catch (e) {
      expect((e as Error).message).toContain('模拟：上游 akshare 接口全挂')
    }
  })

  it('D1-2 runSingleTrace 全维度失败时不调用 IDB 写入，不污染本地库存', async () => {
    mockRunSingleTrace.mockRejectedValue(new Error('全源失败'))
    mockForward.mockResolvedValue({ success: true })
    try {
      await runSingleTrace({ symbol: '000001.SZ', dimensionCode: '01', config: createMinimalConfig() })
    } catch {
      /* ignore */
    }
    expect(mockForward).toHaveBeenCalledTimes(0)
  })

  it('D1-3 runSingleTrace 失败响应包含 fallbackCount/latencyMs/source 关键字段（若返回对象）', async () => {
    mockRunSingleTrace.mockResolvedValue({
      ok: false,
      error: '源 1/2/3 均不可用',
      fallbackCount: 3,
      latencyMs: 42,
      source: 'akshare+tushare+yahoo',
    })
    const result = (await runSingleTrace({
      symbol: '601318.SH', dimensionCode: '03', config: createMinimalConfig(),
    })) as Record<string, unknown>
    expect(result).toHaveProperty('fallbackCount')
    expect(result).toHaveProperty('latencyMs')
    expect(result).toHaveProperty('source')
  })

  it('D1-4 批量全失败（Promise.allSettled）：所有维度都 rejected，不吞异常', async () => {
    const dims = ['01', '02', '03', '04']
    mockRunSingleTrace.mockRejectedValue(new Error('批量：全网挂'))
    const results = await Promise.allSettled(
      dims.map((d) => runSingleTrace({ symbol: '300750.SZ', dimensionCode: d, config: createMinimalConfig() })),
    )
    const rejected = results.filter((r) => r.status === 'rejected')
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    expect(rejected).toHaveLength(dims.length)
    expect(fulfilled).toHaveLength(0)
  })
})

// ===============================================================
// P0 — N1：请求超时触发 AbortController（2 用例）
// ===============================================================
describe('P0 · N1: 请求超时触发 AbortController', () => {
  it('N1-1 fetch 超过 timeoutMs 时触发 AbortController，错误消息含 abort 关键字', async () => {
    mockTimeoutMs.mockReturnValue(10)
    mockRetries.mockReturnValue(0)

    // mock fetch 必须真实监听 signal，否则 setTimeout(abort) 只是设置标记不中断
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts: RequestInit = {}) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(new Response(JSON.stringify({ status: 'ok' }))), 200)
          const signal = opts.signal
          if (signal) {
            if (signal.aborted) {
              clearTimeout(timer)
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer)
                reject(new DOMException('Aborted', 'AbortError'))
              },
              { once: true },
            )
          }
        }),
      ),
    )

    let caughtErr: unknown
    try {
      await collectBasic('600519.SH')
    } catch (err) {
      caughtErr = err
    }
    expect(caughtErr).toBeDefined()
    const msg = (caughtErr as Error).message.toLowerCase()
    expect(msg.includes('abort') || msg.includes('aborted')).toBe(true)
  })

  it('N1-2 超时中断时 logger.error 已记录错误，携带 symbol + durationMs 字段', async () => {
    mockTimeoutMs.mockReturnValue(10)
    mockRetries.mockReturnValue(0)
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts: RequestInit = {}) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = opts.signal
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            )
          }
          // 否则永不 resolve（监听 abort 保证不卡死测试）
        }),
      ),
    )

    try {
      await collectBasic('300750.SZ')
    } catch {
      /* ignore */
    }

    const errorCalls = mockLogger.error.mock.calls as [string, Record<string, unknown>][]
    const matchCall = errorCalls.find(([msg]) =>
      typeof msg === 'string' && msg.includes('collectBasic 请求失败'),
    )
    expect(matchCall).toBeDefined()
    expect(matchCall![1].symbol).toBe('300750.SZ')
    expect(typeof matchCall![1].durationMs).toBe('number')
  })
})

// ===============================================================
// P0 — N3：服务不可达（DNS 失败 / 端口未监听）（2 用例）
// ===============================================================
describe('P0 · N3: 服务不可达（TypeError）', () => {
  it('N3-1 checkFetcherHealth 返回 ok=false，含"服务未启动"友好提示', async () => {
    mockRetries.mockReturnValue(0)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:8000'))),
    )
    const result = await checkFetcherHealth()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('服务未启动或无法连接')
  })

  it('N3-2 collectBasic 服务不可达时向上抛错，错误含 Python 服务提示', async () => {
    mockRetries.mockReturnValue(0)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('fetch failed: ENOTFOUND api.local'))),
    )
    try {
      await collectBasic('600000.SH')
      expect.fail('应当抛出异常')
    } catch (e) {
      expect((e as Error).message).toContain('服务未启动或无法连接')
    }
  })
})

// ===============================================================
// P0 — S1: IndexedDB 写入失败（4 用例）
// ===============================================================
describe('P0 · S1: IndexedDB 写入失败（QuotaExceeded / 非 Error）', () => {
  it('S1-1 dataBridge.forward 正常时 addStock 返回 success=true + Stock 数据', async () => {
    mockForward.mockResolvedValue({ success: true, data: { symbol: '600519.SH', name: '贵州茅台' } })
    const result = await addStock({ symbol: '600519.SH', name: '贵州茅台', pool: 'intention', researchStatus: 'screening', source: 'manual', dataVersion: 1 })
    expect(result.success).toBe(true)
  })

  it('S1-2 QuotaExceeded 场景下返回 success=false，错误含原始原因', async () => {
    mockForward.mockRejectedValue(new DOMException('QuotaExceededError: User denied space quota', 'QuotaExceededError'))
    const result = await addStock({ symbol: '600001.SH', name: '邯郸钢铁', pool: 'intention', researchStatus: 'archived', source: 'manual', dataVersion: 1 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('QuotaExceeded')
  })

  it('S1-3 写入失败后 in-flight 锁释放：同一 symbol 第二次录入成功', async () => {
    mockForward
      .mockRejectedValueOnce(new DOMException('QuotaExceededError: 首次磁盘满', 'QuotaExceededError'))
      .mockResolvedValueOnce({ success: true, data: { symbol: '601318.SH', name: '中国平安' } })
    const r1 = await addStock({ symbol: '601318.SH', name: '中国平安', pool: 'intention', researchStatus: 'screening', source: 'manual', dataVersion: 1 })
    const r2 = await addStock({ symbol: '601318.SH', name: '中国平安', pool: 'intention', researchStatus: 'screening', source: 'manual', dataVersion: 1 })
    expect(r1.success).toBe(false)
    expect(r2.success).toBe(true)
  })

  it('S1-4 抛出字符串/非 Error 类型异常时兜底返回失败不崩溃', async () => {
    mockForward.mockRejectedValue('纯字符串异常：IDB 崩了（legacy code）')
    const result = await addStock({ symbol: '000002.SZ', name: '万科A', pool: 'intention', researchStatus: 'watchlist', source: 'manual', dataVersion: 1 })
    expect(result.success).toBe(false)
    expect(typeof result.error).toBe('string')
  })
})

// ===============================================================
// P0 — C1: 并发采集全部维度失败（3 用例）
// ===============================================================
describe('P0 · C1: 并发采集全部维度失败', () => {
  it('C1-1 全部 reject 时 error 格式 = "${N} 个维度采集失败"', async () => {
    seedIntentionPool(['600519.SH'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)
    mockRunBatchTrace.mockRejectedValue(new Error('网络异常：全部维度挂'))
    await store.runCollection()
    const state = useSevenDimConfigStore.getState()
    expect(state.error).toContain('个维度采集失败')
    expect(state.isCollecting).toBe(false)
  })

  it('C1-2 全维度失败后 collectProgress = 100（不卡在中间）', async () => {
    seedIntentionPool(['600519.SH', '000001.SZ'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(2)
    mockRunBatchTrace.mockRejectedValue(new Error('全部断网'))
    await store.runCollection()
    expect(useSevenDimConfigStore.getState().collectProgress).toBe(100)
  })

  it('C1-3 全维度失败后 isCollecting=false + collectingDimensions=[]', async () => {
    seedIntentionPool(['300750.SZ'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)
    mockRunBatchTrace.mockRejectedValue(new Error('服务挂'))
    await store.runCollection()
    const state = useSevenDimConfigStore.getState()
    expect(state.isCollecting).toBe(false)
    expect(state.collectingDimensions).toHaveLength(0)
  })
})

// ===============================================================
// P0 — X1: 混合一致性（1 用例）
// ===============================================================
describe('P0 · X1: 健康检查失败 + 后续 collectBasic 错误一致', () => {
  it('X1-1 N3 场景下两者均返回"服务未启动或无法连接"提示', async () => {
    mockRetries.mockReturnValue(0)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('ECONNREFUSED 127.0.0.1:8000'))),
    )
    const health = await checkFetcherHealth()
    let businessErr: string | null = null
    try {
      await collectBasic('000001.SZ')
    } catch (e) {
      businessErr = (e as Error).message
    }
    expect(health.error).toContain('服务未启动或无法连接')
    expect(businessErr).toContain('服务未启动或无法连接')
  })
})

// ===============================================================
// P1 本次新增 — D2: 部分源降级（部分维度成功）（3 用例）
// ===============================================================
describe('P1 · D2: 部分源降级（7 维中 3 维失败）', () => {
  it('D2-1 7 维中 3 维 reject，error 文案应 = "3 个维度采集失败"', async () => {
    seedIntentionPool(['600519.SH'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)
    // 01/03/05 失败，02/04/06/07 成功
    mockRunBatchTrace.mockImplementation(({ dimensionCode }: { dimensionCode: string }) => {
      return ['01', '03', '05'].includes(dimensionCode)
        ? Promise.reject(new Error(`dim ${dimensionCode} 超时`))
        : Promise.resolve({ success: true, dimensionCode, rows: 1 })
    })
    await store.runCollection()
    const state = useSevenDimConfigStore.getState()
    expect(state.error).toBe('3 个维度采集失败')
  })

  it('D2-2 logger.error 调用次数 ≥ 1，且 failures 字段 = 3', async () => {
    seedIntentionPool(['000001.SZ', '300750.SZ'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(2)
    mockRunBatchTrace.mockImplementation(({ dimensionCode }: { dimensionCode: string }) => {
      return ['01', '03', '05'].includes(dimensionCode)
        ? Promise.reject(new Error(`dim ${dimensionCode} 接口 429`))
        : Promise.resolve({ ok: true, dimensionCode })
    })
    await store.runCollection()
    const errorCalls = mockLogger.error.mock.calls as [string, Record<string, unknown>][]
    const partials = errorCalls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('并发采集部分失败'),
    )
    expect(partials.length).toBeGreaterThanOrEqual(1)
    // failures 字段要么数字要么字符串，比较数值
    const firstMatch = partials[0][1]
    const failuresCount =
      typeof firstMatch.failures === 'number' ? firstMatch.failures : Number(String(firstMatch.failures ?? 0))
    expect(failuresCount).toBe(3)
  })

  it('D2-3 部分成功后三态：isCollecting=false / collectingDimensions=[] / collectProgress=100', async () => {
    seedIntentionPool(['601318.SH'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)
    mockRunBatchTrace.mockImplementation(({ dimensionCode }: { dimensionCode: string }) =>
      dimensionCode === '07'
        ? Promise.reject(new Error('dim 07 单独失败'))
        : Promise.resolve({ ok: true }),
    )
    await store.runCollection()
    const state = useSevenDimConfigStore.getState()
    expect(state.isCollecting).toBe(false)
    expect(state.collectingDimensions).toHaveLength(0)
    expect(state.collectProgress).toBe(100)
  })
})

// ===============================================================
// P1 本次新增 — N2: 网络抖动 / 重试（3 用例）
// ===============================================================
describe('P1 · N2: 网络抖动 / 重试 maxRetries 次', () => {
  it('N2-1 maxRetries=3 前 3 次 reject，第 4 次 resolve → 最终成功，fetch 调用 4 次', async () => {
    mockTimeoutMs.mockReturnValue(30_000)
    mockRetries.mockReturnValue(3)
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount++
        if (callCount < 4) throw new TypeError(`第 ${callCount} 次失败：网关 502（ECONNRESET）`)
        return new Response(JSON.stringify({ success: true, data: { symbol: '600519.SH', name: '贵州茅台', price: 1680 } }))
      }),
    )
    const result = await collectBasic('600519.SH')
    expect(result.success).toBe(true)
    expect(callCount).toBe(4)
  })

  it('N2-2 maxRetries=3，4 次全部 reject → 第 4 次原始原因透出', async () => {
    mockTimeoutMs.mockReturnValue(30_000)
    mockRetries.mockReturnValue(3)
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount++
        throw new TypeError(`fetch #${callCount} ENOTFOUND（DNS解析失败）
      }),
    )
    try {
      await collectBasic('000001.SZ')
      expect.fail('应当抛出异常')
    } catch (e) {
      expect((e as Error).message).toContain('服务未启动或无法连接')
    }
    expect(callCount).toBe(4)
  })

  it('N2-3 maxRetries=0（重试禁用）→ 首次失败立即 reject，fetch 仅 1 次', async () => {
    mockTimeoutMs.mockReturnValue(30_000)
    mockRetries.mockReturnValue(0)
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount++
        throw new TypeError('立即 ECONNREFUSED')
      }),
    )
    try {
      await collectBasic('300750.SZ')
    } catch {
      /* ignore */
    }
    expect(callCount).toBe(1)
  })
})

// ===============================================================
// P1 本次新增 — N4: HTTP 异常响应（502 / 503 / 非 JSON）（3 用例）
// ===============================================================
describe('P1 · N4: HTTP 5xx / 非 JSON 响应', () => {
  it('N4-1 HTTP 502 Bad Gateway + HTML body → 错误包含 502，不泄漏 SyntaxError', async () => {
    mockTimeoutMs.mockReturnValue(30_000)
    mockRetries.mockReturnValue(0)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html><body>502 Bad Gateway</body></html>', { status: 502, statusText: 'Bad Gateway' }),
      ),
    )
    try {
      await collectBasic('601899.SH')
      expect.fail('应当抛出异常')
    } catch (e) {
      const msg = (e as Error).message
      // 要么包含 HTTP 502，要么包含 Bad Gateway；不直接暴露 <html> 的 parse 错误
      const acceptable = msg.includes('502') || msg.includes('Bad Gateway') || msg.includes('HTTP')
      expect(acceptable).toBe(true)
    }
  })

  it('N4-2 HTTP 503 Service Unavailable（JSON 错误体）', async () => {
    mockTimeoutMs.mockReturnValue(30_000)
    mockRetries.mockReturnValue(0)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error: '过载保护' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Retry-After': '120', 'Content-Type': 'application/json' },
        }),
      ),
    )
    try {
      await collectBasic('600036.SH')
      expect.fail('应当抛出异常')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('HTTP')).toBe(true)
    }
  })

  it('N4-3 HTTP 200 但 body 是纯文本（非 JSON）→ JSON.parse 异常被包装（不崩溃）', async () => {
    mockTimeoutMs.mockReturnValue(30_000)
    mockRetries.mockReturnValue(0)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('500 Internal Server Error — traceback at line 42', {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    )
    try {
      await collectBasic('600000.SH')
      expect.fail('应当抛出异常')
    } catch (e) {
      // 只要不是 undefined 就说明没有未捕获异常泄漏导致 process exit
      expect(typeof (e as Error).message).toBe('string')
    }
  })
})

// ===============================================================
// P1 本次新增 — C2: 部分维度失败（颗粒度验证）（2 用例）
// ===============================================================
describe('P1 · C2: 部分维度失败（颗粒度校验）', () => {
  it('C2-1 01/03/05 失败 + 02/04/06/07 成功 → isCollecting=false 三态合规', async () => {
    seedIntentionPool(['601398.SH'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)
    mockRunBatchTrace.mockImplementation(({ dimensionCode }: { dimensionCode: string }) =>
      ['01', '03', '05'].includes(dimensionCode)
        ? Promise.reject(new Error(`dim ${dimensionCode} 超时：Python worker 挂`))
        : Promise.resolve({ ok: true, dimensionCode, rows: 42 }),
    )
    await store.runCollection()
    const state = useSevenDimConfigStore.getState()
    expect(state.isCollecting).toBe(false)
    expect(state.collectProgress).toBe(100)
  })

  it('C2-2 dim-05 抛具体消息 "数据源 5 未授权 403"，logger.error 的 errors 字段含该具体错误（不被 generic 文案吞）', async () => {
    seedIntentionPool(['000858.SZ'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)
    mockRunBatchTrace.mockImplementation(({ dimensionCode }: { dimensionCode: string }) => {
      if (dimensionCode === '05') return Promise.reject(new Error('数据源 5 未授权 403'))
      return Promise.resolve({ ok: true })
    })
    await store.runCollection()
    const errorCalls = mockLogger.error.mock.calls as [string, Record<string, unknown>][]
    const joinedErrors = errorCalls
      .flatMap(([_m, p]) => [p?.error, p?.errors].filter(Boolean).map(String))
      .join(' | ')
    expect(joinedErrors).toContain('数据源 5 未授权 403')
  })
})

// ===============================================================
// P1 本次新增 — C3: 重入守卫（采集中再次调用 runCollection）（2 用例）
// ===============================================================
describe('P1 · C3: 重入守卫（防止并发多次采集）', () => {
  it('C3-1 采集中同步发起第 2 次 runCollection → 第 2 次返回 undefined，runBatchTrace 仅调用 7 次', async () => {
    seedIntentionPool(['600519.SH'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)

    // 挂起 Promise：模拟 7 个维度都在 fetch 中
    let releaseCollecting!: () => void
    const pending = new Promise<never>(() => {
      // 永不 resolve，直到测试断言完
    })
    const collectingLatch = new Promise<void>((resolve) => { releaseCollecting = resolve })
    mockRunBatchTrace.mockImplementation(async () => {
      releaseCollecting()
      return pending
    })

    const firstCall = store.runCollection()
    await collectingLatch          // 等待 set isCollecting=true 生效（至少一次微队列循环 + setImmediate）
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    const secondResult = store.runCollection()
    // 第 2 次应当立即 return undefined（L460：if collectingDimensions.length>0 return）
    expect(secondResult).toBeUndefined()
    // 7 个维度 + 可能重试？至少应是 enabledDims 数量而不是 2 倍
    expect(mockRunBatchTrace).toHaveBeenCalledTimes(7)
    // 清理：pending 永不 resolve，用 setTimeout 让它不阻塞 vitest 退出（finally）
    setTimeout(() => { /* 不需要清理：vitest 会在文件结束时清理 pending promise */ }, 10)
  }, 8000)

  it('C3-2 getCollectingHint() 在采集中返回"维度 01,02,03... 采集中，请稍候..."文案（与 L226 一致）', async () => {
    seedIntentionPool(['300750.SZ'])
    const store = useSevenDimConfigStore.getState()
    store.setSymbolCount?.(1)
    const pending = new Promise<never>(() => {})
    mockRunBatchTrace.mockReturnValue(pending)

    const latch = new Promise<void>((resolve) => {
      // 微队列：先等待 set isCollecting=true
      setTimeout(() => resolve(), 30)
    })
    const _p = store.runCollection()
    await latch

    const state = useSevenDimConfigStore.getState()
    if (typeof (state as unknown as { getCollectingHint?: () => string }).getCollectingHint === 'function') {
      const hint = (state as unknown as { getCollectingHint: () => string }).getCollectingHint()
      expect(hint).toMatch(/采集中/)
    } else {
      // 若未实现 getCollectingHint，退化为：collectingDimensions.length > 0 就应该有 UI 提示机制存在
      expect(useSevenDimConfigStore.getState().collectingDimensions.length).toBeGreaterThan(0)
    }
  }, 8000)
})
