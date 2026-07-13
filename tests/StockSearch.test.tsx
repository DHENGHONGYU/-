import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockSearch } from '@/components/organisms/input/StockSearch'
import * as inputService from '@/services/input/inputService'
import { useToast } from '@/hooks/useToast'
import { useInputHubStore } from '@/store/inputHubStore'

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

describe('StockSearch', () => {
  beforeEach(() => {
    // 重置输入舱 store，避免上一条用例的 isAddingStock 状态（prevents replay 用例含 100ms 延时 mock）泄漏到后续用例，导致搜索被禁用
    useInputHubStore.getState().reset()
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
    await userEvent.type(input, '银行')

    await waitFor(() => screen.getByText('平安银行'))
    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: '000001.SZ', name: '平安银行' }),
    )
  })

  it('adds stock directly in add mode', async () => {
    vi.spyOn(inputService, 'addStockFromSearch').mockResolvedValue({
      success: true,
      data: { symbol: '600519.SH', name: '贵州茅台' } as never,
    })
    const onAdded = vi.fn()
    render(<StockSearch mode="add" onAdded={onAdded} />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => screen.getByText('贵州茅台'))
    await userEvent.click(screen.getByText('贵州茅台'))

    await waitFor(() => {
      expect(inputService.addStockFromSearch).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: '600519.SH', name: '贵州茅台' }),
        { fetchBasicAfterAdd: false, fetchKlineAfterAdd: false },
      )
      expect(onAdded).toHaveBeenCalled()
    })
  })

  it('prevents replay when adding in add mode', async () => {
    vi.spyOn(inputService, 'addStockFromSearch').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: {} as never }), 100)),
    )
    render(<StockSearch mode="add" />)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, '茅台')

    await waitFor(() => screen.getByText('贵州茅台'))
    const result = screen.getByText('贵州茅台')
    await userEvent.click(result)
    await userEvent.click(result)

    await waitFor(() => {
      expect(inputService.addStockFromSearch).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error toast and keeps dropdown open when add fails', async () => {
    const toast = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast, toasts: [], dismiss: vi.fn() })
    vi.spyOn(inputService, 'addStockFromSearch').mockResolvedValue({
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
