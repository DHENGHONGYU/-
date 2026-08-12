/**
 * collectedDataSyncService 端到端模拟测试
 *
 * 模拟 5 只股票 × 7 个维度的批量采集场景：
 *   1. Mock DataBridge 查询层（queryGet/queryByIndex/queryList）
 *   2. Mock Electron fileSync.writeFiles（捕获写入的文件）
 *   3. 调用 syncCollectedDataToLocal 完整流程
 *   4. 验证生成的文件结构、目录组织、内容正确性
 *
 * 测试场景覆盖：
 *   - 全部维度成功
 *   - 部分维度失败（模拟 05 热点新闻失败）
 *   - 空数据维度（某维度无数据时不应生成文件）
 *   - 股票基本信息缺失（name/industry 为空）
 *   - Markdown 汇总报告内容校验
 *
 * @module collectedDataSyncService.integration.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Mock DataBridge 查询层 ──
const mockQueryGet = vi.fn()
const mockQueryByIndex = vi.fn()
const mockQueryList = vi.fn()

vi.mock('@/core/databridgeQueries', () => ({
  queryGet: (...args: unknown[]) => mockQueryGet(...args),
  queryByIndex: (...args: unknown[]) => mockQueryByIndex(...args),
  queryList: (...args: unknown[]) => mockQueryList(...args),
}))

// ── Mock logger（避免控制台噪音）──
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import {
  syncCollectedDataToLocal,
  collectSymbolFiles,
  hasElectronFs,
  type BatchMetadata,
  type SymbolMetadata,
} from '@/services/data-collector/collectedDataSyncService'
import type { TraceResult } from '@/services/data-collector/collectionPipeline'
import type { CollectionConfig } from '@/types/modules/collection.types'

// ============================================================
// 模拟数据构造
// ============================================================

const SYMBOLS = [
  '000001.SZ',
  '000858.SZ',
  '600276.SH',
  '601899.SH',
  '300750.SZ',
]

const STOCK_NAMES: Record<string, string> = {
  '000001.SZ': '平安银行',
  '000858.SZ': '五粮液',
  '600276.SH': '恒瑞医药',
  '601899.SH': '紫金矿业',
  '300750.SZ': '宁德时代',
}

const STOCK_INDUSTRIES: Record<string, string> = {
  '000001.SZ': '银行',
  '000858.SZ': '食品饮料',
  '600276.SH': '医药生物',
  '601899.SH': '有色金属',
  '300750.SZ': '电力设备',
}

/** 模拟 IndexedDB stocks store 数据 */
function mockStocksData(): Record<string, Record<string, unknown>> {
  const data: Record<string, Record<string, unknown>> = {}
  for (const sym of SYMBOLS) {
    data[sym] = {
      symbol: sym,
      name: STOCK_NAMES[sym],
      industry: STOCK_INDUSTRIES[sym],
      marketCap: Math.round(Math.random() * 1e11),
      pe: 5 + Math.random() * 40,
      pb: 0.5 + Math.random() * 8,
      roe: 0.05 + Math.random() * 0.25,
      researchStatus: 'researching',
      group: 'core',
    }
  }
  // 300750.SZ 模拟信息缺失
  data['300750.SZ']!.name = ''
  data['300750.SZ']!.industry = undefined
  return data
}

/** 模拟 IndexedDB daily_quotes store 数据（每只股票 5 天 K 线） */
function mockDailyQuotesData(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const sym of SYMBOLS) {
    const basePrice = 10 + Math.random() * 100
    for (let day = 0; day < 5; day++) {
      const open = basePrice + (Math.random() - 0.5) * 5
      const close = open + (Math.random() - 0.5) * 3
      const high = Math.max(open, close) + Math.random() * 2
      const low = Math.min(open, close) - Math.random() * 2
      const d = new Date(2026, 7, 5 + day)
      rows.push({
        symbol: sym,
        date: d.toISOString().slice(0, 10),
        open: Math.round(open * 100) / 100,
        close: Math.round(close * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        volume: Math.round(Math.random() * 1e8),
        amount: Math.round(Math.random() * 1e10),
        source: 'akshare',
      })
    }
  }
  return rows
}

/** 模拟 IndexedDB news store 数据 */
function mockNewsData(): Record<string, unknown>[] {
  const news: Record<string, unknown>[] = []
  let id = 0
  for (const sym of SYMBOLS) {
    // 03 筹码
    news.push({
      id: `news-${id++}`,
      symbol: sym,
      dimensionCode: '03',
      title: `${STOCK_NAMES[sym] || sym} 筹码集中度分析`,
      summary: '主力筹码持续集中，机构持仓占比上升',
      publishedAt: Date.now() - Math.random() * 86400000,
      source: 'crawler',
    })
    // 04 重大事项
    news.push({
      id: `news-${id++}`,
      symbol: sym,
      dimensionCode: '04',
      title: `${STOCK_NAMES[sym] || sym} 发布2026年中报`,
      summary: '营收同比增长15%，净利润超预期',
      publishedAt: Date.now() - Math.random() * 86400000,
      source: 'tushare',
    })
  }
  // 05 热点新闻：只为前 4 只生成，模拟 300750.SZ 无新闻数据
  for (const sym of SYMBOLS.slice(0, 4)) {
    news.push({
      id: `news-${id++}`,
      symbol: sym,
      dimensionCode: '05',
      title: `${STOCK_NAMES[sym]} 入选热门板块`,
      summary: '板块轮动信号触发，资金大幅流入',
      publishedAt: Date.now() - Math.random() * 3600000,
      source: 'sina',
    })
  }
  return news
}

/** 模拟 IndexedDB sector_scores store 数据 */
function mockSectorScoresData(): Record<string, unknown>[] {
  const scores: Record<string, unknown>[] = []
  for (const sym of SYMBOLS) {
    // 06 行业竞品
    scores.push({
      id: `ss-06-${sym}`,
      symbol: sym,
      dimensionCode: '06',
      industryRank: Math.ceil(Math.random() * 10),
      marketShare: Math.round(Math.random() * 1000) / 10,
      competitors: ['竞品A', '竞品B', '竞品C'],
    })
    // 07 关联指数
    scores.push({
      id: `ss-07-${sym}`,
      symbol: sym,
      dimensionCode: '07',
      indexCode: '000300.SH',
      etfCode: '510300.SH',
      correlation: Math.round(Math.random() * 100) / 100,
    })
  }
  return scores
}

/** 模拟 IndexedDB research_logs store 数据 */
function mockResearchLogsData(): Record<string, unknown>[] {
  const logs: Record<string, unknown>[] = []
  for (const sym of SYMBOLS) {
    logs.push({
      id: `rl-${sym}`,
      symbol: sym,
      title: `${STOCK_NAMES[sym] || sym} 深度研究报告`,
      author: '中信证券',
      rating: '买入',
      targetPrice: Math.round(50 + Math.random() * 200),
      publishedAt: Date.now() - Math.random() * 604800000,
      content: '公司基本面稳健，行业景气度向上...',
    })
  }
  return logs
}

/** 模拟 IndexedDB financial_reports store 数据 */
function mockFinancialReportsData(): Record<string, unknown>[] {
  const reports: Record<string, unknown>[] = []
  for (const sym of SYMBOLS) {
    reports.push({
      id: `fr-${sym}`,
      symbol: sym,
      period: '2026Q2',
      revenue: Math.round(Math.random() * 1e10),
      netProfit: Math.round(Math.random() * 1e9),
      eps: Math.round(Math.random() * 300) / 100,
      grossMargin: Math.round(Math.random() * 5000) / 100,
      netMargin: Math.round(Math.random() * 3000) / 100,
      debtRatio: Math.round(Math.random() * 7000) / 100,
    })
  }
  return reports
}

/** 模拟采集链路结果 TraceResult[] */
function mockTraceResults(): TraceResult[] {
  const dims = ['01', '02', '03', '04', '05', '06', '07', '08', '09']
  const traces: TraceResult[] = []
  for (const sym of SYMBOLS) {
    for (const dim of dims) {
      // 300750.SZ 的 05 热点新闻维度模拟失败
      const fail = sym === '300750.SZ' && dim === '05'
      traces.push({
        symbol: sym,
        dimensionCode: dim,
        success: !fail,
        source: fail ? undefined : 'akshare',
        latency: fail ? 5000 : Math.round(50 + Math.random() * 400),
        fallbackCount: fail ? 2 : 0,
        error: fail ? 'timeout: all sources circuit-open' : undefined,
      })
    }
  }
  return traces
}

/** 构建测试用 CollectionConfig */
function mockCollectionConfig(dimCodes: string[]): CollectionConfig {
  return {
    version: '1.0.0',
    activeTemplate: 'value',
    dimensions: dimCodes.map((code) => ({
      code,
      name: `维度${code}`,
      enabled: true,
      frequency: 'daily' as const,
      batchSize: 50,
      sources: ['akshare'],
      cacheTtl: 1440,
      storageType: 'full' as const,
      fields: [],
      importance: 'medium' as const,
      sourcePriority: [{ id: 'akshare', priority: 1, enabled: true }],
      concurrency: 5,
      retryPolicy: { maxRetries: 2, backoffMs: 1000 },
      timeoutPolicy: { connectMs: 5000, readMs: 10000 },
      fallbackPolicy: { allowMockFallback: false },
    })),
    global: {
      maxSymbols: 40,
      defaultBatchSize: 50,
      rateLimitPerMinute: 10,
      rateLimitPerHour: 200,
      rateLimitPerDay: 2000,
      notifyOnComplete: true,
      notifyOnError: true,
      defaultTimeoutMs: 5000,
      defaultRetries: 2,
    },
    symbolCount: SYMBOLS.length,
    historyDays: 252,
    updatedAt: Date.now(),
  }
}

// ============================================================
// Mock 文件写入捕获器
// ============================================================

interface CapturedFile {
  relativePath: string
  content: string
}

let capturedFiles: CapturedFile[] = []
let capturedRootDir = ''

function setupElectronMock(): void {
  capturedFiles = []
  capturedRootDir = ''
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    fileSync: {
      writeFiles: async (params: {
        rootDir: string
        files: Array<{ relativePath: string; content: string }>
      }): Promise<{ success: boolean; rootDir: string; writtenCount: number }> => {
        capturedRootDir = params.rootDir
        capturedFiles = params.files.map((f) => ({ ...f }))
        return {
          success: true,
          rootDir: params.rootDir,
          writtenCount: params.files.length,
        }
      },
    },
  }
}

function teardownElectronMock(): void {
  delete (globalThis as unknown as { window?: unknown }).window
}

// ============================================================
// 测试用例
// ============================================================

describe('collectedDataSyncService 端到端模拟', () => {
  const stocksData = mockStocksData()
  const dailyQuotesData = mockDailyQuotesData()
  const newsData = mockNewsData()
  const sectorScoresData = mockSectorScoresData()
  const researchLogsData = mockResearchLogsData()
  const financialReportsData = mockFinancialReportsData()

  beforeEach(() => {
    // 重置 mock
    mockQueryGet.mockReset()
    mockQueryByIndex.mockReset()
    mockQueryList.mockReset()

    // 配置默认 mock 行为
    // queryGet(stocks, symbol) → 返回对应股票信息
    mockQueryGet.mockImplementation((store: string, key: string) => {
      if (store === 'stocks') return Promise.resolve(stocksData[key] ?? undefined)
      return Promise.resolve(undefined)
    })

    // queryByIndex(store, indexName, indexValue) → 按 symbol 索引查询
    mockQueryByIndex.mockImplementation((store: string, _indexName: string, indexValue: string) => {
      if (store === 'daily_quotes') {
        return Promise.resolve(dailyQuotesData.filter((r) => r['symbol'] === indexValue))
      }
      if (store === 'sector_scores') {
        return Promise.resolve(sectorScoresData.filter((r) => r['symbol'] === indexValue))
      }
      if (store === 'research_logs') {
        return Promise.resolve(researchLogsData.filter((r) => r['symbol'] === indexValue))
      }
      if (store === 'financial_reports') {
        return Promise.resolve(financialReportsData.filter((r) => r['symbol'] === indexValue))
      }
      return Promise.resolve([])
    })

    // queryList(store) → 返回全量数据
    mockQueryList.mockImplementation((store: string) => {
      if (store === 'news') return Promise.resolve(newsData)
      if (store === 'daily_quotes') return Promise.resolve(dailyQuotesData)
      if (store === 'sector_scores') return Promise.resolve(sectorScoresData)
      if (store === 'research_logs') return Promise.resolve(researchLogsData)
      if (store === 'financial_reports') return Promise.resolve(financialReportsData)
      return Promise.resolve([])
    })

    setupElectronMock()
  })

  afterEach(() => {
    teardownElectronMock()
  })

  // ── 场景 1：完整同步流程（Electron 环境）──

  it('应在 Electron 环境完整同步 5 只股票 × 9 维度数据', async () => {
    expect(hasElectronFs()).toBe(true)

    const dimCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09']
    const config = mockCollectionConfig(dimCodes)
    const traces = mockTraceResults()

    const result = await syncCollectedDataToLocal(SYMBOLS, dimCodes, traces, {
      parentTaskId: 'e2e-test-batch-001',
      configSnapshot: config,
    })

    // 基本结果校验
    expect(result.success).toBe(true)
    expect(result.symbolCount).toBe(5)
    expect(result.fileCount).toBeGreaterThan(0)
    expect(result.batchDir).toContain('e2e-test-batch-001')
    expect(result.batchDir).toContain('outputs/collected-data')

    // 文件结构校验
    const paths = capturedFiles.map((f) => f.relativePath)
    console.log(`\n[端到端测试] 共生成 ${paths.length} 个文件:\n${paths.map((p) => '  ' + p).join('\n')}\n`)

    // 1. 批量元数据文件
    expect(paths).toContain('_batch_metadata.json')
    const batchMetaFile = capturedFiles.find((f) => f.relativePath === '_batch_metadata.json')
    expect(batchMetaFile).toBeDefined()
    const batchMeta = JSON.parse(batchMetaFile!.content) as BatchMetadata
    expect(batchMeta.batchId).toBe('e2e-test-batch-001')
    expect(batchMeta.symbols).toEqual(SYMBOLS)
    expect(batchMeta.dimensions).toEqual(dimCodes)
    expect(batchMeta.totalTraces).toBe(45) // 5 stocks × 9 dims
    expect(batchMeta.successTraces).toBe(44) // 1 failure (300750.SZ 05)
    expect(batchMeta.failedTraces).toBe(1)

    // 2. Markdown 汇总报告
    expect(paths).toContain('_summary.md')
    const summaryFile = capturedFiles.find((f) => f.relativePath === '_summary.md')
    expect(summaryFile!.content).toContain('# 批量采集资料汇总')
    expect(summaryFile!.content).toContain('- **股票数量**: 5')
    expect(summaryFile!.content).toContain('- **成功率**: 98%')
    expect(summaryFile!.content).toContain('⚠️ 部分失败') // 300750.SZ 有 1 个失败

    // 3. 每只股票都应有 _metadata.json
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/_metadata.json`)
    }

    // 4. 01 基本信息维度 → stock.json
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/01_基本信息/stock.json`)
      const stockFile = capturedFiles.find((f) => f.relativePath === `${sym}/01_基本信息/stock.json`)
      const stockData = JSON.parse(stockFile!.content)
      if (sym === '300750.SZ') {
        // 信息缺失场景
        expect(stockData.name).toBe('')
        expect(stockData.industry).toBeUndefined()
      } else {
        expect(stockData.name).toBe(STOCK_NAMES[sym])
        expect(stockData.industry).toBe(STOCK_INDUSTRIES[sym])
      }
    }

    // 5. 02 K 线数据 → daily_quotes.json + daily_quotes.csv
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/02_K线数据/daily_quotes.json`)
      expect(paths).toContain(`${sym}/02_K线数据/daily_quotes.csv`)
      const csvFile = capturedFiles.find((f) => f.relativePath === `${sym}/02_K线数据/daily_quotes.csv`)
      const csvLines = csvFile!.content.split('\n')
      expect(csvLines.length).toBe(6) // 1 header + 5 data rows
      expect(csvLines[0]).toContain('symbol')
      expect(csvLines[0]).toContain('date')
      expect(csvLines[0]).toContain('open')
      expect(csvLines[0]).toContain('close')
    }

    // 6. 03 筹码 / 04 重大事项 / 05 热点新闻 → news.json
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/03_筹码分布/news.json`)
      expect(paths).toContain(`${sym}/04_重大事项/news.json`)
    }
    // 05 热点新闻：前 4 只有数据，300750.SZ 无数据 → 不应生成文件
    for (const sym of SYMBOLS.slice(0, 4)) {
      expect(paths).toContain(`${sym}/05_热点新闻/news.json`)
    }
    expect(paths).not.toContain('300750.SZ/05_热点新闻/news.json')

    // 7. 06 行业竞品 / 07 关联指数 → sector_scores.json
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/06_行业竞品/sector_scores.json`)
      expect(paths).toContain(`${sym}/07_关联指数/sector_scores.json`)
    }

    // 8. 08 研报中心 → research_logs.json
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/08_研报中心/research_logs.json`)
    }

    // 9. 09 财务数据 → financial_reports.json
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/09_财务数据/financial_reports.json`)
    }
  })

  // ── 场景 2：部分维度失败场景的 metadata 校验 ──

  it('300750.SZ 的 _metadata.json 应记录 05 维度失败信息', async () => {
    const dimCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09']
    const traces = mockTraceResults()

    await syncCollectedDataToLocal(SYMBOLS, dimCodes, traces, {
      parentTaskId: 'e2e-fail-test',
    })

    const metaFile = capturedFiles.find((f) => f.relativePath === '300750.SZ/_metadata.json')
    expect(metaFile).toBeDefined()
    const meta = JSON.parse(metaFile!.content) as SymbolMetadata
    expect(meta.symbol).toBe('300750.SZ')

    // 找到 05 维度的 trace
    const dim05Trace = meta.traces.find((t) => t.dimensionCode === '05')
    expect(dim05Trace).toBeDefined()
    expect(dim05Trace!.success).toBe(false)
    expect(dim05Trace!.error).toContain('circuit-open')
    expect(dim05Trace!.latencyMs).toBe(5000)

    // 其他维度应成功
    const successTraces = meta.traces.filter((t) => t.success)
    expect(successTraces.length).toBe(8)
  })

  // ── 场景 3：Markdown 汇总报告失败详情 ──

  it('_summary.md 应包含失败链路详情', async () => {
    const dimCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09']
    const traces = mockTraceResults()

    await syncCollectedDataToLocal(SYMBOLS, dimCodes, traces, {
      parentTaskId: 'e2e-summary-test',
    })

    const summaryFile = capturedFiles.find((f) => f.relativePath === '_summary.md')
    const md = summaryFile!.content

    // 失败详情
    expect(md).toContain('## 失败链路详情')
    expect(md).toContain('**300750.SZ** [热点新闻]:')
    expect(md).toContain('circuit-open')

    // 明细表应包含 5 只股票
    expect(md).toContain('000001.SZ')
    expect(md).toContain('000858.SZ')
    expect(md).toContain('600276.SH')
    expect(md).toContain('601899.SH')
    expect(md).toContain('300750.SZ')

    // 300750.SZ 应标记为 ⚠️
    expect(md).toContain('| 300750.SZ |  | 01/02/03/04/05/06/07/08/09 | 8 | 1 | ⚠️ 部分失败 |')

    // 其他 4 只应标记为 ✅
    expect(md).toContain('| 000001.SZ | 平安银行 |')
    expect(md).toContain('| 000858.SZ | 五粮液 |')
    expect(md).toContain('| 600276.SH | 恒瑞医药 |')
    expect(md).toContain('| 601899.SH | 紫金矿业 |')
  })

  // ── 场景 4：无 Electron 环境时降级为浏览器下载 ──

  it('无 Electron 环境时应降级为浏览器 bundle 下载', async () => {
    teardownElectronMock()
    // jsdom 环境有 window 但无 fileSync
    ;(globalThis as unknown as { window: Record<string, unknown> }).window = {}

    // Mock DOM 下载
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn(),
    }
    const origCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement
      return origCreateElement(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as unknown as HTMLAnchorElement)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as unknown as HTMLAnchorElement)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const dimCodes = ['01', '02']
    const traces = mockTraceResults().filter((t) => dimCodes.includes(t.dimensionCode))

    const result = await syncCollectedDataToLocal(SYMBOLS, dimCodes, traces, {
      parentTaskId: 'browser-download-test',
    })

    expect(result.success).toBe(true)
    expect(result.fileCount).toBeGreaterThan(0)
    expect(mockAnchor.click).toHaveBeenCalled()
    expect(mockAnchor.download).toContain('.bundle.json')
    expect(mockAnchor.download).toContain('browser-download-test')

    vi.restoreAllMocks()
  })

  // ── 场景 5：单只股票文件收集 ──

  it('collectSymbolFiles 应正确收集单只股票所有维度文件', async () => {
    const dimCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09']
    const traces = mockTraceResults().filter((t) => t.symbol === '000001.SZ')

    const { files, metadata } = await collectSymbolFiles('000001.SZ', dimCodes, traces)

    // 文件数：01(1) + 02(2) + 03(1) + 04(1) + 05(1) + 06(1) + 07(1) + 08(1) + 09(1) + metadata(1) = 11
    expect(files.length).toBe(11)

    // metadata 正确
    expect(metadata.symbol).toBe('000001.SZ')
    expect(metadata.name).toBe('平安银行')
    expect(metadata.industry).toBe('银行')
    expect(metadata.traces.length).toBe(9)
    expect(metadata.traces.every((t) => t.success)).toBe(true)

    // 所有文件路径都以 000001.SZ/ 开头
    for (const f of files) {
      expect(f.relativePath.startsWith('000001.SZ/')).toBe(true)
    }
  })

  // ── 场景 6：空 trace 列表 ──

  it('空 trace 列表时应仍生成元数据和汇总（0 链路）', async () => {
    const result = await syncCollectedDataToLocal(SYMBOLS, ['01'], [], {
      parentTaskId: 'empty-traces-test',
    })

    expect(result.success).toBe(true)
    const batchMetaFile = capturedFiles.find((f) => f.relativePath === '_batch_metadata.json')
    const batchMeta = JSON.parse(batchMetaFile!.content) as BatchMetadata
    expect(batchMeta.totalTraces).toBe(0)
    expect(batchMeta.successTraces).toBe(0)
    expect(batchMeta.failedTraces).toBe(0)

    const summaryFile = capturedFiles.find((f) => f.relativePath === '_summary.md')
    expect(summaryFile!.content).toContain('- **成功率**: 0%')
    expect(summaryFile!.content).toContain('_无失败记录_')
  })

  // ── 场景 7：仅部分维度启用 ──

  it('仅启用 01+02 两个维度时应只生成对应文件', async () => {
    const dimCodes = ['01', '02']
    const traces = mockTraceResults().filter((t) => dimCodes.includes(t.dimensionCode))

    const result = await syncCollectedDataToLocal(SYMBOLS, dimCodes, traces, {
      parentTaskId: 'partial-dims-test',
    })

    expect(result.success).toBe(true)
    const paths = capturedFiles.map((f) => f.relativePath)

    // 不应有 03-09 维度的文件
    for (const sym of SYMBOLS) {
      expect(paths).not.toContain(`${sym}/03_筹码分布/news.json`)
      expect(paths).not.toContain(`${sym}/09_财务数据/financial_reports.json`)
    }

    // 应有 01 和 02 的文件
    for (const sym of SYMBOLS) {
      expect(paths).toContain(`${sym}/01_基本信息/stock.json`)
      expect(paths).toContain(`${sym}/02_K线数据/daily_quotes.json`)
    }
  })
})
