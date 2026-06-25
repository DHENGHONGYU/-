import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QualityIndicator } from '@/components/input/QualityIndicator'

describe('QualityIndicator', () => {
  it('renders missing state when quality is undefined', () => {
    render(<QualityIndicator />)
    expect(screen.getByTitle('基础数据缺失')).toBeInTheDocument()
    expect(screen.getByTitle('行情数据缺失')).toBeInTheDocument()
    expect(screen.getByTitle('财务数据缺失')).toBeInTheDocument()
  })

  it('renders ok state for all quality flags', () => {
    render(
      <QualityIndicator
        quality={{ basic: true, kline: true, finance: true, lastChecked: Date.now() }}
      />,
    )
    expect(screen.getByTitle('基础数据已采集')).toBeInTheDocument()
    expect(screen.getByTitle('行情数据已采集')).toBeInTheDocument()
    expect(screen.getByTitle('财务数据已采集')).toBeInTheDocument()
  })
})
