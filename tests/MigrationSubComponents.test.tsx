import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const {
  mockLogger,
} = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

import { MigrationUploadTab } from '@/components/organisms/system/migration/MigrationUploadTab'
import { MigrationPreviewTab } from '@/components/organisms/system/migration/MigrationPreviewTab'
import { MigrationReportTab } from '@/components/organisms/system/migration/MigrationReportTab'

describe('MigrationUploadTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload area with drop zone and input', () => {
    render(<MigrationUploadTab error="" onFileSelected={vi.fn()} />)
    
    expect(screen.getByText(/拖拽 JSON 文件到此处，或点击选择/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/上传 V6 导出 JSON/i)).toBeInTheDocument()
  })

  it('shows error message when error prop is provided', () => {
    render(<MigrationUploadTab error="解析失败：无效的 JSON" onFileSelected={vi.fn()} />)
    
    expect(screen.getByText('解析失败：无效的 JSON')).toBeInTheDocument()
  })

  it('calls onFileSelected when file is selected via input', async () => {
    const mockOnFileSelected = vi.fn()
    render(<MigrationUploadTab error="" onFileSelected={mockOnFileSelected} />)
    
    const file = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' })
    const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    
    expect(mockOnFileSelected).toHaveBeenCalledWith(file)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationUploadTab] File selected via input',
      expect.objectContaining({ fileName: 'test.json' })
    )
  })

  it('calls onFileSelected when file is dropped', async () => {
    const mockOnFileSelected = vi.fn()
    render(<MigrationUploadTab error="" onFileSelected={mockOnFileSelected} />)
    
    const file = new File(['{"test": "data"}'], 'test.json', { type: 'application/json' })
    const dropZone = screen.getByText(/拖拽 JSON 文件到此处，或点击选择/i).parentElement!
    
    await act(async () => {
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
        preventDefault: vi.fn(),
      })
    })
    
    expect(mockOnFileSelected).toHaveBeenCalledWith(file)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationUploadTab] File dropped',
      expect.objectContaining({ fileName: 'test.json' })
    )
  })

  
})

describe('MigrationPreviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockV6Export = {
    stocks: [{ symbol: '600519.SH', name: '贵州茅台' }],
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

  const mockV9Transformed = {
    stocks: [{ symbol: '600519.SH', name: '贵州茅台' }],
    dailyQuotes: [],
    v6Scores: [],
    scoreDocs: [],
    scoreDocsFromScores: [],
    orders: [],
    sectorScores: [],
    rotationScores: [],
    strategySnapshots: [],
    localDocs: [],
    news: [],
    newsStockMaps: [],
    sentimentCache: [],
  }

  const mockBackup = {
    data: { stocks: [] },
    createdAt: Date.now(),
    stores: 1,
    totalRecords: 0,
  }

  it('renders null when transformed is null', () => {
    const { container } = render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={null}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error=""
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('renders overview grids for V6 and V9 data', () => {
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error=""
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    expect(screen.getByText('V6 源数据概览')).toBeInTheDocument()
    expect(screen.getByText('V9 转换后概览')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('股票').length).toBeGreaterThan(0)
  })

  it('renders overview grid when v6Export is null', () => {
    render(
      <MigrationPreviewTab
        v6Export={null}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error=""
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    expect(screen.getByText('V9 转换后概览')).toBeInTheDocument()
    expect(screen.queryByText('V6 源数据概览')).not.toBeInTheDocument()
  })

  it('toggles overwrite checkbox', async () => {
    const mockOnOverwriteChange = vi.fn()
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={mockOnOverwriteChange}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error=""
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    
    expect(mockOnOverwriteChange).toHaveBeenCalledWith(true)
  })

  it('calls onImport when 执行导入 button is clicked', async () => {
    const mockOnImport = vi.fn()
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={mockOnImport}
        onRunMigration={vi.fn()}
        loading={false}
        error=""
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))
    
    expect(mockOnImport).toHaveBeenCalled()
  })

  it('calls onRunMigration when 一键迁移 button is clicked', async () => {
    const mockOnRunMigration = vi.fn()
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={mockOnRunMigration}
        loading={false}
        error=""
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    await userEvent.click(screen.getByRole('button', { name: /一键迁移/i }))
    
    expect(mockOnRunMigration).toHaveBeenCalled()
  })

  it('disables buttons when loading is true', () => {
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={true}
        error=""
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    expect(screen.getByRole('button', { name: /导入中/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /一键迁移/i })).toBeDisabled()
  })

  it('renders BackupBanner when backup exists', () => {
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error=""
        backup={mockBackup}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    expect(screen.getByText('已自动备份当前数据')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /下载备份文件/i })).toBeInTheDocument()
  })

  it('renders ErrorBanner when error exists', () => {
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error="导入失败：数据库错误"
        backup={null}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    expect(screen.getByText('导入失败：数据库错误')).toBeInTheDocument()
  })

  it('renders rollback button when error exists and backup exists', () => {
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error="导入失败"
        backup={mockBackup}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    expect(screen.getByRole('button', { name: /回滚到备份/i })).toBeInTheDocument()
  })

  it('does not render rollback button when rollbackStatus is done', () => {
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error="导入失败"
        backup={mockBackup}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="done"
      />
    )
    
    expect(screen.queryByRole('button', { name: /回滚到备份/i })).not.toBeInTheDocument()
  })

  it('shows "回滚中..." when rollbackStatus is rolling', () => {
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error="导入失败"
        backup={mockBackup}
        onDownloadBackup={vi.fn()}
        onRollback={vi.fn()}
        rollbackStatus="rolling"
      />
    )
    
    const rollbackButton = screen.getByRole('button', { name: /回滚中/i })
    expect(rollbackButton).toBeDisabled()
  })

  it('calls onDownloadBackup when download backup button is clicked', async () => {
    const mockOnDownloadBackup = vi.fn()
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error=""
        backup={mockBackup}
        onDownloadBackup={mockOnDownloadBackup}
        onRollback={vi.fn()}
        rollbackStatus="idle"
      />
    )
    
    await userEvent.click(screen.getByRole('button', { name: /下载备份文件/i }))
    
    expect(mockOnDownloadBackup).toHaveBeenCalled()
  })

  it('calls onRollback when rollback button is clicked', async () => {
    const mockOnRollback = vi.fn()
    render(
      <MigrationPreviewTab
        v6Export={mockV6Export}
        transformed={mockV9Transformed}
        overwrite={false}
        onOverwriteChange={vi.fn()}
        onImport={vi.fn()}
        onRunMigration={vi.fn()}
        loading={false}
        error="导入失败"
        backup={mockBackup}
        onDownloadBackup={vi.fn()}
        onRollback={mockOnRollback}
        rollbackStatus="idle"
      />
    )
    
    await userEvent.click(screen.getByRole('button', { name: /回滚到备份/i }))
    
    expect(mockOnRollback).toHaveBeenCalled()
  })
})

describe('MigrationReportTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockReport = {
    success: true,
    durationMs: 100,
    summary: {
      totalStores: 3,
      importedRecords: 100,
      skippedRecords: 5,
      failedRecords: 2,
    },
    details: [
      { store: 'stocks', total: 50, success: 48, skipped: 2, failed: 0 },
      { store: 'orders', total: 50, success: 50, skipped: 0, failed: 0 },
    ],
  }

  it('renders null when report is null', () => {
    const { container } = render(
      <MigrationReportTab
        report={null}
        onGenerateReport={vi.fn()}
        onReset={vi.fn()}
      />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('renders summary statistics when report is provided', () => {
    render(
      <MigrationReportTab
        report={mockReport}
        onGenerateReport={vi.fn().mockResolvedValue('')}
        onReset={vi.fn()}
      />
    )
    
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('存储区')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('成功')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('跳过')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('失败')).toBeInTheDocument()
  })

  it('calls onGenerateReport when report changes', async () => {
    const mockOnGenerateReport = vi.fn().mockResolvedValue('Test report content')
    render(
      <MigrationReportTab
        report={mockReport}
        onGenerateReport={mockOnGenerateReport}
        onReset={vi.fn()}
      />
    )
    
    await waitFor(() => {
      expect(mockOnGenerateReport).toHaveBeenCalledWith(mockReport)
    })
  })

  it('displays loading state while generating report', async () => {
    const mockOnGenerateReport = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('Content'), 100))
    )
    
    render(
      <MigrationReportTab
        report={mockReport}
        onGenerateReport={mockOnGenerateReport}
        onReset={vi.fn()}
      />
    )
    
    expect(screen.getByText('生成报告中...')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  it('calls onReset when 重新上传 button is clicked', async () => {
    const mockOnReset = vi.fn()
    render(
      <MigrationReportTab
        report={mockReport}
        onGenerateReport={vi.fn().mockResolvedValue('')}
        onReset={mockOnReset}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /重新上传/i })).toBeInTheDocument()
    })
    
    await userEvent.click(screen.getByRole('button', { name: /重新上传/i }))
    
    expect(mockOnReset).toHaveBeenCalled()
  })

  it('displays report text when generation completes', async () => {
    const mockReportText = JSON.stringify(mockReport, null, 2)
    const mockOnGenerateReport = vi.fn().mockResolvedValue(mockReportText)
    
    render(
      <MigrationReportTab
        report={mockReport}
        onGenerateReport={mockOnGenerateReport}
        onReset={vi.fn()}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText(/totalStores/i)).toBeInTheDocument()
    })
  })
})