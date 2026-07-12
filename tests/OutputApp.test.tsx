import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import OutputApp from '@/apps/output/OutputApp'
import * as systemService from '@/services/system/systemService'

// 辅助函数：包裹组件提供 Router 上下文
const renderWithRouter = (ui: React.ReactElement, initialRoute = '/output/export') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      {ui}
    </MemoryRouter>
  )
}

describe('OutputApp', () => {
  beforeEach(() => {
    vi.spyOn(systemService, 'exportAll').mockResolvedValue({
      success: true,
      data: {
        stocks: [{ symbol: '000001.SZ' }],
        orders: [{ id: '1' }],
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders export button', () => {
    renderWithRouter(<OutputApp />)
    expect(screen.getByRole('button', { name: /导出全部数据/i })).toBeInTheDocument()
  })

  it('displays exported data after clicking export', async () => {
    renderWithRouter(<OutputApp />)
    await userEvent.click(screen.getByRole('button', { name: /导出全部数据/i }))

    await waitFor(() => {
      expect(screen.getByText(/000001.SZ/)).toBeInTheDocument()
    })
    expect(systemService.exportAll).toHaveBeenCalled()
  })

  it('shows error message when export fails', async () => {
    vi.spyOn(systemService, 'exportAll').mockResolvedValue({
      success: false,
      error: '导出失败',
    })

    renderWithRouter(<OutputApp />)
    await userEvent.click(screen.getByRole('button', { name: /导出全部数据/i }))

    await waitFor(() => {
      expect(screen.getByText(/导出失败/)).toBeInTheDocument()
    })
  })
})
