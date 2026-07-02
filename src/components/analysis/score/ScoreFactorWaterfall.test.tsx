/**
 * ScoreFactorWaterfall 组件测试
 *
 * 覆盖：loading / empty / error 三态、数据渲染、正负向贡献展示
 */

import React from 'react'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreFactorWaterfall } from './ScoreFactorWaterfall'
import type { FactorContribution, ScoreAuditTrail } from '@/services/scoring/v6-engine'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 600,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 600,
    x: 0,
    y: 0,
    toJSON: () => {},
  } as DOMRect)
})

afterAll(() => {
  vi.restoreAllMocks()
})

function renderWithSize(ui: React.ReactNode) {
  return render(<div style={{ width: 600, height: 400 }}>{ui}</div>)
}

function createContribution(overrides: Partial<FactorContribution> = {}): FactorContribution {
  return {
    factorId: 'l1',
    label: 'L1 护城河',
    weight: 0.15,
    normalizedWeight: 0.5,
    score: 4,
    baseline: 2.5,
    contribution: 40,
    signedContribution: 15,
    contributionRate: 0.5,
    ...overrides,
  }
}

function createAudit(contributions: FactorContribution[]): ScoreAuditTrail {
  return {
    symbol: 'TEST',
    timestamp: Date.now(),
    config: {} as ScoreAuditTrail['config'],
    layers: {} as ScoreAuditTrail['layers'],
    composite: { weightedSum: 0, layers: {} as Record<string, number>, rating: 'buy' },
    factorContributions: contributions,
  }
}

describe('ScoreFactorWaterfall', () => {
  it('loading 态渲染 LoadingState', () => {
    render(<ScoreFactorWaterfall loading />)
    expect(screen.getByText('正在计算因子贡献...')).toBeInTheDocument()

  })

  it('error 态渲染 ErrorState', () => {
    render(<ScoreFactorWaterfall error="计算失败" />)
    expect(screen.getByText('计算失败')).toBeInTheDocument()
    expect(screen.getByText('因子贡献加载失败')).toBeInTheDocument()
  })

  it('无贡献数据时渲染 EmptyState', () => {
    render(<ScoreFactorWaterfall audit={createAudit([])} />)
    expect(screen.getByText('暂无因子贡献数据')).toBeInTheDocument()
    expect(screen.getByText('请先生成或刷新 V6 评分')).toBeInTheDocument()
  })

  it('有数据时渲染瀑布图与图例', () => {
    const audit = createAudit([
      createContribution({ factorId: 'l1', label: 'L1 护城河', signedContribution: 15 }),
      createContribution({ factorId: 'l2', label: 'L2 竞品格局', signedContribution: -8 }),
    ])
    renderWithSize(<ScoreFactorWaterfall audit={audit} />)

    expect(screen.getByTestId('score-factor-waterfall')).toBeInTheDocument()
    expect(screen.getByText('正向贡献')).toBeInTheDocument()
    expect(screen.getByText('负向贡献')).toBeInTheDocument()
    // “综合得分”同时出现在图例与 X 轴标签中
    expect(screen.getAllByText('综合得分').length).toBeGreaterThanOrEqual(1)
  })

  it('X 轴显示因子标签与综合得分', () => {
    const audit = createAudit([
      createContribution({ factorId: 'l1', label: 'L1 护城河' }),
      createContribution({ factorId: 'l2', label: 'L2 竞品格局' }),
    ])
    renderWithSize(<ScoreFactorWaterfall audit={audit} />)

    const l1Tick = screen.getByText(/^L1$/).closest('text')
    const l2Tick = screen.getByText(/^L2$/).closest('text')
    expect(l1Tick).toHaveTextContent('护城河')
    expect(l2Tick).toHaveTextContent('竞品格局')
    expect(screen.getAllByText('综合得分').length).toBeGreaterThanOrEqual(1)
  })
})
