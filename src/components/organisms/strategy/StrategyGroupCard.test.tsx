/**
 * StrategyGroupCard 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景：
 *   模式1(默认值快照)：空列表 "暂无标的"、count=0 → avg/max=0.00
 *   模式2(计算逻辑分支)：avgComposite = Math.round((sum/n)*100)/100；maxComposite = Math.max
 *   模式6(className 合并)：Card h-full flex-col、color-dot 类
 *   模式7(选择器)：getAllByRole('listitem') 数量匹配
 *   模式8(data-testid)：group-color-dot / reasons[0] 可选渲染
 *   模式3(边界)：reasons[0] 未提供 → 不渲染 line-clamp-2 段落；有原因时显示
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StrategyGroupCard } from '../strategy/StrategyGroupCard'
import type { StrategyGroupItem } from '@/services/trading/strategySnapshotService'

function mkItem(partial: Partial<StrategyGroupItem> & Pick<StrategyGroupItem, 'symbol' | 'composite'>): StrategyGroupItem {
  return {
    name: partial.name ?? partial.symbol,
    reasons: partial.reasons ?? [],
    ...partial,
  }
}

describe('StrategyGroupCard', () => {
  describe('空列表 (模式1 + 三分支边界)', () => {
    it('items=[] → 显示 "暂无标的"、0 只、均分 0.00、最高 0.00', () => {
      render(<StrategyGroupCard title="未分组" items={[]} color="bg-amber-500" />)
      expect(screen.getByText('暂无标的')).toBeInTheDocument()
      expect(screen.getByText('0 只')).toBeInTheDocument()
      expect(screen.getByText('均分 0.00')).toBeInTheDocument()
      expect(screen.getByText('最高 0.00')).toBeInTheDocument()
      expect(screen.queryAllByRole('listitem').length).toBe(0)
    })

    it('空列表仍然显示颜色圆点 data-testid="group-color-dot"', () => {
      render(<StrategyGroupCard title="空" items={[]} color="bg-red-500" />)
      const dot = screen.getByTestId('group-color-dot')
      expect(dot).toBeInTheDocument()
      expect(dot.className).toContain('bg-red-500')
      expect(dot.className).toContain('h-3')
      expect(dot.className).toContain('w-3')
      expect(dot.className).toContain('rounded-full')
    })
  })

  describe('avgComposite / maxComposite 计算 (模式2 数值精度)', () => {
    it('count=1 → avg = max = 该值，两位小数 toFixed(2)', () => {
      render(
        <StrategyGroupCard
          title="单只"
          items={[mkItem({ symbol: '600519', composite: 0.8735 })]}
          color="bg-blue-500"
        />
      )
      // Math.round(0.8735*100)/100 = 0.87
      expect(screen.getByText('均分 0.87')).toBeInTheDocument()
      expect(screen.getByText('最高 0.87')).toBeInTheDocument()
      expect(screen.getByText('1 只')).toBeInTheDocument()
    })

    it('count=3 验证 Math.round((sum/count)*100)/100', () => {
      // [0.512, 0.334, 0.277] → sum=1.123 / 3 = 0.37433... → round(37.433) = 37 → 0.37; max=0.51
      render(
        <StrategyGroupCard
          title="组"
          items={[
            mkItem({ symbol: 'A', composite: 0.512 }),
            mkItem({ symbol: 'B', composite: 0.334 }),
            mkItem({ symbol: 'C', composite: 0.277 }),
          ]}
          color="bg-green-500"
        />
      )
      expect(screen.getByText('均分 0.37')).toBeInTheDocument()
      expect(screen.getByText('最高 0.51')).toBeInTheDocument()
      expect(screen.getByText('3 只')).toBeInTheDocument()
    })

    it('count=2 四舍五入 0.665 → 平均 Math.round( (x+y)/2 * 100 )/100 边界', () => {
      // 0.665 + 0.667 = 1.332 / 2 = 0.666 → round(66.6) = 67 → 0.67
      render(
        <StrategyGroupCard
          title="边界"
          items={[
            mkItem({ symbol: 'X', composite: 0.665 }),
            mkItem({ symbol: 'Y', composite: 0.667 }),
          ]}
          color="bg-purple-500"
        />
      )
      expect(screen.getByText('均分 0.67')).toBeInTheDocument()
      expect(screen.getByText('最高 0.67')).toBeInTheDocument()
    })
  })

  describe('列表渲染 (模式7 选择器)', () => {
    it('li 数量 === items.length，显示 symbol name + composite', () => {
      const items = [
        mkItem({ symbol: '000001', name: '平安银行', composite: 0.42 }),
        mkItem({ symbol: '601318', name: '中国平安', composite: 0.58 }),
      ]
      render(<StrategyGroupCard title="金融" items={items} color="bg-yellow-500" />)
      const lis = screen.getAllByRole('listitem')
      expect(lis.length).toBe(2)
      expect(screen.getByText('000001 平安银行')).toBeInTheDocument()
      expect(screen.getByText('601318 中国平安')).toBeInTheDocument()
      expect(screen.getByText('0.42')).toBeInTheDocument()
      expect(screen.getByText('0.58')).toBeInTheDocument()
    })
  })

  describe('reasons[0] 可选渲染 (模式3 三分支: undefined / [] / 有值)', () => {
    it('reasons=[] → 不渲染 line-clamp-2 段落，无多余描述', () => {
      const { container } = render(
        <StrategyGroupCard
          title="无原因"
          items={[mkItem({ symbol: 'A', composite: 0.5, reasons: [] })]}
          color="bg-slate-500"
        />
      )
      const lis = screen.getAllByRole('listitem')
      expect(lis.length).toBe(1)
      const ps = lis[0].querySelectorAll('p.line-clamp-2')
      expect(ps.length).toBe(0)
    })

    it('reasons 未提供 (空) → 同 reasons=[]，不渲染段落', () => {
      const { container } = render(
        <StrategyGroupCard
          title="省略"
          items={[mkItem({ symbol: 'B', composite: 0.3 })]}
          color="bg-cyan-500"
        />
      )
      const lis = screen.getAllByRole('listitem')
      const ps = lis[0].querySelectorAll('p.line-clamp-2')
      expect(ps.length).toBe(0)
    })

    it('reasons[0] 有值 → 渲染原因段落，并显示该文本', () => {
      render(
        <StrategyGroupCard
          title="有原因"
          items={[
            mkItem({
              symbol: 'C',
              composite: 0.9,
              reasons: ['ROE 连续三年 > 15%，净利率稳定'],
            }),
          ]}
          color="bg-orange-500"
        />
      )
      expect(screen.getByText('ROE 连续三年 > 15%，净利率稳定')).toBeInTheDocument()
    })

    it('reasons 长度>1 → 仅显示 reasons[0]，不渲染 reasons[1]', () => {
      render(
        <StrategyGroupCard
          title="多原因"
          items={[
            mkItem({
              symbol: 'D',
              composite: 0.7,
              reasons: ['原因 1 显示', '原因 2 不显示', '原因 3 不显示'],
            }),
          ]}
          color="bg-rose-500"
        />
      )
      expect(screen.getByText('原因 1 显示')).toBeInTheDocument()
      expect(screen.queryByText('原因 2 不显示')).not.toBeInTheDocument()
      expect(screen.queryByText('原因 3 不显示')).not.toBeInTheDocument()
    })
  })

  describe('className / 结构 (模式6 class 合并)', () => {
    it('外层 Card 含 h-full flex-col，color-dot 含自定义 color 类', () => {
      const { container } = render(
        <StrategyGroupCard title="T" items={[]} color="bg-indigo-500" />
      )
      const rootCard = container.querySelector('.h-full.flex.flex-col')
      expect(rootCard).toBeInTheDocument()
      const dot = screen.getByTestId('group-color-dot')
      expect(dot.className).toContain('bg-indigo-500')
    })
  })
})
