/**
 * @fileoverview dataLayer 测试共享工具模块
 *
 * 提取自原 dataLayer.test.ts（1700 行），供拆分后的各域测试文件共享。
 * 包含：mock 定义、工厂函数、mock 辅助函数。
 */
import { vi } from 'vitest'
import { TEST_MOCK_NEWS_URL, TEST_MOCK_LLM_BASE_URL } from '@/config/dataSourceUrls'

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

// ── 重新导出 mock 以便测试文件使用 ──────────────────────────
export { mockDbReset, mockDbExport, mockDbImport, mockForward, mockQuery, mockEnvelopeCreate, mockGenerateId, mockNow, mockLogger }

// ── 工厂函数：创建各 store 测试数据 ──────────────────────

export function makeStock(overrides: Record<string, unknown> = {}) {
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

export function makeV6Score(overrides: Record<string, unknown> = {}) {
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

export function makeDailyQuote() {
  return {
    symbol: '600519',
    latest: { date: '2026-07-01', open: 1800, high: 1820, low: 1790, close: 1810, volume: 10000, amount: 18100000 },
    history: [],
    period: 'day',
    adjust: 'qfq',
    updatedAt: 1700000000000,
  }
}

export function makeOrder(overrides: Record<string, unknown> = {}) {
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

export function makeSignal(overrides: Record<string, unknown> = {}) {
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

export function makeResearchLog() {
  return {
    traceId: 'trace-001',
    timestamp: 1700000000000,
    actor: 'user',
    action: 'add_stock',
    targetType: 'stock',
    targetCode: '600519',
  }
}

export function makeExecutionLog(overrides: Record<string, unknown> = {}) {
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

export function makeMissingReport(overrides: Record<string, unknown> = {}) {
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

export function makeIntelligentScore(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    symbol: '600519',
    overallScore: 82,
    dimensionScores: [],
    summary: 'test',
    basis: 'test',
    missingFields: [],
    sourceSnapshot: { stock: undefined, fileNames: [], reportLength: 0 },
    configSnapshot: { model: 'gpt-4', baseURL: TEST_MOCK_LLM_BASE_URL },
    modelResponse: '{}',
    dataVersion: 1,
    scoredAt: 1700000000000,
    ...overrides,
  }
}

export function makeIndustryScore(overrides: Record<string, unknown> = {}) {
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
    configSnapshot: { model: 'gpt-4', baseURL: TEST_MOCK_LLM_BASE_URL },
    modelResponse: '{}',
    scoredAt: 1700000000000,
    ...overrides,
  }
}

export function makeRotationScore(overrides: Record<string, unknown> = {}) {
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

export function makeHotSectorScore() {
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

export function makeValuePitScore() {
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

export function makeSectorScore(overrides: Record<string, unknown> = {}) {
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

export function makeScoreDoc(overrides: Record<string, unknown> = {}) {
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

export function makeStrategySnapshot(overrides: Record<string, unknown> = {}) {
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

export function makeLocalDoc() {
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

export function makeNewsArticle() {
  return {
    id: 'news-001',
    title: '茅台发布半年报',
    content: '贵州茅台2026年上半年营收增长15%',
    url: TEST_MOCK_NEWS_URL,
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

export function makeNewsStockMap() {
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

export function makeSentimentCache() {
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

export function makeExecutionPlan(overrides: Record<string, unknown> = {}) {
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

export function makePortfolio() {
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

export function makeTradeReviewRecord(overrides: Record<string, unknown> = {}) {
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

export function makeFinancialReport(overrides: Record<string, unknown> = {}) {
  return {
    symbol: '600519',
    reportDate: '2025-12-31',
    revenue: 1500000000,
    revenueYoY: 15,
    netProfit: 500000000,
    netProfitYoY: 20,
    grossMargin: 90,
    netMargin: 50,
    operatingCF: 600000000,
    rdRatio: 2,
    receivables: 1000000,
    inventoryTurnoverDays: 120,
    interestBearingDebt: 0,
    goodwill: 0,
    netAssets: 2000000000,
    shareholderPledge: 0,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

export function makeWatchlistItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wl-001',
    symbol: '600519',
    name: '贵州茅台',
    addedAt: 1700000000000,
    source: 'manual' as const,
    ...overrides,
  }
}

export function makeCustomAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-001',
    name: '测试智能体',
    description: '用于测试的智能体',
    capabilities: [],
    config: {},
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

export function makeCollectConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cfg-001',
    name: '默认采集配置',
    sources: ['tencent', 'sina'],
    intervals: { kline: '1d', finance: '1q' },
    enabled: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

export function makeTraceRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trace-001',
    traceId: 'trace-001',
    timestamp: 1700000000000,
    actor: 'user',
    action: 'test',
    targetType: 'stock',
    targetCode: '600519',
    ...overrides,
  }
}

export function makeWorkflowDef(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wf-001',
    name: '测试工作流',
    version: 1,
    steps: [],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

export function makeWorkflowSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ws-001',
    workflowId: 'wf-001',
    cron: '0 9 * * *',
    enabled: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

export function makeWorkflowTrigger(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wt-001',
    workflowId: 'wf-001',
    event: 'stock_added',
    enabled: true,
    createdAt: 1700000000000,
    ...overrides,
  }
}

export function makeWorkflowRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wr-001',
    workflowId: 'wf-001',
    scheduleId: 'ws-001',
    status: 'running' as const,
    startedAt: 1700000000000,
    completedAt: undefined,
    result: undefined,
    error: undefined,
    ...overrides,
  }
}

// ── Mock 辅助函数 ──────────────────────────────────────────

/** 设置 query mock 返回成功（单条） */
export function mockQueryGetSuccess<T>(data: T | undefined) {
  mockQuery.mockResolvedValueOnce({ success: true, data })
}

/** 设置 query mock 返回成功（列表） */
export function mockQueryListSuccess<T>(data: T[]) {
  mockQuery.mockResolvedValueOnce({ success: true, data })
}

/** 设置 query mock 返回失败 */
export function mockQueryFail(error: string) {
  mockQuery.mockResolvedValueOnce({ success: false, error })
}

/** 设置 forward mock 成功 */
export function mockForwardSuccess() {
  mockForward.mockResolvedValueOnce(undefined)
}

/** 设置 forward mock 失败 */
export function mockForwardFail(error: string) {
  mockForward.mockRejectedValueOnce(new Error(error))
}
