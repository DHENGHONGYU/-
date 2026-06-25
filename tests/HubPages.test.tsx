import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import InputHubPage from '@/pages/input/InputHubPage'
import AnalysisHubPage from '@/pages/analysis/AnalysisHubPage'
import TradingHubPage from '@/pages/trading/TradingHubPage'
import CommandHubPage from '@/pages/command/CommandHubPage'

describe('Hub Pages', () => {
  it('renders InputHubPage with module cards', () => {
    render(
      <MemoryRouter>
        <InputHubPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('数据采集及接口')).toBeInTheDocument()
    expect(screen.getByText('录入看板')).toBeInTheDocument()
    expect(screen.getByText('批量导入')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/input')).toBe(true)
    expect(links.some((link) => link.getAttribute('href') === '/input/bulk-import')).toBe(true)
  })

  it('renders AnalysisHubPage with module cards', () => {
    render(
      <MemoryRouter>
        <AnalysisHubPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('行业个股分析')).toBeInTheDocument()
    expect(screen.getByText('V4 行业评分')).toBeInTheDocument()
    expect(screen.getByText('V6 个股评分')).toBeInTheDocument()
  })

  it('renders TradingHubPage with module cards', () => {
    render(
      <MemoryRouter>
        <TradingHubPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('交易及持仓')).toBeInTheDocument()
    expect(screen.getByText('交易信号')).toBeInTheDocument()
    expect(screen.getByText('策略管理')).toBeInTheDocument()
  })

  it('renders CommandHubPage with module cards', () => {
    render(
      <MemoryRouter>
        <CommandHubPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('总控中心')).toBeInTheDocument()
    expect(screen.getByText('系统监控')).toBeInTheDocument()
    expect(screen.getByText('AI 体中心')).toBeInTheDocument()
  })
})
