import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import InputApp from '@/apps/input/InputApp'
import * as inputService from '@/services/input/inputService'
import * as fetcherService from '@/services/fetcher/fetcherService'
import * as batchImportService from '@/services/input/batchImportService'
import * as hotSectorService from '@/services/input/hotSectorService'
import * as stockpoolService from '@/services/stockpool/stockpoolService'
import type { Stock } from '@/data/types'

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn(), toasts: [], dismiss: vi.fn() }),
}))

const mockStock: Stock = {
  symbol: '000001.SZ',
  name: '平安银行',
  researchStatus: 'candidate',
  source: 'manual',
  dataVersion: 1,
  dataQuality: { basic: true, kline: true, finance: true },
}

const mockStockMissingBasic: Stock = {
  symbol: '600519.SH',
  name: '贵州茅台',
  researchStatus: 'candidate',
  source: 'manual',
  dataVersion: 1,
}

const mockPoolGroups = [
  {
    status: 'candidate',
    label: '候选池',
    stocks: [mockStock, mockStockMissingBasic],
    options: [],
  },
  { status: 'screened', label: '初筛池', stocks: [], options: [] },
  { status: 'deepDive', label: '深度池', stocks: [], options: [] },
  { status: 'watching', label: '观察池', stocks: [], options: [] },
  { status: 'archived', label: '归档池', stocks: [], options: [] },
]

const mockHotSector = {
  code: 'semiconductor',
  name: '半导体',
  score: 82,
  trend: 'up' as const,
  factors: { momentum: 85, fundFlow: 78, valuation: 68, sentiment: 88 },
  stocks: [
    { symbol: '002594.SZ', name: '比亚迪' },
    { symbol: '300750.SZ', name: '宁德时代' },
  ],
}

describe('InputApp', () => {
  beforeEach(() => {
    vi.spyOn(stockpoolService, 'getAllPoolGroups').mockResolvedValue({
      success: true,
      data: mockPoolGroups as never,
    })
    vi.spyOn(inputService, 'addStock').mockResolvedValue({
      success: true,
      data: mockStock,
    })
    vi.spyOn(fetcherService, 'checkFetcherHealth').mockResolvedValue({
      ok: true,
    })
    vi.spyOn(fetcherService, 'refreshSymbolKline').mockResolvedValue({
      success: true,
      data: undefined as never,
    })
    vi.spyOn(batchImportService, 'parseBulkInput').mockReturnValue([
      { code: '600519', name: '贵州茅台', symbol: '600519.SH' },
    ])
    vi.spyOn(batchImportService, 'importStocks').mockResolvedValue({
      success: true,
      data: { total: 1, success: 1, failed: 0, errors: [], stocks: [mockStock] },
    })
    vi.spyOn(hotSectorService, 'getHotSectors').mockReturnValue([mockHotSector])
    vi.spyOn(hotSectorService, 'getHotSectorByCode').mockReturnValue(mockHotSector)
    vi.spyOn(hotSectorService, 'addHotSectorStock').mockResolvedValue({
      success: true,
      data: mockStock,
    })
    vi.spyOn(hotSectorService, 'addHotSectorStocks').mockResolvedValue({
      success: true,
      data: { added: [mockStock], failed: [] },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  const renderApp = (initialEntries = ['/input']) =>
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <InputApp />
      </MemoryRouter>,
    )

  it('renders input dashboard', async () => {
    renderApp()

    await waitFor(() => {
      expect(screen.getByText('录入候选股票')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /仅录入$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /批量导入/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /热门板块/i })).toBeInTheDocument()
  })

  it('adds stock when clicking 仅录入', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))

    const codeInput = screen.getByPlaceholderText(/股票代码/)
    const nameInput = screen.getByPlaceholderText(/股票名称/)
    await userEvent.type(codeInput, '000001.SZ')
    await userEvent.type(nameInput, '平安银行')
    await userEvent.click(screen.getByRole('button', { name: /仅录入$/ }))

    await waitFor(() => {
      expect(inputService.addStock).toHaveBeenCalledWith(
        { symbol: '000001.SZ', name: '平安银行' },
        { fetchBasicAfterAdd: false, fetchKlineAfterAdd: false },
      )
    })
  })

  it('checks fetcher health when clicking 刷新', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))

    await userEvent.click(screen.getByRole('button', { name: /^刷新$/ }))

    await waitFor(() => {
      expect(fetcherService.checkFetcherHealth).toHaveBeenCalled()
      expect(screen.getAllByText('已连接').length).toBeGreaterThan(0)
    })
  })

  it('navigates to bulk import page and imports', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))

    await userEvent.click(screen.getByRole('button', { name: /批量导入/i }))

    await waitFor(() => {
      expect(screen.getByText('批量导入候选股票')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByPlaceholderText(/600519,贵州茅台/), '600519,贵州茅台')

    await waitFor(() => {
      expect(screen.getByText('600519.SH')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: /确认导入/i }))

    await waitFor(() => {
      expect(batchImportService.importStocks).toHaveBeenCalled()
    })
  })

  it('navigates to hot sector page and displays sectors', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))

    await userEvent.click(screen.getByRole('button', { name: /热门板块/i }))

    await waitFor(() => {
      expect(screen.getByText('热门板块推荐')).toBeInTheDocument()
      expect(screen.getByText('半导体')).toBeInTheDocument()
      expect(screen.getByText('比亚迪')).toBeInTheDocument()
    })
  })

  it('adds single hot sector stock', async () => {
    renderApp()
    await waitFor(() => screen.getByText('录入候选股票'))

    await userEvent.click(screen.getByRole('button', { name: /热门板块/i }))
    await waitFor(() => screen.getByText('比亚迪'))

    const addButtons = screen.getAllByRole('button', { name: /^加入候选池$/ })
    await userEvent.click(addButtons[0]!)

    await waitFor(() => {
      expect(hotSectorService.addHotSectorStock).toHaveBeenCalledWith(
        'semiconductor',
        '002594.SZ',
        { fetchBasicAfterAdd: false, group: undefined },
      )
    })
  })

  it('toggles list view', async () => {
    renderApp()
    await waitFor(() => screen.getByText('股票池看板'))

    await userEvent.click(screen.getByRole('button', { name: /列表视图/i }))

    await waitFor(() => {
      expect(screen.getByText('代码')).toBeInTheDocument()
    })
  })

  it('filters stocks by data quality', async () => {
    renderApp()
    await waitFor(() => screen.getByText('股票池看板'))

    const filterSelect = screen.getByLabelText('数据质量筛选')
    await userEvent.selectOptions(filterSelect, 'missingBasic')

    await waitFor(() => {
      expect(screen.queryByText('平安银行')).not.toBeInTheDocument()
      expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    })
  })

  it('bulk archives selected stocks', async () => {
    vi.spyOn(stockpoolService, 'transitionStock').mockResolvedValue({
      success: true,
      data: { ...mockStock, researchStatus: 'archived' } as never,
    })
    renderApp()
    await waitFor(() => screen.getByText('股票池看板'))

    await userEvent.click(screen.getByRole('button', { name: /列表视图/i }))
    await waitFor(() => screen.getByText('代码'))

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0]!)

    await userEvent.click(screen.getByRole('button', { name: /批量归档/i }))

    await waitFor(() => {
      expect(stockpoolService.transitionStock).toHaveBeenCalledWith('000001.SZ', 'archived')
    })
  })
})
