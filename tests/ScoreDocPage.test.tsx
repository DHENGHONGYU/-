import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import userEvent from '@testing-library/user-event'
import { db } from '@/data/db'
import { saveScoreDoc } from '@/services/analysis/scoreDocService'
import ScoreDocPage from '@/pages/analysis/ScoreDocPage'
import type { Stock } from '@/data/types'

const mockStock: Stock = {
  symbol: '000001.SZ',
  name: '平安银行',
  researchStatus: 'candidate',
  source: 'manual',
  dataVersion: 1,
}

async function seedStock(): Promise<void> {
  await db.put('stocks', mockStock)
}

async function saveVersion(composite: number, versionScore: number): Promise<void> {
  await saveScoreDoc({
    symbol: mockStock.symbol,
    stockName: mockStock.name,
    composite,
    l3v: 3.5,
    layers: {
      L1: { score: versionScore, reason: '景气', weight: 0.2 },
    },
  })
}

describe('ScoreDocPage', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders empty state', () => {
    render(
      <MemoryRouter>
        <ScoreDocPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('请选择股票代码', { selector: 'p' })).toBeInTheDocument()
  })

  it('select a stock and save a score doc, then verify table shows version 1', async () => {
    await seedStock()
    await saveVersion(4.2, 4.0)

    render(
      <MemoryRouter>
        <ScoreDocPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /平安银行/ })).toBeInTheDocument()
    })

    await userEvent.selectOptions(screen.getByRole('combobox'), mockStock.symbol)

    await waitFor(() => {
      expect(screen.getByText('V1')).toBeInTheDocument()
    })
    expect(screen.getByText('4.20')).toBeInTheDocument()
    expect(screen.getByText('3.50')).toBeInTheDocument()
  })

  it('save two versions and verify version 2 appears', async () => {
    await seedStock()
    await saveVersion(4.0, 4.0)
    await saveVersion(4.5, 4.5)

    render(
      <MemoryRouter>
        <ScoreDocPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /平安银行/ })).toBeInTheDocument()
    })

    await userEvent.selectOptions(screen.getByRole('combobox'), mockStock.symbol)

    await waitFor(() => {
      expect(screen.getByText('V2')).toBeInTheDocument()
    })
    expect(screen.getByText('V1')).toBeInTheDocument()
    expect(screen.getByText('+0.50')).toBeInTheDocument()
  })

  it('renders download button for a saved version', async () => {
    await seedStock()
    await saveScoreDoc({
      symbol: mockStock.symbol,
      stockName: mockStock.name,
      composite: 4.2,
      l3v: 3.5,
      layers: {
        L1: { score: 4.0, reason: '景气', weight: 0.2 },
      },
      reportMd: '# 测试报告',
    })

    render(
      <MemoryRouter>
        <ScoreDocPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /平安银行/ })).toBeInTheDocument()
    })

    await userEvent.selectOptions(screen.getByRole('combobox'), mockStock.symbol)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下载 Markdown/ })).toBeInTheDocument()
    })
  })
})
