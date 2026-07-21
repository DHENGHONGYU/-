import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePoolBoard } from './usePoolBoard'
import type { PoolItem } from '@/types/modules/pool.types'
import { RESEARCH_STATUS, DEFAULT_POOL_GROUP, POOL_TYPE } from '@/constants/pool.constants'

// ============================================================
// Mock 外部依赖（使用 vi.hoisted 确保在 vi.mock 提升之前初始化）
// ============================================================

const {
  mockNavigate,
  mockRefresh,
  mockTransitionPoolItem,
  mockUpdatePoolItemGroup,
  mockRefreshSymbolKline,
  mockLogger,
  mockState,
} = vi.hoisted(() => {
  const mockState = {
    items: [] as PoolItem[],
    loading: false,
    error: null as string | null,
  }

  return {
    mockNavigate: vi.fn(),
    mockRefresh: vi.fn().mockResolvedValue(undefined),
    mockTransitionPoolItem: vi.fn().mockResolvedValue({ success: true }),
    mockUpdatePoolItemGroup: vi.fn().mockResolvedValue({ success: true }),
    mockRefreshSymbolKline: vi.fn().mockResolvedValue({ success: true }),
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    mockState,
  }
})

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/store/researchPoolStore', () => ({
  useResearchPoolStore: vi.fn((selector: (state: any) => any) => {
    const state = {
      items: mockState.items,
      loading: mockState.loading,
      error: mockState.error,
      refresh: mockRefresh,
    }
    return selector(state)
  }),
}))

vi.mock('@/services/pool/poolService', () => ({
  transitionPoolItem: (...args: any[]) => mockTransitionPoolItem(...args),
  updatePoolItemGroup: (...args: any[]) => mockUpdatePoolItemGroup(...args),
}))

vi.mock('@/services/fetcher/fetcherService', () => ({
  refreshSymbolKline: (...args: any[]) => mockRefreshSymbolKline(...args),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

// ============================================================
// 测试数据
// ============================================================

function createMockItem(overrides: Partial<PoolItem> = {}): PoolItem {
  return {
    symbol: 'SH600000',
    name: '浦发银行',
    pool: POOL_TYPE.research,
    status: RESEARCH_STATUS.candidate,
    source: 'manual' as const,
    dataVersion: 1,
    group: DEFAULT_POOL_GROUP,
    dataQuality: { basic: true, kline: true, finance: true },
    ...overrides,
  } as PoolItem
}

const mockItemsData: PoolItem[] = [
  createMockItem({ symbol: 'SH600000', name: '浦发银行', group: '金融', status: RESEARCH_STATUS.candidate }),
  createMockItem({ symbol: 'SH600036', name: '招商银行', group: '金融', status: RESEARCH_STATUS.screened }),
  createMockItem({ symbol: 'SZ000001', name: '平安银行', group: '金融', status: RESEARCH_STATUS.deepDive }),
  createMockItem({ symbol: 'SH601318', name: '中国平安', group: '保险', status: RESEARCH_STATUS.watching }),
  createMockItem({
    symbol: 'SH600519',
    name: '贵州茅台',
    group: '消费',
    status: RESEARCH_STATUS.candidate,
    dataQuality: { basic: false, kline: false, finance: false },
  }),
]

// ============================================================
// 测试用例
// ============================================================

describe('usePoolBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.items = []
    mockState.loading = false
    mockState.error = null
    mockRefresh.mockResolvedValue(undefined)
    mockTransitionPoolItem.mockResolvedValue({ success: true })
    mockUpdatePoolItemGroup.mockResolvedValue({ success: true })
    mockRefreshSymbolKline.mockResolvedValue({ success: true })
  })

  describe('初始状态', () => {
    it('初始化时调用 refresh 加载数据', () => {
      renderHook(() => usePoolBoard())

      expect(mockRefresh).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('初始状态各字段正确', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.viewMode).toBe('kanban')
      expect(result.current.selectedGroup).toBe('')
      expect(result.current.qualityFilter).toBe('all')
      expect(result.current.selectedSymbols).toEqual([])
      expect(result.current.message).toBe('')
      expect(result.current.newGroupDialogOpen).toBe(false)
      expect(result.current.newGroupName).toBe('')
      expect(result.current.items).toEqual([])
      expect(result.current.filteredItems).toEqual([])
      expect(result.current.allGroups).toEqual([])
    })

    it('loading 状态正确传递', () => {
      mockState.loading = true
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.loading).toBe(true)
    })

    it('error 状态正确传递', () => {
      mockState.error = '加载失败'
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.error).toBe('加载失败')
    })
  })

  describe('池数据加载', () => {
    it('加载成功后 items 和 allGroups 正确计算', () => {
      mockState.items = mockItemsData
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.items).toHaveLength(5)
      expect(result.current.allGroups).toEqual(['保险', '消费', '金融'])
      expect(result.current.filteredItems).toHaveLength(5)
    })

    it('allGroups 按字母排序', () => {
      mockState.items = [
        createMockItem({ symbol: 'A', group: 'Z组' }),
        createMockItem({ symbol: 'B', group: 'A组' }),
        createMockItem({ symbol: 'C', group: 'M组' }),
      ]
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.allGroups).toEqual(['A组', 'M组', 'Z组'])
    })

    it('无 group 字段的 item 使用默认分组', () => {
      mockState.items = [
        createMockItem({ symbol: 'SH600000', group: undefined }),
      ]
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.allGroups).toEqual([DEFAULT_POOL_GROUP])
    })

    it('空数组时 allGroups 为空数组', () => {
      mockState.items = []
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.allGroups).toEqual([])
    })
  })

  describe('筛选功能', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('按分组筛选', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setSelectedGroup('金融')
      })

      expect(result.current.selectedGroup).toBe('金融')
      expect(result.current.filteredItems).toHaveLength(3)
      expect(result.current.filteredItems.every((s) => s.group === '金融')).toBe(true)
    })

    it('按分组筛选 - 保险组', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setSelectedGroup('保险')
      })

      expect(result.current.filteredItems).toHaveLength(1)
      expect(result.current.filteredItems[0]!.symbol).toBe('SH601318')
    })

    it('selectedGroup 为空时不过滤', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.selectedGroup).toBe('')
      expect(result.current.filteredItems).toHaveLength(5)
    })

    it('qualityFilter=all 不过滤数据质量', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.qualityFilter).toBe('all')
      expect(result.current.filteredItems).toHaveLength(5)
    })

    it('qualityFilter=missingBasic 筛选基础数据缺失', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setQualityFilter('missingBasic')
      })

      expect(result.current.filteredItems).toHaveLength(1)
      expect(result.current.filteredItems[0]!.symbol).toBe('SH600519')
    })

    it('qualityFilter=missingKline 筛选K线数据缺失', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setQualityFilter('missingKline')
      })

      expect(result.current.filteredItems).toHaveLength(1)
      expect(result.current.filteredItems[0]!.symbol).toBe('SH600519')
    })

    it('qualityFilter=missingFinance 筛选财务数据缺失', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setQualityFilter('missingFinance')
      })

      expect(result.current.filteredItems).toHaveLength(1)
      expect(result.current.filteredItems[0]!.symbol).toBe('SH600519')
    })

    it('分组筛选 + 质量筛选组合使用', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setSelectedGroup('消费')
        result.current.setQualityFilter('missingBasic')
      })

      expect(result.current.filteredItems).toHaveLength(1)
      expect(result.current.filteredItems[0]!.symbol).toBe('SH600519')
    })

    it('分组筛选 + 质量筛选无结果', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setSelectedGroup('金融')
        result.current.setQualityFilter('missingBasic')
      })

      expect(result.current.filteredItems).toHaveLength(0)
    })
  })

  describe('视图模式', () => {
    it('默认视图模式为 kanban', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.viewMode).toBe('kanban')
    })

    it('可以切换到 list 模式', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setViewMode('list')
      })

      expect(result.current.viewMode).toBe('list')
    })
  })

  describe('选择股票功能', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('初始 selectedSymbols 为空', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.selectedSymbols).toEqual([])
    })

    it('handleSelectToggle 选中一只股票', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
      })

      expect(result.current.selectedSymbols).toEqual(['SH600000'])
    })

    it('handleSelectToggle 再次点击取消选中', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
      })
      act(() => {
        result.current.handleSelectToggle('SH600000')
      })

      expect(result.current.selectedSymbols).toEqual([])
    })

    it('handleSelectToggle 多选多只股票', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
        result.current.handleSelectToggle('SH600036')
        result.current.handleSelectToggle('SZ000001')
      })

      expect(result.current.selectedSymbols).toHaveLength(3)
      expect(result.current.selectedSymbols).toContain('SH600000')
      expect(result.current.selectedSymbols).toContain('SH600036')
      expect(result.current.selectedSymbols).toContain('SZ000001')
    })

    it('setSelectedSymbols 直接设置选中列表', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setSelectedSymbols(['SH600000', 'SH600036'])
      })

      expect(result.current.selectedSymbols).toEqual(['SH600000', 'SH600036'])
    })
  })

  describe('状态流转', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('handleTransition 调用 transitionPoolItem 并刷新', async () => {
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleTransition('SH600000', RESEARCH_STATUS.screened)
      })

      expect(mockTransitionPoolItem).toHaveBeenCalledWith('SH600000', {
        pool: POOL_TYPE.research,
        status: RESEARCH_STATUS.screened,
        label: '状态流转',
      })
      expect(mockRefresh).toHaveBeenCalled()
    })

    it('handleTransition 成功时不设置错误消息', async () => {
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleTransition('SH600000', RESEARCH_STATUS.screened)
      })

      expect(result.current.message).toBe('')
    })

    it('handleTransition 失败时设置错误消息', async () => {
      mockTransitionPoolItem.mockResolvedValue({ success: false, error: '流转失败原因' })
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleTransition('SH600000', RESEARCH_STATUS.screened)
      })

      expect(result.current.message).toBe('SH600000 流转失败：流转失败原因')
    })

    it('handleTransition 失败且无 error 信息时显示默认消息', async () => {
      mockTransitionPoolItem.mockResolvedValue({ success: false })
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleTransition('SH600000', RESEARCH_STATUS.screened)
      })

      expect(result.current.message).toBe('SH600000 流转失败：未知错误')
    })
  })

  describe('修改分组', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('handleChangeGroup 调用 updatePoolItemGroup 并刷新', async () => {
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleChangeGroup('SH600000', '新分组')
      })

      expect(mockUpdatePoolItemGroup).toHaveBeenCalledWith('SH600000', '新分组')
      expect(mockRefresh).toHaveBeenCalled()
    })

    it('handleChangeGroup 失败时设置错误消息', async () => {
      mockUpdatePoolItemGroup.mockResolvedValue({ success: false, error: '修改失败' })
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleChangeGroup('SH600000', '新分组')
      })

      expect(result.current.message).toBe('SH600000 移入分组失败：修改失败')
    })
  })

  describe('刷新行情', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('handleRefreshKline 调用 refreshSymbolKline 并刷新', async () => {
      const item = mockItemsData[0]!
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleRefreshKline(item)
      })

      expect(mockRefreshSymbolKline).toHaveBeenCalledWith('SH600000')
      expect(mockRefresh).toHaveBeenCalled()
      expect(result.current.message).toBe('已刷新 SH600000 行情')
    })

    it('handleRefreshKline 失败时显示错误消息', async () => {
      mockRefreshSymbolKline.mockResolvedValue({ success: false, error: '网络错误' })
      const item = mockItemsData[0]!
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleRefreshKline(item)
      })

      expect(result.current.message).toBe('网络错误')
      // 初始化时调用 1 次，失败时不再调用
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('跳转分析', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('handleAnalyze 调用 navigate 跳转到分析页面', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleAnalyze('SH600000')
      })

      expect(mockNavigate).toHaveBeenCalledWith('/analysis/intelligent-score/SH600000')
    })
  })

  describe('批量操作', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('handleBulkArchive 批量归档选中的股票', async () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
        result.current.handleSelectToggle('SH600036')
      })

      await act(async () => {
        await result.current.handleBulkArchive()
      })

      expect(mockTransitionPoolItem).toHaveBeenCalledTimes(2)
      expect(mockTransitionPoolItem).toHaveBeenCalledWith('SH600000', {
        pool: POOL_TYPE.research,
        status: RESEARCH_STATUS.archived,
        label: '批量流转',
      })
      expect(mockTransitionPoolItem).toHaveBeenCalledWith('SH600036', {
        pool: POOL_TYPE.research,
        status: RESEARCH_STATUS.archived,
        label: '批量流转',
      })
      expect(mockRefresh).toHaveBeenCalled()
      expect(result.current.selectedSymbols).toEqual([])
    })

    it('handleBulkArchive 成功后显示成功消息', async () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
      })

      await act(async () => {
        await result.current.handleBulkArchive()
      })

      expect(result.current.message).toBe('已批量流转 1 只标的')
    })

    it('handleBulkArchive 部分失败时显示失败详情', async () => {
      mockTransitionPoolItem
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: '权限不足' })

      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
        result.current.handleSelectToggle('SH600036')
      })

      await act(async () => {
        await result.current.handleBulkArchive()
      })

      expect(result.current.message).toContain('批量流转完成')
      expect(result.current.message).toContain('SH600036')
      expect(result.current.message).toContain('权限不足')
    })

    it('runBulkChangeGroup 批量修改分组', async () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
        result.current.handleSelectToggle('SH600036')
      })

      await act(async () => {
        await result.current.runBulkChangeGroup('新分组')
      })

      expect(mockUpdatePoolItemGroup).toHaveBeenCalledTimes(2)
      expect(mockUpdatePoolItemGroup).toHaveBeenCalledWith('SH600000', '新分组')
      expect(mockUpdatePoolItemGroup).toHaveBeenCalledWith('SH600036', '新分组')
      expect(result.current.selectedSymbols).toEqual([])
    })

    it('runBulkChangeGroup 成功后显示成功消息', async () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
      })

      await act(async () => {
        await result.current.runBulkChangeGroup('新分组')
      })

      expect(result.current.message).toBe('已批量移入分组 1 只标的')
    })

    it('批量操作后清空选中状态', async () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.handleSelectToggle('SH600000')
        result.current.handleSelectToggle('SH600036')
      })

      expect(result.current.selectedSymbols).toHaveLength(2)

      await act(async () => {
        await result.current.handleBulkArchive()
      })

      expect(result.current.selectedSymbols).toEqual([])
    })

    it('未选中任何股票时批量操作不调用服务', async () => {
      const { result } = renderHook(() => usePoolBoard())

      await act(async () => {
        await result.current.handleBulkArchive()
      })

      expect(mockTransitionPoolItem).not.toHaveBeenCalled()
      expect(result.current.message).toBe('已批量流转 0 只标的')
    })
  })

  describe('创建分组', () => {
    beforeEach(() => {
      mockState.items = mockItemsData
    })

    it('打开/关闭新建分组对话框', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.newGroupDialogOpen).toBe(false)

      act(() => {
        result.current.setNewGroupDialogOpen(true)
      })

      expect(result.current.newGroupDialogOpen).toBe(true)

      act(() => {
        result.current.setNewGroupDialogOpen(false)
      })

      expect(result.current.newGroupDialogOpen).toBe(false)
    })

    it('设置新分组名称', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setNewGroupName('我的分组')
      })

      expect(result.current.newGroupName).toBe('我的分组')
    })

    it('handleCreateGroup 创建成功', () => {
      const { result } = renderHook(() => usePoolBoard())

      act(() => {
        result.current.setNewGroupName('  新分组  ')
      })

      act(() => {
        result.current.handleCreateGroup()
      })

      expect(result.current.selectedGroup).toBe('新分组')
      expect(result.current.newGroupName).toBe('')
      expect(result.current.newGroupDialogOpen).toBe(false)
      expect(result.current.message).toContain('已创建分组')
      expect(result.current.message).toContain('新分组')
    })

    it('handleCreateGroup 空名称不创建', () => {
      const { result } = renderHook(() => usePoolBoard())

      // 先打开对话框（模拟用户操作流程）
      act(() => {
        result.current.setNewGroupDialogOpen(true)
        result.current.setNewGroupName('   ')
      })

      act(() => {
        result.current.handleCreateGroup()
      })

      expect(result.current.message).toBe('分组名称不能为空')
      // 失败时对话框保持打开状态
      expect(result.current.newGroupDialogOpen).toBe(true)
    })

    it('handleCreateGroup 重复名称不创建', () => {
      const { result } = renderHook(() => usePoolBoard())

      // 先打开对话框（模拟用户操作流程）
      act(() => {
        result.current.setNewGroupDialogOpen(true)
        result.current.setNewGroupName('金融')
      })

      act(() => {
        result.current.handleCreateGroup()
      })

      expect(result.current.message).toBe('分组名称已存在')
      // 失败时对话框保持打开状态
      expect(result.current.newGroupDialogOpen).toBe(true)
    })
  })

  describe('刷新功能', () => {
    it('refresh 函数正确传递', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(typeof result.current.refresh).toBe('function')
    })

    it('初始化时调用一次 refresh', () => {
      renderHook(() => usePoolBoard())

      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })

  describe('ALL_GROUPS_VALUE 常量', () => {
    it('正确导出 ALL_GROUPS_VALUE', () => {
      const { result } = renderHook(() => usePoolBoard())

      expect(result.current.ALL_GROUPS_VALUE).toBe('__all__')
    })
  })
})
