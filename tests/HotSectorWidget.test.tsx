import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HotSectorWidget from '@/cockpit/widgets/HotSectorWidget'
import type { HotSectorData, WidgetConfig } from '@/types/modules/widget.types'
import { UI_TEXT } from '@/constants/uiText'

function buildConfig(title: string): WidgetConfig {
  return {
    instanceId: 'hot-sector-1',
    widgetId: 'hot-sector',
    title,
    size: { cols: 2, rows: 2 },
    settings: {},
    visible: true,
    collapsed: false,
  }
}

function buildHotSectorData(overrides: Partial<HotSectorData> = {}): HotSectorData {
  return {
    symbol: 'TEST.SZ',
    name: '测试标的',
    score: 4.2,
    action: 'immediate',
    dimensions: {
      momentum: 4.0,
      sentiment: 3.8,
      technical: 4.1,
      valuation: 3.5,
      composite: 4.2,
    },
    ...overrides,
  }
}

describe('HotSectorWidget', () => {
  it('renders empty state when no hot sectors', () => {
    render(<HotSectorWidget config={buildConfig(UI_TEXT.analysis.hotSector.title)} data={{ hotSectors: [] }} />)

    expect(screen.getByText(UI_TEXT.analysis.hotSector.title)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.hotSector.noData)).toBeInTheDocument()
  })

  it('renders hot sector item with score and action badge', () => {
    const data = { hotSectors: [buildHotSectorData({ name: '热门标的', action: 'immediate', score: 4.35 })] }
    render(<HotSectorWidget config={buildConfig(UI_TEXT.analysis.hotSector.title)} data={data} />)

    expect(screen.getByText('热门标的')).toBeInTheDocument()
    expect(screen.getByText('TEST.SZ')).toBeInTheDocument()
    expect(screen.getByText('4.35')).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.trading.strategy.immediateFollow)).toBeInTheDocument()
  })

  it('renders dimension labels', () => {
    const data = { hotSectors: [buildHotSectorData()] }
    render(<HotSectorWidget config={buildConfig(UI_TEXT.analysis.hotSector.title)} data={data} />)

    // 组件使用 DIMENSION_NAMES 映射渲染维度标签
    expect(screen.getByText('动量')).toBeInTheDocument()
    expect(screen.getByText('情绪')).toBeInTheDocument()
    expect(screen.getByText('技术')).toBeInTheDocument()
    expect(screen.getByText('估值')).toBeInTheDocument()
  })

  it('renders probe action label', () => {
    const data = { hotSectors: [buildHotSectorData({ action: 'probe', score: 3.5 })] }
    render(<HotSectorWidget config={buildConfig(UI_TEXT.analysis.hotSector.title)} data={data} />)

    expect(screen.getByText(UI_TEXT.analysis.rotation.tentative)).toBeInTheDocument()
  })
})
