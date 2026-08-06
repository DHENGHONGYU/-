/**
 * PoolCard 组件单元测试
 * @vitest-environment jsdom
 *
 * 覆盖场景（organisms 层模式应用）：
 *   模式1(默认值快照)：group 默认值 DEFAULT_POOL_GROUP、allGroups=[] availableGroups=[]
 *   模式2(条件渲染)：onSelectToggle/onAnalyze/onRefreshKline 存在才渲染对应按钮
 *   模式3(事件回调)：Checkbox 点击 → onSelectToggle(symbol)；options 按钮 → onTransition；select → onChangeGroup
 *   模式4(className 合并)：外层 rounded-md border bg-card p-3、shadow-sm、hover:bg-accent/50
 *   模式7(选择器)：container.querySelector('p.font-medium') 取 symbol；queryByRole('checkbox') 用于可选渲染
 *   模式8(ARIA)：aria-label="选择 SYMBOL"、aria-label="切换 SYMBOL 分组"
 *   + 数值格式化：price/pe/pb toFixed(2)
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PoolCard } from '../pool/PoolCard'
import type { PoolItem, PoolTransitionTarget } from '@/types/modules/pool.types'

// QualityIndicator 是 organisms/input 复杂组件，PoolCard 层只关心“存在性”，不关心其内部实现，mock 掉避免副作用
vi.mock('@/components/organisms/input/QualityIndicator', () => ({
  QualityIndicator: ({ quality }: { quality?: unknown }) => (
    <span
      data-testid="quality-indicator"
      data-quality-has-value={quality !== undefined ? '1' : '0'}
      data-quality-type={typeof quality}
    >
      Q
    </span>
  ),
}))

function baseItem(): PoolItem {
  return {
    symbol: '600519',
    name: '贵州茅台',
    pool: 'research',
    status: 'candidate',
    source: '手工录入',
    dataQuality: { completeness: 0.8, sampleCount: 100, sampleAdequacy: 'sufficient' },
  } as unknown as PoolItem
}

function baseOptions(): PoolTransitionTarget[] {
  return [
    { pool: 'research', status: 'screened', label: '→已初筛' },
    { pool: 'research', status: 'deepDive', label: '→深度研究' },
  ]
}

describe('PoolCard', () => {
  describe('基础渲染 (模式1 默认值快照)', () => {
    it('显示 symbol + name，source Badge 显示 source', () => {
      render(<PoolCard item={baseItem()} options={baseOptions()} onTransition={vi.fn()} />)
      expect(screen.getByText('600519')).toBeInTheDocument()
      expect(screen.getByText('贵州茅台')).toBeInTheDocument()
      expect(screen.getByText('手工录入')).toBeInTheDocument()
    })

    it('外层容器含有 border、rounded-md、bg-card、p-3、shadow-sm 类', () => {
      const { container } = render(<PoolCard item={baseItem()} options={baseOptions()} onTransition={vi.fn()} />)
      const card = container.firstElementChild as HTMLElement
      expect(card.className).toContain('rounded-md')
      expect(card.className).toContain('border')
      expect(card.className).toContain('bg-card')
      expect(card.className).toContain('p-3')
      expect(card.className).toContain('shadow-sm')
    })

    it('group 未提供时 → DEFAULT_POOL_GROUP = "默认分组" 显示为 Badge secondary', () => {
      const item = baseItem()
      delete (item as Record<string, unknown>).group
      render(<PoolCard item={item} options={baseOptions()} onTransition={vi.fn()} />)
      expect(screen.getByText('默认分组')).toBeInTheDocument()
    })

    it('item.group="观察池" → Badge secondary 显示 "观察池"，不是默认分组', () => {
      const item = { ...baseItem(), group: '观察池' } as PoolItem
      render(<PoolCard item={item} options={baseOptions()} onTransition={vi.fn()} />)
      expect(screen.getByText('观察池')).toBeInTheDocument()
      expect(screen.queryByText('默认分组')).not.toBeInTheDocument()
    })

    it('QualityIndicator（mock）存在且 quality 被传递（typeof=object，has-value=1）', () => {
      render(<PoolCard item={baseItem()} options={baseOptions()} onTransition={vi.fn()} />)
      const qi = screen.getByTestId('quality-indicator')
      expect(qi).toBeInTheDocument()
      expect(qi.getAttribute('data-quality-has-value')).toBe('1')
      expect(qi.getAttribute('data-quality-type')).toBe('object')
    })
  })

  describe('数值格式化 price/pe/pb (toFixed 2 位小数)', () => {
    it('都有值时显示：价 / PE / PB 三段文本', () => {
      const item = { ...baseItem(), price: 1680.123, pe: 32.456, pb: 9.9 } as PoolItem
      render(<PoolCard item={item} options={baseOptions()} onTransition={vi.fn()} />)
      expect(screen.getByText('价 1680.12')).toBeInTheDocument()
      expect(screen.getByText('PE 32.46')).toBeInTheDocument()
      expect(screen.getByText('PB 9.90')).toBeInTheDocument()
    })

    it('全都未提供时 → 不出现 "价 " / "PE " / "PB " 文本', () => {
      const item = baseItem() as Record<string, unknown>
      delete item.price
      delete item.pe
      delete item.pb
      const { container } = render(<PoolCard item={item as PoolItem} options={baseOptions()} onTransition={vi.fn()} />)
      expect(container.textContent).not.toMatch(/价 \d/)
      expect(container.textContent).not.toMatch(/PE \d/)
      expect(container.textContent).not.toMatch(/PB \d/)
    })

    it('仅 price 存在 → 只显示价，不显示 PE / PB', () => {
      const item = { ...baseItem(), price: 100 } as Record<string, unknown>
      delete item.pe
      delete item.pb
      const { container } = render(<PoolCard item={item as PoolItem} options={baseOptions()} onTransition={vi.fn()} />)
      expect(container.textContent).toContain('价 100.00')
      expect(container.textContent).not.toMatch(/PE \d/)
      expect(container.textContent).not.toMatch(/PB \d/)
    })
  })

  describe('Checkbox + onSelectToggle 条件渲染 (模式2 条件渲染)', () => {
    it('未提供 onSelectToggle → 不渲染 checkbox（aria-label 也不存在）', () => {
      render(<PoolCard item={baseItem()} options={baseOptions()} onTransition={vi.fn()} />)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('提供 onSelectToggle → 渲染 checkbox，aria-label="选择 600519"，checked 反映 selected prop', () => {
      const onSelectToggle = vi.fn()
      render(
        <PoolCard
          item={baseItem()}
          options={baseOptions()}
          onSelectToggle={onSelectToggle}
          selected={true}
          onTransition={vi.fn()}
        />
      )
      const cb = screen.getByRole('checkbox', { name: '选择 600519' })
      expect(cb).toBeInTheDocument()
      expect(cb).toBeChecked()
    })

    it('selected=false → 未选中；点击 checkbox → onSelectToggle(symbol) 被调用', () => {
      const onSelectToggle = vi.fn()
      render(
        <PoolCard
          item={baseItem()}
          options={baseOptions()}
          onSelectToggle={onSelectToggle}
          selected={false}
          onTransition={vi.fn()}
        />
      )
      const cb = screen.getByRole('checkbox', { name: '选择 600519' })
      expect(cb).not.toBeChecked()
      fireEvent.click(cb)
      expect(onSelectToggle).toHaveBeenCalledTimes(1)
      expect(onSelectToggle).toHaveBeenCalledWith('600519')
    })
  })

  describe('options 流转按钮 (模式3 事件回调)', () => {
    it('每个 option 渲染一个 secondary variant 的 Button，文本对应 label', () => {
      render(<PoolCard item={baseItem()} options={baseOptions()} onTransition={vi.fn()} />)
      expect(screen.getByRole('button', { name: '→已初筛' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '→深度研究' })).toBeInTheDocument()
    })

    it('点击 "→已初筛" → onTransition("600519", "screened")', () => {
      const onTransition = vi.fn()
      render(<PoolCard item={baseItem()} options={baseOptions()} onTransition={onTransition} />)
      fireEvent.click(screen.getByRole('button', { name: '→已初筛' }))
      expect(onTransition).toHaveBeenCalledWith('600519', 'screened')
    })

    it('options=[] → 不渲染流转按钮，仍不抛异常', () => {
      render(<PoolCard item={baseItem()} options={[]} onTransition={vi.fn()} />)
      expect(screen.queryAllByRole('button').length).toBe(0)
    })
  })

  describe('availableGroups + onChangeGroup select 条件渲染', () => {
    it('allGroups=[item.group] → availableGroups=[]，不渲染 select', () => {
      const item = { ...baseItem(), group: '默认分组' } as PoolItem
      const onChangeGroup = vi.fn()
      render(
        <PoolCard
          item={item}
          allGroups={['默认分组']}
          options={baseOptions()}
          onChangeGroup={onChangeGroup}
          onTransition={vi.fn()}
        />
      )
      expect(screen.queryByRole('combobox', { name: /切换 .* 分组/ })).not.toBeInTheDocument()
    })

    it('未提供 onChangeGroup → 即使 availableGroups 有值，也不渲染 select', () => {
      const item = { ...baseItem(), group: 'A' } as PoolItem
      render(
        <PoolCard item={item} allGroups={['A', 'B', 'C']} options={baseOptions()} onTransition={vi.fn()} />
      )
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    it('allGroups=[A,B] + item.group=A + onChangeGroup → select 有 B 选项；选中 B → onChangeGroup(symbol,"B")', () => {
      const item = { ...baseItem(), group: 'A' } as PoolItem
      const onChangeGroup = vi.fn()
      render(
        <PoolCard
          item={item}
          allGroups={['A', 'B']}
          options={baseOptions()}
          onChangeGroup={onChangeGroup}
          onTransition={vi.fn()}
        />
      )
      const select = screen.getByRole('combobox', { name: '切换 600519 分组' }) as HTMLSelectElement
      expect(select).toBeInTheDocument()
      expect(select.querySelector('option[value="B"]')).toBeInTheDocument()
      expect(select.querySelector('option[value="A"]')).not.toBeInTheDocument() // A 已过滤
      fireEvent.change(select, { target: { value: 'B' } })
      expect(onChangeGroup).toHaveBeenCalledWith('600519', 'B')
    })

    it('select 默认 placeholder "移入分组"，value=""，切换为空值时不调 onChangeGroup', () => {
      const item = { ...baseItem(), group: 'X' } as PoolItem
      const onChangeGroup = vi.fn()
      render(
        <PoolCard
          item={item}
          allGroups={['X', 'Y']}
          options={baseOptions()}
          onChangeGroup={onChangeGroup}
          onTransition={vi.fn()}
        />
      )
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.options[0]?.textContent).toBe('移入分组')
      expect(select.value).toBe('')
      fireEvent.change(select, { target: { value: '' } })
      expect(onChangeGroup).not.toHaveBeenCalled()
    })
  })

  describe('onAnalyze / onRefreshKline 可选渲染 (模式2)', () => {
    it('两个回调都不提供 → 不渲染 "分析" / "刷新行情" 按钮', () => {
      render(<PoolCard item={baseItem()} options={baseOptions()} onTransition={vi.fn()} />)
      expect(screen.queryByRole('button', { name: '分析' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '刷新行情' })).not.toBeInTheDocument()
    })

    it('onAnalyze 提供 → 渲染 "分析" 按钮 variant=ghost；点击 → onAnalyze(symbol)', () => {
      const onAnalyze = vi.fn()
      render(
        <PoolCard
          item={baseItem()}
          options={baseOptions()}
          onAnalyze={onAnalyze}
          onTransition={vi.fn()}
        />
      )
      const btn = screen.getByRole('button', { name: '分析' })
      expect(btn).toBeInTheDocument()
      expect(btn.className).toContain('hover:bg-accent') // ghost 类特征
      fireEvent.click(btn)
      expect(onAnalyze).toHaveBeenCalledWith('600519')
    })

    it('onRefreshKline 提供 → 渲染 "刷新行情" 按钮；点击 → onRefreshKline(item) 传整个 item', () => {
      const onRefreshKline = vi.fn()
      const item = baseItem()
      render(
        <PoolCard
          item={item}
          options={baseOptions()}
          onRefreshKline={onRefreshKline}
          onTransition={vi.fn()}
        />
      )
      const btn = screen.getByRole('button', { name: '刷新行情' })
      fireEvent.click(btn)
      expect(onRefreshKline).toHaveBeenCalledTimes(1)
      expect(onRefreshKline).toHaveBeenCalledWith(item)
    })
  })
})
