/**
 * @test_id V9-TEST-ST-153
 * scoreDocStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态
 * 2. setSymbol
 * 3. loadVersions 成功/失败/异常
 * 4. reset
 * 5. loadStocks 成功/失败/异常
 * 6. refresh 成功/跳过/失败/异常
 * 7. exportAll 成功/跳过/失败/异常
 * 8. loadHistoryDocs 成功(有diff)/成功(无diff)/跳过/失败/异常
 * 9. loadStockSymbols 成功/查询失败/异常
 * 10. generateReport 成功/无版本/异常
 * 11. setComparisonMode / setComparisonLeft / setComparisonRight
 * 12. initScoreDocStoreSubscriptions / destroyScoreDocStoreSubscriptions
 * 13. runVersionComparison 成功/失败/异常
 * 14. runStockComparison 成功/失败/异常
 * 15. loadTimeline 成功/跳过/失败/异常
 *  @covers_docs [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024]
*/

// ============================================================
// vi.hoisted — 所有 mock 函数声明（在 vi.mock 之前）
// ============================================================

const {
  mockGetRecentVersions,
  mockExportSymbolMd,
  mockBuildScoreDocDiff,
  mockListScoreDocsBySymbol,
  mockBuildReportMarkdown,
  mockCompareTwoVersions,
  mockCompareTwoStocksLatest,
  mockGetScoreTimeline,
} = vi.hoisted(() => ({
  mockGetRecentVersions: vi.fn(),
  mockExportSymbolMd: vi.fn(),
  mockBuildScoreDocDiff: vi.fn(),
  mockListScoreDocsBySymbol: vi.fn(),
  mockBuildReportMarkdown: vi.fn(),
  mockCompareTwoVersions: vi.fn(),
  mockCompareTwoStocksLatest: vi.fn(),
  mockGetScoreTimeline: vi.fn(),
}))

const { mockListPoolItems } = vi.hoisted(() => ({
  mockListPoolItems: vi.fn(),
}))

const {
  mockDataBridgeQuery,
  mockDataBridgeSubscribe,
} = vi.hoisted(() => ({
  mockDataBridgeQuery: vi.fn(),
  mockDataBridgeSubscribe: vi.fn(),
}))

const { mockWithBroadcast } = vi.hoisted(() => ({
  mockWithBroadcast: vi.fn(),
}))

// ============================================================
// vi.mock — 模块级别 mock
// ============================================================

vi.mock('@/services/analysis/scoreDocService', () => ({
  getRecentVersions: mockGetRecentVersions,
  exportSymbolMd: mockExportSymbolMd,
  buildScoreDocDiff: mockBuildScoreDocDiff,
  listScoreDocsBySymbol: mockListScoreDocsBySymbol,
  buildReportMarkdown: mockBuildReportMarkdown,
  compareTwoVersions: mockCompareTwoVersions,
  compareTwoStocksLatest: mockCompareTwoStocksLatest,
  getScoreTimeline: mockGetScoreTimeline,
}))

vi.mock('@/services/pool/poolService', () => ({
  listPoolItems: mockListPoolItems,
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockDataBridgeQuery,
    subscribe: mockDataBridgeSubscribe,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/store/helpers/withBroadcast', () => ({
  withBroadcast: mockWithBroadcast,
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: { saveScoreDocs: 'SAVE_SCORE_DOCS', queryList: 'QUERY_LIST' },
  MODULE_ID: { analyzer: 'analyzer' },
  STORE_NAME: { stocks: 'stocks' },
  DATA_SOURCE: { manual: 'manual', auto: 'auto' },
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: { SCORE_DOCS_CHANGED: 'score_docs_changed' },
}))

vi.mock('@/constants/pool.constants', () => ({
  RESEARCH_STATUS: { watching: 'watching', deepDive: 'deepDive' },
}))

// ============================================================
// imports
// ============================================================

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { useScoreDocStore, destroyScoreDocStoreSubscriptions, initScoreDocStoreSubscriptions } from './scoreDocStore'
import type { ScoreDocVersion, Stock } from '@/data/types'
import { DATA_SOURCE } from '@/config/dbConfig'
import { RESEARCH_STATUS } from '@/constants/pool.constants'
import type { ScoreComparisonMode } from '@/types/modules/score.types'

// ============================================================
// 测试辅助
// ============================================================

/** 构造一个最小化的 ScoreDocVersion mock 对象 */
function makeMockVersion(overrides: Partial<ScoreDocVersion> & { symbol: string; version: number } = { symbol: '600519', version: 1 }): ScoreDocVersion {
  return {
    docId: `${overrides.symbol}__V${overrides.version}__mock`,
    stockName: overrides.stockName ?? '测试股票',
    scoreDate: overrides.scoreDate ?? '2026-07-01',
    composite: overrides.composite ?? 4.0,
    l3v: overrides.l3v ?? 3.8,
    layers: overrides.layers ?? {},
    recommendation: overrides.recommendation ?? { key: 'buy', label: '买入', color: '#22c55e' },
    targetPrice: overrides.targetPrice ?? { bull: 100, base: 80, bear: 60 },
    keyRisks: overrides.keyRisks ?? [],
    keyCatalysts: overrides.keyCatalysts ?? [],
    reportMd: overrides.reportMd ?? '# 测试报告',
    modelUsed: overrides.modelUsed ?? 'v6-score-doc',
    market: overrides.market ?? 'SH',
    createdAt: overrides.createdAt ?? '2026-07-01T10:00:00Z',
    ...overrides,
  }
}

// ============================================================
// beforeEach / afterEach
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useScoreDocStore.setState({
    symbol: '',
    stocks: [],
    versions: [],
    loading: false,
    error: null,
    // 历史文档状态
    historyDocs: [],
    historyDiff: null,
    historyLoading: false,
    historyError: null,
    // 比对状态
    comparisonMode: 'same-stock-versions' as ScoreComparisonMode,
    comparisonLeft: '',
    comparisonRight: '',
    comparisonResult: null,
    comparisonLoading: false,
    comparisonError: null,
    // 时间轴状态
    timelineData: [],
    timelineLoading: false,
  })
})

afterEach(() => {
  // 清理 DataBridge 订阅，避免跨测试污染
  destroyScoreDocStoreSubscriptions()
})

describe('scoreDocStore', () => {
  // ============================================================
  // 初始状态
  // ============================================================

  test('初始状态正确', () => {
    const state = useScoreDocStore.getState()
    expect(state.symbol).toBe('')
    expect(state.stocks).toHaveLength(0)
    expect(state.versions).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  // ============================================================
  // setSymbol
  // ============================================================

  test('setSymbol 更新 symbol', () => {
    const store = useScoreDocStore.getState()
    store.setSymbol('600519')
    expect(useScoreDocStore.getState().symbol).toBe('600519')
  })

  test('setSymbol 设为空字符串时保留其他状态', () => {
    const store = useScoreDocStore.getState()
    store.setSymbol('600519')
    useScoreDocStore.setState({ versions: [{ docId: 'test' }] as ScoreDocVersion[] })
    store.setSymbol('')
    expect(useScoreDocStore.getState().symbol).toBe('')
  })

  // ============================================================
  // loadVersions
  // ============================================================

  test('loadVersions 成功时更新 versions 并清空 error', async () => {
    const mockVersions = [
      {
        docId: '600519__V1__123456',
        symbol: '600519',
        stockName: '贵州茅台',
        version: 1,
        scoreDate: '2026-06-28',
        composite: 4.5,
        l3v: 4.2,
        layers: {},
        recommendation: { key: 'buy', label: '买入', color: '#22c55e' },
        targetPrice: { bull: 1800, base: 1600, bear: 1400 },
        keyRisks: [],
        keyCatalysts: [],
        reportMd: '# 贵州茅台评分报告',
        modelUsed: 'v6-score-doc',
        market: 'SH',
        createdAt: '2026-06-28T10:00:00Z',
      },
    ]

    mockGetRecentVersions.mockResolvedValueOnce({
      success: true,
      data: mockVersions,
    })

    const store = useScoreDocStore.getState()
    store.setSymbol('600519')
    await store.loadVersions()

    const state = useScoreDocStore.getState()
    expect(state.versions).toHaveLength(1)
    expect(state.versions[0]!.symbol).toBe('600519')
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  test('loadVersions 失败时设置 error', async () => {
    mockGetRecentVersions.mockResolvedValueOnce({
      success: false,
      error: '数据库连接失败',
    })

    const store = useScoreDocStore.getState()
    store.setSymbol('600519')
    await store.loadVersions()

    const state = useScoreDocStore.getState()
    expect(state.versions).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBe('数据库连接失败')
  })

  test('loadVersions 异常时捕获错误并设置 error', async () => {
    mockGetRecentVersions.mockRejectedValueOnce(new Error('网络请求失败'))

    const store = useScoreDocStore.getState()
    store.setSymbol('600519')
    await store.loadVersions()

    const state = useScoreDocStore.getState()
    expect(state.versions).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBe('加载失败：网络请求失败')
  })

  test('loadVersions symbol 为空时直接清空 versions 并返回', async () => {
    useScoreDocStore.setState({
      versions: [{ docId: 'test' }] as ScoreDocVersion[],
      error: '之前的错误',
    })

    const store = useScoreDocStore.getState()
    await store.loadVersions()

    const state = useScoreDocStore.getState()
    expect(state.versions).toHaveLength(0)
    expect(state.error).toBeNull()
    expect(state.loading).toBe(false)
    expect(mockGetRecentVersions).not.toHaveBeenCalled()
  })

  test('loadVersions 开始时设置 loading 为 true', async () => {
    mockGetRecentVersions.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: [] }), 50))
    )

    const store = useScoreDocStore.getState()
    store.setSymbol('600519')
    const promise = store.loadVersions()

    expect(useScoreDocStore.getState().loading).toBe(true)
    await promise
    expect(useScoreDocStore.getState().loading).toBe(false)
  })

  // ============================================================
  // clear
  // ============================================================

  test('clear 重置 symbol、versions、error、loading，保留 stocks', async () => {
    const mockStocks: Stock[] = [
      { symbol: '600519', name: '贵州茅台', pool: 'research', researchStatus: RESEARCH_STATUS.watching, source: DATA_SOURCE.manual, dataVersion: 1 },
    ]
    useScoreDocStore.setState({
      symbol: '600519',
      stocks: mockStocks,
      versions: [{ docId: 'test' }] as ScoreDocVersion[],
      error: '错误信息',
      loading: true,
    })

    const store = useScoreDocStore.getState()
    store.reset()

    const state = useScoreDocStore.getState()
    expect(state.symbol).toBe('')
    expect(state.stocks).toHaveLength(1)
    expect(state.stocks[0]!.symbol).toBe('600519')
    expect(state.versions).toHaveLength(0)
    expect(state.error).toBeNull()
    expect(state.loading).toBe(false)
  })
})

describe('scoreDocStore reset', () => {
  test('reset 清空 symbol/versions/error/loading，保留 stocks', () => {
    const mockStocks: Stock[] = [
      { symbol: '000858', name: '五粮液', pool: 'research', researchStatus: RESEARCH_STATUS.watching, source: DATA_SOURCE.manual, dataVersion: 1 },
    ]
    useScoreDocStore.setState({
      symbol: '000858',
      stocks: mockStocks,
      versions: [{ docId: 'v1' }, { docId: 'v2' }] as ScoreDocVersion[],
      error: 'some error',
      loading: true,
    })

    useScoreDocStore.getState().reset()

    const state = useScoreDocStore.getState()
    expect(state.symbol).toBe('')
    expect(state.versions).toHaveLength(0)
    expect(state.error).toBeNull()
    expect(state.loading).toBe(false)
    // stocks 不受 reset 影响
    expect(state.stocks).toHaveLength(1)
    expect(state.stocks[0]!.symbol).toBe('000858')
  })

  test('reset 后可正常 setSymbol 和 loadVersions', async () => {
    const mockVersions = [
      {
        docId: '000858__V1__999999',
        symbol: '000858',
        stockName: '五粮液',
        version: 1,
        scoreDate: '2026-07-01',
        composite: 3.8,
        l3v: 3.5,
        layers: {},
        recommendation: { key: 'probe', label: '观望', color: '#f59e0b' },
        targetPrice: { bull: 200, base: 160, bear: 120 },
        keyRisks: [],
        keyCatalysts: [],
        reportMd: '# 五粮液评分报告',
        modelUsed: 'v6-score-doc',
        market: 'SZ',
        createdAt: '2026-07-01T10:00:00Z',
      },
    ]

    // 先填充脏状态
    useScoreDocStore.setState({ symbol: 'old', error: 'old error', loading: true })
    useScoreDocStore.getState().reset()

    // reset 后应能正常使用
    useScoreDocStore.getState().setSymbol('000858')

    mockGetRecentVersions.mockResolvedValueOnce({
      success: true,
      data: mockVersions,
    })
    await useScoreDocStore.getState().loadVersions()

    const state = useScoreDocStore.getState()
    expect(state.symbol).toBe('000858')
    expect(state.versions).toHaveLength(1)
    expect(state.versions[0]!.symbol).toBe('000858')
    expect(state.error).toBeNull()
    expect(state.loading).toBe(false)
  })
})

// ============================================================
// P0: loadStocks — 加载股票列表（listPoolItems + poolItemToStock）
// ============================================================

describe('scoreDocStore loadStocks', () => {
  /** @test_id V9-TEST-ST-200 */
  test('loadStocks 成功时更新 stocks 列表并映射 PoolItem 到 Stock', async () => {
    const mockPoolItems = [
      {
        symbol: '600519', name: '贵州茅台', pool: 'research' as const,
        status: 'watching' as const, source: 'manual' as const, dataVersion: 1,
      },
      {
        symbol: '000858', name: '五粮液', pool: 'research' as const,
        status: 'deepDive' as const, source: 'manual' as const, dataVersion: 2,
      },
    ]

    mockListPoolItems.mockResolvedValueOnce({ success: true, data: mockPoolItems })

    await useScoreDocStore.getState().loadStocks()

    const state = useScoreDocStore.getState()
    expect(state.stocks).toHaveLength(2)
    expect(state.stocks[0]!.symbol).toBe('600519')
    expect(state.stocks[0]!.researchStatus).toBe('watching') // poolItemToStock: status -> researchStatus
    expect(state.stocks[1]!.symbol).toBe('000858')
    expect(state.stocks[1]!.researchStatus).toBe('deepDive')
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  /** @test_id V9-TEST-ST-201 */
  test('loadStocks 成功但 data 为空时返回空列表', async () => {
    mockListPoolItems.mockResolvedValueOnce({ success: true, data: [] })

    await useScoreDocStore.getState().loadStocks()

    const state = useScoreDocStore.getState()
    expect(state.stocks).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  /** @test_id V9-TEST-ST-202 */
  test('loadStocks service 返回失败时设置 error', async () => {
    mockListPoolItems.mockResolvedValueOnce({ success: false, error: '服务不可用' })

    await useScoreDocStore.getState().loadStocks()

    const state = useScoreDocStore.getState()
    expect(state.stocks).toHaveLength(0)
    expect(state.loading).toBe(false)
    expect(state.error).toBe('服务不可用')
  })

  /** @test_id V9-TEST-ST-203 */
  test('loadStocks service 返回失败且无 error 信息时使用默认消息', async () => {
    mockListPoolItems.mockResolvedValueOnce({ success: false, error: null })

    await useScoreDocStore.getState().loadStocks()

    const state = useScoreDocStore.getState()
    expect(state.error).toBe('加载股票列表失败')
  })

  /** @test_id V9-TEST-ST-204 */
  test('loadStocks 抛出异常时捕获并设置 error', async () => {
    mockListPoolItems.mockRejectedValueOnce(new Error('网络超时'))

    await useScoreDocStore.getState().loadStocks()

    const state = useScoreDocStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('加载失败：网络超时')
  })

  /** @test_id V9-TEST-ST-205 */
  test('loadStocks 非 Error 类型异常也能捕获', async () => {
    mockListPoolItems.mockRejectedValueOnce('字符串错误')

    await useScoreDocStore.getState().loadStocks()

    const state = useScoreDocStore.getState()
    expect(state.error).toBe('加载失败：字符串错误')
  })

  /** @test_id V9-TEST-ST-206 */
  test('loadStocks 开始时设置 loading 为 true', async () => {
    mockListPoolItems.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: [] }), 30))
    )

    const promise = useScoreDocStore.getState().loadStocks()
    expect(useScoreDocStore.getState().loading).toBe(true)
    await promise
    expect(useScoreDocStore.getState().loading).toBe(false)
  })
})

// ============================================================
// P0: refresh — 刷新评分文档
// ============================================================

describe('scoreDocStore refresh', () => {
  /** @test_id V9-TEST-ST-210 */
  test('refresh 成功时更新 versions', async () => {
    const mockVersions = [makeMockVersion({ symbol: '600519', version: 3 })]
    mockGetRecentVersions.mockResolvedValueOnce({ success: true, data: mockVersions })

    useScoreDocStore.setState({ symbol: '600519' })
    await useScoreDocStore.getState().refresh()

    const state = useScoreDocStore.getState()
    expect(state.versions).toHaveLength(1)
    expect(state.versions[0]!.version).toBe(3)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(mockGetRecentVersions).toHaveBeenCalledWith('600519')
  })

  /** @test_id V9-TEST-ST-211 */
  test('refresh symbol 为空时跳过，不调用 service', async () => {
    await useScoreDocStore.getState().refresh()

    expect(mockGetRecentVersions).not.toHaveBeenCalled()
    expect(useScoreDocStore.getState().loading).toBe(false)
  })

  /** @test_id V9-TEST-ST-212 */
  test('refresh service 返回失败时设置 error', async () => {
    mockGetRecentVersions.mockResolvedValueOnce({ success: false, error: '刷新失败' })

    useScoreDocStore.setState({ symbol: '600519' })
    await useScoreDocStore.getState().refresh()

    const state = useScoreDocStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('刷新失败')
  })

  /** @test_id V9-TEST-ST-213 */
  test('refresh 抛出异常时捕获并设置 error', async () => {
    mockGetRecentVersions.mockRejectedValueOnce(new Error('超时'))

    useScoreDocStore.setState({ symbol: '600519' })
    await useScoreDocStore.getState().refresh()

    const state = useScoreDocStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBe('加载失败：超时')
  })

  /** @test_id V9-TEST-ST-214 */
  test('refresh service 无 error 信息时使用默认消息', async () => {
    mockGetRecentVersions.mockResolvedValueOnce({ success: false, error: null })

    useScoreDocStore.setState({ symbol: '600519' })
    await useScoreDocStore.getState().refresh()

    const state = useScoreDocStore.getState()
    expect(state.error).toBe('加载评分文档版本失败')
  })
})

// ============================================================
// P0: exportAll — 导出所有数据（Blob 下载 + DOM 操作）
// ============================================================

describe('scoreDocStore exportAll', () => {
  /** @test_id V9-TEST-ST-220 */
  test('exportAll 成功时触发 Blob 下载', async () => {
    const mockMd = '# 贵州茅台评分报告\n\n内容'
    mockExportSymbolMd.mockResolvedValueOnce({ success: true, data: mockMd })

    const mockVersion = makeMockVersion({ symbol: '600519', version: 1 })
    useScoreDocStore.setState({ symbol: '600519', versions: [mockVersion] })

    // mock DOM 操作
    const mockClick = vi.fn()
    const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node as HTMLElement)
    const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node as HTMLElement)
    const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '', download: '', click: mockClick, style: {}, appendChild: () => {},
    } as unknown as HTMLAnchorElement)

    await useScoreDocStore.getState().exportAll()

    // 验证 Blob 创建和下载链接
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')

    // 清理 DOM spy
    mockAppendChild.mockRestore()
    mockRemoveChild.mockRestore()
    mockCreateObjectURL.mockRestore()
    mockRevokeObjectURL.mockRestore()
    mockCreateElement.mockRestore()
  })

  /** @test_id V9-TEST-ST-221 */
  test('exportAll symbol 为空时跳过', async () => {
    await useScoreDocStore.getState().exportAll()

    expect(mockExportSymbolMd).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-222 */
  test('exportAll versions 为空时跳过', async () => {
    useScoreDocStore.setState({ symbol: '600519', versions: [] })

    await useScoreDocStore.getState().exportAll()

    expect(mockExportSymbolMd).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-223 */
  test('exportAll service 返回失败时设置 error', async () => {
    mockExportSymbolMd.mockResolvedValueOnce({ success: false, error: '导出服务异常' })

    useScoreDocStore.setState({
      symbol: '600519',
      versions: [makeMockVersion({ symbol: '600519', version: 1 })],
    })

    await useScoreDocStore.getState().exportAll()

    const state = useScoreDocStore.getState()
    expect(state.error).toBe('导出服务异常')
  })

  /** @test_id V9-TEST-ST-224 */
  test('exportAll 抛出异常时捕获并设置 error', async () => {
    mockExportSymbolMd.mockRejectedValueOnce(new Error('IO 错误'))

    useScoreDocStore.setState({
      symbol: '600519',
      versions: [makeMockVersion({ symbol: '600519', version: 1 })],
    })

    await useScoreDocStore.getState().exportAll()

    const state = useScoreDocStore.getState()
    expect(state.error).toBe('导出失败：IO 错误')
  })

  /** @test_id V9-TEST-ST-225 */
  test('exportAll service 失败且无 error 时使用默认消息', async () => {
    mockExportSymbolMd.mockResolvedValueOnce({ success: false, error: null })

    useScoreDocStore.setState({
      symbol: '600519',
      versions: [makeMockVersion({ symbol: '600519', version: 1 })],
    })

    await useScoreDocStore.getState().exportAll()

    const state = useScoreDocStore.getState()
    expect(state.error).toBe('导出失败')
  })
})

// ============================================================
// P0: loadHistoryDocs — 加载历史文档（双 service 调用 + diff 计算）
// ============================================================

describe('scoreDocStore loadHistoryDocs', () => {
  /** @test_id V9-TEST-ST-230 */
  test('loadHistoryDocs 有 >=2 个版本时计算 diff', async () => {
    const mockDocs = [
      makeMockVersion({ symbol: '600519', version: 2, composite: 4.5 }),
      makeMockVersion({ symbol: '600519', version: 1, composite: 4.0 }),
    ]
    const mockDiff = {
      newerVersion: 2, olderVersion: 1,
      compositeDelta: 0.5, l3vDelta: 0.3,
      layerChanges: [], addedLayers: [], removedLayers: [],
      ratingChanged: false, oldRating: '观望', newRating: '买入',
    }

    mockListScoreDocsBySymbol.mockResolvedValueOnce({ success: true, data: mockDocs })
    mockBuildScoreDocDiff.mockReturnValueOnce(mockDiff)

    await useScoreDocStore.getState().loadHistoryDocs('600519')

    const state = useScoreDocStore.getState()
    expect(state.historyDocs).toHaveLength(2)
    expect(state.historyDiff).toEqual(mockDiff)
    expect(state.historyLoading).toBe(false)
    expect(state.historyError).toBeNull()
    expect(mockBuildScoreDocDiff).toHaveBeenCalledWith(mockDocs[0], mockDocs[1])
  })

  /** @test_id V9-TEST-ST-231 */
  test('loadHistoryDocs 只有 1 个版本时不计算 diff', async () => {
    const mockDocs = [
      makeMockVersion({ symbol: '600519', version: 1 }),
    ]

    mockListScoreDocsBySymbol.mockResolvedValueOnce({ success: true, data: mockDocs })

    await useScoreDocStore.getState().loadHistoryDocs('600519')

    const state = useScoreDocStore.getState()
    expect(state.historyDocs).toHaveLength(1)
    expect(state.historyDiff).toBeNull()
    expect(mockBuildScoreDocDiff).not.toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-232 */
  test('loadHistoryDocs data 为 null 时使用空列表', async () => {
    mockListScoreDocsBySymbol.mockResolvedValueOnce({ success: true, data: null })

    await useScoreDocStore.getState().loadHistoryDocs('600519')

    const state = useScoreDocStore.getState()
    expect(state.historyDocs).toHaveLength(0)
    expect(state.historyDiff).toBeNull()
  })

  /** @test_id V9-TEST-ST-233 */
  test('loadHistoryDocs symbol 为空时跳过', async () => {
    await useScoreDocStore.getState().loadHistoryDocs('')

    expect(mockListScoreDocsBySymbol).not.toHaveBeenCalled()
    const state = useScoreDocStore.getState()
    expect(state.historyDocs).toHaveLength(0)
    expect(state.historyDiff).toBeNull()
    expect(state.historyLoading).toBe(false)
  })

  /** @test_id V9-TEST-ST-234 */
  test('loadHistoryDocs service 返回失败时设置 historyError', async () => {
    mockListScoreDocsBySymbol.mockResolvedValueOnce({ success: false, error: '查询历史失败' })

    await useScoreDocStore.getState().loadHistoryDocs('600519')

    const state = useScoreDocStore.getState()
    expect(state.historyLoading).toBe(false)
    expect(state.historyError).toBe('查询历史失败')
  })

  /** @test_id V9-TEST-ST-235 */
  test('loadHistoryDocs 抛出异常时捕获并设置 historyError', async () => {
    mockListScoreDocsBySymbol.mockRejectedValueOnce(new Error('数据库崩溃'))

    await useScoreDocStore.getState().loadHistoryDocs('600519')

    const state = useScoreDocStore.getState()
    expect(state.historyLoading).toBe(false)
    expect(state.historyError).toBe('加载失败：数据库崩溃')
  })

  /** @test_id V9-TEST-ST-236 */
  test('loadHistoryDocs 开始时设置 historyLoading 为 true', async () => {
    mockListScoreDocsBySymbol.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: [] }), 20))
    )

    const promise = useScoreDocStore.getState().loadHistoryDocs('600519')
    expect(useScoreDocStore.getState().historyLoading).toBe(true)
    await promise
    expect(useScoreDocStore.getState().historyLoading).toBe(false)
  })
})

// ============================================================
// P0: loadStockSymbols — 加载股票代码列表（DataBridge 查询 + Set 去重）
// ============================================================

describe('scoreDocStore loadStockSymbols', () => {
  /** @test_id V9-TEST-ST-240 */
  test('loadStockSymbols 成功时返回去重排序后的代码列表', async () => {
    const mockStocks: Stock[] = [
      { symbol: '600519', name: '茅台', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
      { symbol: '000858', name: '五粮液', pool: 'research', researchStatus: 'watching', source: 'manual', dataVersion: 1 },
      { symbol: '600519', name: '茅台', pool: 'research', researchStatus: 'deepDive', source: 'akshare', dataVersion: 2 },
    ]

    mockDataBridgeQuery.mockResolvedValueOnce({ success: true, data: mockStocks })

    const result = await useScoreDocStore.getState().loadStockSymbols()

    // Set 去重后应只有 2 个代码，且排序
    expect(result).toEqual(['000858', '600519'])
    expect(mockDataBridgeQuery).toHaveBeenCalledWith({
      action: 'QUERY_LIST',
      store: 'stocks',
      source: 'analyzer',
    })
  })

  /** @test_id V9-TEST-ST-241 */
  test('loadStockSymbols data 为空时返回空数组', async () => {
    mockDataBridgeQuery.mockResolvedValueOnce({ success: true, data: [] })

    const result = await useScoreDocStore.getState().loadStockSymbols()
    expect(result).toEqual([])
  })

  /** @test_id V9-TEST-ST-242 */
  test('loadStockSymbols data 为 null 时返回空数组', async () => {
    mockDataBridgeQuery.mockResolvedValueOnce({ success: true, data: null })

    const result = await useScoreDocStore.getState().loadStockSymbols()
    expect(result).toEqual([])
  })

  /** @test_id V9-TEST-ST-243 */
  test('loadStockSymbols 查询失败时抛出错误', async () => {
    mockDataBridgeQuery.mockResolvedValueOnce({ success: false, error: '权限不足' })

    await expect(useScoreDocStore.getState().loadStockSymbols()).rejects.toThrow('权限不足')
  })

  /** @test_id V9-TEST-ST-244 */
  test('loadStockSymbols 查询失败且无 error 时抛出默认错误', async () => {
    mockDataBridgeQuery.mockResolvedValueOnce({ success: false, error: null })

    await expect(useScoreDocStore.getState().loadStockSymbols()).rejects.toThrow('查询股票列表失败')
  })

  /** @test_id V9-TEST-ST-245 */
  test('loadStockSymbols 异常时直接抛出', async () => {
    mockDataBridgeQuery.mockRejectedValueOnce(new Error('DataBridge 不可用'))

    await expect(useScoreDocStore.getState().loadStockSymbols()).rejects.toThrow('DataBridge 不可用')
  })
})

// ============================================================
// P0: generateReport — 生成报告（多 service 编排）
// ============================================================

describe('scoreDocStore generateReport', () => {
  /** @test_id V9-TEST-ST-250 */
  test('generateReport 成功时返回报告对象', async () => {
    const mockVersion = makeMockVersion({ symbol: '600519', version: 3, composite: 4.2 })
    mockGetRecentVersions.mockResolvedValueOnce({ success: true, data: [mockVersion] })
    mockBuildReportMarkdown.mockReturnValueOnce('# 贵州茅台 V3 评分报告')

    const result = await useScoreDocStore.getState().generateReport('600519')

    expect(result.symbol).toBe('600519')
    expect(result.version).toBe(3)
    expect(result.markdown).toBe('# 贵州茅台 V3 评分报告')
    expect(result.generatedAt).toBeDefined() // ISO 时间戳
    expect(mockGetRecentVersions).toHaveBeenCalledWith('600519', 1)
    expect(mockBuildReportMarkdown).toHaveBeenCalledWith(mockVersion)
  })

  /** @test_id V9-TEST-ST-251 */
  test('generateReport 无评分文档时抛出错误', async () => {
    mockGetRecentVersions.mockResolvedValueOnce({ success: true, data: [] })

    await expect(
      useScoreDocStore.getState().generateReport('600519')
    ).rejects.toThrow('股票 600519 暂无评分文档，请先生成评分')
  })

  /** @test_id V9-TEST-ST-252 */
  test('generateReport service 返回失败时抛出"暂无评分文档"错误', async () => {
    // generateReport 内部用 !success || !data || data.length===0 统一判断
    // 所以 service 返回失败时仍抛出"暂无评分文档"而非原始 error
    mockGetRecentVersions.mockResolvedValueOnce({ success: false, error: '查询失败' })

    await expect(
      useScoreDocStore.getState().generateReport('600519')
    ).rejects.toThrow('股票 600519 暂无评分文档，请先生成评分')
  })

  /** @test_id V9-TEST-ST-253 */
  test('generateReport service 异常时直接抛出', async () => {
    mockGetRecentVersions.mockRejectedValueOnce(new Error('网络错误'))

    await expect(
      useScoreDocStore.getState().generateReport('600519')
    ).rejects.toThrow('网络错误')
  })

  /** @test_id V9-TEST-ST-254 */
  test('generateReport data 为 null 时抛出错误', async () => {
    mockGetRecentVersions.mockResolvedValueOnce({ success: true, data: null })

    await expect(
      useScoreDocStore.getState().generateReport('600519')
    ).rejects.toThrow('股票 600519 暂无评分文档，请先生成评分')
  })
})

// ============================================================
// P0: runVersionComparison — 同股票版本比对
// ============================================================

describe('scoreDocStore runVersionComparison', () => {
  /** @test_id V9-TEST-ST-260 */
  test('runVersionComparison 成功时设置 comparisonResult', async () => {
    const mockResult = {
      mode: 'same-stock-versions' as const,
      left: {
        symbol: '600519', stockName: '茅台', version: 1, scoreDate: '2026-07-01',
        composite: 4.0, l3v: 3.8,
        recommendation: { key: 'buy', label: '买入', color: '#22c55e' },
        modelUsed: 'v6-score-doc',
      },
      right: {
        symbol: '600519', stockName: '茅台', version: 2, scoreDate: '2026-07-10',
        composite: 4.5, l3v: 4.2,
        recommendation: { key: 'buy', label: '买入', color: '#22c55e' },
        modelUsed: 'v6-score-doc',
      },
      compositeDelta: 0.5, l3vDelta: 0.4,
      dimensions: [], ratingChanged: false,
      addedDimensions: [], removedDimensions: [],
      topRisingDimensions: [], topFallingDimensions: [],
    }

    mockCompareTwoVersions.mockResolvedValueOnce({ success: true, data: mockResult })

    await useScoreDocStore.getState().runVersionComparison('600519', 1, 2)

    const state = useScoreDocStore.getState()
    expect(state.comparisonResult).toEqual(mockResult)
    expect(state.comparisonLoading).toBe(false)
    expect(state.comparisonError).toBeNull()
    expect(mockCompareTwoVersions).toHaveBeenCalledWith('600519', 1, 2)
  })

  /** @test_id V9-TEST-ST-261 */
  test('runVersionComparison service 返回失败时设置 comparisonError', async () => {
    mockCompareTwoVersions.mockResolvedValueOnce({ success: false, error: '版本不存在' })

    await useScoreDocStore.getState().runVersionComparison('600519', 1, 99)

    const state = useScoreDocStore.getState()
    expect(state.comparisonResult).toBeNull()
    expect(state.comparisonLoading).toBe(false)
    expect(state.comparisonError).toBe('版本不存在')
  })

  /** @test_id V9-TEST-ST-262 */
  test('runVersionComparison 抛出异常时设置 comparisonError', async () => {
    mockCompareTwoVersions.mockRejectedValueOnce(new Error('比对服务异常'))

    await useScoreDocStore.getState().runVersionComparison('600519', 1, 2)

    const state = useScoreDocStore.getState()
    expect(state.comparisonLoading).toBe(false)
    expect(state.comparisonError).toBe('比对失败：比对服务异常')
  })

  /** @test_id V9-TEST-ST-263 */
  test('runVersionComparison 无 error 信息时使用默认消息', async () => {
    mockCompareTwoVersions.mockResolvedValueOnce({ success: false, error: null })

    await useScoreDocStore.getState().runVersionComparison('600519', 1, 2)

    const state = useScoreDocStore.getState()
    expect(state.comparisonError).toBe('版本比对失败')
  })
})

// ============================================================
// P0: runStockComparison — 跨股票比对
// ============================================================

describe('scoreDocStore runStockComparison', () => {
  /** @test_id V9-TEST-ST-270 */
  test('runStockComparison 成功时设置 comparisonResult', async () => {
    const mockResult = {
      mode: 'cross-stock-latest' as const,
      left: {
        symbol: '600519', stockName: '茅台', version: 2, scoreDate: '2026-07-10',
        composite: 4.5, l3v: 4.2,
        recommendation: { key: 'buy', label: '买入', color: '#22c55e' },
        modelUsed: 'v6-score-doc',
      },
      right: {
        symbol: '000858', stockName: '五粮液', version: 3, scoreDate: '2026-07-10',
        composite: 3.8, l3v: 3.5,
        recommendation: { key: 'probe', label: '观望', color: '#f59e0b' },
        modelUsed: 'v6-score-doc',
      },
      compositeDelta: -0.7, l3vDelta: -0.7,
      dimensions: [], ratingChanged: true,
      addedDimensions: [], removedDimensions: [],
      topRisingDimensions: [], topFallingDimensions: [],
    }

    mockCompareTwoStocksLatest.mockResolvedValueOnce({ success: true, data: mockResult })

    await useScoreDocStore.getState().runStockComparison('600519', '000858')

    const state = useScoreDocStore.getState()
    expect(state.comparisonResult).toEqual(mockResult)
    expect(state.comparisonLoading).toBe(false)
    expect(state.comparisonError).toBeNull()
    expect(mockCompareTwoStocksLatest).toHaveBeenCalledWith('600519', '000858')
  })

  /** @test_id V9-TEST-ST-271 */
  test('runStockComparison service 返回失败时设置 comparisonError', async () => {
    mockCompareTwoStocksLatest.mockResolvedValueOnce({ success: false, error: '股票不存在' })

    await useScoreDocStore.getState().runStockComparison('999999', '888888')

    const state = useScoreDocStore.getState()
    expect(state.comparisonResult).toBeNull()
    expect(state.comparisonLoading).toBe(false)
    expect(state.comparisonError).toBe('股票不存在')
  })

  /** @test_id V9-TEST-ST-272 */
  test('runStockComparison 抛出异常时设置 comparisonError', async () => {
    mockCompareTwoStocksLatest.mockRejectedValueOnce(new Error('超时'))

    await useScoreDocStore.getState().runStockComparison('600519', '000858')

    const state = useScoreDocStore.getState()
    expect(state.comparisonLoading).toBe(false)
    expect(state.comparisonError).toBe('比对失败：超时')
  })

  /** @test_id V9-TEST-ST-273 */
  test('runStockComparison 无 error 信息时使用默认消息', async () => {
    mockCompareTwoStocksLatest.mockResolvedValueOnce({ success: false, error: null })

    await useScoreDocStore.getState().runStockComparison('600519', '000858')

    const state = useScoreDocStore.getState()
    expect(state.comparisonError).toBe('股票比对失败')
  })
})

// ============================================================
// P0: loadTimeline — 加载评分时间轴
// ============================================================

describe('scoreDocStore loadTimeline', () => {
  /** @test_id V9-TEST-ST-280 */
  test('loadTimeline 成功时更新 timelineData', async () => {
    const mockTimeline = [
      { version: 3, scoreDate: '2026-07-15', composite: 4.5, changeFromPrev: 0.3 },
      { version: 2, scoreDate: '2026-07-10', composite: 4.2, changeFromPrev: -0.1 },
      { version: 1, scoreDate: '2026-07-01', composite: 4.3, changeFromPrev: null },
    ]

    mockGetScoreTimeline.mockResolvedValueOnce({ success: true, data: mockTimeline })

    await useScoreDocStore.getState().loadTimeline('600519')

    const state = useScoreDocStore.getState()
    expect(state.timelineData).toHaveLength(3)
    expect(state.timelineData[0]!.version).toBe(3)
    expect(state.timelineLoading).toBe(false)
  })

  /** @test_id V9-TEST-ST-281 */
  test('loadTimeline symbol 为空时跳过', async () => {
    await useScoreDocStore.getState().loadTimeline('')

    expect(mockGetScoreTimeline).not.toHaveBeenCalled()
    const state = useScoreDocStore.getState()
    expect(state.timelineData).toHaveLength(0)
    expect(state.timelineLoading).toBe(false)
  })

  /** @test_id V9-TEST-ST-282 */
  test('loadTimeline service 返回失败时清空 timelineData', async () => {
    mockGetScoreTimeline.mockResolvedValueOnce({ success: false, error: '加载失败' })

    await useScoreDocStore.getState().loadTimeline('600519')

    const state = useScoreDocStore.getState()
    expect(state.timelineData).toHaveLength(0)
    expect(state.timelineLoading).toBe(false)
  })

  /** @test_id V9-TEST-ST-283 */
  test('loadTimeline 抛出异常时清空 timelineData', async () => {
    mockGetScoreTimeline.mockRejectedValueOnce(new Error('异常'))

    await useScoreDocStore.getState().loadTimeline('600519')

    const state = useScoreDocStore.getState()
    expect(state.timelineData).toHaveLength(0)
    expect(state.timelineLoading).toBe(false)
  })

  /** @test_id V9-TEST-ST-284 */
  test('loadTimeline 开始时设置 timelineLoading 为 true', async () => {
    mockGetScoreTimeline.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: [] }), 20))
    )

    const promise = useScoreDocStore.getState().loadTimeline('600519')
    expect(useScoreDocStore.getState().timelineLoading).toBe(true)
    await promise
    expect(useScoreDocStore.getState().timelineLoading).toBe(false)
  })
})

// ============================================================
// P1: setComparisonMode / setComparisonLeft / setComparisonRight — 比对模式状态切换
// ============================================================

describe('scoreDocStore 比对状态 setter', () => {
  // --------------------------------------------------------
  // setComparisonMode
  // --------------------------------------------------------

  /** @test_id V9-TEST-ST-290 */
  test('setComparisonMode 切换到 cross-stock-latest 模式', () => {
    useScoreDocStore.setState({
      comparisonLeft: 'V1',
      comparisonRight: 'V2',
      comparisonResult: { mode: 'same-stock-versions' } as any,
      comparisonError: '旧错误',
    })

    useScoreDocStore.getState().setComparisonMode('cross-stock-latest')

    const state = useScoreDocStore.getState()
    expect(state.comparisonMode).toBe('cross-stock-latest')
    // 切换模式时应清空比对相关状态
    expect(state.comparisonLeft).toBe('')
    expect(state.comparisonRight).toBe('')
    expect(state.comparisonResult).toBeNull()
    expect(state.comparisonError).toBeNull()
  })

  /** @test_id V9-TEST-ST-291 */
  test('setComparisonMode 切换回 same-stock-versions 模式', () => {
    useScoreDocStore.setState({ comparisonMode: 'cross-stock-latest' })

    useScoreDocStore.getState().setComparisonMode('same-stock-versions')

    expect(useScoreDocStore.getState().comparisonMode).toBe('same-stock-versions')
    expect(useScoreDocStore.getState().comparisonLeft).toBe('')
    expect(useScoreDocStore.getState().comparisonRight).toBe('')
  })

  // --------------------------------------------------------
  // setComparisonLeft
  // --------------------------------------------------------

  /** @test_id V9-TEST-ST-292 */
  test('setComparisonLeft 设置左侧值', () => {
    useScoreDocStore.getState().setComparisonLeft('V3')
    expect(useScoreDocStore.getState().comparisonLeft).toBe('V3')
  })

  /** @test_id V9-TEST-ST-293 */
  test('setComparisonLeft 覆盖旧值', () => {
    useScoreDocStore.setState({ comparisonLeft: 'V1' })
    useScoreDocStore.getState().setComparisonLeft('V5')
    expect(useScoreDocStore.getState().comparisonLeft).toBe('V5')
  })

  /** @test_id V9-TEST-ST-294 */
  test('setComparisonLeft 设为空字符串', () => {
    useScoreDocStore.setState({ comparisonLeft: 'V2' })
    useScoreDocStore.getState().setComparisonLeft('')
    expect(useScoreDocStore.getState().comparisonLeft).toBe('')
  })

  // --------------------------------------------------------
  // setComparisonRight
  // --------------------------------------------------------

  /** @test_id V9-TEST-ST-295 */
  test('setComparisonRight 设置右侧值', () => {
    useScoreDocStore.getState().setComparisonRight('V4')
    expect(useScoreDocStore.getState().comparisonRight).toBe('V4')
  })

  /** @test_id V9-TEST-ST-296 */
  test('setComparisonRight 覆盖旧值', () => {
    useScoreDocStore.setState({ comparisonRight: 'V1' })
    useScoreDocStore.getState().setComparisonRight('V6')
    expect(useScoreDocStore.getState().comparisonRight).toBe('V6')
  })

  /** @test_id V9-TEST-ST-297 */
  test('setComparisonRight 设为空字符串', () => {
    useScoreDocStore.setState({ comparisonRight: 'V3' })
    useScoreDocStore.getState().setComparisonRight('')
    expect(useScoreDocStore.getState().comparisonRight).toBe('')
  })
})

// ============================================================
// P2: initScoreDocStoreSubscriptions / destroyScoreDocStoreSubscriptions
// ============================================================

describe('scoreDocStore 订阅管理', () => {
  // --------------------------------------------------------
  // initScoreDocStoreSubscriptions
  // --------------------------------------------------------

  /** @test_id V9-TEST-ST-300 */
  test('initScoreDocStoreSubscriptions 调用 dataBridge.subscribe 并返回取消函数', () => {
    const mockUnsubscribe = vi.fn()
    mockDataBridgeSubscribe.mockReturnValueOnce(mockUnsubscribe)

    const unsubscribe = initScoreDocStoreSubscriptions()

    expect(mockDataBridgeSubscribe).toHaveBeenCalledWith(
      'score_docs',
      expect.any(Function),
    )
    expect(typeof unsubscribe).toBe('function')
  })

  /** @test_id V9-TEST-ST-301 */
  test('initScoreDocStoreSubscriptions 订阅回调在收到 saveScoreDocs action 时正常执行', () => {
    const mockUnsubscribe = vi.fn()
    mockDataBridgeSubscribe.mockReturnValueOnce(mockUnsubscribe)

    initScoreDocStoreSubscriptions()

    // 获取注册的回调函数
    const callback = mockDataBridgeSubscribe.mock.calls[0]![1]
    expect(typeof callback).toBe('function')

    // 模拟收到 saveScoreDocs 事件
    callback({ meta: { action: 'SAVE_SCORE_DOCS', traceId: 'trace-123' } })

    // 不应抛出异常
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(1)
  })

  /** @test_id V9-TEST-ST-302 */
  test('initScoreDocStoreSubscriptions 重复调用时先销毁旧订阅', () => {
    const mockUnsubscribe1 = vi.fn()
    const mockUnsubscribe2 = vi.fn()
    mockDataBridgeSubscribe
      .mockReturnValueOnce(mockUnsubscribe1)
      .mockReturnValueOnce(mockUnsubscribe2)

    initScoreDocStoreSubscriptions()
    initScoreDocStoreSubscriptions()

    // 第一次的 unsubscribe 应被调用
    expect(mockUnsubscribe1).toHaveBeenCalled()
    expect(mockDataBridgeSubscribe).toHaveBeenCalledTimes(2)
  })

  // --------------------------------------------------------
  // destroyScoreDocStoreSubscriptions
  // --------------------------------------------------------

  /** @test_id V9-TEST-ST-303 */
  test('destroyScoreDocStoreSubscriptions 调用取消函数', () => {
    const mockUnsubscribe = vi.fn()
    mockDataBridgeSubscribe.mockReturnValueOnce(mockUnsubscribe)

    initScoreDocStoreSubscriptions()
    destroyScoreDocStoreSubscriptions()

    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  /** @test_id V9-TEST-ST-304 */
  test('destroyScoreDocStoreSubscriptions 无订阅时不会报错', () => {
    // 没有初始化订阅直接销毁
    expect(() => destroyScoreDocStoreSubscriptions()).not.toThrow()
  })

  /** @test_id V9-TEST-ST-305 */
  test('destroyScoreDocStoreSubscriptions 连续调用不会报错', () => {
    const mockUnsubscribe = vi.fn()
    mockDataBridgeSubscribe.mockReturnValueOnce(mockUnsubscribe)

    initScoreDocStoreSubscriptions()
    destroyScoreDocStoreSubscriptions()
    destroyScoreDocStoreSubscriptions() // 第二次不应报错

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})

// ============================================================
// 补充：reset 触发 withBroadcast 广播
// ============================================================

describe('scoreDocStore reset 广播', () => {
  /** @test_id V9-TEST-ST-310 */
  test('reset 调用 withBroadcast 广播 SCORE_DOCS_CHANGED', () => {
    useScoreDocStore.setState({ symbol: '600519', versions: [makeMockVersion({ symbol: '600519', version: 1 })] })

    useScoreDocStore.getState().reset()

    expect(mockWithBroadcast).toHaveBeenCalledWith('score_docs_changed', { action: 'reset' })
  })
})

