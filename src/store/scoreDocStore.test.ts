/**
 * @test_id V9-TEST-ST-153
 * scoreDocStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态
 * 2. setSymbol
 * 3. loadVersions 成功
 * 4. loadVersions 失败（service 返回 error）
 * 5. loadVersions 异常（抛出错误）
 * 6. clear
  * @covers_docs [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024]
*/
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useScoreDocStore } from './scoreDocStore'
import { getRecentVersions } from '@/services/analysis/scoreDocService'
import type { ScoreDocVersion, Stock } from '@/data/types'
import { DATA_SOURCE } from '@/config/dbConfig'
import { RESEARCH_STATUS } from '@/constants/pool.constants'
vi.mock('@/services/analysis/scoreDocService', () => ({
  getRecentVersions: vi.fn(),
  exportSymbolMd: vi.fn(),
}))

vi.mock('@/services/pool/poolService', () => ({
  listPoolItems: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  useScoreDocStore.setState({
    symbol: '',
    stocks: [],
    versions: [],
    loading: false,
    error: null,
  })
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

    vi.mocked(getRecentVersions).mockResolvedValueOnce({
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
    vi.mocked(getRecentVersions).mockResolvedValueOnce({
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
    vi.mocked(getRecentVersions).mockRejectedValueOnce(new Error('网络请求失败'))

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
    expect(getRecentVersions).not.toHaveBeenCalled()
  })

  test('loadVersions 开始时设置 loading 为 true', async () => {
    vi.mocked(getRecentVersions).mockImplementationOnce(
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
