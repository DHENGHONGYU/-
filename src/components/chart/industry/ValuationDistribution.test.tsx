/**
 * ValuationDistribution + buildHistogram 单元测试
 *
 * 测试策略：
 * - buildHistogram 纯函数：测试分箱、边界、空数据
 * - ValuationDistribution 组件：测试 props 传递、高亮逻辑、显示控制
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ValuationDistribution,
  buildHistogram,
  type ValuationDistributionProps,
  type ValuationDistributionBin,
} from './ValuationDistribution'

// ─── Mock ────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePerfTrace', () => ({
  usePerfTrace: vi.fn(),
}))

let captured: Record<string, unknown> = {}

vi.mock('recharts', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    BarChart: vi.fn((props: Record<string, unknown>) => {
      captured.barChart = props
      return React.createElement('div', { 'data-testid': 'recharts-bar-chart' }, props.children)
    }),
    Bar: vi.fn((props: Record<string, unknown>) => {
      captured.bar = props
      // 必须渲染 children 才能触发 Cell 子组件的 mock，便于捕获 fill
      return React.createElement('g', { 'data-testid': 'recharts-bar' }, props.children)
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
    Tooltip: vi.fn((props: Record<string, unknown>) => {
      captured.tooltip = props
      return null
    }),
    ResponsiveContainer: vi.fn((props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'recharts-container' }, props.children),
    ),
    ReferenceLine: vi.fn((props: Record<string, unknown>) => {
      captured.referenceLine = props
      return React.createElement('line', { 'data-testid': 'recharts-reference-line' })
    }),
    Cell: vi.fn((props: Record<string, unknown>) => {
      const cells = (captured.cells as Array<Record<string, unknown>>) || []
      cells.push(props)
      captured.cells = cells
      return null
    }),
  }
})

// ─── buildHistogram 测试 ─────────────────────────────────────────────

describe('buildHistogram', () => {
  it('空数组返回空数组', () => {
    expect(buildHistogram([], 10)).toEqual([])
  })

  it('单个值生成指定数量的 bin', () => {
    const result = buildHistogram([5], 5)
    expect(result).toHaveLength(5)
    // 第一个 bin 应包含该值
    expect(result[0]!.count).toBe(1)
    // 其他 bin count 为 0
    expect(result[1]!.count).toBe(0)
  })

  it('所有值落入正确的 bin', () => {
    const values = [1, 2, 3, 4, 5]
    const result = buildHistogram(values, 5)
    expect(result).toHaveLength(5)
    const totalCount = result.reduce((sum, bin) => sum + bin.count, 0)
    expect(totalCount).toBe(5)
  })

  it('bin 的 range 字段格式正确', () => {
    const result = buildHistogram([1, 2, 3], 3)
    expect(result[0]!.range).toMatch(/^\d+\.\d+-\d+\.\d+$/)
  })

  it('bin 的 min/max 计算正确', () => {
    const values = [10, 20, 30]
    const result = buildHistogram(values, 3)
    const totalRange = result[2]!.max - result[0]!.min
    expect(totalRange).toBeCloseTo(20, 1) // 30 - 10 = 20
  })

  it('默认 binCount=10', () => {
    const result = buildHistogram([1, 2, 3])
    expect(result).toHaveLength(10)
  })

  it('自定义 binCount', () => {
    const result = buildHistogram([1, 2, 3, 4, 5], 3)
    expect(result).toHaveLength(3)
  })

  it('所有值相同时 binWidth=1 避免除零', () => {
    const result = buildHistogram([5, 5, 5], 3)
    expect(result).toHaveLength(3)
    expect(result[0]!.count).toBe(3) // 所有值都在第一个 bin
  })

  it('最后一个 bin 包含 max 值（闭区间）', () => {
    const values = [1, 2, 3, 4, 5]
    const result = buildHistogram(values, 5)
    const lastBin = result[result.length - 1]!
    expect(lastBin.count).toBeGreaterThanOrEqual(1)
  })

  it('负数值正确分箱', () => {
    const values = [-5, -3, 0, 3, 5]
    const result = buildHistogram(values, 5)
    const totalCount = result.reduce((sum, bin) => sum + bin.count, 0)
    expect(totalCount).toBe(5)
  })

  it('大量数据正确分箱', () => {
    const values = Array.from({ length: 100 }, (_, i) => i * 0.1)
    const result = buildHistogram(values, 10)
    expect(result).toHaveLength(10)
    const totalCount = result.reduce((sum, bin) => sum + bin.count, 0)
    expect(totalCount).toBe(100)
  })
})

// ─── ValuationDistribution 组件测试 ───────────────────────────────────

describe('ValuationDistribution', () => {
  beforeEach(() => {
    captured = {}
  })

  function createBins(): ValuationDistributionBin[] {
    return [
      { range: '0-5', min: 0, max: 5, count: 3 },
      { range: '5-10', min: 5, max: 10, count: 7 },
      { range: '10-15', min: 10, max: 15, count: 5 },
      { range: '15-20', min: 15, max: 20, count: 2 },
    ]
  }

  function createProps(overrides: Partial<ValuationDistributionProps> = {}): ValuationDistributionProps {
    return {
      data: createBins(),
      height: 220,
      ...overrides,
    }
  }

  describe('基础渲染', () => {
    it('正常渲染不报错', () => {
      render(<ValuationDistribution {...createProps()} />)
      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument()
    })

    it('数据传递到 BarChart', () => {
      render(<ValuationDistribution {...createProps()} />)
      const chartProps = captured.barChart as { data: unknown[] }
      expect(chartProps.data).toHaveLength(4)
    })

    it('height 传递到容器', () => {
      render(<ValuationDistribution {...createProps({ height: 300 })} />)
      const container = screen.getByTestId('recharts-container').parentElement!
      expect(container.style.height).toBe('300px')
    })

    it('默认 valueUnit 为 x', () => {
      render(<ValuationDistribution {...createProps()} />)
      expect(captured.tooltip).toBeDefined()
    })

    it('自定义 valueUnit', () => {
      render(<ValuationDistribution {...createProps({ valueUnit: '%' })} />)
      // tooltip formatter 使用 valueUnit
      expect(captured.tooltip).toBeDefined()
    })
  })

  describe('currentValue 高亮', () => {
    it('currentValue 在某个 bin 范围内时高亮该 bin', () => {
      render(<ValuationDistribution {...createProps({ currentValue: 7 })} />)
      const refLine = captured.referenceLine as { x: string } | undefined
      expect(refLine).toBeDefined()
      expect(refLine!.x).toBe('5-10') // 7 在 5-10 范围内
    })

    it('currentValue 不在任何 bin 范围内时不高亮', () => {
      render(<ValuationDistribution {...createProps({ currentValue: 100 })} />)
      const refLine = captured.referenceLine as { x: string | undefined } | undefined
      // refLine 存在但 x 为 undefined
      expect(refLine).toBeDefined()
      expect(refLine!.x).toBeUndefined()
    })

    it('不传 currentValue 时不渲染参考线', () => {
      render(<ValuationDistribution {...createProps()} />)
      expect(captured.referenceLine).toBeUndefined()
    })

    it('currentValueLabel 传递到参考线标签', () => {
      render(
        <ValuationDistribution
          {...createProps({ currentValue: 7, currentValueLabel: '当前行业' })}
        />,
      )
      const refLine = captured.referenceLine as { label: { value: string } }
      expect(refLine.label.value).toContain('当前行业')
      expect(refLine.label.value).toContain('7.00')
    })
  })

  describe('显示控制', () => {
    it('showGrid=false 时不渲染网格', () => {
      render(<ValuationDistribution {...createProps({ showGrid: false })} />)
      expect(captured.cartesianGrid).toBeUndefined()
    })

    it('showGrid=true 时渲染网格', () => {
      render(<ValuationDistribution {...createProps({ showGrid: true })} />)
      expect(captured.cartesianGrid).toBeDefined()
    })

    it('xAxisLabel 传递到 XAxis', () => {
      render(<ValuationDistribution {...createProps({ xAxisLabel: 'PE 中位数' })} />)
      const xAxisProps = captured.xAxis as { label: { value: string } }
      expect(xAxisProps.label.value).toBe('PE 中位数')
    })

    it('yAxisLabel 传递到 YAxis', () => {
      render(<ValuationDistribution {...createProps({ yAxisLabel: '行业数量' })} />)
      const yAxisProps = captured.yAxis as { label: { value: string } }
      expect(yAxisProps.label.value).toBe('行业数量')
    })

    it('不传 xAxisLabel 时 XAxis 无 label', () => {
      render(<ValuationDistribution {...createProps()} />)
      const xAxisProps = captured.xAxis as { label: unknown }
      expect(xAxisProps.label).toBeUndefined()
    })
  })

  describe('颜色配置', () => {
    it('自定义 barColor 传递到 Cell 组件', () => {
      render(<ValuationDistribution {...createProps({ barColor: '#3b82f6' })} />)
      // ValuationDistribution 通过 Cell 子组件设置每个柱子的颜色，而非 Bar 的 fill
      // 直接从 Bar 的 children（Cell React 元素数组）读取 fill prop
      const barProps = captured.bar as { children?: Array<{ props: { fill?: string } }> }
      const cellElements = barProps.children
      expect(cellElements).toBeDefined()
      expect(Array.isArray(cellElements)).toBe(true)
      expect(cellElements!.length).toBeGreaterThan(0)
      // 无 currentValue 时所有 Cell 使用 barColor
      expect(cellElements![0]!.props.fill).toBe('#3b82f6')
    })

    it('自定义 highlightColor 传递到参考线', () => {
      render(
        <ValuationDistribution
          {...createProps({ currentValue: 7, highlightColor: '#ff0000' })}
        />,
      )
      const refLine = captured.referenceLine as { stroke: string }
      expect(refLine.stroke).toBe('#ff0000')
    })
  })

  describe('边界情况', () => {
    it('空数据不报错', () => {
      render(<ValuationDistribution {...createProps({ data: [] })} />)
      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument()
    })

    it('单个 bin 不报错', () => {
      render(
        <ValuationDistribution
          {...createProps({ data: [{ range: '0-10', min: 0, max: 10, count: 5 }] })}
        />,
      )
      const chartProps = captured.barChart as { data: unknown[] }
      expect(chartProps.data).toHaveLength(1)
    })

    it('所有 bin count 为 0 不报错', () => {
      render(
        <ValuationDistribution
          {...createProps({
            data: [
              { range: '0-5', min: 0, max: 5, count: 0 },
              { range: '5-10', min: 5, max: 10, count: 0 },
            ],
          })}
        />,
      )
      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument()
    })

    it('currentValue 为 0 时不报错', () => {
      render(
        <ValuationDistribution {...createProps({ currentValue: 0 })} />,
      )
      const refLine = captured.referenceLine as { x: string } | undefined
      expect(refLine).toBeDefined()
      expect(refLine!.x).toBe('0-5') // 0 在 0-5 范围内
    })

    it('currentValue 为负数不报错', () => {
      render(
        <ValuationDistribution
          {...createProps({
            data: [
              { range: '-10~-5', min: -10, max: -5, count: 2 },
              { range: '-5~0', min: -5, max: 0, count: 3 },
            ],
            currentValue: -7,
          })}
        />,
      )
      const refLine = captured.referenceLine as { x: string }
      expect(refLine.x).toBe('-10~-5')
    })
  })

  describe('与 buildHistogram 集成', () => {
    it('buildHistogram 生成的数据可直接传入组件', () => {
      const values = [5, 10, 15, 20, 25, 30]
      const bins = buildHistogram(values, 5)
      render(<ValuationDistribution data={bins} height={200} />)
      const chartProps = captured.barChart as { data: unknown[] }
      expect(chartProps.data).toHaveLength(5)
    })

    it('buildHistogram + currentValue 高亮集成', () => {
      const values = [5, 10, 15, 20, 25, 30]
      const bins = buildHistogram(values, 5)
      render(
        <ValuationDistribution
          data={bins}
          currentValue={12}
          height={200}
        />,
      )
      const refLine = captured.referenceLine as { x: string }
      expect(refLine).toBeDefined()
      // 12 应该在第二个 bin 范围内
      expect(refLine.x).toBe(bins[1]!.range)
    })
  })
})
