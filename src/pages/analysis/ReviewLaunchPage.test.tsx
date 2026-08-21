import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ReviewLaunchPage from './ReviewLaunchPage'

// ------------------------------------------------------------------
// vi.hoisted mocks（store actions + 可变 state）
// ------------------------------------------------------------------

const mockSetSymbol = vi.hoisted(() => vi.fn())
const mockRunEvaluation = vi.hoisted(() => vi.fn())
const mockReset = vi.hoisted(() => vi.fn())

const mockState = vi.hoisted(() => ({
  symbol: '',
  v6Score: null as unknown,
  result: null as unknown,
  secondWaveSignal: null as unknown,
  marketBreadth: null as number | null,
  rotationScore: null as unknown,
  chip: null as unknown,
  hardRisks: [] as string[],
  loading: false,
  error: null as string | null,
  lastUpdated: 0,
}))

// 评估结果与各因子样本（供"有结果态"断言）
const mockV6 = { symbol: '600519', score: 85, rating: 'strong_buy', name: '测试股' }
const mockResult = {
  total: 82,
  tier: 'priority',
  riskDowngraded: false,
  riskMultiplier: 1,
  recommendation: '建议优先深度复盘',
  riskTags: [] as string[],
  evaluatedAt: '2026-08-19T00:00:00.000Z',
  dimensions: [
    { id: 'D1', name: '数据就绪度', score: 90, detail: '四源就绪' },
    { id: 'D2', name: '策略适配度', score: 78, detail: '黄金买点命中' },
    { id: 'D3', name: '时机成熟度', score: 85, detail: '二波启动' },
    { id: 'D4', name: '风险健康度', score: 80, detail: '无硬风险' },
  ],
}
const mockSecondWave = {
  detected: true,
  signalType: 'strong_wave',
  strength: 75,
  pullbackLevel: 'ma10',
  uptrendPct60: 0.62,
  uptrendPct20: 0.34,
  maxVolumeRatio: 5.2,
  hasTrialShadow: true,
  hasBreakout: true,
  maLevels: { ma5: 10.2, ma10: 9.8, ma20: 9.1 },
  details: ['主升浪确认', '放量突破'],
}
const mockRotation = {
  sectorName: '半导体',
  swLevel1: '电子',
  swLevel2: '半导体',
  swLevel3: '集成电路',
  f1Jingqi: 72,
  f2Zijin: 68,
}
const mockChip = { riskLevel: 'low', score: 30 }

// ------------------------------------------------------------------
// module mocks
// ------------------------------------------------------------------

vi.mock('@/store/reviewLaunchStore', () => ({
  useReviewLaunchStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      ...mockState,
      setSymbol: mockSetSymbol,
      runEvaluation: mockRunEvaluation,
      reset: mockReset,
    }),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}))

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  }
})

vi.mock('@/components/templates', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}))

vi.mock('@/components/molecules', () => ({
  ErrorState: ({ error }: { error: unknown }) => <div data-testid="error-state">{String(error)}</div>,
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@/components/atoms/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}))

vi.mock('@/components/atoms/Badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-variant={variant}>{children}</span>
  ),
}))

vi.mock('@/components/atoms/Button', () => ({
  Button: ({
    asChild,
    children,
    onClick,
    disabled,
  }: {
    asChild?: boolean
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => {
    if (asChild) return <span data-testid="btn-aschild" onClick={onClick}>{children}</span>
    return (
      <button data-testid="btn" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    )
  },
}))

vi.mock('@/components/atoms/Breadcrumb', () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => <ol>{children}</ol>,
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  BreadcrumbLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  BreadcrumbSeparator: () => <span>/</span>,
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/chart/ScoreRadar', () => ({
  ScoreRadar: ({ data }: { data: unknown[] }) => (
    <div data-testid="score-radar" data-count={data?.length ?? 0} />
  ),
}))

vi.mock('@/components/chart/GaugeChart', () => ({
  GaugeChart: ({ value, label }: { value: number; label: string }) => (
    <div data-testid="gauge-chart" data-value={value}>
      {label}
    </div>
  ),
}))

vi.mock('@/components/organisms/input/StockSelector', () => ({
  StockSelector: ({ value, onChange }: { value: string; onChange: (opt: { symbol: string; name: string }) => void }) => (
    <button data-testid="stock-selector" onClick={() => onChange({ symbol: '600519', name: '测试股' })}>
      选择 {value}
    </button>
  ),
}))

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('ReviewLaunchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockState, {
      symbol: '',
      v6Score: null,
      result: null,
      secondWaveSignal: null,
      marketBreadth: null,
      rotationScore: null,
      chip: null,
      hardRisks: [],
      loading: false,
      error: null,
      lastUpdated: 0,
    })
  })

  it('初始空态：渲染标题与空状态提示，运行评估按钮禁用', () => {
    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('复盘启动分析 · RLES 评价体系')).toBeTruthy()
    expect(screen.getByTestId('empty-state')).toBeTruthy()
    const runBtn = screen.getByText('运行评估') as HTMLButtonElement
    expect(runBtn.disabled).toBe(true)
  })

  it('有结果态：渲染复盘启动就绪度/启动建议/四维雷达/维度明细/增强因子/二波诊断', () => {
    Object.assign(mockState, {
      symbol: '600519',
      v6Score: mockV6,
      result: mockResult,
      secondWaveSignal: mockSecondWave,
      marketBreadth: 60,
      rotationScore: mockRotation,
      chip: mockChip,
      hardRisks: [],
    })
    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('复盘启动就绪度')).toBeTruthy()
    expect(screen.getByText('启动建议')).toBeTruthy()
    expect(screen.getByText('维度明细')).toBeTruthy()
    expect(screen.getByText('增强因子明细')).toBeTruthy()
    expect(screen.getByText('四维评分雷达')).toBeTruthy()
    expect(screen.getByTestId('score-radar')).toBeTruthy()
    expect(screen.getByText('主升浪二波形态诊断')).toBeTruthy()
    expect(screen.getByText('命中二波形态')).toBeTruthy()
    expect(screen.getByText('黄金买点命中')).toBeTruthy()
  })

  it('风险降级态：显示风险降级标签与硬风险标签', () => {
    Object.assign(mockState, {
      symbol: '600519',
      v6Score: mockV6,
      result: { ...mockResult, riskDowngraded: true, riskMultiplier: 0.73 },
      secondWaveSignal: mockSecondWave,
      marketBreadth: 60,
      rotationScore: mockRotation,
      chip: mockChip,
      hardRisks: ['st_violation'],
    })
    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/风险降级.*0.73/)).toBeTruthy()
    expect(screen.getByText('st_violation')).toBeTruthy()
  })

  it('选择标的触发 setSymbol + runEvaluation', () => {
    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTestId('stock-selector'))
    expect(mockSetSymbol).toHaveBeenCalledWith('600519')
    expect(mockRunEvaluation).toHaveBeenCalledWith('600519')
  })

  it('点击运行评估（已有标的）触发 runEvaluation', () => {
    mockState.symbol = '600519'
    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>,
    )
    const runBtn = screen.getByText('运行评估') as HTMLButtonElement
    expect(runBtn.disabled).toBe(false)
    fireEvent.click(runBtn)
    expect(mockRunEvaluation).toHaveBeenCalledTimes(1)
  })

  it('点击重置按钮触发 reset', () => {
    Object.assign(mockState, { symbol: '600519', result: mockResult })
    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByText('重置'))
    expect(mockReset).toHaveBeenCalledTimes(1)
  })
})
