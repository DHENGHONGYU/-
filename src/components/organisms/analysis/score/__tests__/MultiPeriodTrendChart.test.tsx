/**
 * MultiPeriodTrendChart 组件测试
 *
 * 覆盖：周期切换、图表渲染、loading/error/empty 三态
 */

import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UI_TEXT } from '@/constants/uiText'
import { MultiPeriodTrendChart } from '../MultiPeriodTrendChart'
import type { ScoreTrendData } from '@/services/analysis/scoreTrendService'

function createTrendData(period: ScoreTrendData['period']): ScoreTrendData {
  return {
    entityId: 'TEST',
    entityType: 'stock',
    period,
    points: [
      { period: '2026-W27', composite: 3.5, count: 2, dimensions: { 估值: 4, 成长: 3 } },
      { period: '2026-W28', composite: 4.2, count: 3, dimensions: { 估值: 4.5, 成长: 4 } },
    ],
  }
}

describe('MultiPeriodTrendChart', () => {
  test('渲染周期切换按钮', () => {
    render(
      <MultiPeriodTrendChart
        data={createTrendData('month')}
        period="month"
        onPeriodChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('tab', { name: /周/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /月/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /季/i })).toBeInTheDocument()
  })

  test('当前周期 tab 为激活状态', () => {
    render(
      <MultiPeriodTrendChart
        data={createTrendData('week')}
        period="week"
        onPeriodChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('tab', { name: /周/i })).toHaveAttribute('aria-selected', 'true')
  })

  test('切换周期触发 onPeriodChange', () => {
    const onChange = vi.fn()
    render(
      <MultiPeriodTrendChart
        data={createTrendData('month')}
        period="month"
        onPeriodChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: /季/i }))
    expect(onChange).toHaveBeenCalledWith('quarter')
  })

  test('渲染趋势图表与波动高亮', () => {
    render(
      <MultiPeriodTrendChart
        data={createTrendData('week')}
        period="week"
        onPeriodChange={vi.fn()}
      />,
    )

    expect(document.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(UI_TEXT.analysis.factor.volatility, 'i'))).toBeInTheDocument()
  })

  test('loading 状态展示加载 UI', () => {
    render(
      <MultiPeriodTrendChart
        data={undefined}
        period="month"
        onPeriodChange={vi.fn()}
        loading
      />,
    )

    expect(screen.getByText(/加载中/i)).toBeInTheDocument()
  })

  test('error 状态展示错误与重试', () => {
    const onRetry = vi.fn()
    render(
      <MultiPeriodTrendChart
        data={undefined}
        period="month"
        onPeriodChange={vi.fn()}
        error="加载失败"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText(new RegExp(UI_TEXT.common.error, 'i'))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /重试/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  test('空数据展示 empty 状态', () => {
    render(
      <MultiPeriodTrendChart
        data={{ entityId: 'TEST', entityType: 'stock', period: 'month', points: [] }}
        period="month"
        onPeriodChange={vi.fn()}
      />,
    )

    expect(screen.getByText(new RegExp(UI_TEXT.analysis.trend.noData, 'i'))).toBeInTheDocument()
  })
})
