/**
 * dataLayer 单元测试
 *
 * 覆盖场景：
 * 1.  stockStore.add/get/list（含边界：重复添加、空列表）
 * 2.  v6ScoreStore.save/get/list
 * 3.  dailyQuoteStore.get（空数据返回 undefined）
 * 4.  orderStore.add/list
 * 5.  signalStore.save/list/listBySymbol
 * 6.  researchLogStore.list（空列表）
 * 7.  错误处理路径（模拟 db 抛出异常时的降级行为）
 * 8.  dataManager.reset/export/import
 */

const {
  mockDbGet,
  mockDbGetAll,
  mockDbGetAllByIndex,
  mockDbReset,
  mockDbExport,
  mockDbImport,
  mockDataBridgeForward,
  mockEnvelopeFactoryCreate,
  mockGenerateId,
  mockNow,
} = vi.hoisted(() => {
  const mockDbGet = vi.fn()
  const mockDbGetAll = vi.fn()
  const mockDbGetAllByIndex = vi.fn()
  const mockDbReset = vi.fn()
  const mockDbExport = vi.fn()
  const mockDbImport = vi.fn()
  const mockDataBridgeForward = vi.fn()
  const mockEnvelopeFactoryCreate = vi.fn()
  const mockGenerateId = vi.fn()
  const mockNow = vi.fn()

  return {
    mockDbGet,
    mockDbGetAll,
    mockDbGetAllByIndex,
    mockDbReset,
    mockDbExport,
    mockDbImport,
    mockDataBridgeForward,
    mockEnvelopeFactoryCreate,
    mockGenerateId,
    mockNow,
  }
})

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('@/config/dbConfig', () => ({
  DATA_SOURCE: { manual: 'manual', import: 'import', akshare: 'akshare' },
  DEFAULT_POOL_GROUP: '默认分组',
  ENVELOPE_ACTION: {
    insertStock: 'INSERT_STOCK',
    updateStock: 'UPDATE_STOCK',
    deleteStock: 'DELETE_STOCK',
    saveScores: 'SAVE_SCORES',
    saveDailyQuotes: 'SAVE_DAILY_QUOTES',
    saveIntelligentScores: 'SAVE_INTELLIGENT_SCORES',
    saveIndustryScores: 'SAVE_INDUSTRY_SCORES',
    saveRotationScores: 'SAVE_ROTATION_SCORES',
    saveSectorScores: 'SAVE_SECTOR_SCORES',
    saveScoreDocs: 'SAVE_SCORE_DOCS',
    saveStrategySnapshots: 'SAVE_STRATEGY_SNAPSHOTS',
    saveHotSectorScores: 'SAVE_HOT_SECTOR_SCORES',
    saveValuePitScores: 'SAVE_VALUE_PIT_SCORES',
    saveLocalDocs: 'SAVE_LOCAL_DOCS',
    saveNews: 'SAVE_NEWS',
    saveNewsStockMap: 'SAVE_NEWS_STOCK_MAP',
    saveSentimentCache: 'SAVE_SENTIMENT_CACHE',
    saveResearchLog: 'SAVE_RESEARCH_LOG',
    insertSignal: 'INSERT_SIGNAL',
    insertOrder: 'INSERT_ORDER',
    updateOrder: 'UPDATE_ORDER',
    deleteOrder: 'DELETE_ORDER',
    resetAll: 'RESET_ALL',
    importAll: 'IMPORT_ALL',
    exportAll: 'EXPORT_ALL',
    createExecutionPlan: 'CREATE_EXECUTION_PLAN',
    updateExecutionPhase: 'UPDATE_EXECUTION_PHASE',
    saveExecutionLog: 'SAVE_EXECUTION_LOG',
    saveMissingReport: 'SAVE_MISSING_REPORT',
    updateMissingReport: 'UPDATE_MISSING_REPORT',
    saveWatchlist: 'SAVE_WATCHLIST',
    saveNewsBookmark: 'SAVE_NEWS_BOOKMARK',
  },
  ENVELOPE_TARGET: { db: 'db' },
  MODULE_ID: {
    fetcher: 'fetcher',
    stockpool: 'stockpool',
    analyzer: 'analyzer',
    tradinghub: 'tradinghub',
    system: 'system',
    rotation: 'rotation',
    sector: 'sector',
    news: 'news',
    strategy: 'strategy',
    user: 'user',
  },
  RESEARCH_STATUS: {
    candidate: 'candidate',
    screened: 'screened',
    deepDive: 'deepDive',
    watching: 'watching',
    archived: 'archived',
  },
  STORE_NAME: {
    stocks: 'stocks',
    v6Scores: 'v6_scores',
    intelligentScores: 'intelligent_scores',
    industryScores: 'industry_scores',
    orders: 'orders',
    watchlists: 'watchlists',
    signals: 'signals',
    researchLogs: 'research_logs',
    dailyQuotes: 'daily_quotes',
    rotationScores: 'rotation_scores',
    sectorScores: 'sector_scores',
    scoreDocs: 'score_docs',
    strategySnapshots: 'strategy_snapshots',
    localDocs: 'local_docs',
    news: 'news',
    newsStockMap: 'news_stock_map',
    sentimentCache: 'sentiment_cache',
    newsBookmarks: 'news_bookmarks',
    hotSectorScores: 'hot_sector_scores',
    valuePitScores: 'value_pit_scores',
    executionLogs: 'execution_logs',
    missingReports: 'missing_reports',
  },
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: { forward: mockDataBridgeForward },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: { create: mockEnvelopeFactoryCreate },
}))

vi.mock('@/data/db', () => ({
  db: {
    get: mockDbGet,
    getAll: mockDbGetAll,
    getAllByIndex: mockDbGetAllByIndex,
    reset: mockDbReset,
    export: mockDbExport,
    import: mockDbImport,
  },
  generateId: mockGenerateId,
  now: mockNow,
}))

import {
  stockStore,
  v6ScoreStore,
  dailyQuoteStore,
  orderStore,
  signalStore,
  researchLogStore,
  dataManager,
  executionLogStore,
  missingReportStore,
  watchlistStore,
  newsBookmarkStore,
  dataLayer,
} from './dataLayer'
import type {
  Stock,
  V6Score,
  DailyQuotes,
  Order,
  Signal,
  ResearchLog,
  ExecutionLog,
  MissingReport,
  NewsBookmark,
  Watchlist,
} from './types'

// ---- 辅助数据工厂函数 ----

function createStock(overrides: Partial<Stock> = {}): Stock {
  return {
    symbol: '000001',
    name: '平安银行',
    researchStatus: 'candidate' as Stock['researchStatus'],
    source: 'manual' as Stock['source'],
    dataVersion: 1,
    ...overrides,
  }
}

function createV6Score(overrides: Partial<V6Score> = {}): V6Score {
  return {
    symbol: '000001',
    score: 85,
    factors: { moat: 80, valuation: 75, growth: 90 },
    algorithmVersion: 'v6.0',
    calculatedAt: 1700000000000,
    dataVersion: 1,
    ...overrides,
  }
}

function createDailyQuotes(overrides: Partial<DailyQuotes> = {}): DailyQuotes {
  return {
    symbol: '000001',
    latest: {
      date: '2026-06-29',
      open: 10.5,
      high: 10.8,
      low: 10.3,
      close: 10.6,
      volume: 1000000,
      amount: 10600000,
    },
    history: [],
    period: 'daily',
    adjust: 'qfq',
    updatedAt: 1700000000000,
    ...overrides,
  }
}

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-001',
    symbol: '000001',
    direction: 'buy' as Order['direction'],
    quantity: 100,
    price: 10.5,
    amount: 1050,
    status: 'filled' as Order['status'],
    accountType: 'paper' as Order['accountType'],
    createdAt: 1700000000000,
    ...overrides,
  }
}

function createSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'signal-001',
    symbol: '000001',
    direction: 'buy',
    type: 'technical',
    confidence: 0.85,
    rationale: '均线金叉',
    snapshot: {},
    createdAt: 1700000000000,
    ...overrides,
  }
}

function createResearchLog(overrides: Partial<ResearchLog> = {}): ResearchLog {
  return {
    id: 1,
    traceId: 'trace-001',
    timestamp: 1700000000000,
    actor: 'system',
    action: 'ANALYZE',
    targetType: 'stock',
    targetCode: '000001',
    ...overrides,
  }
}

function createExecutionLog(overrides: Partial<ExecutionLog> = {}): ExecutionLog {
  return {
    id: 1,
    planId: 'plan-001',
    symbol: '000001',
    phase: 'plan' as ExecutionLog['phase'],
    action: 'create' as ExecutionLog['action'],
    actor: 'system',
    timestamp: 1700000000000,
    success: true,
    ...overrides,
  }
}

function createMissingReport(overrides: Partial<MissingReport> = {}): MissingReport {
  return {
    id: 1,
    symbol: '000001',
    reportType: 'research' as MissingReport['reportType'],
    severity: 'medium' as MissingReport['severity'],
    reason: '研报数据缺失',
    detectedAt: 1700000000000,
    retryCount: 0,
    ...overrides,
  }
}

function createNewsBookmark(overrides: Partial<NewsBookmark> = {}): NewsBookmark {
  return {
    id: 'news-001',
    bookmarkedAt: 1700000000000,
    ...overrides,
  }
}

function createWatchlist(overrides: Partial<Watchlist> = {}): Watchlist {
  return {
    id: 'watchlist-001',
    name: '我的观察',
    items: ['000001', '000002'],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

// ---- 测试前重置 ----

beforeEach(() => {
  vi.clearAllMocks()
  mockEnvelopeFactoryCreate.mockReturnValue({ meta: { traceId: 'test-trace' }, payload: {} })
  mockDataBridgeForward.mockResolvedValue(undefined)
  mockGenerateId.mockReturnValue('gen-id-001')
  mockNow.mockReturnValue(1700000000000)
})

// ============================================================
// stockStore
// ============================================================
describe('stockStore', () => {
  describe('add', () => {
    it('成功添加新股', async () => {
      mockDbGet.mockResolvedValue(undefined)
      const stock = createStock()

      const result = await stockStore.add(stock)

      expect(mockDbGet).toHaveBeenCalledWith('stocks', '000001')
      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.symbol).toBe('000001')
      expect(result.data?.name).toBe('平安银行')
    })

    it('重复添加返回错误', async () => {
      const existing = createStock()
      mockDbGet.mockResolvedValue(existing)

      const result = await stockStore.add(createStock())

      expect(result.success).toBe(false)
      expect(result.error).toContain('已存在')
      expect(mockDataBridgeForward).not.toHaveBeenCalled()
    })

    it('dataBridge.forward 失败时返回错误', async () => {
      mockDbGet.mockResolvedValue(undefined)
      mockDataBridgeForward.mockRejectedValueOnce(new Error('网络错误'))

      const result = await stockStore.add(createStock())

      expect(result.success).toBe(false)
      expect(result.error).toBe('网络错误')
    })

    it('dataBridge.forward 抛出非 Error 对象时捕获消息', async () => {
      mockDbGet.mockResolvedValue(undefined)
      mockDataBridgeForward.mockRejectedValueOnce('字符串异常')

      const result = await stockStore.add(createStock())

      expect(result.success).toBe(false)
      expect(result.error).toBe('字符串异常')
    })
  })

  describe('get', () => {
    it('获取已存在的股票', async () => {
      const stock = createStock()
      mockDbGet.mockResolvedValue(stock)

      const result = await stockStore.get('000001')

      expect(mockDbGet).toHaveBeenCalledWith('stocks', '000001')
      expect(result).toEqual(stock)
    })

    it('获取不存在的股票返回 undefined', async () => {
      mockDbGet.mockResolvedValue(undefined)

      const result = await stockStore.get('999999')

      expect(result).toBeUndefined()
    })

    it('db.get 抛出异常时返回 undefined', async () => {
      mockDbGet.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await stockStore.get('000001')

      expect(result).toBeUndefined()
    })
  })

  describe('list', () => {
    it('返回股票列表', async () => {
      const stocks = [createStock(), createStock({ symbol: '000002', name: '万科A' })]
      mockDbGetAll.mockResolvedValue(stocks)

      const result = await stockStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('stocks')
      expect(result).toHaveLength(2)
    })

    it('空列表返回空数组', async () => {
      mockDbGetAll.mockResolvedValue([])

      const result = await stockStore.list()

      expect(result).toEqual([])
    })

    it('db.getAll 抛出异常时返回空数组', async () => {
      mockDbGetAll.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await stockStore.list()

      expect(result).toEqual([])
    })
  })
})

// ============================================================
// v6ScoreStore
// ============================================================
describe('v6ScoreStore', () => {
  describe('save', () => {
    it('保存评分成功', async () => {
      const score = createV6Score()

      const result = await v6ScoreStore.save(score)

      expect(mockEnvelopeFactoryCreate).toHaveBeenCalled()
      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })

    it('保存评分失败时返回错误', async () => {
      mockDataBridgeForward.mockRejectedValueOnce(new Error('写入失败'))

      const result = await v6ScoreStore.save(createV6Score())

      expect(result.success).toBe(false)
      expect(result.error).toBe('写入失败')
    })
  })

  describe('get', () => {
    it('获取已存在的评分', async () => {
      const score = createV6Score()
      mockDbGet.mockResolvedValue(score)

      const result = await v6ScoreStore.get('000001')

      expect(mockDbGet).toHaveBeenCalledWith('v6_scores', '000001')
      expect(result).toEqual(score)
    })

    it('获取不存在的评分返回 undefined', async () => {
      mockDbGet.mockResolvedValue(undefined)

      const result = await v6ScoreStore.get('999999')

      expect(result).toBeUndefined()
    })

    it('db.get 异常时返回 undefined', async () => {
      mockDbGet.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await v6ScoreStore.get('000001')

      expect(result).toBeUndefined()
    })
  })

  describe('list', () => {
    it('返回评分列表', async () => {
      const scores = [createV6Score(), createV6Score({ symbol: '000002', score: 72 })]
      mockDbGetAll.mockResolvedValue(scores)

      const result = await v6ScoreStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('v6_scores')
      expect(result).toHaveLength(2)
    })

    it('db.getAll 异常时返回空数组', async () => {
      mockDbGetAll.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await v6ScoreStore.list()

      expect(result).toEqual([])
    })
  })
})

// ============================================================
// dailyQuoteStore
// ============================================================
describe('dailyQuoteStore', () => {
  describe('get', () => {
    it('获取已存在的行情数据', async () => {
      const quotes = createDailyQuotes()
      mockDbGet.mockResolvedValue(quotes)

      const result = await dailyQuoteStore.get('000001')

      expect(mockDbGet).toHaveBeenCalledWith('daily_quotes', '000001')
      expect(result).toEqual(quotes)
    })

    it('空数据返回 undefined', async () => {
      mockDbGet.mockResolvedValue(undefined)

      const result = await dailyQuoteStore.get('999999')

      expect(result).toBeUndefined()
    })

    it('db.get 异常时返回 undefined', async () => {
      mockDbGet.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await dailyQuoteStore.get('000001')

      expect(result).toBeUndefined()
    })
  })
})

// ============================================================
// orderStore
// ============================================================
describe('orderStore', () => {
  describe('add', () => {
    it('成功添加订单', async () => {
      const orderInput = {
        symbol: '000001',
        direction: 'buy' as const,
        quantity: 100,
        price: 10.5,
        amount: 1050,
        status: 'pending' as const,
        accountType: 'paper' as const,
      }

      const result = await orderStore.add(orderInput)

      expect(mockGenerateId).toHaveBeenCalled()
      expect(mockNow).toHaveBeenCalled()
      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('gen-id-001')
      expect(result.data?.symbol).toBe('000001')
    })

    it('dataBridge.forward 失败时返回错误', async () => {
      mockDataBridgeForward.mockRejectedValueOnce(new Error('订单写入失败'))

      const result = await orderStore.add({
        symbol: '000001',
        direction: 'buy',
        quantity: 100,
        price: 10.5,
        amount: 1050,
        status: 'pending',
        accountType: 'paper',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('订单写入失败')
    })
  })

  describe('list', () => {
    it('返回订单列表', async () => {
      const orders = [createOrder(), createOrder({ id: 'order-002', symbol: '000002' })]
      mockDbGetAll.mockResolvedValue(orders)

      const result = await orderStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('orders')
      expect(result).toHaveLength(2)
    })
  })
})

// ============================================================
// signalStore
// ============================================================
describe('signalStore', () => {
  describe('save', () => {
    it('成功保存信号', async () => {
      const signal = createSignal()

      const result = await signalStore.save(signal)

      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(signal)
    })

    it('保存信号失败时返回错误', async () => {
      mockDataBridgeForward.mockRejectedValueOnce(new Error('信号写入失败'))

      const result = await signalStore.save(createSignal())

      expect(result.success).toBe(false)
      expect(result.error).toBe('信号写入失败')
    })
  })

  describe('list', () => {
    it('返回信号列表', async () => {
      const signals = [createSignal(), createSignal({ id: 'signal-002', symbol: '000002' })]
      mockDbGetAll.mockResolvedValue(signals)

      const result = await signalStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('signals')
      expect(result).toHaveLength(2)
    })
  })

  describe('listBySymbol', () => {
    it('按 symbol 过滤信号', async () => {
      const signals = [
        createSignal({ id: 'signal-001', symbol: '000001' }),
        createSignal({ id: 'signal-002', symbol: '000001' }),
        createSignal({ id: 'signal-003', symbol: '000002' }),
      ]
      mockDbGetAll.mockResolvedValue(signals)

      const result = await signalStore.listBySymbol('000001')

      expect(result).toHaveLength(2)
      expect(result.every((s) => s.symbol === '000001')).toBe(true)
    })

    it('无匹配信号时返回空数组', async () => {
      const signals = [createSignal({ symbol: '000001' })]
      mockDbGetAll.mockResolvedValue(signals)

      const result = await signalStore.listBySymbol('999999')

      expect(result).toEqual([])
    })
  })
})

// ============================================================
// researchLogStore
// ============================================================
describe('researchLogStore', () => {
  describe('list', () => {
    it('返回研究日志列表', async () => {
      const logs = [createResearchLog(), createResearchLog({ id: 2, traceId: 'trace-002' })]
      mockDbGetAll.mockResolvedValue(logs)

      const result = await researchLogStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('research_logs')
      expect(result).toHaveLength(2)
    })

    it('空列表返回空数组', async () => {
      mockDbGetAll.mockResolvedValue([])

      const result = await researchLogStore.list()

      expect(result).toEqual([])
    })
  })
})

// ============================================================
// dataManager
// ============================================================
describe('dataManager', () => {
  describe('reset', () => {
    it('调用 db.reset 清空所有数据', async () => {
      mockDbReset.mockResolvedValue(undefined)

      await dataManager.reset()

      expect(mockDbReset).toHaveBeenCalledTimes(1)
    })
  })

  describe('export', () => {
    it('调用 db.export 并返回导出数据', async () => {
      const exportData = { stocks: [{ symbol: '000001', name: '平安银行' }], orders: [] }
      mockDbExport.mockResolvedValue(exportData)

      const result = await dataManager.export()

      expect(mockDbExport).toHaveBeenCalledTimes(1)
      expect(result).toEqual(exportData)
    })
  })

  describe('import', () => {
    it('调用 db.import 导入数据', async () => {
      mockDbImport.mockResolvedValue(undefined)
      const importData = { stocks: [{ symbol: '000001', name: '平安银行' }] }

      await dataManager.import(importData)

      expect(mockDbImport).toHaveBeenCalledWith(importData)
    })
  })
})

// ============================================================
// executionLogStore
// ============================================================
describe('executionLogStore', () => {
  describe('list', () => {
    it('返回执行日志列表', async () => {
      const logs = [createExecutionLog(), createExecutionLog({ id: 2, planId: 'plan-002' })]
      mockDbGetAll.mockResolvedValue(logs)

      const result = await executionLogStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('execution_logs')
      expect(result).toHaveLength(2)
    })

    it('空列表返回空数组', async () => {
      mockDbGetAll.mockResolvedValue([])

      const result = await executionLogStore.list()

      expect(result).toEqual([])
    })

    it('db.getAll 异常时返回空数组', async () => {
      mockDbGetAll.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await executionLogStore.list()

      expect(result).toEqual([])
    })
  })

  describe('listByPlan', () => {
    it('按 planId 过滤执行日志', async () => {
      const logs = [createExecutionLog({ planId: 'plan-001' }), createExecutionLog({ planId: 'plan-001' })]
      mockDbGetAllByIndex.mockResolvedValue(logs)

      const result = await executionLogStore.listByPlan('plan-001')

      expect(mockDbGetAllByIndex).toHaveBeenCalledWith('execution_logs', 'by-plan', 'plan-001')
      expect(result).toHaveLength(2)
    })

    it('索引查询异常时返回空数组', async () => {
      mockDbGetAllByIndex.mockRejectedValueOnce(new Error('索引异常'))

      const result = await executionLogStore.listByPlan('plan-001')

      expect(result).toEqual([])
    })
  })

  describe('listBySymbol', () => {
    it('按 symbol 过滤执行日志', async () => {
      const logs = [createExecutionLog({ symbol: '000001' })]
      mockDbGetAllByIndex.mockResolvedValue(logs)

      const result = await executionLogStore.listBySymbol('000001')

      expect(mockDbGetAllByIndex).toHaveBeenCalledWith('execution_logs', 'by-symbol', '000001')
      expect(result).toHaveLength(1)
    })
  })

  describe('save', () => {
    it('成功保存执行日志', async () => {
      const logInput: Omit<ExecutionLog, 'id'> = {
        planId: 'plan-001',
        symbol: '000001',
        phase: 'plan',
        action: 'create',
        actor: 'system',
        timestamp: 1700000000000,
        success: true,
      }

      const result = await executionLogStore.save(logInput)

      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================
// missingReportStore
// ============================================================
describe('missingReportStore', () => {
  describe('list', () => {
    it('返回缺失报告列表', async () => {
      const reports = [createMissingReport(), createMissingReport({ id: 2, symbol: '000002' })]
      mockDbGetAll.mockResolvedValue(reports)

      const result = await missingReportStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('missing_reports')
      expect(result).toHaveLength(2)
    })

    it('db.getAll 异常时返回空数组', async () => {
      mockDbGetAll.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await missingReportStore.list()

      expect(result).toEqual([])
    })
  })

  describe('listBySeverity', () => {
    it('按严重度过滤', async () => {
      mockDbGetAllByIndex.mockResolvedValue([createMissingReport({ severity: 'critical' })])

      const result = await missingReportStore.listBySeverity('critical')

      expect(mockDbGetAllByIndex).toHaveBeenCalledWith('missing_reports', 'by-severity', 'critical')
      expect(result).toHaveLength(1)
    })
  })

  describe('report', () => {
    it('成功登记缺失报告', async () => {
      const reportInput: Omit<MissingReport, 'id'> = {
        symbol: '000001',
        reportType: 'research',
        severity: 'high',
        reason: '研报拉取失败',
        detectedAt: 1700000000000,
        retryCount: 0,
      }

      const result = await missingReportStore.report(reportInput)

      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })
  })

  describe('incrementRetry', () => {
    it('成功递增重试次数', async () => {
      const result = await missingReportStore.incrementRetry(1)

      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================
// watchlistStore
// ============================================================
describe('watchlistStore', () => {
  describe('list', () => {
    it('返回观察列表', async () => {
      const lists = [createWatchlist(), createWatchlist({ id: 'watchlist-002' })]
      mockDbGetAll.mockResolvedValue(lists)

      const result = await watchlistStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('watchlists')
      expect(result).toHaveLength(2)
    })

    it('异常时返回空数组', async () => {
      mockDbGetAll.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await watchlistStore.list()

      expect(result).toEqual([])
    })
  })

  describe('get', () => {
    it('获取已存在的观察列表', async () => {
      const list = createWatchlist()
      mockDbGet.mockResolvedValue(list)

      const result = await watchlistStore.get('watchlist-001')

      expect(mockDbGet).toHaveBeenCalledWith('watchlists', 'watchlist-001')
      expect(result).toEqual(list)
    })

    it('不存在的观察列表返回 undefined', async () => {
      mockDbGet.mockResolvedValue(undefined)

      const result = await watchlistStore.get('non-existent')

      expect(result).toBeUndefined()
    })
  })

  describe('save', () => {
    it('成功保存观察列表', async () => {
      const list = createWatchlist()

      const result = await watchlistStore.save(list)

      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================
// newsBookmarkStore
// ============================================================
describe('newsBookmarkStore', () => {
  describe('list', () => {
    it('返回资讯收藏列表', async () => {
      const bookmarks = [createNewsBookmark(), createNewsBookmark({ id: 'news-002' })]
      mockDbGetAll.mockResolvedValue(bookmarks)

      const result = await newsBookmarkStore.list()

      expect(mockDbGetAll).toHaveBeenCalledWith('news_bookmarks')
      expect(result).toHaveLength(2)
    })

    it('异常时返回空数组', async () => {
      mockDbGetAll.mockRejectedValueOnce(new Error('数据库异常'))

      const result = await newsBookmarkStore.list()

      expect(result).toEqual([])
    })
  })

  describe('get', () => {
    it('获取已存在的收藏', async () => {
      const bookmark = createNewsBookmark()
      mockDbGet.mockResolvedValue(bookmark)

      const result = await newsBookmarkStore.get('news-001')

      expect(mockDbGet).toHaveBeenCalledWith('news_bookmarks', 'news-001')
      expect(result).toEqual(bookmark)
    })
  })

  describe('save', () => {
    it('成功保存收藏', async () => {
      const bookmark = createNewsBookmark()

      const result = await newsBookmarkStore.save(bookmark)

      expect(mockDataBridgeForward).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================
// dataLayer aggregator
// ============================================================
describe('dataLayer aggregator', () => {
  it('暴露全部已实现 store', () => {
    expect(dataLayer.stocks).toBe(stockStore)
    expect(dataLayer.v6Scores).toBe(v6ScoreStore)
    expect(dataLayer.dailyQuotes).toBe(dailyQuoteStore)
    expect(dataLayer.orders).toBe(orderStore)
    expect(dataLayer.signals).toBe(signalStore)
    expect(dataLayer.researchLogs).toBe(researchLogStore)
    expect(dataLayer.executionLogs).toBe(executionLogStore)
    expect(dataLayer.missingReports).toBe(missingReportStore)
    expect(dataLayer.watchlists).toBe(watchlistStore)
    expect(dataLayer.newsBookmarks).toBe(newsBookmarkStore)
    expect(dataLayer.manager).toBe(dataManager)
  })
})