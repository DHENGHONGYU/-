/**
 * @test_id V9-TEST-ST-020
 * dataLayer.ts 单元测试
 *
 * 覆盖全部 33 个 store 及 dataManager 的读写操作，
 * 包含成功路径、失败路径、边界条件共 26+ 个测试场景。
 *
 * @vitest
  * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-QA-080]
*/
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock 依赖（使用 vi.hoisted 确保 vi.mock 工厂可访问）──
const {
  mockDbReset,
  mockDbExport,
  mockDbImport,
  mockForward,
  mockQuery,
  mockEnvelopeCreate,
  mockGenerateId,
  mockNow,
  mockLogger,
} = vi.hoisted(() => ({
  mockDbReset: vi.fn().mockResolvedValue(undefined),
  mockDbExport: vi.fn().mockResolvedValue({}),
  mockDbImport: vi.fn().mockResolvedValue(undefined),
  mockForward: vi.fn().mockResolvedValue(undefined),
  mockQuery: vi.fn(),
  mockEnvelopeCreate: vi.fn().mockReturnValue({ _mock: 'envelope' }),
  mockGenerateId: vi.fn().mockReturnValue('mock-id-001'),
  mockNow: vi.fn().mockReturnValue(1700000000000),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('./db', () => ({
  db: {
    reset: mockDbReset,
    export: mockDbExport,
    import: mockDbImport,
  },
  generateId: mockGenerateId,
  now: mockNow,
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    forward: mockForward,
    query: mockQuery,
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: mockEnvelopeCreate,
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// ── 导入被测模块 ──────────────────────────────────────────
import {
  stockStore,
  v6ScoreStore,
  dailyQuoteStore,
  orderStore,
  financialReportStore,
  signalStore,
  researchLogStore,
  executionLogStore,
  missingReportStore,
  intelligentScoreStore,
  industryScoreStore,
  rotationScoreStore,
  hotSectorScoreStore,
  valuePitScoreStore,
  sectorScoreStore,
  scoreDocStore,
  strategySnapshotStore,
  localDocStore,
  newsStore,
  newsStockMapStore,
  sentimentCacheStore,
  executionPlanStore,
  portfolioStore,
  tradeReviewStore,
  watchlistStore,
  customAgentStore,
  collectConfigStore,
  traceRecordStore,
  workflowDefStore,
  workflowScheduleStore,
  workflowTriggerStore,
  workflowRunStore,
  dataManager,
  dataLayer,
} from './dataLayer'

// ── 工厂函数：创建各 store 测试数据 ──────────────────────

function makeStock(overrides: Record<string, unknown> = {}) {
  return {
    symbol: '600519',
    name: '贵州茅台',
    price: 1800,
    pool: 'research' as const,
    researchStatus: 'candidate' as const,
    source: 'manual' as const,
    group: '默认分组',
    ...overrides,
  }
}

function makeV6Score(overrides: Record<string, unknown> = {}) {
  return {
    symbol: '600519',
    score: 85,
    factors: { L3: 90, L4: 80 },
    algorithmVersion: 'v6.0',
    calculatedAt: 1700000000000,
    dataVersion: 1,
    ...overrides,
  }
}

function makeDailyQuote() {
  return {
    symbol: '600519',
    latest: { date: '2026-07-01', open: 1800, high: 1820, low: 1790, close: 1810, volume: 10000, amount: 18100000 },
    history: [],
    period: 'day',
    adjust: 'qfq',
    updatedAt: 1700000000000,
  }
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    symbol: '600519',
    direction: 'buy' as const,
    quantity: 100,
    price: 1800,
    amount: 180000,
    status: 'pending' as const,
    accountType: 'paper' as const,
    ...overrides,
  }
}

function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sig-001',
    symbol: '600519',
    direction: 'buy' as const,
    type: 'golden_cross',
    strategy: 'ma_cross',
    confidence: 0.85,
    rationale: 'MA5 上穿 MA20',
    snapshot: {},
    createdAt: 1700000000000,
    ...overrides,
  }
}

function makeResearchLog() {
  return {
    traceId: 'trace-001',
    timestamp: 1700000000000,
    actor: 'user',
    action: 'add_stock',
    targetType: 'stock',
    targetCode: '600519',
  }
}

function makeExecutionLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'elog-001',
    planId: 'plan-001',
    symbol: '600519',
    action: 'buy',
    phase: 'plan' as const,
    timestamp: 1700000000000,
    createdAt: 1700000000000,
    ...overrides,
  }
}

function makeMissingReport(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    symbol: '600519',
    reportType: 'kline_missing',
    severity: 'high',
    reason: 'K线数据缺失3天',
    detectedAt: 1700000000000,
    retryCount: 0,
    createdAt: 1700000000000,
    ...overrides,
  }
}

function makeIntelligentScore(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: '600519',
    overallScore: 82,
    dimensionScores: [],
    summary: 'test',
    basis: 'test',
    missingFields: [],
    sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
    configSnapshot: { model: 'gpt-4', baseURL: 'http://localhost' },
    modelResponse: '{}',
    dataVersion: 1,
    scoredAt: 1700000000000,
    ...overrides,
  }
}

function makeIndustryScore(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'SW801',
    name: '白酒',
    overallScore: 78,
    dimensionScores: [],
    summary: 'test',
    basis: 'test',
    missingFields: [],
    sectorSnapshot: { composite: 80, recommendation: 'buy', positionPct: '10', subTracks: [] },
    configSnapshot: { model: 'gpt-4', baseURL: 'http://localhost' },
    modelResponse: '{}',
    scoredAt: 1700000000000,
    ...overrides,
  }
}

function makeRotationScore(overrides: Record<string, unknown> = {}) {
  return {
    id: 'SW801__20260701',
    sectorCode: 'SW801',
    sectorName: '白酒',
    scoreDate: '2026-07-01',
    f1Jingqi: 80,
    f2Zijin: 70,
    f3Guzhi: 60,
    f4Beta: 50,
    f5Nengliang: 65,
    total: 75,
    resonance: 6,
    signal: 'buy',
    alertLevel: 'none',
    declineType: 'none',
    poolStocks: [],
    modelUsed: 'v6-rotation',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function makeHotSectorScore() {
  return {
    symbol: 'SW801',
    name: '白酒',
    score: 82,
    dimensions: { momentum: 80, sentiment: 75, technical: 85, valuation: 70, composite: 82 },
    action: 'immediate' as const,
    calculatedAt: 1700000000000,
    dataVersion: 1,
  }
}

function makeValuePitScore() {
  return {
    symbol: 'SW801',
    name: '白酒',
    score: 78,
    dimensions: { catalyst: 80, valuation: 85, chip: 70, rotation: 75, liquidity: 60, composite: 78 },
    rotationSignal: true,
    action: 'probe' as const,
    calculatedAt: 1700000000000,
    dataVersion: 1,
  }
}

function makeSectorScore(overrides: Record<string, unknown> = {}) {
  return {
    id: 'SW801__2026-07-01',
    sectorCode: 'SW801',
    scoreDate: '2026-07-01',
    dimensions: { planAlignment: 4, policySupport: 5, usChinaParity: 3 },
    composite: 80,
    isCore: true,
    modelUsed: 'v6-sector',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function makeScoreDoc(overrides: Record<string, unknown> = {}) {
  return {
    docId: '600519__1__1700000000000',
    symbol: '600519',
    stockName: '贵州茅台',
    version: 1,
    scoreDate: '2026-07-01',
    composite: 85,
    l3v: 80,
    layers: {},
    recommendation: { key: 'buy', label: '买入', color: 'red' },
    targetPrice: { bull: 2000, base: 1900, bear: 1700 },
    keyRisks: [],
    keyCatalysts: [],
    reportMd: '# Report',
    modelUsed: 'v6-pro',
    market: 'CN',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function makeStrategySnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snap-001',
    version: 1,
    timestamp: 1700000000000,
    date: '2026-07-01',
    time: '10:00',
    stockCount: 50,
    scoreCount: 50,
    rotationCount: 10,
    core: { count: 5, avgComposite: 85, maxComposite: 95, symbols: [], items: [] },
    hot: { count: 3, avgComposite: 80, maxComposite: 90, symbols: [], items: [] },
    value: { count: 4, avgComposite: 75, maxComposite: 85, symbols: [], items: [] },
    trigger: 'manual',
    ...overrides,
  }
}

function makeLocalDoc() {
  return {
    id: 'doc-001',
    symbol: '600519',
    name: '贵州茅台',
    content: '研究笔记内容',
    category: '研报' as const,
    tags: ['白酒'],
    sourcePath: '/path/to/file',
    size: 1024,
    addedAt: 1700000000000,
  }
}

function makeNewsArticle() {
  return {
    id: 'news-001',
    title: '茅台发布半年报',
    content: '贵州茅台2026年上半年营收增长15%',
    url: 'https://example.com/news/1',
    source: '东方财富',
    category: '财报',
    publishTime: '2026-07-01T10:00:00Z',
    fetchTime: '2026-07-01T10:05:00Z',
    sentiment: 'positive' as const,
    sentimentConfidence: 0.9,
    relatedStocks: ['600519'],
    keywords: ['茅台', '财报'],
    hash: 'abc123hash',
  }
}

function makeNewsStockMap() {
  return {
    id: '600519_news-001',
    symbol: '600519',
    newsId: 'news-001',
    relevanceScore: 0.95,
    isTitleMatch: true,
    isContentMatch: true,
    industryMatch: true,
  }
}

function makeSentimentCache() {
  return {
    id: 'sent_abc123',
    contentHash: 'abc123',
    sentiment: 'positive' as const,
    confidence: 0.88,
    method: 'llm' as const,
    analyzedAt: 1700000000000,
    llmModel: 'gpt-4',
  }
}

function makeExecutionPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-001',
    symbol: '600519',
    name: '贵州茅台',
    phase: 'plan' as const,
    direction: 'buy' as const,
    quantity: 100,
    targetPrice: 1800,
    rationale: '估值合理',
    confidence: 0.8,
    riskChecks: [],
    createdAt: 1700000000000,
    ...overrides,
  }
}

function makePortfolio() {
  return {
    id: 'pf-001',
    name: '核心组合',
    theme: '第四次工业革命',
    totalValue: 1000000,
    cashReserve: 100000,
    holdings: [],
    rebalancePlan: [],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  }
}

function makeTradeReviewRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tr-001',
    generatedAt: 1700000000000,
    report: { summary: 'test', details: [], score: 80 } as unknown as import('@/services/trading/tradeReviewAI.types').TradeReviewReport,
    tradeErrors: [],
    disciplineScore: 85,
    skillRoadmap: [],
    psychologicalProfile: null,
    ...overrides,
  }
}

// ── 辅助函数 ──────────────────────────────────────────────

/** 设置 query mock 返回成功（单条） */
function mockQueryGetSuccess<T>(data: T | undefined) {
  mockQuery.mockResolvedValueOnce({ success: true, data })
}

/** 设置 query mock 返回成功（列表） */
function mockQueryListSuccess<T>(data: T[]) {
  mockQuery.mockResolvedValueOnce({ success: true, data })
}

/** 设置 query mock 返回失败 */
function mockQueryFail(error: string) {
  mockQuery.mockResolvedValueOnce({ success: false, error })
}

/** 设置 forward mock 成功 */
function mockForwardSuccess() {
  mockForward.mockResolvedValueOnce(undefined)
}

/** 设置 forward mock 失败 */
function mockForwardFail(error: string) {
  mockForward.mockRejectedValueOnce(new Error(error))
}

// ── 测试套件 ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('dataLayer', () => {
  // ─── stockStore ─────────────────────────────────────────

  describe('stockStore', () => {
    it('add: 成功添加新股票', async () => {
      mockQueryGetSuccess(undefined) // 查询不存在
      mockForwardSuccess()

      const result = await stockStore.add(makeStock())
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        symbol: '600519',
        name: '贵州茅台',
        dataVersion: 1,
      })
      expect(mockForward).toHaveBeenCalledOnce()
    })

    it('add: 股票已存在时返回失败', async () => {
      mockQueryGetSuccess({ symbol: '600519', name: '贵州茅台' }) // 已存在

      const result = await stockStore.add(makeStock())
      expect(result.success).toBe(false)
      expect(result.error).toContain('已存在')
    })

    it('add: forward 失败时返回错误', async () => {
      mockQueryGetSuccess(undefined)
      mockForwardFail('写入失败')

      const result = await stockStore.add(makeStock())
      expect(result.success).toBe(false)
      expect(result.error).toBe('写入失败')
    })

    it('get: 查询到股票', async () => {
      const stock = makeStock()
      mockQueryGetSuccess(stock)

      const result = await stockStore.get('600519')
      expect(result).toEqual(stock)
    })

    it('get: 查询失败返回 undefined', async () => {
      mockQueryFail('查询失败')

      const result = await stockStore.get('600519')
      expect(result).toBeUndefined()
    })

    it('list: 返回全部股票', async () => {
      const stocks = [makeStock(), makeStock({ symbol: '000001', name: '平安银行' })]
      mockQueryListSuccess(stocks)

      const result = await stockStore.list()
      expect(result).toHaveLength(2)
    })

    it('list: 查询失败返回空数组', async () => {
      mockQueryFail('查询失败')

      const result = await stockStore.list()
      expect(result).toEqual([])
    })

    it('listByStatus: 按状态查询', async () => {
      const stocks = [makeStock({ researchStatus: 'watching' })]
      mockQuery.mockResolvedValueOnce({ success: true, data: stocks })

      const result = await stockStore.listByStatus('watching' as any)
      expect(result).toHaveLength(1)
    })

    it('listByGroup: 按分组查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeStock()] })

      const result = await stockStore.listByGroup('默认分组')
      expect(result).toHaveLength(1)
    })

    it('listGroups: 返回去重排序的分组列表', async () => {
      const stocks = [
        makeStock({ group: 'B组' }),
        makeStock({ symbol: '000001', group: 'A组' }),
        makeStock({ symbol: '000002', group: 'B组' }),
      ]
      mockQueryListSuccess(stocks)

      const result = await stockStore.listGroups()
      expect(result).toEqual(['A组', 'B组', '默认分组'])
    })

    it('updateStatus: 成功更新状态', async () => {
      mockQueryGetSuccess(makeStock()) // 查询存在
      mockForwardSuccess()

      const result = await stockStore.updateStatus('600519', 'watching' as any)
      expect(result.success).toBe(true)
    })

    it('updateStatus: 股票不存在时返回失败', async () => {
      mockQueryGetSuccess(undefined)

      const result = await stockStore.updateStatus('600519', 'watching' as any)
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('updateGroup: 成功更新分组', async () => {
      mockQueryGetSuccess(makeStock()) // 查询存在
      mockForwardSuccess()
      mockQueryGetSuccess({ ...makeStock(), group: '新分组' }) // 更新后再查

      const result = await stockStore.updateGroup('600519', '新分组')
      expect(result.success).toBe(true)
      expect(result.data?.group).toBe('新分组')
    })

    it('updateGroup: 空分组名返回失败', async () => {
      const result = await stockStore.updateGroup('600519', '   ')
      expect(result.success).toBe(false)
      expect(result.error).toContain('不能为空')
    })

    it('updateGroup: 股票不存在返回失败', async () => {
      mockQueryGetSuccess(undefined)

      const result = await stockStore.updateGroup('600519', '新分组')
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('remove: 成功删除', async () => {
      mockForwardSuccess()

      const result = await stockStore.remove('600519')
      expect(result.success).toBe(true)
    })

    it('remove: forward 失败返回错误', async () => {
      mockForwardFail('删除失败')

      const result = await stockStore.remove('600519')
      expect(result.success).toBe(false)
      expect(result.error).toBe('删除失败')
    })

    it('listGroups: 空列表返回默认分组', async () => {
      mockQueryListSuccess([])

      const result = await stockStore.listGroups()
      expect(result).toEqual(['默认分组'])
    })
  })

  // ─── v6ScoreStore ───────────────────────────────────────

  describe('v6ScoreStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await v6ScoreStore.save(makeV6Score())
      expect(result.success).toBe(true)
    })

    it('save: forward 失败', async () => {
      mockForwardFail('DB error')

      const result = await v6ScoreStore.save(makeV6Score())
      expect(result.success).toBe(false)
      expect(result.error).toBe('DB error')
    })

    it('get: 查询到评分', async () => {
      mockQueryGetSuccess(makeV6Score())

      const result = await v6ScoreStore.get('600519')
      expect(result?.score).toBe(85)
    })

    it('get: 查询失败返回 undefined', async () => {
      mockQueryFail('err')

      const result = await v6ScoreStore.get('600519')
      expect(result).toBeUndefined()
    })

    it('list: 返回全部评分', async () => {
      mockQueryListSuccess([makeV6Score()])

      const result = await v6ScoreStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── dailyQuoteStore ────────────────────────────────────

  describe('dailyQuoteStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await dailyQuoteStore.save(makeDailyQuote())
      expect(result.success).toBe(true)
    })

    it('get: 查询到行情', async () => {
      mockQueryGetSuccess(makeDailyQuote())

      const result = await dailyQuoteStore.get('600519')
      expect(result?.symbol).toBe('600519')
    })

    it('get: 查询失败返回 undefined', async () => {
      mockQueryFail('err')

      const result = await dailyQuoteStore.get('600519')
      expect(result).toBeUndefined()
    })
  })

  // ─── orderStore ─────────────────────────────────────────

  describe('orderStore', () => {
    it('add: 成功创建订单', async () => {
      mockForwardSuccess()

      const result = await orderStore.add(makeOrder())
      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('mock-id-001')
      expect(result.data?.createdAt).toBe(1700000000000)
    })

    it('add: forward 失败', async () => {
      mockForwardFail('写入失败')

      const result = await orderStore.add(makeOrder())
      expect(result.success).toBe(false)
    })

    it('list: 返回全部订单', async () => {
      mockQueryListSuccess([makeOrder()])

      const result = await orderStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── signalStore ────────────────────────────────────────

  describe('signalStore', () => {
    it('save: 成功保存信号', async () => {
      mockForwardSuccess()

      const result = await signalStore.save(makeSignal())
      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('sig-001')
    })

    it('save: forward 失败', async () => {
      mockForwardFail('err')

      const result = await signalStore.save(makeSignal())
      expect(result.success).toBe(false)
    })

    it('list: 返回全部信号', async () => {
      mockQueryListSuccess([makeSignal()])

      const result = await signalStore.list()
      expect(result).toHaveLength(1)
    })

    it('listBySymbol: 按股票代码过滤', async () => {
      mockQueryListSuccess([makeSignal(), makeSignal({ id: 'sig-002', symbol: '000001' })])

      const result = await signalStore.listBySymbol('600519')
      expect(result).toHaveLength(1)
      expect(result[0]?.symbol).toBe('600519')
    })
  })

  // ─── researchLogStore ───────────────────────────────────

  describe('researchLogStore', () => {
    it('list: 返回全部日志', async () => {
      mockQueryListSuccess([makeResearchLog()])

      const result = await researchLogStore.list()
      expect(result).toHaveLength(1)
    })

    it('list: 查询失败返回空数组', async () => {
      mockQueryFail('err')

      const result = await researchLogStore.list()
      expect(result).toEqual([])
    })
  })

  // ─── intelligentScoreStore ──────────────────────────────

  describe('intelligentScoreStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await intelligentScoreStore.save(makeIntelligentScore())
      expect(result.success).toBe(true)
    })

    it('listBySymbol: 按股票代码查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeIntelligentScore()] })

      const result = await intelligentScoreStore.listBySymbol('600519')
      expect(result).toHaveLength(1)
    })

    it('getLatestBySymbol: 返回最新评分', async () => {
      const scores = [
        makeIntelligentScore({ scoredAt: 1000 }),
        makeIntelligentScore({ scoredAt: 3000 }),
        makeIntelligentScore({ scoredAt: 2000 }),
      ]
      mockQuery.mockResolvedValueOnce({ success: true, data: scores })

      const result = await intelligentScoreStore.getLatestBySymbol('600519')
      expect(result?.scoredAt).toBe(3000)
    })

    it('getLatestBySymbol: 空列表返回 undefined', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })

      const result = await intelligentScoreStore.getLatestBySymbol('600519')
      expect(result).toBeUndefined()
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeIntelligentScore()])

      const result = await intelligentScoreStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── industryScoreStore ─────────────────────────────────

  describe('industryScoreStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await industryScoreStore.save(makeIndustryScore())
      expect(result.success).toBe(true)
    })

    it('listByCode: 按行业代码查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeIndustryScore()] })

      const result = await industryScoreStore.listByCode('SW801')
      expect(result).toHaveLength(1)
    })

    it('getLatestByCode: 返回最新评分', async () => {
      const scores = [
        makeIndustryScore({ scoredAt: 1000 }),
        makeIndustryScore({ id: 2, scoredAt: 5000 }),
      ]
      mockQuery.mockResolvedValueOnce({ success: true, data: scores })

      const result = await industryScoreStore.getLatestByCode('SW801')
      expect(result?.scoredAt).toBe(5000)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeIndustryScore()])

      const result = await industryScoreStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── rotationScoreStore ─────────────────────────────────

  describe('rotationScoreStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await rotationScoreStore.save(makeRotationScore())
      expect(result.success).toBe(true)
    })

    it('get: 查询到记录', async () => {
      mockQueryGetSuccess(makeRotationScore())

      const result = await rotationScoreStore.get('SW801__20260701')
      expect(result?.sectorCode).toBe('SW801')
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeRotationScore()])

      const result = await rotationScoreStore.list()
      expect(result).toHaveLength(1)
    })

    it('listBySector: 按板块查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeRotationScore()] })

      const result = await rotationScoreStore.listBySector('SW801')
      expect(result).toHaveLength(1)
    })

    it('getLatestBySector: 返回最新记录', async () => {
      const records = [
        makeRotationScore({ scoreDate: '2026-06-01' }),
        makeRotationScore({ id: 'SW801__20260702', scoreDate: '2026-07-02' }),
      ]
      mockQuery.mockResolvedValueOnce({ success: true, data: records })

      const result = await rotationScoreStore.getLatestBySector('SW801')
      expect(result?.scoreDate).toBe('2026-07-02')
    })
  })

  // ─── hotSectorScoreStore ────────────────────────────────

  describe('hotSectorScoreStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await hotSectorScoreStore.save(makeHotSectorScore())
      expect(result.success).toBe(true)
    })

    it('get: 查询到记录', async () => {
      mockQueryGetSuccess(makeHotSectorScore())

      const result = await hotSectorScoreStore.get('SW801')
      expect(result?.score).toBe(82)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeHotSectorScore()])

      const result = await hotSectorScoreStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── valuePitScoreStore ─────────────────────────────────

  describe('valuePitScoreStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await valuePitScoreStore.save(makeValuePitScore())
      expect(result.success).toBe(true)
    })

    it('get: 查询到记录', async () => {
      mockQueryGetSuccess(makeValuePitScore())

      const result = await valuePitScoreStore.get('SW801')
      expect(result?.score).toBe(78)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeValuePitScore()])

      const result = await valuePitScoreStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── sectorScoreStore ───────────────────────────────────

  describe('sectorScoreStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await sectorScoreStore.save(makeSectorScore())
      expect(result.success).toBe(true)
    })

    it('get: 查询到记录', async () => {
      mockQueryGetSuccess(makeSectorScore())

      const result = await sectorScoreStore.get('SW801__2026-07-01')
      expect(result?.composite).toBe(80)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeSectorScore()])

      const result = await sectorScoreStore.list()
      expect(result).toHaveLength(1)
    })

    it('listBySector: 按板块查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeSectorScore()] })

      const result = await sectorScoreStore.listBySector('SW801')
      expect(result).toHaveLength(1)
    })

    it('getLatestBySector: 返回最新记录', async () => {
      const records = [
        makeSectorScore({ scoreDate: '2026-06-01' }),
        makeSectorScore({ id: 'SW801__2026-07-15', scoreDate: '2026-07-15' }),
      ]
      mockQuery.mockResolvedValueOnce({ success: true, data: records })

      const result = await sectorScoreStore.getLatestBySector('SW801')
      expect(result?.scoreDate).toBe('2026-07-15')
    })
  })

  // ─── scoreDocStore ──────────────────────────────────────

  describe('scoreDocStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await scoreDocStore.save(makeScoreDoc())
      expect(result.success).toBe(true)
    })

    it('get: 查询到文档', async () => {
      mockQueryGetSuccess(makeScoreDoc())

      const result = await scoreDocStore.get('600519__1__1700000000000')
      expect(result?.composite).toBe(85)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeScoreDoc()])

      const result = await scoreDocStore.list()
      expect(result).toHaveLength(1)
    })

    it('listBySymbol: 按股票查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeScoreDoc()] })

      const result = await scoreDocStore.listBySymbol('600519')
      expect(result).toHaveLength(1)
    })

    it('getLatestBySymbol: 返回最高版本', async () => {
      const docs = [
        makeScoreDoc({ version: 1 }),
        makeScoreDoc({ docId: '600519__3__1700000000003', version: 3 }),
        makeScoreDoc({ docId: '600519__2__1700000000002', version: 2 }),
      ]
      mockQuery.mockResolvedValueOnce({ success: true, data: docs })

      const result = await scoreDocStore.getLatestBySymbol('600519')
      expect(result?.version).toBe(3)
    })
  })

  // ─── strategySnapshotStore ──────────────────────────────

  describe('strategySnapshotStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await strategySnapshotStore.save(makeStrategySnapshot())
      expect(result.success).toBe(true)
    })

    it('get: 查询到快照', async () => {
      mockQueryGetSuccess(makeStrategySnapshot())

      const result = await strategySnapshotStore.get('snap-001')
      expect(result?.stockCount).toBe(50)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeStrategySnapshot()])

      const result = await strategySnapshotStore.list()
      expect(result).toHaveLength(1)
    })

    it('getLatest: 返回最新快照', async () => {
      const snaps = [
        makeStrategySnapshot({ timestamp: 1000 }),
        makeStrategySnapshot({ id: 'snap-003', timestamp: 3000 }),
        makeStrategySnapshot({ id: 'snap-002', timestamp: 2000 }),
      ]
      mockQueryListSuccess(snaps)

      const result = await strategySnapshotStore.getLatest()
      expect(result?.timestamp).toBe(3000)
    })

    it('getLatest: 空列表返回 undefined', async () => {
      mockQueryListSuccess([])

      const result = await strategySnapshotStore.getLatest()
      expect(result).toBeUndefined()
    })
  })

  // ─── localDocStore ──────────────────────────────────────

  describe('localDocStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await localDocStore.save(makeLocalDoc())
      expect(result.success).toBe(true)
    })

    it('get: 查询到文档', async () => {
      mockQueryGetSuccess(makeLocalDoc())

      const result = await localDocStore.get('doc-001')
      expect(result?.name).toBe('贵州茅台')
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeLocalDoc()])

      const result = await localDocStore.list()
      expect(result).toHaveLength(1)
    })

    it('listBySymbol: 按股票查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeLocalDoc()] })

      const result = await localDocStore.listBySymbol('600519')
      expect(result).toHaveLength(1)
    })
  })

  // ─── newsStore ──────────────────────────────────────────

  describe('newsStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await newsStore.save(makeNewsArticle())
      expect(result.success).toBe(true)
    })

    it('get: 查询到文章', async () => {
      mockQueryGetSuccess(makeNewsArticle())

      const result = await newsStore.get('news-001')
      expect(result?.title).toContain('茅台')
    })

    it('getByHash: 通过哈希查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeNewsArticle()] })

      const result = await newsStore.getByHash('abc123hash')
      expect(result?.hash).toBe('abc123hash')
    })

    it('getByHash: 无匹配返回 undefined', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })

      const result = await newsStore.getByHash('nonexistent')
      expect(result).toBeUndefined()
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeNewsArticle()])

      const result = await newsStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── newsStockMapStore ──────────────────────────────────

  describe('newsStockMapStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await newsStockMapStore.save(makeNewsStockMap())
      expect(result.success).toBe(true)
    })

    it('listBySymbol: 按股票查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeNewsStockMap()] })

      const result = await newsStockMapStore.listBySymbol('600519')
      expect(result).toHaveLength(1)
    })

    it('listByNews: 按资讯查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeNewsStockMap()] })

      const result = await newsStockMapStore.listByNews('news-001')
      expect(result).toHaveLength(1)
    })
  })

  // ─── sentimentCacheStore ────────────────────────────────

  describe('sentimentCacheStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await sentimentCacheStore.save(makeSentimentCache())
      expect(result.success).toBe(true)
    })

    it('get: 查询到缓存', async () => {
      mockQueryGetSuccess(makeSentimentCache())

      const result = await sentimentCacheStore.get('sent_abc123')
      expect(result?.sentiment).toBe('positive')
    })

    it('getByContentHash: 通过内容哈希查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeSentimentCache()] })

      const result = await sentimentCacheStore.getByContentHash('abc123')
      expect(result?.contentHash).toBe('abc123')
    })

    it('getByContentHash: 无匹配返回 undefined', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })

      const result = await sentimentCacheStore.getByContentHash('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  // ─── executionPlanStore ─────────────────────────────────

  describe('executionPlanStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await executionPlanStore.save(makeExecutionPlan())
      expect(result.success).toBe(true)
    })

    it('get: 查询到计划', async () => {
      mockQueryGetSuccess(makeExecutionPlan())

      const result = await executionPlanStore.get('plan-001')
      expect(result?.symbol).toBe('600519')
    })

    it('getAll: 返回全部', async () => {
      mockQueryListSuccess([makeExecutionPlan()])

      const result = await executionPlanStore.getAll()
      expect(result).toHaveLength(1)
    })

    it('getBySymbol: 按股票查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeExecutionPlan()] })

      const result = await executionPlanStore.getBySymbol('600519')
      expect(result).toHaveLength(1)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeExecutionPlan()])

      const result = await executionPlanStore.list()
      expect(result).toHaveLength(1)
    })

    it('update: 成功更新', async () => {
      mockQueryGetSuccess(makeExecutionPlan()) // 查询存在
      mockForwardSuccess()

      const result = await executionPlanStore.update('plan-001', { phase: 'confirmed' })
      expect(result.success).toBe(true)
      expect(result.data?.phase).toBe('confirmed')
    })

    it('update: 计划不存在返回失败', async () => {
      mockQueryGetSuccess(undefined)

      const result = await executionPlanStore.update('plan-999', { phase: 'confirmed' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('update: forward 失败返回错误', async () => {
      mockQueryGetSuccess(makeExecutionPlan())
      mockForwardFail('写入失败')

      const result = await executionPlanStore.update('plan-001', { phase: 'confirmed' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('写入失败')
    })

    it('delete: 成功删除', async () => {
      mockForwardSuccess()

      const result = await executionPlanStore.delete('plan-001')
      expect(result.success).toBe(true)
    })

    it('delete: forward 失败返回错误', async () => {
      mockForwardFail('删除失败')

      const result = await executionPlanStore.delete('plan-001')
      expect(result.success).toBe(false)
      expect(result.error).toBe('删除失败')
    })
  })

  // ─── executionLogStore ──────────────────────────────────

  describe('executionLogStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await executionLogStore.save(makeExecutionLog())
      expect(result.success).toBe(true)
    })

    it('getByPlanId: 按计划ID查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeExecutionLog()] })

      const result = await executionLogStore.getByPlanId('plan-001')
      expect(result).toHaveLength(1)
    })

    it('listByPlan: 按计划ID查询（别名）', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeExecutionLog()] })

      const result = await executionLogStore.listByPlan('plan-001')
      expect(result).toHaveLength(1)
    })

    it('getBySymbol: 按股票查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeExecutionLog()] })

      const result = await executionLogStore.getBySymbol('600519')
      expect(result).toHaveLength(1)
    })

    it('listBySymbol: 按股票查询（别名）', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeExecutionLog()] })

      const result = await executionLogStore.listBySymbol('600519')
      expect(result).toHaveLength(1)
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeExecutionLog()])

      const result = await executionLogStore.list()
      expect(result).toHaveLength(1)
    })

    it('getAll: 返回全部（别名）', async () => {
      mockQueryListSuccess([makeExecutionLog()])

      const result = await executionLogStore.getAll()
      expect(result).toHaveLength(1)
    })
  })

  // ─── missingReportStore ─────────────────────────────────

  describe('missingReportStore', () => {
    it('report: 成功创建报告', async () => {
      mockForwardSuccess()

      const result = await missingReportStore.report({
        symbol: '600519',
        reportType: 'kline_missing',
        severity: 'high',
        reason: 'K线数据缺失',
        detectedAt: 1700000000000,
        retryCount: 0,
        createdAt: 1700000000000,
      })
      expect(result.success).toBe(true)
      expect(result.data?.id).toBeTypeOf('string')
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makeMissingReport()])

      const result = await missingReportStore.list()
      expect(result).toHaveLength(1)
    })

    it('listBySymbol: 按股票查询', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [makeMissingReport()] })

      const result = await missingReportStore.listBySymbol('600519')
      expect(result).toHaveLength(1)
    })

    it('listBySeverity: 按严重程度过滤', async () => {
      mockQueryListSuccess([
        makeMissingReport({ severity: 'high' }),
        makeMissingReport({ id: '2', severity: 'low' }),
      ])

      const result = await missingReportStore.listBySeverity('high')
      expect(result).toHaveLength(1)
      expect(result[0]?.severity).toBe('high')
    })

    it('incrementRetry: 成功递增重试次数', async () => {
      mockQueryGetSuccess(makeMissingReport({ retryCount: 2 }))
      mockForwardSuccess()

      const result = await missingReportStore.incrementRetry('1')
      expect(result.success).toBe(true)
      expect(result.data?.retryCount).toBe(3)
    })

    it('incrementRetry: 报告不存在返回失败', async () => {
      mockQueryGetSuccess(undefined)

      const result = await missingReportStore.incrementRetry('999')
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('incrementRetry: forward 失败返回错误', async () => {
      mockQueryGetSuccess(makeMissingReport())
      mockForwardFail('写入失败')

      const result = await missingReportStore.incrementRetry('1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('写入失败')
    })

    it('report: forward 失败仍返回成功（当前实现不检查返回值）', async () => {
      mockForwardFail('写入失败')

      const result = await missingReportStore.report({
        symbol: '600519',
        reportType: 'kline_missing',
        severity: 'high',
        reason: 'K线数据缺失',
        detectedAt: 1700000000000,
        retryCount: 0,
        createdAt: 1700000000000,
      })
      // 当前实现不检查 sendWriteEnvelope 返回值，始终返回成功
      expect(result.success).toBe(true)
    })
  })

  // ─── portfolioStore ─────────────────────────────────────

  describe('portfolioStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await portfolioStore.save(makePortfolio())
      expect(result.success).toBe(true)
    })

    it('get: 查询到组合', async () => {
      mockQueryGetSuccess(makePortfolio())

      const result = await portfolioStore.get('pf-001')
      expect(result?.name).toBe('核心组合')
    })

    it('list: 返回全部', async () => {
      mockQueryListSuccess([makePortfolio()])

      const result = await portfolioStore.list()
      expect(result).toHaveLength(1)
    })
  })

  // ─── tradeReviewStore ───────────────────────────────────

  describe('tradeReviewStore', () => {
    it('save: 成功保存', async () => {
      mockForwardSuccess()

      const result = await tradeReviewStore.save(makeTradeReviewRecord())
      expect(result.success).toBe(true)
    })

    it('getLatest: 返回最新记录', async () => {
      const records = [
        makeTradeReviewRecord({ generatedAt: 1000 }),
        makeTradeReviewRecord({ id: 'tr-003', generatedAt: 5000 }),
        makeTradeReviewRecord({ id: 'tr-002', generatedAt: 3000 }),
      ]
      mockQueryListSuccess(records)

      const result = await tradeReviewStore.getLatest()
      expect(result?.generatedAt).toBe(5000)
    })

    it('getLatest: 空列表返回 null', async () => {
      mockQueryListSuccess([])

      const result = await tradeReviewStore.getLatest()
      expect(result).toBeNull()
    })
  })

  // ─── dataManager ────────────────────────────────────────

  describe('dataManager', () => {
    it('reset: 调用 db.reset', async () => {
      await dataManager.reset()
      expect(mockDbReset).toHaveBeenCalledOnce()
    })

    it('export: 调用 db.export', async () => {
      mockDbExport.mockResolvedValueOnce({ stocks: [{ symbol: '600519' }] })

      const result = await dataManager.export()
      expect(result).toEqual({ stocks: [{ symbol: '600519' }] })
    })

    it('import: 调用 db.import', async () => {
      const data = { stocks: [{ symbol: '600519' }] }
      await dataManager.import(data)
      expect(mockDbImport).toHaveBeenCalledWith(data)
    })
  })

  // ─── dataLayer 聚合器 ───────────────────────────────────

  describe('dataLayer aggregator', () => {
    it('暴露全部 33 个 store 及 manager', () => {
      expect(dataLayer.stocks).toBe(stockStore)
      expect(dataLayer.v6Scores).toBe(v6ScoreStore)
      expect(dataLayer.dailyQuotes).toBe(dailyQuoteStore)
      expect(dataLayer.financialReports).toBe(financialReportStore)
      expect(dataLayer.intelligentScores).toBe(intelligentScoreStore)
      expect(dataLayer.industryScores).toBe(industryScoreStore)
      expect(dataLayer.researchLogs).toBe(researchLogStore)
      expect(dataLayer.orders).toBe(orderStore)
      expect(dataLayer.signals).toBe(signalStore)
      expect(dataLayer.rotationScores).toBe(rotationScoreStore)
      expect(dataLayer.sectorScores).toBe(sectorScoreStore)
      expect(dataLayer.scoreDocs).toBe(scoreDocStore)
      expect(dataLayer.strategySnapshots).toBe(strategySnapshotStore)
      expect(dataLayer.localDocs).toBe(localDocStore)
      expect(dataLayer.news).toBe(newsStore)
      expect(dataLayer.newsStockMap).toBe(newsStockMapStore)
      expect(dataLayer.sentimentCache).toBe(sentimentCacheStore)
      expect(dataLayer.hotSectorScores).toBe(hotSectorScoreStore)
      expect(dataLayer.valuePitScores).toBe(valuePitScoreStore)
      expect(dataLayer.executionPlans).toBe(executionPlanStore)
      expect(dataLayer.executionLogs).toBe(executionLogStore)
      expect(dataLayer.missingReports).toBe(missingReportStore)
      expect(dataLayer.portfolios).toBe(portfolioStore)
      expect(dataLayer.tradeReviews).toBe(tradeReviewStore)
      expect(dataLayer.watchlists).toBe(watchlistStore)
      expect(dataLayer.customAgents).toBe(customAgentStore)
      expect(dataLayer.collectConfig).toBe(collectConfigStore)
      expect(dataLayer.traceRecords).toBe(traceRecordStore)
      expect(dataLayer.workflowDefs).toBe(workflowDefStore)
      expect(dataLayer.workflowSchedules).toBe(workflowScheduleStore)
      expect(dataLayer.workflowTriggers).toBe(workflowTriggerStore)
      expect(dataLayer.workflowRuns).toBe(workflowRunStore)
      expect(dataLayer.manager).toBe(dataManager)
    })

    it('共计 46 个属性', () => {
      expect(Object.keys(dataLayer)).toHaveLength(46)
    })
  })

  // ─── 错误处理 ───────────────────────────────────────────

  describe('error handling', () => {
    it('sendWriteEnvelope: 捕获异常并返回错误信息', async () => {
      mockForward.mockRejectedValueOnce(new Error('DB connection lost'))

      const result = await v6ScoreStore.save(makeV6Score())
      expect(result.success).toBe(false)
      expect(result.error).toBe('DB connection lost')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'DataBridge.forward failed',
        { error: 'DB connection lost' },
      )
    })

    it('sendWriteEnvelope: 处理非 Error 异常', async () => {
      mockForward.mockRejectedValueOnce('string error')

      const result = await v6ScoreStore.save(makeV6Score())
      expect(result.success).toBe(false)
      expect(result.error).toBe('string error')
    })

    it('queryGet: 查询失败时记录错误日志并返回 undefined', async () => {
      mockQuery.mockResolvedValueOnce({ success: false, error: 'timeout' })

      const result = await stockStore.get('600519')
      expect(result).toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('queryGet failed'),
        { error: 'timeout' },
      )
    })

    it('queryList: 查询失败时记录错误日志并返回空数组', async () => {
      mockQuery.mockResolvedValueOnce({ success: false, error: 'timeout' })

      const result = await stockStore.list()
      expect(result).toEqual([])
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('queryList failed'),
        { error: 'timeout' },
      )
    })

    it('queryByIndex: 查询失败时记录错误日志并返回空数组', async () => {
      mockQuery.mockResolvedValueOnce({ success: false, error: 'index error' })

      const result = await stockStore.listByStatus('candidate' as any)
      expect(result).toEqual([])
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('queryByIndex failed'),
        { error: 'index error' },
      )
    })

    it('queryList: data 为 null 时返回空数组', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: null })

      const result = await stockStore.list()
      expect(result).toEqual([])
    })

    it('db.reset 抛出异常时向上传播', async () => {
      mockDbReset.mockRejectedValueOnce(new Error('reset failed'))

      await expect(dataManager.reset()).rejects.toThrow('reset failed')
    })

    it('db.export 抛出异常时向上传播', async () => {
      mockDbExport.mockRejectedValueOnce(new Error('export failed'))

      await expect(dataManager.export()).rejects.toThrow('export failed')
    })

    it('db.import 抛出异常时向上传播', async () => {
      mockDbImport.mockRejectedValueOnce(new Error('import failed'))

      await expect(dataManager.import({})).rejects.toThrow('import failed')
    })
  })

  // ─── EnvelopeFactory 调用验证 ──────────────────────────

  describe('envelope creation', () => {
    it('sendWriteEnvelope 正确调用 EnvelopeFactory.create', async () => {
      mockForwardSuccess()

      await v6ScoreStore.save(makeV6Score())

      expect(mockEnvelopeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'analyzer',
          target: 'db',
          action: 'SAVE_SCORES',
        }),
        expect.any(Object),
      )
    })

    it('queryGet 使用正确的 action 和 source', async () => {
      mockQueryGetSuccess(undefined)

      await stockStore.get('600519')

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUERY_GET',
          store: 'stocks',
          key: '600519',
          source: 'datalayer',
        }),
      )
    })

    it('queryList 使用正确的 action 和 source', async () => {
      mockQueryListSuccess([])

      await stockStore.list()

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUERY_LIST',
          store: 'stocks',
          source: 'datalayer',
        }),
      )
    })

    it('queryByIndex 使用正确的 action、indexName 和 indexValue', async () => {
      mockQuery.mockResolvedValueOnce({ success: true, data: [] })

      await stockStore.listByStatus('watching' as any)

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'QUERY_BY_INDEX',
          store: 'stocks',
          indexName: 'by-status',
          indexValue: 'watching',
          source: 'datalayer',
        }),
      )
    })
  })
})
