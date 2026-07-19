import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockSearch } from '@/components/organisms/input/StockSearch'
import { useToast } from '@/hooks/useToast'
import { useInputHubStore } from '@/store/inputHubStore'
import type { StockSearchResult } from '@/services/input/inputService'

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn(), toasts: [], dismiss: vi.fn() })),
}))

const mockSearchResults: StockSearchResult[] = [
  { symbol: '600519.SH', name: '贵州茅台', industry: 'SH' },
  { symbol: '000001.SZ', name: '平安银行', industry: 'SZ' },
  { symbol: '000858.SZ', name: '五粮液', industry: 'SZ' },
]

describe('StockSearch', () => {
  beforeEach(() => {
    // 依赖 store 的方法由组件通过 selector 读取，直接 spy store 避免模块加载顺序问题
    useInputHubStore.getState().reset()
    vi.spyOn(useInputHubStore.getState(), 'searchStocks').mockResolvedValue(mockSearchResults)
    vi.spyOn(useInputHubStore.getState(), 'addStockFromSearch').mockResolvedValue({
      success: true,
      data: { symbol: '600519.SH', name: '贵州茅台' } as never,
    })
  })

  it('renders search input', () => {
    render(<StockSearch onSelect={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('shows matching results when typing', async () => {
    render(<StockSearch onSelect={vi.fn()} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => {
      expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    })
    expect(screen.getByText('600519.SH')).toBeInTheDocument()
  })

  it('calls onSelect when clicking a result', async () => {
    const onSelect = vi.fn()
    render(<StockSearch onSelect={onSelect} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => screen.getByText('贵州茅台'))
    await userEvent.click(screen.getByText('贵州茅台'))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: '600519.SH', name: '贵州茅台' }),
    )
  })

  it('selects active result with Enter key', async () => {
    const onSelect = vi.fn()
    render(<StockSearch onSelect={onSelect} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => screen.getByText('贵州茅台'))
    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: '600519.SH', name: '贵州茅台' }),
    )
  })

  it('adds stock directly in add mode', async () => {
    const onAdded = vi.fn()
    render(<StockSearch mode="add" onAdded={onAdded} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => screen.getByText('贵州茅台'))
    await userEvent.click(screen.getByText('贵州茅台'))

    await waitFor(() => {
      expect(useInputHubStore.getState().addStockFromSearch).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: '600519.SH', name: '贵州茅台' }),
        { fetchBasicAfterAdd: false, fetchKlineAfterAdd: false },
      )
      expect(onAdded).toHaveBeenCalled()
    })
  })

  it('prevents replay when adding in add mode', async () => {
    vi.spyOn(useInputHubStore.getState(), 'addStockFromSearch').mockImplementation(
      async (_result: StockSearchResult, _options?: unknown) => {
        // 忠实模拟 store 真实行为：同步置位 isAddingStock，组件据此拦截重放
        useInputHubStore.setState({ isAddingStock: true })
        await new Promise((resolve) => setTimeout(resolve, 100))
        useInputHubStore.setState({ isAddingStock: false })
        return { success: true, data: {} as never }
      },
    )
    render(<StockSearch mode="add" />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => screen.getByText('贵州茅台'))
    const result = screen.getByText('贵州茅台')
    await userEvent.click(result)
    await userEvent.click(result)

    await waitFor(() => {
      expect(useInputHubStore.getState().addStockFromSearch).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error toast and keeps dropdown open when add fails', async () => {
    const toast = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast, toasts: [], dismiss: vi.fn() })
    vi.spyOn(useInputHubStore.getState(), 'addStockFromSearch').mockResolvedValue({
      success: false,
      error: '已存在',
    })

    render(<StockSearch mode="add" />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => screen.getByText('贵州茅台'))
    await userEvent.click(screen.getByText('贵州茅台'))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error', title: '录入失败' }),
      )
    })
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
  })
})
