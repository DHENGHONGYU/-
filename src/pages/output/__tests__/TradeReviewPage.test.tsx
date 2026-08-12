/**
 * @fileoverview TradeReviewPage 拆分后功能验证测试
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// --- Mock 依赖 ---

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  BarChart3: () => <svg data-testid="icon-bar-chart" />,
  Download: () => <svg data-testid="icon-download" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  TrendingUp: () => <svg data-testid="icon-trending" />,
}))

vi.mock('@/components/organisms/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/templates/PageContainer', () => ({
  PageContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/components/templates/PageHeader', () => ({
  PageHeader: ({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}))

vi.mock('@/hooks/usePageGuard', () => ({
  usePageGuard: () => ({
    isVisible: true,
    isClickable: true,
    tooltipText: '',
    guardProps: { disabled: false },
  }),
}))

// Mock BuySellPointReviewPanel & ReviewArtifactModal
vi.mock('@/components/organisms/output/BuySellPointReviewPanel', () => ({
  BuySellPointReviewPanel: ({ review }: { review: unknown }) => (
    <div data-testid="buy-sell-panel">{JSON.stringify(review)}</div>
  ),
}))

vi.mock('@/components/organisms/output/ReviewArtifactModal', () => ({
  ReviewArtifactModal: ({ open }: { open: boolean }) => (
    <div data-testid="review-modal" data-open={open} />
  ),
}))

// Mock useTradeReviewReport Hook
const mockGenerateReport = vi.fn()
const mockDownloadReport = vi.fn()
const mockUseTradeReviewReport = vi.fn()

vi.mock('@/pages/output/hooks/useTradeReviewReport', () => ({
  useTradeReviewReport: () => mockUseTradeReviewReport(),
}))

// Mock TradeReviewKlineChart（避免触发 K 线采集）
vi.mock('@/pages/output/components/TradeReviewKlineChart', () => ({
  TradeReviewKlineChart: ({ orders }: { orders: unknown[] }) => (
    <div data-testid="kline-chart">K线图表 ({orders.length} 订单)</div>
  ),
}))

// --- Import after mocks ---
import TradeReviewPage from '../TradeReviewPage'

function renderPage(): void {
  render(
    <MemoryRouter>
      <TradeReviewPage />
    </MemoryRouter>,
  )
}

function makeDefaultHookReturn() {
  return {
    orders: [] as Array<{ id: string; symbol: string; price: number; createdAt: number }>,
    loading: false,
    generating: false,
    review: null,
    loadOrders: vi.fn(),
    generateReport: mockGenerateReport,
    downloadReport: mockDownloadReport,
  }
}

describe('TradeReviewPage 拆分后功能验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTradeReviewReport.mockReturnValue(makeDefaultHookReturn())
  })

  it('渲染页面标题和描述', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: '交易复盘' })).toBeInTheDocument()
    expect(screen.getByText('基于交易记录生成六维复盘报告')).toBeInTheDocument()
  })

  it('渲染面包屑导航', () => {
    renderPage()
    expect(screen.getByText('首页')).toBeInTheDocument()
    expect(screen.getByText('输出舱')).toBeInTheDocument()
    // "交易复盘" 同时出现在 h1 和面包屑中
    expect(screen.getAllByText('交易复盘').length).toBeGreaterThanOrEqual(2)
  })

  it('渲染生成复盘报告卡片', () => {
    renderPage()
    // "生成复盘报告" 同时出现在卡片标题和按钮上
    expect(screen.getAllByText('生成复盘报告').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('交易记录数量')).toBeInTheDocument()
  })

  it('显示交易记录数量为 0', () => {
    renderPage()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('点击生成复盘报告按钮时调用 generateReport（无订单时按钮 disabled）', () => {
    renderPage()
    const buttons = screen.getAllByRole('button')
    const generateBtn = buttons.find((b) => b.textContent?.includes('生成复盘报告'))
    expect(generateBtn).toBeDefined()
    expect(generateBtn).toBeDisabled()
  })

  it('没有 review 数据时不渲染摘要组件', () => {
    renderPage()
    expect(screen.queryByText('总交易笔数')).not.toBeInTheDocument()
    expect(screen.queryByText('心理画像')).not.toBeInTheDocument()
    expect(screen.queryByText('纪律分析')).not.toBeInTheDocument()
    expect(screen.queryByText('行动计划')).not.toBeInTheDocument()
  })

  it('没有订单数据时不渲染 K 线图表', () => {
    renderPage()
    expect(screen.queryByTestId('kline-chart')).not.toBeInTheDocument()
  })

  it('渲染返回链接', () => {
    renderPage()
    // 返回链接包含 SVG 图标 + 文本，使用函数匹配器
    const backLink = screen.getByRole('link', { name: /返回/ })
    expect(backLink).toBeInTheDocument()
  })
})

// ============================================================
// 带 review 数据的场景
// ============================================================

function makeMockReport() {
  return {
    generatedAt: Date.now(),
    summary: {
      totalTrades: 10,
      profitableTrades: 6,
      losingTrades: 4,
      winRate: 60.0,
      profitLossRatio: 1.5,
      avgProfit: 3.2,
      avgLoss: -2.1,
      totalPnL: 1000,
      totalPnLPercent: 10.0,
      disciplineScore: 75.5,
      totalErrors: 3,
    },
    errorAnalysis: {
      topErrors: [],
      errorTrend: '稳定',
      psychologicalProfile: {
        primaryType: 'chase_type' as const,
        name: '追涨型',
        characteristics: ['追高买入', '频繁交易'],
        rootCause: 'FOMO 心理',
        improvementDirection: '建立交易计划',
      },
      riskProfile: {
        riskAppetite: 'moderate' as const,
        maxDrawdown: 15,
        concentrationLevel: 'medium' as const,
        suggestions: [],
      },
    },
    disciplineAnalysis: {
      planAdherenceRate: 70.0,
      stopLossExecutionRate: 80.0,
      positionManagementScore: 65.0,
      emotionControlScore: 60.0,
      overallScore: 68.0,
      improvements: ['严格执行止损', '控制仓位'],
    },
    skillDevelopment: {
      currentLevel: 'intermediate',
      prioritySkills: [],
      recommendedResources: [],
      userId: 'test',
      dimensions: [],
      milestones: [],
      learningPath: [],
      overallLevel: 'intermediate' as const,
      updatedAt: Date.now(),
    },
    actionPlan: {
      immediate: ['复盘最近 3 笔交易'],
      shortTerm: ['每周写交易日志'],
      longTerm: ['建立稳定交易系统'],
    },
    aiInsight: {
      pnlAttribution: [],
      dataPatterns: [],
      personalizedAdvice: [],
    },
  }
}

describe('TradeReviewPage 带 review 数据场景', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTradeReviewReport.mockReturnValue({
      orders: [{ id: '1', symbol: '000001', price: 10, createdAt: Date.now() }],
      loading: false,
      generating: false,
      review: { report: makeMockReport(), generatedAt: new Date().toISOString() },
      loadOrders: vi.fn(),
      generateReport: mockGenerateReport,
      downloadReport: mockDownloadReport,
    })
  })

  it('渲染交易摘要卡片', () => {
    renderPage()
    expect(screen.getByText('总交易笔数')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('胜率')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
  })

  it('渲染心理画像组件', () => {
    renderPage()
    expect(screen.getByText('心理画像')).toBeInTheDocument()
    expect(screen.getByText('追涨型')).toBeInTheDocument()
    expect(screen.getByText('FOMO 心理')).toBeInTheDocument()
  })

  it('渲染纪律分析组件', () => {
    renderPage()
    expect(screen.getByText('纪律分析')).toBeInTheDocument()
    expect(screen.getByText('计划遵守率')).toBeInTheDocument()
    expect(screen.getByText('70.0%')).toBeInTheDocument()
  })

  it('渲染行动计划组件', () => {
    renderPage()
    expect(screen.getByText('行动计划')).toBeInTheDocument()
    expect(screen.getByText('复盘最近 3 笔交易')).toBeInTheDocument()
    expect(screen.getByText('每周写交易日志')).toBeInTheDocument()
  })

  it('渲染 K 线图表组件（有订单时）', () => {
    renderPage()
    expect(screen.getByTestId('kline-chart')).toBeInTheDocument()
  })

  it('渲染导出和下载按钮', () => {
    renderPage()
    expect(screen.getByText('导出成品卡')).toBeInTheDocument()
    expect(screen.getByText('下载报告')).toBeInTheDocument()
  })

  it('点击下载报告调用 downloadReport', () => {
    renderPage()
    const downloadBtn = screen.getByText('下载报告').closest('button')
    expect(downloadBtn).toBeDefined()
    fireEvent.click(downloadBtn!)
    expect(mockDownloadReport).toHaveBeenCalledTimes(1)
  })
})
