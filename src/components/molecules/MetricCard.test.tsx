/**
 * MetricCard 组件单元测试
 *
 * 覆盖场景：
 * 1. 基础渲染：标题和数值正确显示
 * 2. 数值为 string 类型时正确显示
 * 3. 数值为 number 类型时正确显示
 * 4. unit 单位显示
 * 5. trend=up 时显示上升趋势箭头和颜色
 * 6. trend=down 时显示下降趋势箭头和颜色
 * 7. trend=neutral（默认）时显示中性趋势
 * 8. change 变化文本显示
 * 9. loading=true 时显示骨架屏，隐藏数值和趋势
 * 10. loading=false 时显示实际内容
 * 11. className 透传到外层 Card
 * 12. change 为空字符串时不显示 Badge
 * 13. unit 为空字符串时不显示单位
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '@/components/molecules/MetricCard'

describe('MetricCard', () => {
  it('基础渲染：标题和数值正确显示', () => {
    render(<MetricCard title="总市值" value="1.2万亿" />)
    expect(screen.getByText('总市值')).toBeInTheDocument()
    expect(screen.getByText('1.2万亿')).toBeInTheDocument()
  })

  it('数值为 number 类型时正确显示', () => {
    render(<MetricCard title="市盈率" value={25.6} />)
    expect(screen.getByText('25.6')).toBeInTheDocument()
  })

  it('数值为 string 类型时正确显示', () => {
    render(<MetricCard title="净利润" value="¥500亿" />)
    expect(screen.getByText('¥500亿')).toBeInTheDocument()
  })

  it('unit 单位正确显示在数值旁', () => {
    render(<MetricCard title="营收增速" value={25.3} unit="%" />)
    expect(screen.getByText('25.3')).toBeInTheDocument()
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('trend=up 时显示上升箭头和变化文本', () => {
    render(
      <MetricCard
        title="股价"
        value={120.5}
        unit="元"
        trend="up"
        change="5.2%"
      />,
    )
    expect(screen.getByText('↑ 5.2%')).toBeInTheDocument()
  })

  it('trend=down 时显示下降箭头和变化文本', () => {
    render(
      <MetricCard
        title="股价"
        value={120.5}
        unit="元"
        trend="down"
        change="3.8%"
      />,
    )
    expect(screen.getByText('↓ 3.8%')).toBeInTheDocument()
  })

  it('trend=neutral（默认）时显示中性标记', () => {
    render(
      <MetricCard
        title="波动率"
        value={15.2}
        unit="%"
        trend="neutral"
        change="0.1%"
      />,
    )
    expect(screen.getByText('— 0.1%')).toBeInTheDocument()
  })

  it('默认 trend 为 neutral', () => {
    render(
      <MetricCard
        title="基准值"
        value={100}
        change="持平"
      />,
    )
    expect(screen.getByText('— 持平')).toBeInTheDocument()
  })

  it('loading=true 时显示骨架屏，隐藏数值', () => {
    render(
      <MetricCard
        title="加载中指标"
        value="999"
        loading={true}
      />,
    )
    // 骨架屏有 animate-pulse 类
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    // 数值不应显示
    expect(screen.queryByText('999')).not.toBeInTheDocument()
    // 标题仍然显示
    expect(screen.getByText('加载中指标')).toBeInTheDocument()
  })

  it('loading=true 时隐藏趋势 Badge', () => {
    render(
      <MetricCard
        title="加载中"
        value="100"
        trend="up"
        change="5%"
        loading={true}
      />,
    )
    expect(screen.queryByText('↑ 5%')).not.toBeInTheDocument()
  })

  it('loading=false（默认）时显示实际数值', () => {
    render(<MetricCard title="正常指标" value={42} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })

  it('className 透传到外层 Card', () => {
    const { container } = render(
      <MetricCard title="测试" value={1} className="custom-metric-card" />,
    )
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('custom-metric-card')
  })

  it('change 为空字符串时不显示 Badge', () => {
    render(
      <MetricCard
        title="无变化"
        value={100}
        trend="up"
        change=""
      />,
    )
    // 没有 Badge（没有带 outline variant 的元素）
    expect(document.querySelector('.inline-flex.items-center')).toBeNull()
  })

  it('unit 为空字符串时不显示单位', () => {
    render(
      <MetricCard
        title="无单位"
        value={100}
        unit=""
      />,
    )
    const valueEl = screen.getByText('100')
    // 数值旁边没有额外的单位 span
    expect(valueEl.nextElementSibling).toBeNull()
  })

  it('标题使用 muted-foreground 样式', () => {
    render(<MetricCard title="样式测试" value={1} />)
    const titleEl = screen.getByText('样式测试')
    expect(titleEl).toHaveClass('text-muted-foreground')
    expect(titleEl.tagName).toBe('P')
  })

  it('color 生效时数值文字应用强调色', () => {
    render(<MetricCard title="强调" value={88} color="#10b981" />)
    const valueEl = screen.getByText('88')
    expect(valueEl).toHaveStyle({ color: '#10b981' })
  })

  it('border=true 且 color 时外层 Card 应用左边框与边框色', () => {
    const { container } = render(
      <MetricCard title="左边框" value={7} color="#ef4444" border />,
    )
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('border-l-4')
    expect(card).toHaveStyle({ borderLeftColor: '#ef4444' })
  })

  it('border=false 且无条件时外层 Card 无左边框', () => {
    const { container } = render(<MetricCard title="无边框" value={1} />)
    const card = container.firstChild as HTMLElement
    expect(card).not.toHaveClass('border-l-4')
  })
})
