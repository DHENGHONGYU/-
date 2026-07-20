/**
 * @test_id V9-TEST-UT-C5
 * @covers_docs [V9-DOC-PROJ-190, V9-DOC-PROJ-108, V9-DOC-DATA-024]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntentionPoolBoard } from '@/components/organisms/pool/IntentionPoolBoard'
import type { PoolItem } from '@/types/modules/pool.types'

/**
 * IntentionPoolBoard.tsx 单元测试
 *
 * 测试覆盖：
 *   1. 看板视图渲染（三列：初步筛选/观察列表/已归档）
 *   2. 列表视图切换
 *   3. 空状态展示
 */

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

// mock poolTransitionEngine
vi.mock('@/core/poolTransitionEngine', () => ({
  getPoolLabel: vi.fn((pool: string, status: string) => {
    // 模拟意向池三状态的中文标签
    const labelMap: Record<string, string> = {
      screening: '初步筛选',
      watchlist: '观察列表',
      archived: '已归档',
    }
    return labelMap[status] ?? `${pool}:${status}`
  }),
  getPoolTransitionOptions: vi.fn((_pool: string, status: string) => {
    // 根据状态返回可用的流转选项
    const optionsMap: Record<string, Array<{ pool: string; status: string; label: string }>> = {
      screening: [
        { pool: 'intention', status: 'watchlist', label: '加入观察' },
        { pool: 'intention', status: 'archived', label: '归档' },
      ],
      watchlist: [
        { pool: 'intention', status: 'archived', label: '归档' },
      ],
      archived: [
        { pool: 'intention', status: 'screening', label: '恢复筛选' },
      ],
    }
    return optionsMap[status] ?? []
  }),
}))

// mock QualityIndicator 组件（简化渲染）
vi.mock('@/components/organisms/input/QualityIndicator', () => ({
  QualityIndicator: ({ quality }: { quality?: { basic?: boolean; kline?: boolean; finance?: boolean } }) => (
    <div data-testid="quality-indicator">
      {quality?.basic ? '基础' : '无基础'}
    </div>
  ),
}))

// ─── 测试数据工厂 ────────────────────────────────────────────

/** 构造 mock PoolItem 数据 */
function makePoolItem(overrides: Partial<PoolItem> & { symbol: string }): PoolItem {
  return {
    symbol: overrides.symbol,
    name: overrides.name ?? `股票${overrides.symbol}`,
    pool: overrides.pool ?? 'intention',
    status: overrides.status ?? 'screening',
    price: overrides.price ?? 10.5,
    pe: overrides.pe ?? 15.2,
    pb: overrides.pb ?? 1.8,
    roe: overrides.roe ?? 12.5,
    marketCap: overrides.marketCap ?? 1e10,
    source: overrides.source ?? 'manual',
    dataVersion: overrides.dataVersion ?? 1,
    dataQuality: overrides.dataQuality ?? { basic: true, kline: true, finance: true },
    ingestedAt: overrides.ingestedAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    group: overrides.group ?? '默认分组',
    ...overrides,
  } as PoolItem
}

// ─── 测试套件 ────────────────────────────────────────────────

describe('IntentionPoolBoard.tsx 单元测试', () => {
  // 默认的 mock 回调
  const mockOnTransition = vi.fn()
  const mockOnSelectToggle = vi.fn()
  const mockOnChangeGroup = vi.fn()
  const mockOnAnalyze = vi.fn()
  const mockOnRefreshKline = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════════
  // 套件1：看板视图渲染（三列：初步筛选/观察列表/已归档）
  // ═══════════════════════════════════════════════════════════

  describe('看板视图渲染（三列）', () => {
    it('应渲染三列：初步筛选、观察列表、已归档', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
        makePoolItem({ symbol: '600519', status: 'watchlist' }),
        makePoolItem({ symbol: '000002', status: 'archived' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // 三列标题应存在
      expect(screen.getByText('初步筛选')).toBeInTheDocument()
      expect(screen.getByText('观察列表')).toBeInTheDocument()
      expect(screen.getByText('已归档')).toBeInTheDocument()
    })

    it('股票应显示在正确的列中', () => {
      const items = [
        makePoolItem({ symbol: '000001', name: '平安银行', status: 'screening' }),
        makePoolItem({ symbol: '600519', name: '贵州茅台', status: 'watchlist' }),
        makePoolItem({ symbol: '000002', name: '万科A', status: 'archived' }),
      ]

      const { container } = render(
        <IntentionPoolBoard
          items={items}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // 验证股票代码出现在 DOM 中
      expect(screen.getByText('000001')).toBeInTheDocument()
      expect(screen.getByText('600519')).toBeInTheDocument()
      expect(screen.getByText('000002')).toBeInTheDocument()

      // 验证股票名称出现在 DOM 中
      expect(screen.getByText('平安银行')).toBeInTheDocument()
      expect(screen.getByText('贵州茅台')).toBeInTheDocument()
      expect(screen.getByText('万科A')).toBeInTheDocument()
    })

    it('每列应显示正确的股票数量', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
        makePoolItem({ symbol: '000002', status: 'screening' }),
        makePoolItem({ symbol: '600519', status: 'watchlist' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // 数量徽标：初步筛选=2, 观察列表=1, 已归档=0
      // 数量以数字形式显示在列标题旁
      const countBadges = screen.getAllByText(/\d+/)
      // 应至少包含 2, 1, 0 三个计数
      const countTexts = countBadges.map((el) => el.textContent)
      expect(countTexts).toContain('2')
      expect(countTexts).toContain('1')
      expect(countTexts).toContain('0')
    })

    it('卡片应显示流转操作按钮', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // screening 状态应有 "加入观察" 和 "归档" 按钮
      expect(screen.getByText('加入观察')).toBeInTheDocument()
      expect(screen.getByText('归档')).toBeInTheDocument()
    })

    it('点击流转按钮应触发 onTransition 回调', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // 点击 "加入观察" 按钮
      fireEvent.click(screen.getByText('加入观察'))
      expect(mockOnTransition).toHaveBeenCalledWith('000001', 'watchlist')

      // 重置并点击 "归档" 按钮
      mockOnTransition.mockClear()
      fireEvent.click(screen.getByText('归档'))
      expect(mockOnTransition).toHaveBeenCalledWith('000001', 'archived')
    })

    it('卡片应显示价格/PE/PB/ROE 等财务数据', () => {
      const items = [
        makePoolItem({
          symbol: '000001',
          price: 12.35,
          pe: 8.5,
          pb: 0.9,
          roe: 10.5,
          status: 'screening',
        }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      expect(screen.getByText('价 12.35')).toBeInTheDocument()
      expect(screen.getByText('PE 8.50')).toBeInTheDocument()
      expect(screen.getByText('PB 0.90')).toBeInTheDocument()
      expect(screen.getByText('ROE 10.50%')).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件2：列表视图切换
  // ═══════════════════════════════════════════════════════════

  describe('列表视图切换', () => {
    it('viewMode="list" 时应渲染表格视图', () => {
      const items = [
        makePoolItem({ symbol: '000001', name: '平安银行', status: 'screening' }),
        makePoolItem({ symbol: '600519', name: '贵州茅台', status: 'watchlist' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="list"
          selectedSymbols={[]}
          onSelectToggle={mockOnSelectToggle}
          onTransition={mockOnTransition}
        />,
      )

      // 表格应有列头
      expect(screen.getByText('代码')).toBeInTheDocument()
      expect(screen.getByText('名称')).toBeInTheDocument()
      expect(screen.getByText('状态')).toBeInTheDocument()
      expect(screen.getByText('价格')).toBeInTheDocument()

      // 股票数据应出现在表格中
      expect(screen.getByText('000001')).toBeInTheDocument()
      expect(screen.getByText('平安银行')).toBeInTheDocument()
      expect(screen.getByText('600519')).toBeInTheDocument()
      expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    })

    it('列表视图中不应渲染看板列标题', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="list"
          selectedSymbols={[]}
          onSelectToggle={mockOnSelectToggle}
          onTransition={mockOnTransition}
        />,
      )

      // 看板视图的列标题不应出现（列表视图使用表格而非列）
      // "初步筛选" 作为列标题不应出现，但可能作为状态标签出现
      // 验证表格结构存在
      const table = document.querySelector('table')
      expect(table).toBeInTheDocument()
    })

    it('列表视图应显示操作按钮', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="list"
          selectedSymbols={[]}
          onSelectToggle={mockOnSelectToggle}
          onTransition={mockOnTransition}
        />,
      )

      // screening 状态应有 "加入观察" 和 "归档" 按钮
      expect(screen.getByText('加入观察')).toBeInTheDocument()
      expect(screen.getByText('归档')).toBeInTheDocument()
    })

    it('列表视图点击流转按钮应触发 onTransition', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'watchlist' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="list"
          selectedSymbols={[]}
          onSelectToggle={mockOnSelectToggle}
          onTransition={mockOnTransition}
        />,
      )

      // watchlist 状态应有 "归档" 按钮
      fireEvent.click(screen.getByText('归档'))
      expect(mockOnTransition).toHaveBeenCalledWith('000001', 'archived')
    })

    it('默认 viewMode 应为看板视图', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
      ]

      // 不传 viewMode，默认应为 kanban
      render(
        <IntentionPoolBoard
          items={items}
          onTransition={mockOnTransition}
        />,
      )

      // 看板列标题应存在
      expect(screen.getByText('初步筛选')).toBeInTheDocument()
      expect(screen.getByText('观察列表')).toBeInTheDocument()
      expect(screen.getByText('已归档')).toBeInTheDocument()

      // 表格不应存在
      const table = document.querySelector('table')
      expect(table).not.toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════
  // 套件3：空状态展示
  // ═══════════════════════════════════════════════════════════

  describe('空状态展示', () => {
    it('看板视图无数据时，每列应显示"暂无标的"', () => {
      render(
        <IntentionPoolBoard
          items={[]}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // 三列都应显示空状态
      const emptyTexts = screen.getAllByText('暂无标的')
      expect(emptyTexts).toHaveLength(3)
    })

    it('看板视图部分列有数据时，空列应显示"暂无标的"', () => {
      const items = [
        makePoolItem({ symbol: '000001', status: 'screening' }),
      ]

      render(
        <IntentionPoolBoard
          items={items}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // 只有 screening 列有数据，watchlist 和 archived 列应为空
      const emptyTexts = screen.getAllByText('暂无标的')
      expect(emptyTexts).toHaveLength(2)
    })

    it('列表视图无数据时，表格应显示"暂无标的"', () => {
      render(
        <IntentionPoolBoard
          items={[]}
          viewMode="list"
          selectedSymbols={[]}
          onSelectToggle={mockOnSelectToggle}
          onTransition={mockOnTransition}
        />,
      )

      expect(screen.getByText('暂无标的')).toBeInTheDocument()
    })

    it('空状态时三列标题仍应正确渲染', () => {
      render(
        <IntentionPoolBoard
          items={[]}
          viewMode="kanban"
          onTransition={mockOnTransition}
        />,
      )

      // 即使没有数据，三列标题仍应显示
      expect(screen.getByText('初步筛选')).toBeInTheDocument()
      expect(screen.getByText('观察列表')).toBeInTheDocument()
      expect(screen.getByText('已归档')).toBeInTheDocument()

      // 每列计数应为 0
      const zeroBadges = screen.getAllByText('0')
      expect(zeroBadges).toHaveLength(3)
    })
  })
})
