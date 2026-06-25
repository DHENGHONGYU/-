import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MigrationPanel from '@/components/system/MigrationPanel'
import * as migrationService from '@/services/system/v6MigrationService'
import { db } from '@/data/db'

const sampleJson = {
  stocks: [{ symbol: '600519.SH', name: '贵州茅台', market: 'A股', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
  daily_quotes: [],
  v6_scores: [],
  orders: [],
  sector_scores: [],
  rotation_scores: [],
  score_docs: [],
  strategy_snapshots: [],
  local_docs: [],
  news: [],
  news_stock_map: [],
  sentiment_cache: [],
}

describe('MigrationPanel', () => {
  beforeEach(async () => {
    await db.init()
    await db.reset()
    vi.restoreAllMocks()
  })

  it('renders upload area', () => {
    render(<MigrationPanel />)
    expect(screen.getByText(/拖拽 JSON 文件/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /上传/i })).toBeInTheDocument()
  })

  it('parses uploaded JSON and switches to preview tab', async () => {
    const file = new File([JSON.stringify(sampleJson)], 'v6-export.json', { type: 'application/json' })
    render(<MigrationPanel />)

    const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /预览/i })).not.toBeDisabled()
    })
  })

  it('shows error for invalid JSON file', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    render(<MigrationPanel />)

    const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText(/解析失败/i)).toBeInTheDocument()
    })
  })

  it('calls runV6Migration when clicking 一键迁移', async () => {
    const runSpy = vi.spyOn(migrationService, 'runV6Migration').mockResolvedValue({
      success: true,
      data: {
        success: true,
        durationMs: 100,
        summary: { totalStores: 1, importedRecords: 1, skippedRecords: 0, failedRecords: 0 },
        details: [{ store: 'stocks', total: 1, success: 1, skipped: 0, failed: 0 }],
      },
    })

    const file = new File([JSON.stringify(sampleJson)], 'v6-export.json', { type: 'application/json' })
    render(<MigrationPanel />)

    const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一键迁移/i })).toBeEnabled()
    })

    await userEvent.click(screen.getByRole('button', { name: /一键迁移/i }))

    await waitFor(() => {
      expect(runSpy).toHaveBeenCalled()
    })
  })
})
