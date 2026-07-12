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

    expect(screen.getByRole('link', { name: /进入输入舱/i })).toHaveAttribute('href', '/input')
    expect(screen.getByRole('link', { name: /打开驾驶舱/i })).toHaveAttribute('href', '/cockpit')
    expect(screen.getByRole('link', { name: /总控中心/i })).toHaveAttribute('href', '/command')
  })

  it('renders feature descriptions', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('录入候选股票，管理股票池，批量导入，热门板块')).toBeInTheDocument()
    expect(screen.getByText('V4/V6 评分，行业分析，策略回测')).toBeInTheDocument()
    expect(screen.getByText('交易信号，模拟盘执行，持仓管理')).toBeInTheDocument()
    expect(screen.getByText('研究报告，数据导出')).toBeInTheDocument()
  })
})
