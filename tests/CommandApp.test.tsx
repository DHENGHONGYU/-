import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommandApp from '@/apps/command/CommandApp'
import * as systemService from '@/services/system/systemService'

describe('CommandApp', () => {
  beforeEach(() => {
    vi.spyOn(systemService, 'loadSystemStats').mockResolvedValue({
      success: true,
      data: { stocks: 12, orders: 3, scores: 8 },
    })
    vi.spyOn(systemService, 'resetAll').mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders action buttons', () => {
    render(<CommandApp />)
    expect(screen.getByRole('button', { name: /刷新统计/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重置数据/i })).toBeInTheDocument()
  })

  it('loads and displays stats when clicking 刷新统计', async () => {
    render(<CommandApp />)
    await userEvent.click(screen.getByRole('button', { name: /刷新统计/i }))

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })
    expect(screen.getByText('stocks')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
    expect(screen.getByText('scores')).toBeInTheDocument()
  })

  it('calls resetAll and refreshes stats when confirming reset', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<CommandApp />)
    await userEvent.click(screen.getByRole('button', { name: /刷新统计/i }))
    await waitFor(() => screen.getByText('12'))

    await userEvent.click(screen.getByRole('button', { name: /重置数据/i }))

    await waitFor(() => {
      expect(vi.mocked(systemService.resetAll)).toHaveBeenCalled()
      expect(vi.mocked(systemService.loadSystemStats)).toHaveBeenCalledTimes(2)
    })

    vi.unstubAllGlobals()
  })

  it('does not reset when user cancels', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))

    render(<CommandApp />)
    await userEvent.click(screen.getByRole('button', { name: /重置数据/i }))

    expect(vi.mocked(systemService.resetAll)).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('shows error message when stats loading fails', async () => {
    vi.spyOn(systemService, 'loadSystemStats').mockResolvedValue({
      success: false,
      error: '服务不可用',
    })

    render(<CommandApp />)
    await userEvent.click(screen.getByRole('button', { name: /刷新统计/i }))

    await waitFor(() => {
      expect(screen.getByText(/服务不可用/)).toBeInTheDocument()
    })
  })
})
