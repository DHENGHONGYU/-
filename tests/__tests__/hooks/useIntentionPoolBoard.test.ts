/**
 * @test_id V9-TEST-UT-HOOK-001
 * @fileoverview useIntentionPoolBoard Hook 逻辑单元测试
 *
 * 测试覆盖：
 *   1. 初始化状态（viewMode、qualityFilter、selectedSymbols 等）
 *   2. 视图模式切换（kanban/list）
 *   3. 分组筛选逻辑（allGroups 提取、selectedGroup 过滤）
 *   4. 数据质量筛选（all/missingBasic/missingKline/missingFinance）
 *   5. 选择切换逻辑（handleSelectToggle）
 *   6. 新建分组验证（空名称、重复名称）
 *   7. DataBridge 订阅初始化与清理
 *
 * @covers_docs [V9-DOC-PROJ-191, V9-DOC-PROJ-108]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Mock 依赖模块 ───────────────────────────────────────────

// mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// mock react-router
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}))

// mock services
vi.mock('@/services/pool/poolService', () => ({
  transitionPoolItem: vi.fn().mockResolvedValue({ success: true }),
  updatePoolItemGroup: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/services/fetcher/fetcherService', () => ({
  refreshSymbolKline: vi.fn().mockResolvedValue({ success: true }),
}))

// mock Store
const mockRefresh = vi.fn().mockResolvedValue(undefined)
const mockItems: unknown[] = []

vi.mock('@/store/intentionPoolStore', () => ({
  useIntentionPoolStore: Object.assign(
    (selector: (state: unknown) => unknown) => {
      const state = {
        items: mockItems,
        loading: false,
        error: null,
        refresh: mockRefresh,
      }
      return selector(state)
    },
    {
      getState: () => ({ items: mockItems, refresh: mockRefresh }),
    },
  ),
  initIntentionPoolStoreSubscriptions: vi.fn(() => vi.fn()),
}))

// ─── 导入被测模块 ────────────────────────────────────────────

import { useIntentionPoolBoard } from '@/hooks/useIntentionPoolBoard'
import { initIntentionPoolStoreSubscriptions } from '@/store/intentionPoolStore'

// ─── 辅助函数 ────────────────────────────────────────────────

interface MockPoolItem {
  symbol: string
  name: string
  group?: string
  dataQuality?: { basic?: boolean; kline?: boolean; finance?: boolean }
  [key: string]: unknown
}

function setMockItems(items: MockPoolItem[]): void {
  mockItems.length = 0
  mockItems.push(...items)
}

// ─── 测试套件 ────────────────────────────────────────────────

describe('useIntentionPoolBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMockItems([])
  })

  // ═══════════════════════════════════════════════════════════
  // 套件1：初始化状态
  // ═══════════════════════════════════════════════════════════

  describe('初始化状态', () => {
    it('viewMode 应为 kanban', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.viewMode).toBe('kanban')
    })

    it('qualityFilter 应为 all', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.qualityFilter).toBe('all')
    })

    it('selectedSymbols 应为空数组', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.selectedSymbols).toEqual([])
    })

    it('selectedGroup 应为空字符串', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.selectedGroup).toBe('')
    })

    it('newGroupDialogOpen 应为 false', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.newGroupDialogOpen).toBe(false)
    })

    it('ALL_GROUPS_VALUE 应为 __all__', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.ALL_GROUPS_VALUE).toBe('__all__')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件2：视图模式切换
  // ═══════════════════════════════════════════════════════════

  describe('视图模式切换', () => {
    it('setViewMode 应切换到 list', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setViewMode('list')
      })
      expect(result.current.viewMode).toBe('list')
    })

    it('setViewMode 应切换回 kanban', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setViewMode('list')
      })
      act(() => {
        result.current.setViewMode('kanban')
      })
      expect(result.current.viewMode).toBe('kanban')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件3：分组筛选逻辑
  // ═══════════════════════════════════════════════════════════

  describe('分组筛选逻辑', () => {
    it('allGroups 应从 items 中提取去重排序的分组', () => {
      setMockItems([
        { symbol: 'A', name: 'A', group: 'B组' },
        { symbol: 'B', name: 'B', group: 'A组' },
        { symbol: 'C', name: 'C', group: 'B组' },
      ])
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.allGroups).toEqual(['A组', 'B组'])
    })

    it('items 无 group 时应使用默认分组', () => {
      setMockItems([
        { symbol: 'A', name: 'A' },
        { symbol: 'B', name: 'B', group: 'X组' },
      ])
      const { result } = renderHook(() => useIntentionPoolBoard())
      // DEFAULT_POOL_GROUP = '默认分组'
      expect(result.current.allGroups).toContain('默认分组')
      expect(result.current.allGroups).toContain('X组')
    })

    it('selectedGroup 过滤后 filteredItems 应只包含匹配的 items', () => {
      setMockItems([
        { symbol: 'A', name: 'A', group: '核心' },
        { symbol: 'B', name: 'B', group: '观察' },
        { symbol: 'C', name: 'C', group: '核心' },
      ])
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setSelectedGroup('核心')
      })
      expect(result.current.filteredItems).toHaveLength(2)
      expect(result.current.filteredItems.map((i: { symbol: string }) => i.symbol)).toEqual(['A', 'C'])
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件4：数据质量筛选
  // ═══════════════════════════════════════════════════════════

  describe('数据质量筛选', () => {
    beforeEach(() => {
      setMockItems([
        { symbol: 'A', name: 'A', dataQuality: { basic: true, kline: true, finance: true } },
        { symbol: 'B', name: 'B', dataQuality: { basic: true, kline: false, finance: true } },
        { symbol: 'C', name: 'C', dataQuality: { basic: false, kline: true, finance: false } },
        { symbol: 'D', name: 'D' },
      ])
    })

    it('qualityFilter=all 应返回全部 items', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      expect(result.current.filteredItems).toHaveLength(4)
    })

    it('qualityFilter=missingBasic 应只返回 basic !== true 的 items', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setQualityFilter('missingBasic')
      })
      // C (basic=false) 和 D (no dataQuality) 应被保留
      expect(result.current.filteredItems).toHaveLength(2)
      const symbols = result.current.filteredItems.map((i: { symbol: string }) => i.symbol)
      expect(symbols).toContain('C')
      expect(symbols).toContain('D')
    })

    it('qualityFilter=missingKline 应只返回 kline !== true 的 items', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setQualityFilter('missingKline')
      })
      expect(result.current.filteredItems).toHaveLength(2)
      const symbols = result.current.filteredItems.map((i: { symbol: string }) => i.symbol)
      expect(symbols).toContain('B')
      expect(symbols).toContain('D')
    })

    it('qualityFilter=missingFinance 应只返回 finance !== true 的 items', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setQualityFilter('missingFinance')
      })
      expect(result.current.filteredItems).toHaveLength(2)
      const symbols = result.current.filteredItems.map((i: { symbol: string }) => i.symbol)
      expect(symbols).toContain('C')
      expect(symbols).toContain('D')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件5：选择切换逻辑
  // ═══════════════════════════════════════════════════════════

  describe('选择切换逻辑', () => {
    it('handleSelectToggle 应添加未选中的 symbol', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.handleSelectToggle('000001')
      })
      expect(result.current.selectedSymbols).toContain('000001')
    })

    it('handleSelectToggle 应移除已选中的 symbol', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.handleSelectToggle('000001')
      })
      expect(result.current.selectedSymbols).toContain('000001')
      act(() => {
        result.current.handleSelectToggle('000001')
      })
      expect(result.current.selectedSymbols).not.toContain('000001')
    })

    it('handleSelectToggle 应支持多个 symbol 同时选中', () => {
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.handleSelectToggle('000001')
        result.current.handleSelectToggle('600519')
      })
      expect(result.current.selectedSymbols).toHaveLength(2)
      expect(result.current.selectedSymbols).toContain('000001')
      expect(result.current.selectedSymbols).toContain('600519')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件6：新建分组验证
  // ═══════════════════════════════════════════════════════════

  describe('新建分组验证', () => {
    it('空名称应设置错误 message', () => {
      setMockItems([{ symbol: 'A', name: 'A', group: '已有组' }])
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setNewGroupName('   ')
      })
      act(() => {
        result.current.handleCreateGroup()
      })
      expect(result.current.message).toBe('分组名称不能为空')
    })

    it('重复名称应设置错误 message', () => {
      setMockItems([{ symbol: 'A', name: 'A', group: '已有组' }])
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setNewGroupName('已有组')
      })
      act(() => {
        result.current.handleCreateGroup()
      })
      expect(result.current.message).toBe('分组名称已存在')
    })

    it('有效名称应设置 selectedGroup 并关闭对话框', () => {
      setMockItems([{ symbol: 'A', name: 'A', group: '已有组' }])
      const { result } = renderHook(() => useIntentionPoolBoard())
      act(() => {
        result.current.setNewGroupName('新分组')
      })
      act(() => {
        result.current.handleCreateGroup()
      })
      expect(result.current.selectedGroup).toBe('新分组')
      expect(result.current.newGroupDialogOpen).toBe(false)
      expect(result.current.newGroupName).toBe('')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件7：DataBridge 订阅初始化
  // ═══════════════════════════════════════════════════════════

  describe('DataBridge 订阅初始化', () => {
    it('Hook 挂载时应调用 initIntentionPoolStoreSubscriptions', () => {
      renderHook(() => useIntentionPoolBoard())
      expect(initIntentionPoolStoreSubscriptions).toHaveBeenCalledTimes(1)
    })

    it('Hook 挂载时应调用 refresh 加载数据', () => {
      renderHook(() => useIntentionPoolBoard())
      expect(mockRefresh).toHaveBeenCalledTimes(1)
    })
  })
})
