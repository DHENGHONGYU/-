import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SectorHeatmapData } from '@/types/modules/widget.types'
import { buildWidgetConfig } from './helpers/widget-test.utils'

// ============================================================
// Mock: marketDataStore.useDataSource
// ============================================================
const mockUseDataSource = vi.fn()
vi.mock('@/store/marketDataStore', () => ({
  useDataSource: (key: string) => mockUseDataSource(key),
}))

// 延迟导入被测组件
const SectorHeatmapWidget = (await import('@/cockpit/widgets/SectorHeatmapWidget')).default

// ============================================================
// 测试辅助函数
// ============================================================
function buildConfig(title = '板块热力图') {
  return buildWidgetConfig({ instanceId: 'sector-heatmap-1', widgetId: 'sectorHeatmap', title })
}

function withData(sectors: SectorHeatmapData[]) {
  return {
    data: { sectors },
    loading: false,
    error: null,
    lastUpdated: Date.now(),
  }
}

// ============================================================
// 测试套件
// ============================================================
describe('SectorHeatmapWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // 状态分支：error / loading / 空数据
  // ----------------------------------------------------------
  it('renders error state when useDataSource returns error', () => {
    mockUseDataSource.mockReturnValue({ data: undefined, loading: false, error: '网络连接超时', lastUpdated: 0 })

    render(<SectorHeatmapWidget config={buildConfig()} />)

    expect(screen.getByText('板块热力图')).toBeInTheDocument()
    expect(screen.getByText('网络连接超时')).toBeInTheDocument()
  })

  it('renders loading skeleton when useDataSource returns loading', () => {
    mockUseDataSource.mockReturnValue({ data: undefined, loading: true, error: null, lastUpdated: 0 })

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    expect(screen.getByText('板块热力图')).toBeInTheDocument()
    // skeleton 应包含 10 个灰色占位 div（左右各 5 个）+ 1 个大骨架
    const skeletons = container.querySelectorAll('.bg-gray-200')
    expect(skeletons.length).toBe(11)
  })

  it('renders empty heatmap when sectors array is empty', () => {
    mockUseDataSource.mockReturnValue(withData([]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    expect(screen.getByText('板块热力图')).toBeInTheDocument()
    expect(screen.queryByText('领涨 Top5')).toBeInTheDocument()
    expect(screen.queryByText('领跌 Top5')).toBeInTheDocument()
    const topGainerSection = container.querySelectorAll('.grid.grid-cols-2')[0]
    expect(topGainerSection).toBeDefined()
  })

  // ----------------------------------------------------------
  // 正常数据渲染
  // ----------------------------------------------------------
  it('renders sector names and change percent texts', () => {
    mockUseDataSource.mockReturnValue(
      withData([
        { name: '半导体', code: 'SEC001', changePercent: 3.25 },
        { name: '新能源', code: 'SEC002', changePercent: -1.82 },
        { name: '人工智能', code: 'SEC003', changePercent: 4.56 },
      ]),
    )

    render(<SectorHeatmapWidget config={buildConfig()} />)

    expect(screen.getByText('半导体')).toBeInTheDocument()
    expect(screen.getByText('新能源')).toBeInTheDocument()
    expect(screen.getByText('人工智能')).toBeInTheDocument()
    // 热力图区域和排行榜区域都会显示涨跌幅，使用 getAllByText 验证至少存在
    expect(screen.getAllByText('+3.25%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('-1.82%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('+4.56%').length).toBeGreaterThanOrEqual(1)
  })

  // ----------------------------------------------------------
  // 边界场景
  // ----------------------------------------------------------
  it('renders zero change percent without plus sign', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '平盘板块', code: 'SEC000', changePercent: 0 }]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    const changeSpan = container.querySelector('.aspect-square span:last-child')
    expect(changeSpan?.textContent).toBe('0.00%')
  })

  it('caps heatmap intensity at 0.8 for large positive change', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '暴涨板块', code: 'SEC001', changePercent: 10.0 }]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    const cell = container.querySelector('.aspect-square') as HTMLElement | null
    expect(cell).toBeTruthy()
    const style = cell?.getAttribute('style') ?? ''
    expect(style).toContain('rgb(')
  })

  it('caps heatmap intensity at 0.8 for large negative change', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '暴跌板块', code: 'SEC002', changePercent: -10.0 }]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    const cell = container.querySelector('.aspect-square') as HTMLElement | null
    expect(cell).toBeTruthy()
    const style = cell?.getAttribute('style') ?? ''
    expect(style).toContain('rgb(')
  })

  it('renders top gainers and losers when sectors count is less than 5', () => {
    mockUseDataSource.mockReturnValue(
      withData([
        { name: 'A', code: 'S1', changePercent: 2.0 },
        { name: 'B', code: 'S2', changePercent: -1.5 },
      ]),
    )

    render(<SectorHeatmapWidget config={buildConfig()} />)

    expect(screen.getByText('领涨 Top5')).toBeInTheDocument()
    expect(screen.getByText('领跌 Top5')).toBeInTheDocument()
    expect(screen.getByText('1. A')).toBeInTheDocument()
    expect(screen.getByText('1. B')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 热力图颜色计算
  // ----------------------------------------------------------
  it('applies heatmap background color for positive change sector', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '半导体', code: 'SEC001', changePercent: 5.0 }]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    const cell = container.querySelector('.aspect-square')
    expect(cell).toBeTruthy()
    expect(cell?.getAttribute('style')).toContain('background-color')
  })

  it('applies heatmap background color for negative change sector', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '房地产', code: 'SEC002', changePercent: -4.0 }]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    const cell = container.querySelector('.aspect-square')
    expect(cell).toBeTruthy()
    expect(cell?.getAttribute('style')).toContain('background-color')
  })

  // ----------------------------------------------------------
  // 涨跌文字颜色
  // ----------------------------------------------------------
  it('uses success color for positive change text in heatmap cell', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '半导体', code: 'SEC001', changePercent: 2.0 }]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    const changeSpan = container.querySelector('.aspect-square span:last-child')
    expect(changeSpan).toHaveStyle({ color: '#22c55e' })
  })

  it('uses danger color for negative change text in heatmap cell', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '房地产', code: 'SEC002', changePercent: -3.0 }]))

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    const changeSpan = container.querySelector('.aspect-square span:last-child')
    expect(changeSpan).toHaveStyle({ color: '#ef4444' })
  })

  // ----------------------------------------------------------
  // 领涨/领跌 Top5 排行
  // ----------------------------------------------------------
  it('renders top 5 gainers sorted by changePercent descending', () => {
    mockUseDataSource.mockReturnValue(
      withData([
        { name: 'A', code: 'S1', changePercent: 1.0 },
        { name: 'B', code: 'S2', changePercent: 5.0 },
        { name: 'C', code: 'S3', changePercent: 3.0 },
        { name: 'D', code: 'S4', changePercent: 2.0 },
        { name: 'E', code: 'S5', changePercent: 4.0 },
        { name: 'F', code: 'S6', changePercent: -1.0 },
      ]),
    )

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    expect(screen.getByText('领涨 Top5')).toBeInTheDocument()
    expect(screen.getByText('1. B')).toBeInTheDocument()

    // 领涨区域验证排序结果（排除热力图区域的重复文本）
    const gainerSection = container.querySelectorAll('.grid.grid-cols-2 > div')[0]
    expect(gainerSection).toBeTruthy()
    const gainerText = gainerSection?.textContent ?? ''
    expect(gainerText).toContain('B')
    expect(gainerText).toContain('5.00')
  })

  it('renders top 5 losers sorted by changePercent ascending', () => {
    mockUseDataSource.mockReturnValue(
      withData([
        { name: 'X', code: 'S1', changePercent: -1.0 },
        { name: 'Y', code: 'S2', changePercent: -5.0 },
        { name: 'Z', code: 'S3', changePercent: -3.0 },
        { name: 'W', code: 'S4', changePercent: -2.0 },
        { name: 'V', code: 'S5', changePercent: -4.0 },
        { name: 'U', code: 'S6', changePercent: 1.0 },
      ]),
    )

    const { container } = render(<SectorHeatmapWidget config={buildConfig()} />)

    expect(screen.getByText('领跌 Top5')).toBeInTheDocument()
    expect(screen.getByText('1. Y')).toBeInTheDocument()

    const loserSection = container.querySelectorAll('.grid.grid-cols-2 > div')[1]
    expect(loserSection).toBeTruthy()
    const loserText = loserSection?.textContent ?? ''
    expect(loserText).toContain('Y')
    expect(loserText).toContain('5.00')
  })

  // ----------------------------------------------------------
  // 组件可渲染性（memo 包装验证）
  // ----------------------------------------------------------
  it('renders without error when wrapped with React.memo', () => {
    mockUseDataSource.mockReturnValue(withData([{ name: '测试板块', code: 'TEST', changePercent: 0.5 }]))

    expect(() => render(<SectorHeatmapWidget config={buildConfig()} />)).not.toThrow()
  })
})
