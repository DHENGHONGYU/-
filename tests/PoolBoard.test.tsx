import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PoolBoard } from '@/components/organisms/pool/PoolBoard'
import { DEFAULT_POOL_GROUP } from '@/constants/pool.constants'
import type { Stock } from '@/data/types'
import { UI_TEXT } from '@/constants/uiText'

const mockStocks: Stock[] = [
  {
    symbol: '000001.SZ',
    name: '平安银行',
    researchStatus: 'candidate',
    source: 'manual',
    dataVersion: 1,
    group: '核心持仓',
    price: 12.5,
    dataQuality: { basic: true, kline: false, finance: false },
  },
  {
    symbol: '600519.SH',
    name: '贵州茅台',
    researchStatus: 'candidate',
    source: 'akshare',
    dataVersion: 1,
    price: 1800,
    dataQuality: { basic: true, kline: true, finance: true },
  },
]

describe('PoolBoard', () => {
  it('renders kanban columns by research status', () => {
    render(
      <PoolBoard
        stocks={mockStocks}
        viewMode="kanban"
        onTransition={vi.fn()}
      />,
    )

    expect(screen.getByText('意向候选池')).toBeInTheDocument()
    expect(screen.getByText('平安银行')).toBeInTheDocument()
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
  })

  it('renders group badges in kanban cards', () => {
    render(
      <PoolBoard
        stocks={mockStocks}
        viewMode="kanban"
        onTransition={vi.fn()}
      />,
    )

    expect(screen.getByText(UI_TEXT.trading.strategy.coreHoldings)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_POOL_GROUP)).toBeInTheDocument()
  })

  it('calls onChangeGroup when selecting a different group in kanban', async () => {
    const onChangeGroup = vi.fn()
    render(
      <PoolBoard
        stocks={mockStocks}
        viewMode="kanban"
        allGroups={['核心持仓', '成长配置', DEFAULT_POOL_GROUP]}
        onTransition={vi.fn()}
        onChangeGroup={onChangeGroup}
      />,
    )

    const selects = screen.getAllByLabelText(/切换 .* 分组/)
    expect(selects.length).toBeGreaterThan(0)

    await userEvent.selectOptions(selects[0]!, '成长配置')

    expect(onChangeGroup).toHaveBeenCalledWith('000001.SZ', '成长配置')
  })

  it('renders list view with group column', () => {
    render(
      <PoolBoard
        stocks={mockStocks}
        viewMode="list"
        onTransition={vi.fn()}
      />,
    )

    expect(screen.getByText(UI_TEXT.trading.strategy.coreHoldings)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_POOL_GROUP)).toBeInTheDocument()
  })
})
