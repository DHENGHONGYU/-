import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoreResourcePanel } from '@/apps/trading/panels/CoreResourcePanel'
import type { Portfolio, StrategyResult } from '@/data/types'

function buildPortfolio(): Portfolio {
  return {
    id: 'test-portfolio',
    name: '第四次工业革命稀缺核心资源',
    theme: 'fourth-industrial-revolution-core-resource',
    totalValue: 1_000_000,
    cashReserve: 40_000,
    holdings: [
      {
        symbol: '002371.SZ',
        name: '北方华创',
        currentShares: 0,
        currentWeight: 0,
        targetWeight: 0.125,
        targetShares: 400,
        price: 300,
        marketValue: 120_000,
        score: 4.5,
        rationale: 'V6自动评分 4.5',
      },
      {
        symbol: '601138.SH',
        name: '工业富联',
        currentShares: 0,
        currentWeight: 0,
        targetWeight: 0.125,
        targetShares: 5000,
        price: 25,
        marketValue: 125_000,
        score: 4.2,
        rationale: 'V6自动评分 4.2',
      },
    ],
    rebalancePlan: [
      {
        symbol: '002371.SZ',
        action: 'buy',
        shares: 400,
        reason: '目标 400 股，当前 0 股，需补仓',
      },
      {
        symbol: '601138.SH',
        action: 'buy',
        shares: 5000,
        reason: '目标 5000 股，当前 0 股，需补仓',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('CoreResourcePanel', () => {
  it('renders empty state', () => {
    render(<CoreResourcePanel onRefresh={vi.fn()} />)

    expect(screen.getByText('核心稀缺主题组合')).toBeInTheDocument()
    expect(screen.getByText('刷新组合')).toBeInTheDocument()
    expect(
      screen.getByText(/暂无核心稀缺组合/),
    ).toBeInTheDocument()
  })

  it('renders portfolio holdings and rebalance plan', () => {
    render(<CoreResourcePanel portfolio={buildPortfolio()} onRefresh={vi.fn()} />)

    expect(screen.getByText('北方华创')).toBeInTheDocument()
    expect(screen.getByText('工业富联')).toBeInTheDocument()
    expect(screen.getByText('0 / 400')).toBeInTheDocument()
    expect(screen.getByText('0 / 5000')).toBeInTheDocument()
    expect(screen.getByText(/再平衡计划/)).toBeInTheDocument()
    expect(screen.getByText('买入 400')).toBeInTheDocument()
    expect(screen.getByText('买入 5000')).toBeInTheDocument()
  })

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = vi.fn()
    render(<CoreResourcePanel portfolio={buildPortfolio()} onRefresh={onRefresh} />)

    fireEvent.click(screen.getByText('刷新组合'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<CoreResourcePanel loading onRefresh={vi.fn()} />)

    expect(screen.getByText('构建中...')).toBeInTheDocument()
    expect(screen.getByText('构建中...')).toBeDisabled()
  })

  it('renders strategy classification summary and badges', () => {
    const strategyResult: StrategyResult = {
      selected: [],
      coreScarce: [],
      valueBargain: [],
      hotMomentum: [],
      rejected: [],
      summary: {
        total: 20,
        selectedCount: 13,
        coreScarceCount: 8,
        valueBargainCount: 3,
        hotMomentumCount: 2,
      },
    }

    render(
      <CoreResourcePanel
        portfolio={buildPortfolio()}
        strategyResult={strategyResult}
        onRefresh={vi.fn()}
      />,
    )

    expect(screen.getByText('20进13入选')).toBeInTheDocument()
    expect(screen.getByText('13/20')).toBeInTheDocument()
    expect(screen.getByText('核心稀缺')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })
})
