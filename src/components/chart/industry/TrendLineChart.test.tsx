/**
 * TrendLineChart 单元测试
 *
 * 测试策略：
 * - Mock recharts，验证 props 传递和数据渲染
 * - 验证多系列、参考线、yDomain、显示开关等配置
 * - 验证空数据和单数据点边界情况
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  TrendLineChart,
  type TrendLineChartProps,
  type TrendLineDataPoint,
  type TrendLineSeries,
  type TrendLineReferenceLine,
} from './TrendLineChart'

// ─── Mock ────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePerfTrace', () => ({
  usePerfTrace: vi.fn(),
}))

let captured: Record<string, unknown> = {}

vi.mock('recharts', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    LineChart: vi.fn((props: Record<string, unknown>) => {
      captured.lineChart = props
      return React.createElement('div', { 'data-testid': 'recharts-line-chart' }, props.children)
    }),
    Line: vi.fn((props: Record<string, unknown>) => {
      captured.lines = captured.lines || []
      captured.lines.push(props)
      return React.createElement('path', { 'data-testid': 'recharts-line' })
    }),
    XAxis: vi.fn((props: Record<string, unknown>) => {
      captured.xAxis = props
      return React.createElement('g', { 'data-testid': 'recharts-x-axis' })
    }),
    YAxis: vi.fn((props: Record<string, unknown>) => {
      captured.yAxis = props
      return React.createElement('g', { 'data-testid': 'recharts-y-axis' })
    }),
    CartesianGrid: vi.fn((props: Record<string, unknown>) => {
      captured.cartesianGrid = props
      return React.createElement('g', { 'data-testid': 'recharts-cartesian-grid' })
    }),
    Tooltip: vi.fn(() => null),
    ResponsiveContainer: vi.fn((props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'recharts-container' }, props.children),
    ),
    Legend: vi.fn(() => null),
    ReferenceLine: vi.fn((props: Record<string, unknown>) => {
      captured.referenceLines = captured.referenceLines || []
      captured.referenceLines.push(props)
      return React.createElement('line', { 'data-testid': 'recharts-reference-line' })
    }),
  }
})

// ─── 工厂函数 ────────────────────────────────────────────────────────

function createTrendData(): TrendLineDataPoint[] {
  return [
    { period: '2024Q1', current: 3.2, previous: 2.8 },
    { period: '2024Q2', current: 3.5, previous: 3.0 },
    { period: '2024Q3', current: 4.1, previous: 3.3 },
    { period: '2024Q4', current: 3.8, previous: 3.6 },
  ]
}

function createSeries(): TrendLineSeries[] {
  return [
    { dataKey: 'current', name: '当前评分', color: '#3b82f6' },
    { dataKey: 'previous', name: '上期评分', color: '#ef4444' },
  ]
}

function createProps(overrides: Partial<TrendLineChartProps> = {}): TrendLineChartProps {
  return {
    data: createTrendData(),
    series: createSeries(),
    height: 280,
    ...overrides,
  }
}

// ─── 测试用例 ────────────────────────────────────────────────────────

describe('TrendLineChart', () => {
  beforeEach(() => {
    captured = {}
  })

  describe('基础渲染', () => {
    it('正常渲染不报错', () => {
      render(<TrendLineChart {...createProps()} />)
      expect(screen.getByTestId('recharts-line-chart')).toBeInTheDocument()
    })

    it('数据传递到 LineChart', () => {
      render(<TrendLineChart {...createProps()} />)
      const chartProps = captured.lineChart as { data: unknown[] }
      expect(chartProps.data).toHaveLength(4)
    })

    it('每个 series 渲染一条 Line', () => {
      render(<TrendLineChart {...createProps()} />)
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines).toHaveLength(2)
    })

    it('height 传递到容器 div', () => {
      render(<TrendLineChart {...createProps({ height: 500 })} />)
      const container = screen.getByTestId('recharts-container').parentElement!
      expect(container.style.height).toBe('500px')
    })
  })

  describe('多系列配置', () => {
    it('单系列渲染一条 Line', () => {
      render(
        <TrendLineChart
          {...createProps({
            series: [{ dataKey: 'current', name: '当前' }],
          })}
        />,
      )
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines).toHaveLength(1)
      expect(lines[0]!.dataKey).toBe('current')
    })

    it('三系列渲染三条 Line', () => {
      render(
        <TrendLineChart
          {...createProps({
            series: [
              { dataKey: 'a', name: 'A' },
              { dataKey: 'b', name: 'B' },
              { dataKey: 'c', name: 'C' },
            ],
          })}
        />,
      )
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines).toHaveLength(3)
    })

    it('自定义颜色传递到 Line stroke', () => {
      render(<TrendLineChart {...createProps()} />)
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines[0]!.stroke).toBe('#3b82f6')
      expect(lines[1]!.stroke).toBe('#ef4444')
    })

    it('未指定颜色时使用默认色板', () => {
      render(
        <TrendLineChart
          {...createProps({
            series: [
              { dataKey: 'a', name: 'A' },
              { dataKey: 'b', name: 'B' },
              { dataKey: 'c', name: 'C' },
              { dataKey: 'd', name: 'D' },
              { dataKey: 'e', name: 'E' },
              { dataKey: 'f', name: 'F' },
            ],
          })}
        />,
      )
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines[0]!.stroke).toBeTruthy()
      expect(lines[5]!.stroke).toBeTruthy()
    })

    it('smooth=true 时 type 为 monotone', () => {
      render(
        <TrendLineChart
          {...createProps({
            series: [{ dataKey: 'current', name: '当前', smooth: true }],
          })}
        />,
      )
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines[0]!.type).toBe('monotone')
    })

    it('type=step 传递到 Line', () => {
      render(
        <TrendLineChart
          {...createProps({
            series: [{ dataKey: 'current', name: '当前', type: 'step' }],
          })}
        />,
      )
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines[0]!.type).toBe('step')
    })

    it('strokeWidth 传递到 Line', () => {
      render(
        <TrendLineChart
          {...createProps({
            series: [{ dataKey: 'current', name: '当前', strokeWidth: 3 }],
          })}
        />,
      )
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines[0]!.strokeWidth).toBe(3)
    })

    it('dot=true 传递到 Line', () => {
      render(
        <TrendLineChart
          {...createProps({
            series: [{ dataKey: 'current', name: '当前', dot: true }],
          })}
        />,
      )
      const lines = captured.lines as Array<Record<string, unknown>>
      expect(lines[0]!.dot).toBe(true)
    })
  })

  describe('参考线', () => {
    it('referenceLines 渲染对应数量的 ReferenceLine', () => {
      const refLines: TrendLineReferenceLine[] = [
        { y: 3.0, label: '均值', color: '#00ff00' },
        { y: 4.5, label: '上限' },
      ]
      render(<TrendLineChart {...createProps({ referenceLines: refLines })} />)
      const renderedRefLines = captured.referenceLines as Array<Record<string, unknown>>
      expect(renderedRefLines).toHaveLength(2)
    })

    it('参考线 y 值传递正确', () => {
      render(
        <TrendLineChart
          {...createProps({ referenceLines: [{ y: 2.5, label: '阈值' }] })}
        />,
      )
      const refLines = captured.referenceLines as Array<Record<string, unknown>>
      expect(refLines[0]!.y).toBe(2.5)
    })

    it('参考线 label 传递正确', () => {
      render(
        <TrendLineChart
          {...createProps({ referenceLines: [{ y: 3.0, label: '基准线' }] })}
        />,
      )
      const refLines = captured.referenceLines as Array<Record<string, unknown>>
      const label = refLines[0]!.label as { value: string }
      expect(label.value).toBe('基准线')
    })

    it('无 referenceLines 时不渲染参考线', () => {
      render(<TrendLineChart {...createProps()} />)
      expect(captured.referenceLines).toBeUndefined()
    })
  })

  describe('显示控制', () => {
    it('showGrid=false 时不渲染网格', () => {
      render(<TrendLineChart {...createProps({ showGrid: false })} />)
      expect(captured.cartesianGrid).toBeUndefined()
    })

    it('showGrid=true 时渲染网格', () => {
      render(<TrendLineChart {...createProps({ showGrid: true })} />)
      expect(captured.cartesianGrid).toBeDefined()
    })

    it('xAxisKey 传递到 XAxis', () => {
      render(<TrendLineChart {...createProps({ xAxisKey: 'period' })} />)
      const xAxisProps = captured.xAxis as { dataKey: string }
      expect(xAxisProps.dataKey).toBe('period')
    })

    it('yDomain 传递到 YAxis', () => {
      render(<TrendLineChart {...createProps({ yDomain: [0, 5] })} />)
      const yAxisProps = captured.yAxis as { domain: number[] }
      expect(yAxisProps.domain).toEqual([0, 5])
    })

    it('yDomain=auto 时 YAxis domain 为 auto', () => {
      render(<TrendLineChart {...createProps({ yDomain: ['auto', 'auto'] })} />)
      const yAxisProps = captured.yAxis as { domain: string[] }
      expect(yAxisProps.domain).toEqual(['auto', 'auto'])
    })
  })

  describe('边界情况', () => {
    it('空数据不报错', () => {
      render(<TrendLineChart {...createProps({ data: [] })} />)
      expect(screen.getByTestId('recharts-line-chart')).toBeInTheDocument()
    })

    it('单数据点不报错', () => {
      render(
        <TrendLineChart
          {...createProps({ data: [{ period: '2024Q1', current: 3.5 }] })}
        />,
      )
      const chartProps = captured.lineChart as { data: unknown[] }
      expect(chartProps.data).toHaveLength(1)
    })

    it('空 series 不报错', () => {
      render(<TrendLineChart {...createProps({ series: [] })} />)
      expect(screen.getByTestId('recharts-line-chart')).toBeInTheDocument()
    })

    it('大数量数据（100 点）不报错', () => {
      const bigData: TrendLineDataPoint[] = Array.from({ length: 100 }, (_, i) => ({
        period: `P${i}`,
        value: Math.random() * 5,
      }))
      render(
        <TrendLineChart
          {...createProps({
            data: bigData,
            series: [{ dataKey: 'value', name: '随机值' }],
          })}
        />,
      )
      const chartProps = captured.lineChart as { data: unknown[] }
      expect(chartProps.data).toHaveLength(100)
    })
  })
})
