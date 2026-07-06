import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  adaptHeatmapData,
  getMetricValue,
  SectorRotationHeatmap,
  type HeatmapCell,
} from '@/components/analysis/sector/SectorRotationHeatmap'
import type { SectorHeatmapData } from '@/types/modules/widget.types'
import { UI_TEXT } from '@/constants/uiText'

// ============================================================
// Mock: react-router useNavigate
// ============================================================
const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// ============================================================
// Mock: marketDataStore
// ============================================================
const mockUseDataSource = vi.fn()
const mockFetchDataSource = vi.fn().mockResolvedValue(undefined)
vi.mock('@/store/marketDataStore', () => ({
  useDataSource: (key: string) => mockUseDataSource(key),
  useMarketDataStore: (selector: (state: { fetchDataSource: typeof mockFetchDataSource }) => unknown) =>
    selector({ fetchDataSource: mockFetchDataSource }),
}))

// ============================================================
// 测试辅助函数
// ============================================================
function buildSectors(overrides: Partial<SectorHeatmapData>[] = []): SectorHeatmapData[] {
  const defaults: SectorHeatmapData[] = [
    { name: '半导体', code: 'SEC001', changePercent: 3.25, turnover: '2.5%', fundFlow: 1.2 },
    { name: '新能源', code: 'SEC002', changePercent: -1.82, turnover: '1.8%', fundFlow: -0.5 },
    { name: '人工智能', code: 'SEC003', changePercent: 4.56, turnover: '3.1%', fundFlow: 2.0 },
    { name: '房地产', code: 'SEC004', changePercent: -0.5, turnover: '0.9%', fundFlow: 0 },
  ]
  return overrides.length > 0
    ? overrides.map((o, i) => ({ ...(defaults[i] ?? defaults[0]), ...o })) as SectorHeatmapData[]
    : defaults
}

function withDataSourceReturn(overrides: Partial<ReturnType<typeof mockUseDataSource>> = {}) {
  return {
    data: undefined,
    loading: false,
    error: null,
    lastUpdated: 0,
    ...overrides,
  }
}

// ============================================================
// 纯函数单元测试
// ============================================================
describe('SectorRotationHeatmap pure functions', () => {
  describe('adaptHeatmapData', () => {
    it('adapts numeric turnover and fundFlow', () => {
      const result = adaptHeatmapData(buildSectors())

      expect(result[0]).toMatchObject({
        name: '半导体',
        code: 'SEC001',
        changePercent: 3.25,
        turnover: 2.5,
        fundFlow: 1.2,
      })
    })

    it('parses string turnover with percent sign', () => {
      const result = adaptHeatmapData([{ name: 'A', code: 'A', changePercent: 1, turnover: '5.5%' }])

      expect(result[0]!.turnover).toBe(5.5)
    })

    it('returns null for invalid turnover string', () => {
      const result = adaptHeatmapData([{ name: 'A', code: 'A', changePercent: 1, turnover: 'N/A' }])

      expect(result[0]!.turnover).toBeNull()
    })

    it('returns null for missing turnover and fundFlow', () => {
      const result = adaptHeatmapData([{ name: 'A', code: 'A', changePercent: 1 }])

      expect(result[0]!.turnover).toBeNull()
      expect(result[0]!.fundFlow).toBeNull()
    })

    it('keeps numeric turnover as-is', () => {
      const result = adaptHeatmapData([{ name: 'A', code: 'A', changePercent: 1, turnover: '3.14%' }])

      expect(result[0]!.turnover).toBe(3.14)
    })
  })

  describe('getMetricValue', () => {
    const cell: HeatmapCell = {
      name: '半导体',
      code: 'SEC001',
      changePercent: 3.25,
      turnover: 2.5,
      fundFlow: 1.2,
    }

    it('returns changePercent for changePercent metric', () => {
      expect(getMetricValue(cell, 'changePercent')).toBe(3.25)
    })

    it('returns turnover for turnover metric', () => {
      expect(getMetricValue(cell, 'turnover')).toBe(2.5)
    })

    it('returns fundFlow for fundFlow metric', () => {
      expect(getMetricValue(cell, 'fundFlow')).toBe(1.2)
    })

    it('returns null when metric value is null', () => {
      const cellWithNulls: HeatmapCell = {
        name: 'A',
        code: 'A',
        changePercent: 1,
        turnover: null,
        fundFlow: null,
      }
      expect(getMetricValue(cellWithNulls, 'turnover')).toBeNull()
    })
  })
})

// ============================================================
// 组件集成测试
// ============================================================
describe('SectorRotationHeatmap component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDataSource.mockReturnValue(withDataSourceReturn({ data: { sectors: buildSectors() } }))
  })

  // ----------------------------------------------------------
  // 状态分支
  // ----------------------------------------------------------
  it('renders loading state when useDataSource returns loading', () => {
    mockUseDataSource.mockReturnValue(withDataSourceReturn({ loading: true }))

    render(<SectorRotationHeatmap />)

    expect(screen.getByText(UI_TEXT.analysis.hotSector.rotationHeatmap)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.common.loading)).toBeInTheDocument()
  })

  it('renders error state when useDataSource returns error', () => {
    mockUseDataSource.mockReturnValue(withDataSourceReturn({ error: '数据服务异常' }))

    render(<SectorRotationHeatmap />)

    expect(screen.getByText('数据服务异常')).toBeInTheDocument()
  })

  it('renders empty state when sectors array is empty', () => {
    mockUseDataSource.mockReturnValue(withDataSourceReturn({ data: { sectors: [] } }))

    render(<SectorRotationHeatmap />)

    expect(screen.getByText(UI_TEXT.common.empty)).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 正常渲染
  // ----------------------------------------------------------
  it('renders title and time/metric selectors', () => {
    render(<SectorRotationHeatmap />)

    expect(screen.getByText(UI_TEXT.analysis.hotSector.rotationHeatmap)).toBeInTheDocument()
    // 组件中 Select 未配置 label，使用 role 选择器定位两个下拉框
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBe(2)
    expect(screen.getByText('日线')).toBeInTheDocument()
    expect(screen.getByText('涨跌幅')).toBeInTheDocument()
  })

  it('renders sector cells with formatted metric values', () => {
    render(<SectorRotationHeatmap />)

    // 通过 aria-label 定位热力图 cell（同时验证无障碍标签）
    expect(screen.getByRole('button', { name: '半导体 +3.25%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新能源 -1.82%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '人工智能 +4.56%' })).toBeInTheDocument()
  })

  it('renders top gainers and losers sections for changePercent metric', () => {
    render(<SectorRotationHeatmap />)

    expect(screen.getByText(UI_TEXT.analysis.hotSector.leadingSector)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.hotSector.fallingSector)).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 交互：切换指标
  // ----------------------------------------------------------
  it('switches metric and updates cell values and ranking titles', async () => {
    const user = userEvent.setup()
    render(<SectorRotationHeatmap />)

    const selects = screen.getAllByRole('combobox')
    // 第二个 combobox 是指标选择器
    await user.selectOptions(selects[1]!, 'fundFlow')

    expect(screen.getByText(UI_TEXT.analysis.hotSector.capitalInflow)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.hotSector.capitalOutflow)).toBeInTheDocument()
    // cell 和排行榜中都会显示相同涨跌幅，使用 getAllByText 验证至少存在
    expect(screen.getAllByText('+1.20%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('-0.50%').length).toBeGreaterThanOrEqual(1)
  })

  it('shows only top gainers section when metric is turnover', async () => {
    const user = userEvent.setup()
    render(<SectorRotationHeatmap />)

    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[1]!, 'turnover')

    expect(screen.getByText(UI_TEXT.analysis.hotSector.highTurnover)).toBeInTheDocument()
    expect(screen.queryByText(UI_TEXT.analysis.hotSector.fallingSector)).not.toBeInTheDocument()
    expect(screen.queryByText(UI_TEXT.analysis.hotSector.capitalOutflow)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 交互：切换时间窗口触发数据获取
  // ----------------------------------------------------------
  it('calls fetchDataSource when time window changes', async () => {
    const user = userEvent.setup()
    render(<SectorRotationHeatmap />)

    await waitFor(() => {
      expect(mockFetchDataSource).toHaveBeenCalledTimes(1)
    })

    const selects = screen.getAllByRole('combobox')
    // 第一个 combobox 是时间周期选择器
    await user.selectOptions(selects[0]!, 'week')

    await waitFor(() => {
      expect(mockFetchDataSource).toHaveBeenCalledTimes(2)
    })

    const lastCall = mockFetchDataSource.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe('sectorHeatmap')
    expect(lastCall?.[1]).toMatchObject({ params: { timeWindow: 'week' } })
  })

  // ----------------------------------------------------------
  // 交互：点击 cell 导航
  // ----------------------------------------------------------
  it('navigates to industry-score page when cell is clicked', async () => {
    const user = userEvent.setup()
    render(<SectorRotationHeatmap />)

    const cell = screen.getByRole('button', { name: /半导体/ })
    await user.click(cell)

    expect(mockNavigate).toHaveBeenCalledWith('/analysis/industry-score?sector=SEC001')
  })

  // ----------------------------------------------------------
  // 排行榜排序
  // ----------------------------------------------------------
  it('sorts top gainers descending by selected metric', () => {
    render(<SectorRotationHeatmap />)

    const gainers = screen.getByText(UI_TEXT.analysis.hotSector.leadingSector).closest('div')?.querySelectorAll('li')
    expect(gainers?.[0]?.textContent).toContain('人工智能')
    expect(gainers?.[1]?.textContent).toContain('半导体')
  })

  it('sorts top losers ascending by changePercent', () => {
    render(<SectorRotationHeatmap />)

    const losers = screen.getByText(UI_TEXT.analysis.hotSector.fallingSector).closest('div')?.querySelectorAll('li')
    expect(losers?.[0]?.textContent).toContain('新能源')
    expect(losers?.[1]?.textContent).toContain('房地产')
  })
})
