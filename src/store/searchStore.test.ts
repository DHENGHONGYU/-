/**
 * @test_id V9-TEST-ST-SRCH-001
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore } from './searchStore'
import type { SearchResult, SearchItem } from '@/types/modules/data-sync.types'

// ============================================================
// Mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('@/lib/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
  },
}))

vi.mock('@/constants/store-channels.constants', () => ({
  EVENT_NAMES: {
    DATA_TEST_CHANGED: 'data_test:changed',
  },
}))

// ============================================================
// Helpers
// ============================================================

function createMockSearchItem(overrides: Partial<SearchItem> = {}): SearchItem {
  return {
    source: 'collection-history',
    id: `item-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    title: '测试数据项',
    snippet: '这是一个测试数据项的摘要',
    details: { channel: 'auto-collect', status: 'success' },
    ...overrides,
  }
}

function createMockSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  const items = [
    createMockSearchItem({ id: 'item-1', title: '结果1' }),
    createMockSearchItem({ id: 'item-2', title: '结果2' }),
    createMockSearchItem({ id: 'item-3', title: '结果3' }),
  ]
  return {
    items,
    total: 3,
    page: 1,
    pageSize: 20,
    facets: {
      byChannel: { 'auto-collect': 3 },
      byFileType: { csv: 2, xlsx: 1 },
      byStatus: { success: 3 },
      byDimension: { financial: 2 },
    },
    ...overrides,
  } as SearchResult
}

// ============================================================
// Tests
// ============================================================

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.getState().reset()
    vi.clearAllMocks()
  })

  // --------------------------------------------------------
  // 1. 初始状态
  // --------------------------------------------------------
  describe('初始状态', () => {
    it('所有字段默认值正确', () => {
      const state = useSearchStore.getState()
      // 检索条件
      expect(state.keyword).toBe('')
      expect(state.datePreset).toBe('all')
      expect(state.channels).toEqual([])
      expect(state.symbols).toEqual([])
      expect(state.dimensions).toEqual([])
      expect(state.statuses).toEqual([])
      expect(state.fileTypes).toEqual([])
      // 分页
      expect(state.page).toBe(1)
      expect(state.pageSize).toBe(20)
      // 视图
      expect(state.viewMode).toBe('timeline')
      // 结果
      expect(state.result).toBeNull()
      expect(state.loading).toBe(false)
    })
  })

  // --------------------------------------------------------
  // 2. 搜索成功（setResult）
  // --------------------------------------------------------
  describe('搜索成功 - setResult', () => {
    it('正确设置搜索结果数据', () => {
      const result = createMockSearchResult()
      useSearchStore.getState().setResult(result)

      const state = useSearchStore.getState()
      expect(state.result).toBe(result)
      expect(state.result!.items).toHaveLength(3)
      expect(state.result!.total).toBe(3)
      expect(state.result!.page).toBe(1)
      expect(state.result!.facets.byChannel).toEqual({ 'auto-collect': 3 })
    })

    it('设置结果后触发广播事件', async () => {
      const { eventBus } = await import('@/lib/eventBus')
      const result = createMockSearchResult()

      useSearchStore.getState().setResult(result)

      expect(eventBus.emit).toHaveBeenCalledWith(
        'data_test:changed',
        { action: 'searchComplete', total: result.total }
      )
    })

    it('设置结果后记录 info 日志', () => {
      const result = createMockSearchResult()

      useSearchStore.getState().setResult(result)

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[searchStore] 检索结果已设置',
        { total: result.total, page: result.page }
      )
    })
  })

  // --------------------------------------------------------
  // 3. 搜索失败（空结果场景）
  // --------------------------------------------------------
  describe('搜索失败/空结果', () => {
    it('空结果正确设置（total=0，items=[]）', () => {
      const emptyResult = createMockSearchResult({
        items: [],
        total: 0,
        facets: {
          byChannel: {},
          byFileType: {},
          byStatus: {},
          byDimension: {},
        },
      })
      useSearchStore.getState().setResult(emptyResult)

      const state = useSearchStore.getState()
      expect(state.result).not.toBeNull()
      expect(state.result!.items).toEqual([])
      expect(state.result!.total).toBe(0)
    })
  })

  // --------------------------------------------------------
  // 4. 搜索中 loading 状态
  // --------------------------------------------------------
  describe('搜索中 loading 状态', () => {
    it('setLoading(true) 设置加载中状态', () => {
      useSearchStore.getState().setLoading(true)
      expect(useSearchStore.getState().loading).toBe(true)
    })

    it('setLoading(false) 取消加载状态', () => {
      useSearchStore.getState().setLoading(true)
      useSearchStore.getState().setLoading(false)
      expect(useSearchStore.getState().loading).toBe(false)
    })

    it('loading 状态变更不影响其他字段', () => {
      const result = createMockSearchResult()
      useSearchStore.getState().setResult(result)
      useSearchStore.getState().setKeyword('测试')

      useSearchStore.getState().setLoading(true)

      const state = useSearchStore.getState()
      expect(state.loading).toBe(true)
      expect(state.keyword).toBe('测试')
      expect(state.result).toBe(result)
    })
  })

  // --------------------------------------------------------
  // 5. 清空搜索结果
  // --------------------------------------------------------
  describe('清空搜索结果', () => {
    it('设置空结果清空搜索结果', () => {
      const result = createMockSearchResult()
      useSearchStore.getState().setResult(result)
      expect(useSearchStore.getState().result!.items.length).toBeGreaterThan(0)

      const emptyResult = createMockSearchResult({ items: [], total: 0 })
      useSearchStore.getState().setResult(emptyResult)

      const state = useSearchStore.getState()
      expect(state.result!.items).toEqual([])
      expect(state.result!.total).toBe(0)
    })
  })

  // --------------------------------------------------------
  // 6. 检索条件操作
  // --------------------------------------------------------
  describe('检索条件操作', () => {
    describe('setKeyword', () => {
      it('设置关键词并重置页码为 1', () => {
        useSearchStore.getState().setPage(3)
        useSearchStore.getState().setKeyword('人工智能')

        const state = useSearchStore.getState()
        expect(state.keyword).toBe('人工智能')
        expect(state.page).toBe(1)
      })
    })

    describe('setDatePreset', () => {
      it('设置日期预设并重置页码为 1', () => {
        useSearchStore.getState().setPage(5)
        useSearchStore.getState().setDatePreset('last7days')

        const state = useSearchStore.getState()
        expect(state.datePreset).toBe('last7days')
        expect(state.page).toBe(1)
      })
    })

    describe('toggleChannel', () => {
      it('添加不存在的 channel', () => {
        useSearchStore.getState().setPage(2)
        useSearchStore.getState().toggleChannel('auto-collect')

        const state = useSearchStore.getState()
        expect(state.channels).toContain('auto-collect')
        expect(state.channels).toHaveLength(1)
        expect(state.page).toBe(1)
      })

      it('移除已存在的 channel', () => {
        useSearchStore.getState().toggleChannel('auto-collect')
        useSearchStore.getState().toggleChannel('file-import')
        expect(useSearchStore.getState().channels).toHaveLength(2)

        useSearchStore.getState().toggleChannel('auto-collect')

        const state = useSearchStore.getState()
        expect(state.channels).toHaveLength(1)
        expect(state.channels).not.toContain('auto-collect')
        expect(state.channels).toContain('file-import')
      })
    })

    describe('toggleStatus', () => {
      it('添加不存在的 status', () => {
        useSearchStore.getState().setPage(3)
        useSearchStore.getState().toggleStatus('success')

        const state = useSearchStore.getState()
        expect(state.statuses).toContain('success')
        expect(state.statuses).toHaveLength(1)
        expect(state.page).toBe(1)
      })

      it('移除已存在的 status', () => {
        useSearchStore.getState().toggleStatus('success')
        useSearchStore.getState().toggleStatus('failed')
        expect(useSearchStore.getState().statuses).toHaveLength(2)

        useSearchStore.getState().toggleStatus('success')

        const state = useSearchStore.getState()
        expect(state.statuses).toHaveLength(1)
        expect(state.statuses).not.toContain('success')
        expect(state.statuses).toContain('failed')
      })
    })

    describe('toggleFileType', () => {
      it('添加不存在的 fileType', () => {
        useSearchStore.getState().setPage(4)
        useSearchStore.getState().toggleFileType('csv')

        const state = useSearchStore.getState()
        expect(state.fileTypes).toContain('csv')
        expect(state.fileTypes).toHaveLength(1)
        expect(state.page).toBe(1)
      })

      it('移除已存在的 fileType', () => {
        useSearchStore.getState().toggleFileType('csv')
        useSearchStore.getState().toggleFileType('xlsx')
        expect(useSearchStore.getState().fileTypes).toHaveLength(2)

        useSearchStore.getState().toggleFileType('csv')

        const state = useSearchStore.getState()
        expect(state.fileTypes).toHaveLength(1)
        expect(state.fileTypes).not.toContain('csv')
        expect(state.fileTypes).toContain('xlsx')
      })
    })

    describe('setSymbols', () => {
      it('设置股票代码列表并重置页码', () => {
        useSearchStore.getState().setPage(2)
        useSearchStore.getState().setSymbols(['AAPL', 'TSLA'])

        const state = useSearchStore.getState()
        expect(state.symbols).toEqual(['AAPL', 'TSLA'])
        expect(state.page).toBe(1)
      })
    })

    describe('setDimensions', () => {
      it('设置维度列表并重置页码', () => {
        useSearchStore.getState().setPage(3)
        useSearchStore.getState().setDimensions(['financial', 'technical'])

        const state = useSearchStore.getState()
        expect(state.dimensions).toEqual(['financial', 'technical'])
        expect(state.page).toBe(1)
      })
    })

    describe('setPage', () => {
      it('设置当前页码', () => {
        useSearchStore.getState().setPage(5)
        expect(useSearchStore.getState().page).toBe(5)
      })
    })

    describe('setViewMode', () => {
      it('设置视图模式为 grouped', () => {
        useSearchStore.getState().setViewMode('grouped')
        expect(useSearchStore.getState().viewMode).toBe('grouped')
      })

      it('设置视图模式为 timeline', () => {
        useSearchStore.getState().setViewMode('grouped')
        useSearchStore.getState().setViewMode('timeline')
        expect(useSearchStore.getState().viewMode).toBe('timeline')
      })
    })
  })

  // --------------------------------------------------------
  // 7. buildCriteria
  // --------------------------------------------------------
  describe('buildCriteria', () => {
    it('默认状态下生成的条件（空字段为 undefined）', () => {
      const criteria = useSearchStore.getState().buildCriteria()

      expect(criteria.keyword).toBeUndefined()
      expect(criteria.dateRange).toBeUndefined()
      expect(criteria.channels).toBeUndefined()
      expect(criteria.symbols).toBeUndefined()
      expect(criteria.dimensions).toBeUndefined()
      expect(criteria.statuses).toBeUndefined()
      expect(criteria.fileTypes).toBeUndefined()
      expect(criteria.sortBy).toBe('timestamp')
      expect(criteria.sortOrder).toBe('desc')
      expect(criteria.page).toBe(1)
      expect(criteria.pageSize).toBe(20)
    })

    it('设置关键词后正确包含 keyword', () => {
      useSearchStore.getState().setKeyword('测试')
      const criteria = useSearchStore.getState().buildCriteria()
      expect(criteria.keyword).toBe('测试')
    })

    it('设置 channels 后正确包含 channels', () => {
      useSearchStore.getState().toggleChannel('auto-collect')
      useSearchStore.getState().toggleChannel('file-import')
      const criteria = useSearchStore.getState().buildCriteria()
      expect(criteria.channels).toEqual(['auto-collect', 'file-import'])
    })

    it('设置 statuses 后正确包含 statuses', () => {
      useSearchStore.getState().toggleStatus('success')
      const criteria = useSearchStore.getState().buildCriteria()
      expect(criteria.statuses).toEqual(['success'])
    })

    it('设置 fileTypes 后正确包含 fileTypes', () => {
      useSearchStore.getState().toggleFileType('csv')
      const criteria = useSearchStore.getState().buildCriteria()
      expect(criteria.fileTypes).toEqual(['csv'])
    })

    it('设置 symbols 和 dimensions 后正确包含', () => {
      useSearchStore.getState().setSymbols(['AAPL'])
      useSearchStore.getState().setDimensions(['financial'])
      const criteria = useSearchStore.getState().buildCriteria()
      expect(criteria.symbols).toEqual(['AAPL'])
      expect(criteria.dimensions).toEqual(['financial'])
    })

    it('datePreset=today 生成正确的 dateRange', () => {
      useSearchStore.getState().setDatePreset('today')
      const criteria = useSearchStore.getState().buildCriteria()

      expect(criteria.dateRange).toBeDefined()
      expect(criteria.dateRange!.preset).toBe('custom')
      expect(criteria.dateRange!.start).toBeDefined()
      expect(criteria.dateRange!.end).toBeDefined()

      // start 应该是今天的 00:00:00
      const startDate = new Date(criteria.dateRange!.start!)
      const now = new Date()
      expect(startDate.getFullYear()).toBe(now.getFullYear())
      expect(startDate.getMonth()).toBe(now.getMonth())
      expect(startDate.getDate()).toBe(now.getDate())
      expect(startDate.getHours()).toBe(0)
    })

    it('datePreset=last7days 生成正确的 dateRange', () => {
      useSearchStore.getState().setDatePreset('last7days')
      const criteria = useSearchStore.getState().buildCriteria()

      expect(criteria.dateRange).toBeDefined()
      expect(criteria.dateRange!.preset).toBe('last7days')
      expect(criteria.dateRange!.start).toBeDefined()
      expect(criteria.dateRange!.end).toBeDefined()

      const startDate = new Date(criteria.dateRange!.start!)
      const endDate = new Date(criteria.dateRange!.end!)
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeCloseTo(7, 0)
    })

    it('datePreset=all 时 dateRange 为 undefined', () => {
      useSearchStore.getState().setDatePreset('all')
      const criteria = useSearchStore.getState().buildCriteria()
      expect(criteria.dateRange).toBeUndefined()
    })

    /** @test_id V9-TEST-ST-SRCH-001-DATE-YESTERDAY */
    it('datePreset=yesterday 生成正确的 dateRange（昨天 00:00~23:59:59）', () => {
      useSearchStore.getState().setDatePreset('yesterday')
      const criteria = useSearchStore.getState().buildCriteria()

      expect(criteria.dateRange).toBeDefined()
      expect(criteria.dateRange!.preset).toBe('custom')

      const startDate = new Date(criteria.dateRange!.start!)
      const endDate = new Date(criteria.dateRange!.end!)

      // start 应该是昨天的 00:00:00
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(startDate.getFullYear()).toBe(yesterday.getFullYear())
      expect(startDate.getMonth()).toBe(yesterday.getMonth())
      expect(startDate.getDate()).toBe(yesterday.getDate())
      expect(startDate.getHours()).toBe(0)
      expect(startDate.getMinutes()).toBe(0)

      // end 应该是昨天的 23:59:59
      expect(endDate.getFullYear()).toBe(yesterday.getFullYear())
      expect(endDate.getMonth()).toBe(yesterday.getMonth())
      expect(endDate.getDate()).toBe(yesterday.getDate())
      expect(endDate.getHours()).toBe(23)
      expect(endDate.getMinutes()).toBe(59)
    })

    /** @test_id V9-TEST-ST-SRCH-001-DATE-LAST30 */
    it('datePreset=last30days 生成正确的 dateRange', () => {
      useSearchStore.getState().setDatePreset('last30days')
      const criteria = useSearchStore.getState().buildCriteria()

      expect(criteria.dateRange).toBeDefined()
      expect(criteria.dateRange!.preset).toBe('last30days')
      expect(criteria.dateRange!.start).toBeDefined()
      expect(criteria.dateRange!.end).toBeDefined()

      const startDate = new Date(criteria.dateRange!.start!)
      const endDate = new Date(criteria.dateRange!.end!)
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeCloseTo(30, 0)
    })

    it('page 和 pageSize 正确传递', () => {
      useSearchStore.getState().setPage(3)
      const criteria = useSearchStore.getState().buildCriteria()
      expect(criteria.page).toBe(3)
      expect(criteria.pageSize).toBe(20)
    })
  })

  // --------------------------------------------------------
  // 8. reset 重置到初始状态
  // --------------------------------------------------------
  describe('reset', () => {
    it('重置所有状态到初始值', () => {
      // 先修改所有字段
      useSearchStore.getState().setKeyword('测试')
      useSearchStore.getState().setDatePreset('last7days')
      useSearchStore.getState().toggleChannel('auto-collect')
      useSearchStore.getState().toggleStatus('success')
      useSearchStore.getState().toggleFileType('csv')
      useSearchStore.getState().setSymbols(['AAPL'])
      useSearchStore.getState().setDimensions(['financial'])
      useSearchStore.getState().setPage(5)
      useSearchStore.getState().setViewMode('grouped')
      useSearchStore.getState().setResult(createMockSearchResult())
      useSearchStore.getState().setLoading(true)

      // 重置
      useSearchStore.getState().reset()

      const state = useSearchStore.getState()
      expect(state.keyword).toBe('')
      expect(state.datePreset).toBe('all')
      expect(state.channels).toEqual([])
      expect(state.symbols).toEqual([])
      expect(state.dimensions).toEqual([])
      expect(state.statuses).toEqual([])
      expect(state.fileTypes).toEqual([])
      expect(state.page).toBe(1)
      expect(state.pageSize).toBe(20)
      expect(state.viewMode).toBe('timeline')
      expect(state.result).toBeNull()
      expect(state.loading).toBe(false)
    })

    it('重置时触发广播事件', async () => {
      const { eventBus } = await import('@/lib/eventBus')

      useSearchStore.getState().reset()

      expect(eventBus.emit).toHaveBeenCalledWith(
        'data_test:changed',
        { action: 'searchReset' }
      )
    })

    it('重置时记录 info 日志', () => {
      useSearchStore.getState().reset()

      expect(mockLogger.info).toHaveBeenCalledWith('[searchStore] 已重置')
    })
  })
})
