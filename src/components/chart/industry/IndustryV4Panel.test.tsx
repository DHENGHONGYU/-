/**
 * IndustryV4Panel + IndustryV4Radar + SubIndicatorBar 单元测试
 *
 * 测试策略：
 * - Mock recharts，验证 props 传递和数据转换
 * - 验证维度切换、条件渲染、数据映射逻辑
 * - 验证 SubIndicatorBar 的排序、过滤、布局切换
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  IndustryV4Panel,
  type IndustryV4PanelProps,
} from './IndustryV4Panel'
import { IndustryV4Radar, type IndustryV4RadarDataItem } from './IndustryV4Radar'
import { SubIndicatorBar, type SubIndicatorBarDataItem } from './SubIndicatorBar'

// ─── Mock ────────────────────────────────────────────────────────────

vi.mock('@/hooks/usePerfTrace', () => ({
  usePerfTrace: vi.fn(),
}))

let capturedProps: Record<string, unknown> = {}

vi.mock('recharts', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    RadarChart: vi.fn((props: Record<string, unknown>) => {
      capturedProps.radarChart = props
      return React.createElement('div', { 'data-testid': 'recharts-radar-chart' }, props.children)
    }),
    Radar: vi.fn((props: Record<string, unknown>) => {
      capturedProps.radar = props
      return React.createElement('polygon', { 'data-testid': 'recharts-radar' })
    }),
    PolarGrid: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-polar-grid' })),
    PolarAngleAxis: vi.fn((props: Record<string, unknown>) => {
      capturedProps.polarAngleAxis = props
      return React.createElement('g', { 'data-testid': 'recharts-polar-angle-axis' })
    }),
    PolarRadiusAxis: vi.fn((props: Record<string, unknown>) => {
      capturedProps.polarRadiusAxis = props
      return React.createElement('g', { 'data-testid': 'recharts-polar-radius-axis' })
    }),
    BarChart: vi.fn((props: Record<string, unknown>) => {
      capturedProps.barChart = props
      return React.createElement('div', { 'data-testid': 'recharts-bar-chart' }, props.children)
    }),
    Bar: vi.fn((props: Record<string, unknown>) => {
      capturedProps.bar = props
      return React.createElement('rect', { 'data-testid': 'recharts-bar' })
    }),
    XAxis: vi.fn((props: Record<string, unknown>) => {
      capturedProps.xAxis = props
      return React.createElement('g', { 'data-testid': 'recharts-x-axis' })
    }),
    YAxis: vi.fn((props: Record<string, unknown>) => {
      capturedProps.yAxis = props
      return React.createElement('g', { 'data-testid': 'recharts-y-axis' })
    }),
    CartesianGrid: vi.fn(() => React.createElement('g', { 'data-testid': 'recharts-cartesian-grid' })),
    Tooltip: vi.fn(() => null),
    ResponsiveContainer: vi.fn((props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': 'recharts-container' }, props.children),
    ),
    Legend: vi.fn(() => null),
    Cell: vi.fn(() => null),
  }
})

// ─── 工厂函数 ────────────────────────────────────────────────────────

function createDimensions(): IndustryV4PanelProps['dimensions'] {
  return [
    {
      name: 'prosperity',
      label: '景气度',
      score: 4.2,
      subIndicators: [
        { key: 'rev_growth', label: '营收增速', value: 3.8, maxValue: 5 },
        { key: 'profit_growth', label: '利润增速', value: 4.5, maxValue: 5 },
        { key: 'pmi_signal', label: 'PMI 信号', value: null, maxValue: 5 },
      ],
    },
    {
      name: 'competition',
      label: '竞争格局',
      score: 3.5,
      subIndicators: [
        { key: 'cr5', label: 'CR5 集中度', value: 3.0, maxValue: 5 },
        { key: 'entry_barrier', label: '进入壁垒', value: 4.0, maxValue: 5 },
      ],
    },
    {
      name: 'policy',
      label: '政策环境',
      score: 4.0,
      subIndicators: [
        { key: 'policy_support', label: '政策支持', value: 4.2, maxValue: 5 },
      ],
    },
    {
      name: 'technology',
      label: '技术跃迁',
      score: 3.8,
      subIndicators: [
        { key: 'rd_ratio', label: '研发占比', value: 3.5, maxValue: 5 },
        { key: 'patent_count', label: '专利数量', value: 4.1, maxValue: 5 },
      ],
    },
  ]
}

function createPanelProps(overrides: Partial<IndustryV4PanelProps> = {}): IndustryV4PanelProps {
  return {
    dimensions: createDimensions(),
    compositeScore: 3.88,
    height: 400,
    ...overrides,
  }
}

// ─── IndustryV4Panel 测试 ────────────────────────────────────────────

describe('IndustryV4Panel', () => {
  beforeEach(() => {
    capturedProps = {}
  })

  describe('基础渲染', () => {
    it('正常渲染不报错', () => {
      render(<IndustryV4Panel {...createPanelProps()} />)
      expect(screen.getByText('V4 综合评分')).toBeInTheDocument()
    })

    it('compositeScore 显示两位小数', () => {
      render(<IndustryV4Panel {...createPanelProps({ compositeScore: 4.567 })} />)
      expect(screen.getByText('4.57')).toBeInTheDocument()
    })

    it('compositeScore 为 null 时不显示评分区域', () => {
      const { container } = render(<IndustryV4Panel {...createPanelProps({ compositeScore: null })} />)
      expect(container.querySelector('[style*="linear-gradient"]')).toBeNull()
    })

    it('渲染所有维度切换按钮', () => {
      render(<IndustryV4Panel {...createPanelProps()} />)
      expect(screen.getByText('景气度')).toBeInTheDocument()
      expect(screen.getByText('竞争格局')).toBeInTheDocument()
      expect(screen.getByText('政策环境')).toBeInTheDocument()
      expect(screen.getByText('技术跃迁')).toBeInTheDocument()
    })

    it('维度按钮显示评分值（一位小数）', () => {
      render(<IndustryV4Panel {...createPanelProps()} />)
      expect(screen.getByText('4.2')).toBeInTheDocument()
      expect(screen.getByText('3.5')).toBeInTheDocument()
    })
  })

  describe('维度切换', () => {
    it('默认 activeDimension 为 prosperity', () => {
      render(<IndustryV4Panel {...createPanelProps()} />)
      const prosperityBtn = screen.getByText('景气度').closest('button')!
      expect(prosperityBtn.style.border).toContain('rgb') // 有颜色边框
    })

    it('点击维度按钮触发 onDimensionChange', () => {
      const onDimensionChange = vi.fn()
      render(<IndustryV4Panel {...createPanelProps({ onDimensionChange })} />)
      fireEvent.click(screen.getByText('竞争格局'))
      expect(onDimensionChange).toHaveBeenCalledWith('competition')
    })

    it('点击技术跃迁触发 onDimensionChange', () => {
      const onDimensionChange = vi.fn()
      render(<IndustryV4Panel {...createPanelProps({ onDimensionChange })} />)
      fireEvent.click(screen.getByText('技术跃迁'))
      expect(onDimensionChange).toHaveBeenCalledWith('technology')
    })

    it('activeDimension 切换后高亮对应按钮', () => {
      const { rerender } = render(<IndustryV4Panel {...createPanelProps({ activeDimension: 'prosperity' })} />)
      const prosperityBtn = screen.getByText('景气度').closest('button')!
      expect(prosperityBtn.style.background).not.toBe('transparent')

      rerender(<IndustryV4Panel {...createPanelProps({ activeDimension: 'policy' })} />)
      const policyBtn = screen.getByText('政策环境').closest('button')!
      expect(policyBtn.style.background).not.toBe('transparent')
    })
  })

  describe('子组件渲染控制', () => {
    it('showRadar=false 时不渲染雷达图', () => {
      render(<IndustryV4Panel {...createPanelProps({ showRadar: false })} />)
      expect(screen.queryByTestId('recharts-radar-chart')).not.toBeInTheDocument()
    })

    it('showSubIndicators=false 时不渲染子指标栏', () => {
      render(<IndustryV4Panel {...createPanelProps({ showSubIndicators: false })} />)
      expect(screen.queryByTestId('recharts-bar-chart')).not.toBeInTheDocument()
    })

    it('showRadar + showSubIndicators 都为 false 时仅显示评分和按钮', () => {
      render(<IndustryV4Panel {...createPanelProps({ showRadar: false, showSubIndicators: false })} />)
      expect(screen.queryByTestId('recharts-radar-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('recharts-bar-chart')).not.toBeInTheDocument()
      expect(screen.getByText('V4 综合评分')).toBeInTheDocument()
    })
  })

  describe('数据转换', () => {
    it('雷达图数据正确映射 dimensions → radarData', () => {
      render(<IndustryV4Panel {...createPanelProps()} />)
      const radarChartProps = capturedProps.radarChart as { data: Array<Record<string, unknown>> }
      expect(radarChartProps).toBeTruthy()
      expect(radarChartProps.data).toHaveLength(4)
      // IndustryV4Radar 内部将 dimension 映射为 label
      expect(radarChartProps.data[0]).toEqual({
        dimension: '景气度',
        label: '景气度',
        score: 4.2,
        fullMark: 5,
      })
    })

    it('子指标数据传递到 SubIndicatorBar', () => {
      render(<IndustryV4Panel {...createPanelProps({ activeDimension: 'prosperity' })} />)
      const barChartProps = capturedProps.barChart as { data: Array<Record<string, unknown>> }
      expect(barChartProps).toBeTruthy()
      // null 值被过滤
      expect(barChartProps.data).toHaveLength(2)
      // sortByValue=desc 排序后顺序可能变化
      const names = barChartProps.data.map((d) => d.name)
      expect(names).toContain('rev_growth')
      expect(names).toContain('profit_growth')
    })
  })

  describe('边界情况', () => {
    it('空 dimensions 数组不报错', () => {
      render(<IndustryV4Panel {...createPanelProps({ dimensions: [], compositeScore: 0 })} />)
      expect(screen.getByText('0.00')).toBeInTheDocument()
    })

    it('维度无子指标时不报错', () => {
      render(
        <IndustryV4Panel
          {...createPanelProps({
            dimensions: [{ name: 'prosperity', label: '景气度', score: 3, subIndicators: [] }],
          })}
        />,
      )
      expect(screen.getByText('景气度')).toBeInTheDocument()
    })

    it('所有子指标 value 为 null 时 SubIndicatorBar 数据为空不报错', () => {
      render(
        <IndustryV4Panel
          {...createPanelProps({
            dimensions: [
              {
                name: 'prosperity',
                label: '景气度',
                score: 3,
                subIndicators: [{ key: 'x', label: 'X', value: null, maxValue: 5 }],
              },
            ],
          })}
        />,
      )
      expect(screen.getByText('景气度')).toBeInTheDocument()
    })
  })
})

// ─── IndustryV4Radar 测试 ────────────────────────────────────────────

describe('IndustryV4Radar', () => {
  beforeEach(() => {
    capturedProps = {}
  })

  const radarData: IndustryV4RadarDataItem[] = [
    { dimension: 'prosperity', label: '景气度', score: 4.2, fullMark: 5 },
    { dimension: 'competition', label: '竞争', score: 3.5, fullMark: 5 },
    { dimension: 'policy', label: '政策', score: 4.0, fullMark: 5 },
    { dimension: 'technology', label: '技术', score: 3.8, fullMark: 5 },
  ]

  it('正常渲染不报错', () => {
    render(<IndustryV4Radar data={radarData} />)
    expect(screen.getByTestId('recharts-radar-chart')).toBeInTheDocument()
  })

  it('数据映射 dimension → label', () => {
    render(<IndustryV4Radar data={radarData} />)
    const chartProps = capturedProps.radarChart as { data: Array<Record<string, unknown>> }
    expect(chartProps.data[0]!.dimension).toBe('景气度')
    expect(chartProps.data[1]!.dimension).toBe('竞争')
  })

  it('自定义 series 传递到 Radar', () => {
    render(
      <IndustryV4Radar
        data={radarData}
        series={[{ name: '自定义', dataKey: 'score', color: '#ff0000', fillOpacity: 0.5 }]}
      />,
    )
    const radarProps = capturedProps.radar as Record<string, unknown>
    expect(radarProps.fill).toBe('#ff0000')
    expect(radarProps.fillOpacity).toBe(0.5)
  })

  it('默认 series 使用 series1 颜色', () => {
    render(<IndustryV4Radar data={radarData} />)
    const radarProps = capturedProps.radar as Record<string, unknown>
    expect(radarProps.dataKey).toBe('score')
  })

  it('maxValue 传递到 PolarRadiusAxis domain', () => {
    render(<IndustryV4Radar data={radarData} maxValue={10} />)
    const radiusProps = capturedProps.polarRadiusAxis as { domain: number[] }
    expect(radiusProps.domain).toEqual([0, 10])
  })

  it('showLegend=false 时不渲染 Legend', () => {
    render(<IndustryV4Radar data={radarData} showLegend={false} />)
    expect(capturedProps.legend).toBeUndefined()
  })

  it('空数据不报错', () => {
    render(<IndustryV4Radar data={[]} />)
    expect(screen.getByTestId('recharts-radar-chart')).toBeInTheDocument()
  })

  it('radarConfig 传递 strokeWidth 和 dot', () => {
    render(
      <IndustryV4Radar
        data={radarData}
        radarConfig={{ strokeWidth: 3, dot: true, fillOpacity: 0.4 }}
      />,
    )
    const radarProps = capturedProps.radar as Record<string, unknown>
    expect(radarProps.strokeWidth).toBe(3)
    expect(radarProps.dot).toBe(true)
    expect(radarProps.fillOpacity).toBe(0.4)
  })
})

// ─── SubIndicatorBar 测试 ────────────────────────────────────────────

describe('SubIndicatorBar', () => {
  beforeEach(() => {
    capturedProps = {}
  })

  const barData: SubIndicatorBarDataItem[] = [
    { name: 'rev_growth', label: '营收增速', value: 3.8, maxValue: 5 },
    { name: 'profit_growth', label: '利润增速', value: 4.5, maxValue: 5 },
    { name: 'pmi_signal', label: 'PMI 信号', value: null, maxValue: 5 },
    { name: 'order_growth', label: '订单增速', value: 2.1, maxValue: 5 },
  ]

  it('正常渲染不报错', () => {
    render(<SubIndicatorBar data={barData} />)
    expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument()
  })

  it('null 值被过滤掉', () => {
    render(<SubIndicatorBar data={barData} />)
    const chartProps = capturedProps.barChart as { data: unknown[] }
    expect(chartProps.data).toHaveLength(3)
  })

  it('sortByValue=desc 按降序排列', () => {
    render(<SubIndicatorBar data={barData} sortByValue="desc" />)
    const chartProps = capturedProps.barChart as { data: Array<Record<string, unknown>> }
    expect(chartProps.data[0]!.value).toBe(4.5)
    expect(chartProps.data[1]!.value).toBe(3.8)
    expect(chartProps.data[2]!.value).toBe(2.1)
  })

  it('sortByValue=asc 按升序排列', () => {
    render(<SubIndicatorBar data={barData} sortByValue="asc" />)
    const chartProps = capturedProps.barChart as { data: Array<Record<string, unknown>> }
    expect(chartProps.data[0]!.value).toBe(2.1)
    expect(chartProps.data[2]!.value).toBe(4.5)
  })

  it('sortByValue=none 保持原始顺序', () => {
    render(<SubIndicatorBar data={barData} sortByValue="none" />)
    const chartProps = capturedProps.barChart as { data: Array<Record<string, unknown>> }
    expect(chartProps.data[0]!.name).toBe('rev_growth')
  })

  it('layout=vertical 传递到 BarChart', () => {
    render(<SubIndicatorBar data={barData} layout="vertical" />)
    const chartProps = capturedProps.barChart as { layout: string }
    expect(chartProps.layout).toBe('vertical')
  })

  it('layout=horizontal 传递到 BarChart', () => {
    render(<SubIndicatorBar data={barData} layout="horizontal" />)
    const chartProps = capturedProps.barChart as { layout: string }
    expect(chartProps.layout).toBe('horizontal')
  })

  it('自定义 barColor 传递到 Bar', () => {
    render(<SubIndicatorBar data={barData} barColor="#ff0000" />)
    const barProps = capturedProps.bar as { fill: string }
    expect(barProps.fill).toBe('#ff0000')
  })

  it('自定义 valueDomain 传递到 YAxis（horizontal 布局）', () => {
    render(<SubIndicatorBar data={barData} valueDomain={[0, 10]} />)
    const yAxisProps = capturedProps.yAxis as { domain: number[] }
    expect(yAxisProps.domain).toEqual([0, 10])
  })

  it('默认 valueDomain 基于 maxValue 计算', () => {
    render(<SubIndicatorBar data={barData} />)
    const yAxisProps = capturedProps.yAxis as { domain: number[] }
    expect(yAxisProps.domain[0]).toBe(0)
    // maxValue=5, * 1.1 = 5.5
    expect(yAxisProps.domain[1]).toBeCloseTo(5.5)
  })

  it('labelPosition=none 时不显示标签', () => {
    render(<SubIndicatorBar data={barData} labelPosition="none" />)
    const barProps = capturedProps.bar as { label: unknown }
    expect(barProps.label).toBeUndefined()
  })

  it('空数据不报错', () => {
    render(<SubIndicatorBar data={[]} />)
    expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument()
  })

  it('所有值为 null 时数据为空', () => {
    const allNullData: SubIndicatorBarDataItem[] = [
      { name: 'a', label: 'A', value: null },
      { name: 'b', label: 'B', value: null },
    ]
    render(<SubIndicatorBar data={allNullData} />)
    const chartProps = capturedProps.barChart as { data: unknown[] }
    expect(chartProps.data).toHaveLength(0)
  })

  it('barRadius 传递到 Bar', () => {
    render(<SubIndicatorBar data={barData} barRadius={8} />)
    const barProps = capturedProps.bar as { radius: number[] }
    expect(barProps.radius).toEqual([8, 8, 0, 0])
  })

  it('vertical 布局时 barRadius 方向翻转', () => {
    render(<SubIndicatorBar data={barData} layout="vertical" barRadius={6} />)
    const barProps = capturedProps.bar as { radius: number[] }
    expect(barProps.radius).toEqual([0, 6, 6, 0])
  })
})
