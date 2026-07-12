import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ValuePitWidget from '@/cockpit/widgets/ValuePitWidget'
import type { ValuePitData, WidgetConfig } from '@/types/modules/widget.types'
import { UI_TEXT } from '@/constants/uiText'

function buildConfig(title: string): WidgetConfig {
  return {
    instanceId: 'value-pit-1',
    widgetId: 'value-pit',
    title,
    size: { cols: 2, rows: 2 },
    settings: {},
    visible: true,
    collapsed: false,
  }
}

function buildValuePitData(overrides: Partial<ValuePitData> = {}): ValuePitData {
  return {
    symbol: 'TEST.SZ',
    name: '测试洼地',
    score: 3.8,
    action: 'wait',
    rotationSignal: false,
    dimensions: {
      catalyst: 3.5,
      valuation: 4.2,
      chip: 3.2,
      rotation: 3.6,
      liquidity: 3.4,
      composite: 3.8,
    },
    ...overrides,
  }
}

describe('ValuePitWidget', () => {
  it('renders empty state when no value pit data', () => {
    render(<ValuePitWidget config={buildConfig(UI_TEXT.analysis.valuePit.title)} data={{ valuePit: [] }} />)

    expect(screen.getByText(UI_TEXT.analysis.valuePit.title)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.valuePit.noData)).toBeInTheDocument()
  })

  it('renders value pit item with score and action badge', () => {
    const data = { valuePit: [buildValuePitData({ name: '洼地标的', action: 'probe', score: 3.55 })] }
    render(<ValuePitWidget config={buildConfig(UI_TEXT.analysis.valuePit.title)} data={data} />)

    expect(screen.getByText('洼地标的')).toBeInTheDocument()
    expect(screen.getByText('TEST.SZ')).toBeInTheDocument()
    expect(screen.getByText('3.55')).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.rotation.tentative)).toBeInTheDocument()
  })

  it('renders rotation signal badge', () => {
    const data = { valuePit: [buildValuePitData({ rotationSignal: true, action: 'immediate' })] }
    render(<ValuePitWidget config={buildConfig(UI_TEXT.analysis.valuePit.title)} data={data} />)

    expect(screen.getByText(UI_TEXT.analysis.rotation.signal)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.trading.strategy.immediateOpen)).toBeInTheDocument()
  })

  it('renders dimension labels', () => {
    const data = { valuePit: [buildValuePitData()] }
    render(<ValuePitWidget config={buildConfig(UI_TEXT.analysis.valuePit.title)} data={data} />)

    expect(screen.getByText(UI_TEXT.analysis.factor.catalyst)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.factor.value)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.factor.chips)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.rotation.rotation)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.factor.liquidity)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.analysis.score.overall)).toBeInTheDocument()
  })
})
