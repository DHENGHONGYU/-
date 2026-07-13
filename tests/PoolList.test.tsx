import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PoolList } from '@/components/organisms/pool/PoolList'
import { DEFAULT_POOL_GROUP, POOL_TYPE, RESEARCH_STATUS } from '@/constants/pool.constants'
import type { PoolItem } from '@/types/modules/pool.types'
import { UI_TEXT } from '@/constants/uiText'

const mockItems: PoolItem[] = [
  {
    symbol: '000001.SZ',
    name: '平安银行',
    pool: POOL_TYPE.research,
    status: RESEARCH_STATUS.candidate,
    source: 'manual',
    dataVersion: 1,
    group: '核心持仓',
    price: 12.5,
    dataQuality: { basic: true, kline: false, finance: false },
  },
  {
    symbol: '600519.SH',
    name: '贵州茅台',
    pool: POOL_TYPE.research,
    status: RESEARCH_STATUS.watching,
    source: 'akshare',
    dataVersion: 1,
    price: 1800,
    dataQuality: { basic: true, kline: true, finance: true },
  },
]

describe('PoolList', () => {
  it('renders stocks in table', () => {
    render(
      <PoolList
        items={mockItems}
        selectedSymbols={[]}
        onSelectToggle={vi.fn()}
        onTransition={vi.fn()}
      />,
    )

    expect(screen.getByText('平安银行')).toBeInTheDocument()
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
  })

  it('calls onSelectToggle when checkbox clicked', async () => {
    const onSelectToggle = vi.fn()
    render(
      <PoolList
        items={mockItems}
        selectedSymbols={[]}
        onSelectToggle={onSelectToggle}
        onTransition={vi.fn()}
      />,
    )

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0]!)

    expect(onSelectToggle).toHaveBeenCalledWith('000001.SZ')
  })

  it('renders quality indicator for each row', () => {
    render(
      <PoolList
        items={mockItems}
        selectedSymbols={[]}
        onSelectToggle={vi.fn()}
        onTransition={vi.fn()}
      />,
    )

    expect(screen.getAllByLabelText('数据质量指示')).toHaveLength(2)
  })

  it('renders group column with fallback to default group', () => {
    render(
      <PoolList
        items={mockItems}
        selectedSymbols={[]}
        onSelectToggle={vi.fn()}
        onTransition={vi.fn()}
      />,
    )

    expect(screen.getByText(UI_TEXT.trading.strategy.coreHoldings)).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_POOL_GROUP)).toBeInTheDocument()
  })

  it('calls onChangeGroup when selecting a different group', async () => {
    const onChangeGroup = vi.fn()
    render(
      <PoolList
        items={mockItems}
        selectedSymbols={[]}
        allGroups={['核心持仓', '成长配置', DEFAULT_POOL_GROUP]}
        onSelectToggle={vi.fn()}
        onTransition={vi.fn()}
        onChangeGroup={onChangeGroup}
      />,
    )

    const selects = screen.getAllByLabelText(/分组/)
    expect(selects.length).toBeGreaterThan(0)

    await userEvent.selectOptions(selects[0]!, '成长配置')

    expect(onChangeGroup).toHaveBeenCalledWith('000001.SZ', '成长配置')
  })
})
