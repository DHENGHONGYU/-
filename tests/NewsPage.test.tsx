import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { db } from '@/data/db'
import NewsPage from '@/pages/analysis/NewsPage'

describe('NewsPage', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })
  })

  it('renders empty state', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '智能资讯' })).toBeInTheDocument()
    expect(await screen.findByText('暂无资讯，点击生成模拟资讯')).toBeInTheDocument()
  })

  it('generates mock articles and displays cards', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /生成模拟资讯/i }))

    await waitFor(
      () => {
        expect(screen.queryByText('暂无资讯，点击生成模拟资讯')).not.toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    const cards = await screen.findAllByRole('button', { name: /(贵州茅台|比亚迪|银行板块|人工智能|宏观数据)/ })
    expect(cards.length).toBeGreaterThan(0)
  })

  it('filters by sentiment', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /生成模拟资讯/i }))
    await waitFor(
      () => {
        expect(screen.queryByText('暂无资讯，点击生成模拟资讯')).not.toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    const allCards = await screen.findAllByRole('button', { name: /(贵州茅台|比亚迪|银行板块|人工智能|宏观数据)/ })
    expect(allCards.length).toBe(5)

    await userEvent.selectOptions(screen.getByLabelText('情感'), 'negative')

    await waitFor(() => {
      const negativeCards = screen.getAllByRole('button', { name: /银行板块/ })
      expect(negativeCards.length).toBe(1)
    })
  })

  it('opens dialog with full content when clicking a card', async () => {
    render(
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /生成模拟资讯/i }))
    await waitFor(
      () => {
        expect(screen.queryByText('暂无资讯，点击生成模拟资讯')).not.toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    const card = await screen.findByRole('button', { name: /贵州茅台/ })
    await userEvent.click(card)

    const dialog = await screen.findByRole('dialog', {}, { timeout: 2000 })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('贵州茅台年报超预期，白酒板块强劲上涨')).toBeInTheDocument()
    expect(within(dialog).getByText(/600519贵州茅台发布年报/)).toBeInTheDocument()
  })
})
