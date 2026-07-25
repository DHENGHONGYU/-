/**
 * @test_id V9-TEST-ST-211
 * profileStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. setSymbol: 设置股票代码并自动加载
 * 3. loadStocks: 成功/失败/已有数据时跳过
 * 4. setActiveDomain: 切换域
 * 5. loadItems: 成功/失败/无 symbol/带筛选
 * 6. setFilter / resetFilter
 * 7. selectItem: 选中/取消选中
 * 8. loadItemDetail: 成功/失败
 * 9. loadEvidence: 成功/失败/无 symbol
 * 10. loadProfile: 成功/失败/无 symbol
 * 11. deleteItem: 成功/失败/无 symbol
 * 12. deleteTag: 成功/失败/无 symbol
 * 13. reset: 重置到初始状态
 * 14. selectDomainCounts: 纯函数
 * 15. selectSelectedItem: 纯函数
 * 16. groupEvidenceByLayer: 纯函数
 * 17. selectAvailableSources: 纯函数
 *
 * minQuality 筛选边界测试:
 * - minQuality=undefined 时不执行筛选
 * - minQuality=0 时排除负分条目
 * - minQuality>0 时正常筛选
 * - qualityScore=null/undefined 以默认值 50 参与筛选
 * - qualityScore=0 显式 0 分参与筛选
 * - 超大分值(200+)正确参与筛选和排序
 * - 边界等值(qualityScore === minQuality)正确保留
 * - 负分 minQuality 正确处理
 * - evidenceWeight=null/undefined 以默认值 0.5 参与排序
 * - 混合筛选条件组合测试
 * - 多次 setFilter 累积效果测试
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { ProfileItem, ScoreEvidence, StockProfile, ProfileDomain } from '@/data/types/types.profile'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockQuery = vi.hoisted(() => vi.fn())
const mockForward = vi.hoisted(() => vi.fn())
const mockListPoolItems = vi.hoisted(() => vi.fn())
const mockEnvelopeCreate = vi.hoisted(() => vi.fn())
const mockNanoid = vi.hoisted(() => vi.fn())
const mockDebug = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: mockDebug }),
}))

vi.mock('@/core/databridge', () => ({
  dataBridge: {
    query: mockQuery,
    forward: mockForward,
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  },
}))

vi.mock('@/core/envelope', () => ({
  EnvelopeFactory: {
    create: mockEnvelopeCreate,
  },
}))

vi.mock('@/config/dbConfig', () => ({
  ENVELOPE_ACTION: {
    queryByIndex: 'QUERY_BY_INDEX',
    queryGet: 'QUERY_GET',
    deleteProfileItem: 'DELETE_PROFILE_ITEM',
    deleteProfileTag: 'DELETE_PROFILE_TAG',
  },
  ENVELOPE_TARGET: { db: 'DB' },
  MODULE_ID: { analyzer: 'analyzer' },
  STORE_NAME: {
    profileItems: 'profile_items',
    scoreEvidence: 'score_evidence',
    stockProfiles: 'stock_profiles',
  },
}))

vi.mock('@/services/pool/poolService', () => ({
  listPoolItems: mockListPoolItems,
}))

vi.mock('nanoid', () => ({
  nanoid: mockNanoid,
}))

// ============================================================
// Imports
// ============================================================

import {
  useProfileStore,
  selectDomainCounts,
  selectSelectedItem,
  groupEvidenceByLayer,
  selectAvailableSources,
  type ProfileFilter,
} from './profileStore'
import {
  superHighScoreFilterScenario,
  superHighScoreSortScenario,
  exactMatchScenario,
  negativeMinQualityScenario,
  nullEvidenceWeightSortScenario,
  itemTypeAndMinQualityScenario,
  sentimentMinQualityKeywordScenario,
  accumulativeFilterSteps,
  toProfileItem,
  type MinQualityTestScenario,
} from './__tests__/profileStore.minQuality.test-data'

// ============================================================
// Helpers
// ============================================================

function createMockItem(overrides: Partial<ProfileItem> = {}): ProfileItem {
  return {
    id: `item-${Math.random().toString(36).slice(2, 9)}`,
    symbol: 'AAPL',
    domain: 'D1' as ProfileDomain,
    itemType: 'news',
    title: '测试资料标题',
    summary: '测试资料摘要内容',
    source: '东方财富',
    publishedAt: Date.now(),
    collectedAt: Date.now(),
    sentiment: 'positive',
    qualityScore: 80,
    evidenceWeight: 0.6,
    relatedLayers: ['l1'],
    topicTags: ['AI', '科技'],
    dataHash: 123456,
    ...overrides,
  }
}

function createMockEvidence(overrides: Partial<ScoreEvidence> = {}): ScoreEvidence {
  return {
    id: `ev-${Math.random().toString(36).slice(2, 9)}`,
    symbol: 'AAPL',
    layer: 'l1',
    evidenceType: 'profile_item',
    title: '测试证据',
    description: '证据描述',
    weight: 0.7,
    confidence: 0.8,
    sentiment: 'positive',
    source: '研报',
    createdAt: Date.now(),
    ...overrides,
  }
}

function createMockProfile(overrides: Partial<StockProfile> = {}): StockProfile {
  return {
    symbol: 'AAPL',
    stockName: '苹果公司',
    totalItems: 50,
    domainCounts: { D1: 10, D2: 5, D3: 8, D4: 6, D5: 7, D6: 4, D7: 5, D8: 5 },
    typeCounts: { news: 20, research_report: 15, notice: 15 },
    totalEvidence: 30,
    layerEvidenceCounts: {
      lMinus1: 3, l0: 2, l1: 4, l2: 3, l3f: 4, l3v: 3, l4: 3, l5: 2, l6: 2, l7: 2, l8: 2,
    },
    evidenceCoverage: 0.85,
    lastUpdatedAt: Date.now(),
    lastSyncSources: ['东方财富', '同花顺'],
    avgQualityScore: 75,
    ...overrides,
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  useProfileStore.getState().reset()
})

// ============================================================
// useProfileStore
// ============================================================

describe('useProfileStore', () => {
  // ---------- 初始状态 ----------

  describe('初始状态', () => {
    it('所有状态字段为初始值', () => {
      const state = useProfileStore.getState()
      expect(state.symbol).toBe('')
      expect(state.stocks).toEqual([])
      expect(state.stocksLoading).toBe(false)
      expect(state.activeDomain).toBeNull()
      expect(state.items).toEqual([])
      expect(state.itemsLoading).toBe(false)
      expect(state.itemsError).toBeNull()
      expect(state.filter).toEqual({
        itemType: undefined,
        sentiment: undefined,
        minQuality: undefined,
        keyword: '',
        source: undefined,
      })
      expect(state.selectedItemId).toBeNull()
      expect(state.detailLoading).toBe(false)
      expect(state.evidence).toEqual([])
      expect(state.evidenceLoading).toBe(false)
      expect(state.profile).toBeNull()
      expect(state.profileLoading).toBe(false)
    })
  })

  // ---------- setSymbol ----------

  describe('setSymbol', () => {
    it('应设置 symbol 并清空相关状态', () => {
      // mock loadItems/loadEvidence/loadProfile 避免异步干扰
      mockQuery.mockResolvedValue({ success: true, data: [] })

      useProfileStore.getState().setSymbol('AAPL')

      const state = useProfileStore.getState()
      expect(state.symbol).toBe('AAPL')
      expect(state.selectedItemId).toBeNull()
      expect(state.items).toEqual([])
      expect(state.evidence).toEqual([])
      expect(state.profile).toBeNull()
    })

    it('切换 symbol 后应自动触发加载', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      useProfileStore.getState().setSymbol('TSLA')

      // 等待微任务完成（setSymbol 内部调用了 void loadItems 等）
      await new Promise((r) => setTimeout(r, 10))

      // dataBridge.query 应被调用多次（loadItems, loadEvidence, loadProfile）
      expect(mockQuery).toHaveBeenCalled()
    })
  })

  // ---------- loadStocks ----------

  describe('loadStocks', () => {
    it('成功时应填充 stocks 列表', async () => {
      mockListPoolItems.mockResolvedValue({
        success: true,
        data: [
          { symbol: 'AAPL', name: '苹果', pool: 'research', status: 'active', source: 'eastmoney', dataVersion: 1 },
          { symbol: 'TSLA', name: '特斯拉', pool: 'research', status: 'active', source: 'eastmoney', dataVersion: 1 },
        ],
      })

      await useProfileStore.getState().loadStocks()

      const state = useProfileStore.getState()
      expect(state.stocks).toHaveLength(2)
      expect(state.stocks[0]!.symbol).toBe('AAPL')
      expect(state.stocks[0]!.researchStatus).toBe('active')
      expect(state.stocksLoading).toBe(false)
    })

    it('已有数据时应跳过加载', async () => {
      // 先填充数据
      useProfileStore.setState({
        stocks: [{ symbol: 'AAPL', name: '苹果' } as any],
      })

      await useProfileStore.getState().loadStocks()

      expect(mockListPoolItems).not.toHaveBeenCalled()
    })

    it('加载失败时 stocks 为空数组', async () => {
      mockListPoolItems.mockRejectedValue(new Error('网络错误'))

      await useProfileStore.getState().loadStocks()

      const state = useProfileStore.getState()
      expect(state.stocks).toEqual([])
      expect(state.stocksLoading).toBe(false)
    })

    it('success=false 时 stocks 为空数组', async () => {
      mockListPoolItems.mockResolvedValue({ success: false, error: '查询失败' })

      await useProfileStore.getState().loadStocks()

      const state = useProfileStore.getState()
      expect(state.stocks).toEqual([])
      expect(state.stocksLoading).toBe(false)
    })

    it('加载中 stocksLoading 为 true', async () => {
      let resolveList: ((value: { success: true; data: any[] }) => void) | undefined
      const listPromise = new Promise<{ success: true; data: any[] }>((r) => { resolveList = r })
      mockListPoolItems.mockReturnValue(listPromise)

      const promise = useProfileStore.getState().loadStocks()
      expect(useProfileStore.getState().stocksLoading).toBe(true)

      resolveList!({ success: true, data: [] })
      await promise

      expect(useProfileStore.getState().stocksLoading).toBe(false)
    })
  })

  // ---------- setActiveDomain ----------

  describe('setActiveDomain', () => {
    it('应设置 activeDomain 并清空选中项', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      useProfileStore.setState({ selectedItemId: 'item-123', symbol: 'AAPL' })
      useProfileStore.getState().setActiveDomain('D3')

      const state = useProfileStore.getState()
      expect(state.activeDomain).toBe('D3')
      expect(state.selectedItemId).toBeNull()
    })

    it('设置为 null 表示全部域', () => {
      useProfileStore.setState({ activeDomain: 'D5' as ProfileDomain })
      useProfileStore.getState().setActiveDomain(null)

      expect(useProfileStore.getState().activeDomain).toBeNull()
    })
  })

  // ---------- loadItems ----------

  describe('loadItems', () => {
    it('无 symbol 时直接返回空数组', async () => {
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toEqual([])
      expect(state.itemsLoading).toBe(false)
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('成功时应加载资料列表并按质量排序', async () => {
      const items = [
        createMockItem({ id: 'item-1', qualityScore: 90, evidenceWeight: 0.8 }),
        createMockItem({ id: 'item-2', qualityScore: 60, evidenceWeight: 0.5 }),
        createMockItem({ id: 'item-3', qualityScore: 80, evidenceWeight: 0.7 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(3)
      // 按 qualityScore * evidenceWeight 降序：90*0.8=72 > 80*0.7=56 > 60*0.5=30
      expect(state.items[0]!.id).toBe('item-1')
      expect(state.items[1]!.id).toBe('item-3')
      expect(state.items[2]!.id).toBe('item-2')
      expect(state.itemsLoading).toBe(false)
      expect(state.itemsError).toBeNull()
    })

    it('失败时设置 itemsError', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '查询失败' })

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toEqual([])
      expect(state.itemsError).toBe('查询失败')
      expect(state.itemsLoading).toBe(false)
    })

    it('抛出异常时捕获并设置错误', async () => {
      mockQuery.mockRejectedValue(new Error('DB 连接失败'))

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toEqual([])
      expect(state.itemsError).toBe('DB 连接失败')
      expect(state.itemsLoading).toBe(false)
    })

    it('按 itemType 筛选', async () => {
      const items = [
        createMockItem({ id: 'item-news', itemType: 'news', qualityScore: 80, evidenceWeight: 0.6 }),
        createMockItem({ id: 'item-report', itemType: 'research_report', qualityScore: 80, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: 'news', sentiment: undefined, minQuality: 0, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]!.id).toBe('item-news')
    })

    it('按 sentiment 筛选', async () => {
      const items = [
        createMockItem({ id: 'pos', sentiment: 'positive', qualityScore: 80, evidenceWeight: 0.6 }),
        createMockItem({ id: 'neg', sentiment: 'negative', qualityScore: 80, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: 'negative', minQuality: 0, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      expect(useProfileStore.getState().items).toHaveLength(1)
      expect(useProfileStore.getState().items[0]!.id).toBe('neg')
    })

    it('按 minQuality 筛选', async () => {
      const items = [
        createMockItem({ id: 'high', qualityScore: 90, evidenceWeight: 0.6 }),
        createMockItem({ id: 'low', qualityScore: 40, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 60, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      expect(useProfileStore.getState().items).toHaveLength(1)
      expect(useProfileStore.getState().items[0]!.id).toBe('high')
    })

    it('按 minQuality 筛选：缺失 qualityScore 的条目应被排除 + 日志', async () => {
      mockDebug.mockClear()
      const items = [
        createMockItem({ id: 'has-score', qualityScore: 80, evidenceWeight: 0.6 }),
        createMockItem({ id: 'no-score', qualityScore: undefined, evidenceWeight: 0.6 }),
        createMockItem({ id: 'also-no-score', qualityScore: null as unknown as undefined, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 60, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]!.id).toBe('has-score')
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('缺失 qualityScore')
      )
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('2/3')
      )
    })

    it('按 minQuality 筛选：显式 0 分条目参与筛选 + 零值日志', async () => {
      mockDebug.mockClear()
      const items = [
        createMockItem({ id: 'zero-score', qualityScore: 0, evidenceWeight: 0.6 }),
        createMockItem({ id: 'high-score', qualityScore: 80, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 60, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]!.id).toBe('high-score')
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('显式 0')
      )
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('qualityScore 为显式 0')
      )
    })

    it('按 minQuality 筛选：显式 0 分在阈值=0 时应保留', async () => {
      mockDebug.mockClear()
      const items = [
        createMockItem({ id: 'zero-score', qualityScore: 0, evidenceWeight: 0.6 }),
        createMockItem({ id: 'high-score', qualityScore: 80, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 0, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      expect(useProfileStore.getState().items).toHaveLength(2)
    })

    // 逆向验证
    it('逆向：筛选后条目数减少 → 缺失评分被排除或评分低于阈值', async () => {
      mockDebug.mockClear()
      const items = [
        createMockItem({ id: 'a', qualityScore: 90, evidenceWeight: 0.6 }),
        createMockItem({ id: 'b', qualityScore: undefined, evidenceWeight: 0.6 }),
        createMockItem({ id: 'c', qualityScore: 30, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 60, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]!.id).toBe('a')

      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('缺失 qualityScore')
      )
      const missingLogCalls = mockDebug.mock.calls.filter((c: any[]) =>
        c[0]?.includes('缺失 qualityScore')
      )
      expect(missingLogCalls.length).toBe(1)
    })

    it('逆向：0 分条目被排除 → 日志应记录显式 0', async () => {
      mockDebug.mockClear()
      const items = [
        createMockItem({ id: 'a', qualityScore: 0, evidenceWeight: 0.6 }),
        createMockItem({ id: 'b', qualityScore: 80, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 60, keyword: '', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]!.id).toBe('b')

      const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
        c[0]?.includes('显式 0')
      )
      expect(zeroCalls.length).toBe(1)
    })

    it('按 keyword 筛选（标题/摘要/标签）', async () => {
      const items = [
        createMockItem({ id: 'match-title', title: 'AI 大模型突破', qualityScore: 80, evidenceWeight: 0.6 }),
        createMockItem({ id: 'match-summary', summary: '人工智能技术进展', qualityScore: 80, evidenceWeight: 0.6 }),
        createMockItem({ id: 'match-tag', topicTags: ['AI'], qualityScore: 80, evidenceWeight: 0.6 }),
        createMockItem({ id: 'no-match', title: '无关标题', summary: '无关摘要', topicTags: ['其他'], qualityScore: 80, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 0, keyword: 'ai', source: undefined },
      })
      await useProfileStore.getState().loadItems()

      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(3)
      expect(state.items.map((i) => i.id)).toContain('match-title')
      expect(state.items.map((i) => i.id)).toContain('match-summary')
      expect(state.items.map((i) => i.id)).toContain('match-tag')
    })

    it('按 source 筛选', async () => {
      const items = [
        createMockItem({ id: 's1', source: '东方财富', qualityScore: 80, evidenceWeight: 0.6 }),
        createMockItem({ id: 's2', source: '同花顺', qualityScore: 80, evidenceWeight: 0.6 }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: items })

      useProfileStore.setState({
        symbol: 'AAPL',
        filter: { itemType: undefined, sentiment: undefined, minQuality: 0, keyword: '', source: '同花顺' },
      })
      await useProfileStore.getState().loadItems()

      expect(useProfileStore.getState().items).toHaveLength(1)
      expect(useProfileStore.getState().items[0]!.id).toBe('s2')
    })

    it('有 activeDomain 时查询参数带 domain', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      useProfileStore.setState({ symbol: 'AAPL', activeDomain: 'D3' as ProfileDomain })
      await useProfileStore.getState().loadItems()

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          indexValue: ['AAPL', 'D3'],
        }),
      )
    })
  })

  // ---------- refreshItems ----------

  describe('refreshItems', () => {
    it('应调用 loadItems 重新加载', async () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().refreshItems()

      expect(mockQuery).toHaveBeenCalled()
      expect(useProfileStore.getState().itemsLoading).toBe(false)
    })
  })

  // ---------- setFilter / resetFilter ----------

  describe('setFilter / resetFilter', () => {
    it('setFilter 应合并筛选条件', () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      useProfileStore.getState().setFilter({ itemType: 'news' })
      expect(useProfileStore.getState().filter.itemType).toBe('news')

      useProfileStore.getState().setFilter({ sentiment: 'positive' })
      const filter = useProfileStore.getState().filter
      expect(filter.itemType).toBe('news')
      expect(filter.sentiment).toBe('positive')
    })

    it('resetFilter 应恢复初始筛选条件', () => {
      mockQuery.mockResolvedValue({ success: true, data: [] })

      useProfileStore.setState({
        filter: { itemType: 'news', sentiment: 'positive', minQuality: 60, keyword: 'AI', source: '东方财富' },
      })

      useProfileStore.getState().resetFilter()

      const filter = useProfileStore.getState().filter
      expect(filter.itemType).toBeUndefined()
      expect(filter.sentiment).toBeUndefined()
      expect(filter.minQuality).toBeUndefined()
      expect(filter.keyword).toBe('')
      expect(filter.source).toBeUndefined()
    })
  })

  // ---------- selectItem ----------

  describe('selectItem', () => {
    it('应设置 selectedItemId', () => {
      useProfileStore.getState().selectItem('item-123')
      expect(useProfileStore.getState().selectedItemId).toBe('item-123')
    })

    it('传入 null 应取消选中', () => {
      useProfileStore.setState({ selectedItemId: 'item-123' })
      useProfileStore.getState().selectItem(null)
      expect(useProfileStore.getState().selectedItemId).toBeNull()
    })
  })

  // ---------- loadItemDetail ----------

  describe('loadItemDetail', () => {
    it('成功时返回资料详情', async () => {
      const item = createMockItem({ id: 'item-detail-1' })
      mockQuery.mockResolvedValue({ success: true, data: item })

      const result = await useProfileStore.getState().loadItemDetail('item-detail-1')

      expect(result).toEqual(item)
      expect(useProfileStore.getState().detailLoading).toBe(false)
    })

    it('失败时返回 null', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '未找到' })

      const result = await useProfileStore.getState().loadItemDetail('item-not-found')

      expect(result).toBeNull()
      expect(useProfileStore.getState().detailLoading).toBe(false)
    })

    it('异常时返回 null', async () => {
      mockQuery.mockRejectedValue(new Error('DB 错误'))

      const result = await useProfileStore.getState().loadItemDetail('item-error')

      expect(result).toBeNull()
      expect(useProfileStore.getState().detailLoading).toBe(false)
    })

    it('加载中 detailLoading 为 true', async () => {
      let resolveDetail: ((value: { success: true; data: ProfileItem }) => void) | undefined
      const detailPromise = new Promise<{ success: true; data: ProfileItem }>((r) => { resolveDetail = r })
      mockQuery.mockReturnValue(detailPromise)

      const promise = useProfileStore.getState().loadItemDetail('item-loading')
      expect(useProfileStore.getState().detailLoading).toBe(true)

      resolveDetail!({ success: true, data: createMockItem({ id: 'item-loading' }) })
      await promise

      expect(useProfileStore.getState().detailLoading).toBe(false)
    })
  })

  // ---------- loadEvidence ----------

  describe('loadEvidence', () => {
    it('无 symbol 时直接返回空数组', async () => {
      await useProfileStore.getState().loadEvidence()

      expect(useProfileStore.getState().evidence).toEqual([])
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('成功时加载证据列表', async () => {
      const evidence = [
        createMockEvidence({ id: 'ev-1' }),
        createMockEvidence({ id: 'ev-2', layer: 'l2' }),
      ]
      mockQuery.mockResolvedValue({ success: true, data: evidence })

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadEvidence()

      const state = useProfileStore.getState()
      expect(state.evidence).toHaveLength(2)
      expect(state.evidenceLoading).toBe(false)
    })

    it('失败时 evidence 为空数组', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '查询失败' })

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadEvidence()

      expect(useProfileStore.getState().evidence).toEqual([])
      expect(useProfileStore.getState().evidenceLoading).toBe(false)
    })

    it('异常时 evidence 为空数组', async () => {
      mockQuery.mockRejectedValue(new Error('DB 错误'))

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadEvidence()

      expect(useProfileStore.getState().evidence).toEqual([])
      expect(useProfileStore.getState().evidenceLoading).toBe(false)
    })
  })

  // ---------- loadProfile ----------

  describe('loadProfile', () => {
    it('无 symbol 时 profile 为 null', async () => {
      await useProfileStore.getState().loadProfile()

      expect(useProfileStore.getState().profile).toBeNull()
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('成功时加载资料包元数据', async () => {
      const profile = createMockProfile()
      mockQuery.mockResolvedValue({ success: true, data: profile })

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadProfile()

      const state = useProfileStore.getState()
      expect(state.profile).toEqual(profile)
      expect(state.profileLoading).toBe(false)
    })

    it('失败时 profile 为 null', async () => {
      mockQuery.mockResolvedValue({ success: false, error: '未找到' })

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadProfile()

      expect(useProfileStore.getState().profile).toBeNull()
      expect(useProfileStore.getState().profileLoading).toBe(false)
    })

    it('异常时 profile 为 null', async () => {
      mockQuery.mockRejectedValue(new Error('DB 错误'))

      useProfileStore.setState({ symbol: 'AAPL' })
      await useProfileStore.getState().loadProfile()

      expect(useProfileStore.getState().profile).toBeNull()
      expect(useProfileStore.getState().profileLoading).toBe(false)
    })
  })

  // ---------- deleteItem ----------

  describe('deleteItem', () => {
    it('无 symbol 时返回 false', async () => {
      const result = await useProfileStore.getState().deleteItem('item-1')
      expect(result).toBe(false)
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('成功时从 items 中移除并返回 true', async () => {
      mockForward.mockResolvedValue({ success: true })

      const items = [
        createMockItem({ id: 'item-keep' }),
        createMockItem({ id: 'item-delete' }),
      ]
      useProfileStore.setState({ symbol: 'AAPL', items, selectedItemId: 'item-delete' })

      const result = await useProfileStore.getState().deleteItem('item-delete')

      expect(result).toBe(true)
      const state = useProfileStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]!.id).toBe('item-keep')
      expect(state.selectedItemId).toBeNull()
    })

    it('异常时返回 false', async () => {
      mockForward.mockRejectedValue(new Error('删除失败'))

      useProfileStore.setState({ symbol: 'AAPL', items: [createMockItem({ id: 'item-1' })] })

      const result = await useProfileStore.getState().deleteItem('item-1')

      expect(result).toBe(false)
      // items 不应被修改
      expect(useProfileStore.getState().items).toHaveLength(1)
    })
  })

  // ---------- deleteTag ----------

  describe('deleteTag', () => {
    it('无 symbol 时返回 false', async () => {
      const result = await useProfileStore.getState().deleteTag('tag-1')
      expect(result).toBe(false)
      expect(mockForward).not.toHaveBeenCalled()
    })

    it('成功时返回 true', async () => {
      mockQuery.mockResolvedValue({ success: true, data: createMockProfile() })
      mockForward.mockResolvedValue({ success: true })

      useProfileStore.setState({ symbol: 'AAPL' })
      const result = await useProfileStore.getState().deleteTag('tag-123')

      expect(result).toBe(true)
      expect(mockForward).toHaveBeenCalledTimes(1)
    })

    it('异常时返回 false', async () => {
      mockForward.mockRejectedValue(new Error('删除标签失败'))

      useProfileStore.setState({ symbol: 'AAPL' })
      const result = await useProfileStore.getState().deleteTag('tag-err')

      expect(result).toBe(false)
    })
  })

  // ---------- reset ----------

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      // 填充各种状态
      useProfileStore.setState({
        symbol: 'AAPL',
        stocks: [{ symbol: 'AAPL', name: '苹果' } as any],
        activeDomain: 'D3' as ProfileDomain,
        items: [createMockItem()],
        itemsError: 'some error',
        filter: { itemType: 'news', sentiment: 'positive', minQuality: 60, keyword: 'AI', source: '东方财富' } as ProfileFilter,
        selectedItemId: 'item-123',
        evidence: [createMockEvidence()],
        profile: createMockProfile(),
      })

      useProfileStore.getState().reset()

      const state = useProfileStore.getState()
      expect(state.symbol).toBe('')
      expect(state.stocks).toEqual([])
      expect(state.stocksLoading).toBe(false)
      expect(state.activeDomain).toBeNull()
      expect(state.items).toEqual([])
      expect(state.itemsLoading).toBe(false)
      expect(state.itemsError).toBeNull()
      expect(state.filter).toEqual({
        itemType: undefined,
        sentiment: undefined,
        minQuality: undefined,
        keyword: '',
        source: undefined,
      })
      expect(state.selectedItemId).toBeNull()
      expect(state.detailLoading).toBe(false)
      expect(state.evidence).toEqual([])
      expect(state.evidenceLoading).toBe(false)
      expect(state.profile).toBeNull()
      expect(state.profileLoading).toBe(false)
    })
  })
})

// ============================================================
// Selector 纯函数
// ============================================================

describe('selectDomainCounts', () => {
  it('空 items → 全部 0', () => {
    const state = useProfileStore.getState()
    const counts = selectDomainCounts(state)
    expect(counts).toEqual({ D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0 })
  })

  it('按域统计数量', () => {
    const items = [
      createMockItem({ id: 'd1a', domain: 'D1' as ProfileDomain }),
      createMockItem({ id: 'd1b', domain: 'D1' as ProfileDomain }),
      createMockItem({ id: 'd3a', domain: 'D3' as ProfileDomain }),
      createMockItem({ id: 'd5a', domain: 'D5' as ProfileDomain }),
    ]
    useProfileStore.setState({ items })

    const counts = selectDomainCounts(useProfileStore.getState())
    expect(counts.D1).toBe(2)
    expect(counts.D3).toBe(1)
    expect(counts.D5).toBe(1)
    expect(counts.D2).toBe(0)
    expect(counts.D8).toBe(0)
  })
})

describe('selectSelectedItem', () => {
  it('无选中项返回 undefined', () => {
    const state = useProfileStore.getState()
    expect(selectSelectedItem(state)).toBeUndefined()
  })

  it('有选中项返回对应条目', () => {
    const item = createMockItem({ id: 'selected-item' })
    useProfileStore.setState({
      items: [item, createMockItem({ id: 'other-item' })],
      selectedItemId: 'selected-item',
    })

    const result = selectSelectedItem(useProfileStore.getState())
    expect(result).toBeDefined()
    expect(result!.id).toBe('selected-item')
  })
})

describe('groupEvidenceByLayer', () => {
  it('空数组返回空对象', () => {
    const result = groupEvidenceByLayer([])
    expect(result).toEqual({})
  })

  it('按层分组证据', () => {
    const evidence = [
      createMockEvidence({ id: 'l1a', layer: 'l1' }),
      createMockEvidence({ id: 'l1b', layer: 'l1' }),
      createMockEvidence({ id: 'l2a', layer: 'l2' }),
      createMockEvidence({ id: 'l3fa', layer: 'l3f' }),
    ]

    const grouped = groupEvidenceByLayer(evidence)
    expect(grouped['l1']).toHaveLength(2)
    expect(grouped['l2']).toHaveLength(1)
    expect(grouped['l3f']).toHaveLength(1)
    expect(grouped['l4']).toBeUndefined()
  })
})

describe('selectAvailableSources', () => {
  it('空 items 返回空数组', () => {
    const state = useProfileStore.getState()
    expect(selectAvailableSources(state)).toEqual([])
  })

  it('返回去重并排序的来源列表', () => {
    const items = [
      createMockItem({ id: 'a', source: '东方财富' }),
      createMockItem({ id: 'b', source: '同花顺' }),
      createMockItem({ id: 'c', source: '东方财富' }),
      createMockItem({ id: 'd', source: '雪球' }),
    ]
    useProfileStore.setState({ items })

    const sources = selectAvailableSources(useProfileStore.getState())
    expect(sources).toHaveLength(3)
    expect(sources).toContain('东方财富')
    expect(sources).toContain('同花顺')
    expect(sources).toContain('雪球')
    // 验证去重
    expect(new Set(sources).size).toBe(3)
  })
})

// ============================================================
// 深度验证 — profileStore 数据流完整性
// ============================================================
describe('profileStore - 深度验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProfileStore.setState({ symbol: 'AAPL', items: [], itemsLoading: false })
  })

  it('完整流程: DB 返回混合数据 → 筛选 → 排序', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'good', qualityScore: 90, evidenceWeight: 0.9, itemType: 'news' }),
      createMockItem({ id: 'zero', qualityScore: 0, evidenceWeight: 0.3, itemType: 'news' }),
      createMockItem({ id: 'missing', qualityScore: undefined, evidenceWeight: 0.7, itemType: 'news' }),
      createMockItem({ id: 'low', qualityScore: 30, evidenceWeight: 0.8, itemType: 'news' }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    const filter: Partial<ProfileFilter> = { itemType: undefined, sentiment: undefined, minQuality: 50, keyword: '', source: undefined }
    useProfileStore.setState({
      filter: filter as ProfileFilter,
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    const resultIds = state.items.map((i) => i.id)
    // good(90>=50) passes, zero(0<50) excluded, missing(undefined??50=50>=50) passes, low(30<50) excluded
    expect(state.items.length).toBeGreaterThanOrEqual(1)
    expect(resultIds).toContain('good')
    expect(resultIds).not.toContain('zero')
    expect(resultIds).not.toContain('low')

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失 qualityScore')
    )
    expect(zeroCalls.length).toBeGreaterThanOrEqual(1)
    expect(missingCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('qualityScore 边界: 0 分在 minQuality=0 时保留，负分被排除', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'zero', qualityScore: 0, evidenceWeight: 0.5 }),
      createMockItem({ id: 'neg', qualityScore: -10, evidenceWeight: 0.5 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: 0, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    // minQuality=0: filter activated, qualityScore>=0 preserved, negative excluded
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.id).toBe('zero')
  })

  it('qualityScore 边界: null/undefined 在 minQuality>0 时以 50 分参与筛选', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'null-score', qualityScore: null as unknown as undefined, evidenceWeight: 0.9 }),
      createMockItem({ id: 'real', qualityScore: 80, evidenceWeight: 0.9 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: 60, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    // null-score: (null ?? 50) = 50 < 60 → excluded
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.id).toBe('real')

    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失 qualityScore')
    )
    expect(missingCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('日志触发: minQuality>0 且存在显式 0 分条目时输出日志', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'zero', qualityScore: 0, evidenceWeight: 0.5 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: 1, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    expect(zeroCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('空数据: 无 qualityScore 异常时无日志输出', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'a', qualityScore: 80, evidenceWeight: 0.5 }),
      createMockItem({ id: 'b', qualityScore: 70, evidenceWeight: 0.5 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({ symbol: 'AAPL' })
    await useProfileStore.getState().loadItems()

    const zeroCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('显式 0')
    )
    const missingCalls = mockDebug.mock.calls.filter((c: any[]) =>
      c[0]?.includes('缺失 qualityScore')
    )
    expect(zeroCalls.length).toBe(0)
    expect(missingCalls.length).toBe(0)
  })

  // ============================================================
  // minQuality 筛选边界情况专项测试
  // ============================================================

  it('minQuality=undefined 时不执行筛选，所有条目保留', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'high', qualityScore: 90, evidenceWeight: 0.9 }),
      createMockItem({ id: 'zero', qualityScore: 0, evidenceWeight: 0.5 }),
      createMockItem({ id: 'neg', qualityScore: -10, evidenceWeight: 0.3 }),
      createMockItem({ id: 'null-score', qualityScore: null as unknown as undefined, evidenceWeight: 0.7 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: undefined, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    expect(state.items).toHaveLength(4)
  })

  it('minQuality=0 时排除负分条目，保留 0 分及以上', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'high', qualityScore: 90, evidenceWeight: 0.9 }),
      createMockItem({ id: 'zero', qualityScore: 0, evidenceWeight: 0.5 }),
      createMockItem({ id: 'neg', qualityScore: -10, evidenceWeight: 0.3 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: 0, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    expect(state.items).toHaveLength(2)
    expect(state.items.map(i => i.id)).toContain('high')
    expect(state.items.map(i => i.id)).toContain('zero')
    expect(state.items.map(i => i.id)).not.toContain('neg')
  })

  it('qualityScore=null 以默认值 50 参与 minQuality=60 筛选时被排除', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'null-score', qualityScore: null as unknown as undefined, evidenceWeight: 0.9 }),
      createMockItem({ id: 'real', qualityScore: 80, evidenceWeight: 0.9 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: 60, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    // null qualityScore uses 50 as default, 50 < 60 so excluded
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.id).toBe('real')
  })

  it('qualityScore=undefined 以默认值 50 参与 minQuality=40 筛选时被保留', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'undefined-score', qualityScore: undefined, evidenceWeight: 0.9 }),
      createMockItem({ id: 'low', qualityScore: 30, evidenceWeight: 0.9 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: 40, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    // undefined qualityScore uses 50 as default, 50 >= 40 so preserved
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.id).toBe('undefined-score')
  })

  it('排序中 null/undefined qualityScore 使用 50 默认值参与排序', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'null-score', qualityScore: null as unknown as undefined, evidenceWeight: 0.8 }),
      createMockItem({ id: 'real-high', qualityScore: 90, evidenceWeight: 0.7 }),
      createMockItem({ id: 'real-low', qualityScore: 30, evidenceWeight: 0.9 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: undefined, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    // Sort scores:
    // - null-score: (50 ?? 50) * 0.8 = 40 (wait, it uses ?? 50 so 50 * 0.8 = 40)
    // - real-high: 90 * 0.7 = 63
    // - real-low: 30 * 0.9 = 27
    // Expected order: real-high(63) > null-score(40) > real-low(27)
    expect(state.items[0]!.id).toBe('real-high')
    expect(state.items[1]!.id).toBe('null-score')
    expect(state.items[2]!.id).toBe('real-low')
  })

  it('minQuality=100 时仅保留满分条目', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'perfect', qualityScore: 100, evidenceWeight: 0.9 }),
      createMockItem({ id: 'high', qualityScore: 90, evidenceWeight: 0.9 }),
      createMockItem({ id: 'zero', qualityScore: 0, evidenceWeight: 0.5 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: { itemType: undefined, sentiment: undefined, minQuality: 100, keyword: '', source: undefined },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0]!.id).toBe('perfect')
  })

  // ============================================================
  // 数据驱动测试：使用独立测试数据文件
  // ============================================================

  async function runScenario(scenario: MinQualityTestScenario): Promise<void> {
    mockDebug.mockClear()
    const items = scenario.items.map(toProfileItem)
    mockQuery.mockResolvedValue({ success: true, data: items })

    useProfileStore.setState({
      filter: {
        itemType: scenario.filter.itemType as ProfileFilter['itemType'] ?? undefined,
        sentiment: scenario.filter.sentiment as ProfileFilter['sentiment'] ?? undefined,
        minQuality: scenario.filter.minQuality,
        keyword: scenario.filter.keyword ?? '',
        source: scenario.filter.source ?? undefined,
      },
    })
    await useProfileStore.getState().loadItems()

    const state = useProfileStore.getState()
    const actualIds = state.items.map((i) => i.id)

    expect(actualIds.sort()).toEqual(scenario.expectedIds.sort())

    if (scenario.expectedOrder) {
      const orderedIds = state.items.map((i) => i.id)
      expect(orderedIds).toEqual(scenario.expectedOrder)
    }
  }

  it(`[data-driven] ${superHighScoreFilterScenario.description}`, async () => {
    await runScenario(superHighScoreFilterScenario)
  })

  it(`[data-driven] ${superHighScoreSortScenario.description}`, async () => {
    await runScenario(superHighScoreSortScenario)
  })

  it(`[data-driven] ${exactMatchScenario.description}`, async () => {
    await runScenario(exactMatchScenario)
  })

  it(`[data-driven] ${negativeMinQualityScenario.description}`, async () => {
    await runScenario(negativeMinQualityScenario)
  })

  it(`[data-driven] ${nullEvidenceWeightSortScenario.description}`, async () => {
    await runScenario(nullEvidenceWeightSortScenario)
  })

  it(`[data-driven] ${itemTypeAndMinQualityScenario.description}`, async () => {
    await runScenario(itemTypeAndMinQualityScenario)
  })

  it(`[data-driven] ${sentimentMinQualityKeywordScenario.description}`, async () => {
    await runScenario(sentimentMinQualityKeywordScenario)
  })

  it('[data-driven] 多次 setFilter 的累积效果验证', async () => {
    mockDebug.mockClear()
    const items = [
      createMockItem({ id: 'a', qualityScore: 90, itemType: 'news', sentiment: 'positive', evidenceWeight: 0.9 }),
      createMockItem({ id: 'b', qualityScore: 30, itemType: 'research_report', sentiment: 'negative', evidenceWeight: 0.5 }),
    ]
    mockQuery.mockResolvedValue({ success: true, data: items })

    let state: ReturnType<typeof useProfileStore.getState>

    for (const step of accumulativeFilterSteps) {
      if (step.step === 1) {
        useProfileStore.setState({ filter: step.filterUpdate as Partial<ProfileFilter> })
      } else {
        useProfileStore.getState().setFilter(step.filterUpdate as Partial<ProfileFilter>)
      }
      state = useProfileStore.getState()

      if (step.expectedMinQuality !== undefined) {
        expect(state.filter.minQuality).toBe(step.expectedMinQuality)
      }
      if (step.expectedItemType !== undefined) {
        expect(state.filter.itemType).toBe(step.expectedItemType)
      } else {
        expect(state.filter.itemType).toBeUndefined()
      }
      if (step.expectedSentiment !== undefined) {
        expect(state.filter.sentiment).toBe(step.expectedSentiment)
      }
    }
  })
})
