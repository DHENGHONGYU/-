import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ComponentShowcasePage from '@/pages/command/showcase/ComponentShowcasePage'
import {
  buildUIComponentShowcase,
  buildWidgetStateShowcase,
  buildColorTokenShowcase,
  buildStockDataShowcase,
} from '@/showcase'

describe('ComponentShowcasePage', () => {
  it('renders the showcase title and sections', () => {
    render(
      <MemoryRouter>
        <ComponentShowcasePage />
      </MemoryRouter>,
    )
    expect(screen.getByText('组件示例库')).toBeInTheDocument()
    expect(screen.getByText('基础 UI 组件')).toBeInTheDocument()
    expect(screen.getByText('Widget 状态外壳')).toBeInTheDocument()
    expect(screen.getByText('颜色令牌')).toBeInTheDocument()
    expect(screen.getByText('股票数据展示')).toBeInTheDocument()
    expect(screen.getByText('智能体详情面板')).toBeInTheDocument()
  })
})

describe('Showcase group builders', () => {
  it('buildUIComponentShowcase returns expected structure', () => {
    const group = buildUIComponentShowcase()
    expect(group.id).toBe('ui-components')
    expect(group.items.length).toBeGreaterThan(0)
    expect(group.items.some((i) => i.id === 'button-variants')).toBe(true)
  })

  it('buildWidgetStateShowcase returns expected structure', () => {
    const group = buildWidgetStateShowcase()
    expect(group.id).toBe('widget-states')
    expect(group.items.some((i) => i.id === 'state-transitions')).toBe(true)
  })

  it('buildColorTokenShowcase returns expected structure', () => {
    const group = buildColorTokenShowcase()
    expect(group.id).toBe('color-tokens')
    expect(group.items.some((i) => i.id === 'theme-tokens')).toBe(true)
  })

  it('buildStockDataShowcase returns expected structure', () => {
    const group = buildStockDataShowcase()
    expect(group.id).toBe('stock-data')
    expect(group.items.some((i) => i.id === 'watchlist-row')).toBe(true)
  })
})
