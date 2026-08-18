import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { UI_TEXT } from '@/constants/uiText'
import HomePage from '@/pages/HomePage'

describe('HomePage', () => {
  it('renders title and feature cards', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText(UI_TEXT.cockpit.systemName)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.cockpit.inputCabin)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.cockpit.analysisCabin)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.cockpit.tradingCabin)).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.cockpit.outputCabin)).toBeInTheDocument()
  })

  it('renders navigation buttons with correct links', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /输入舱/i })).toHaveAttribute('href', '/input')
    expect(screen.getByRole('link', { name: /打开驾驶舱/i })).toHaveAttribute('href', '/cockpit')
    expect(screen.getByRole('link', { name: /总控舱/i })).toHaveAttribute('href', '/command')
  })

  it('renders feature descriptions', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('双源输入 · 数据采集')).toBeInTheDocument()
    expect(screen.getByText('多因子模型 · 深度研究')).toBeInTheDocument()
    expect(screen.getByText('持仓管理 · 交易复盘')).toBeInTheDocument()
    expect(screen.getByText('报告生成 · 策略回测')).toBeInTheDocument()
  })
})
