import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import MigrationPanel from '@/components/organisms/system/MigrationPanel'

// ══════════════════════════════════════════════════════════════
// vi.hoisted:确保 mock 引用在 vi.mock 提升前已就绪
// ══════════════════════════════════════════════════════════════
const {
  mockLogger,
  mockCallTool,
} = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  mockCallTool: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('@/mcp/bridge/mcpBridge', () => ({
  mcpBridge: {
    callTool: mockCallTool,
  },
}))

// ══════════════════════════════════════════════════════════════
// 测试数据
// ══════════════════════════════════════════════════════════════
const sampleJson = {
  stocks: [
    {
      symbol: '600519.SH',
      name: '贵州茅台',
      market: 'A股',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
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

const v6ExportMock = {
  stocks: sampleJson.stocks,
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

const v9TransformedMock = {
  stocks: sampleJson.stocks,
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

const migrationReportMock = {
  success: true,
  durationMs: 100,
  summary: {
    totalStores: 1,
    importedRecords: 1,
    skippedRecords: 0,
    failedRecords: 0,
  },
  details: [{ store: 'stocks', total: 1, success: 1, skipped: 0, failed: 0 }],
}

// ══════════════════════════════════════════════════════════════
// Setup
// ══════════════════════════════════════════════════════════════
beforeEach(() => {
  vi.clearAllMocks()
  mockCallTool.mockImplementation(async (_server: string, tool: string, args: Record<string, unknown>) => {
    switch (tool) {
      case 'parse_v6_export':
        return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
      case 'transform_v6_to_v9':
        return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
      case 'import_to_v9':
        return { content: [{ type: 'text' as const, text: JSON.stringify(migrationReportMock) }], isError: false }
      case 'run_v6_migration':
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: migrationReportMock }) }], isError: false }
      case 'generate_migration_report':
        return { content: [{ type: 'text' as const, text: typeof args.migrationReport === 'object' ? JSON.stringify(args.migrationReport, null, 2) : String(args.migrationReport) }], isError: false }
      case 'export_data':
        return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: {} }) }], isError: false }
      default:
        return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
    }
  })
})

function renderPage() {
  return render(
    <MemoryRouter>
      <MigrationPanel />
    </MemoryRouter>,
  )
}

/** 上传文件并等待预览 Tab 启用 */
async function uploadFile(json: unknown = sampleJson, fileName = 'v6-export.json') {
  const file = new File([JSON.stringify(json)], fileName, { type: 'application/json' })
  renderPage()
  const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
  await userEvent.upload(input, file)
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: /预览/i })).not.toBeDisabled()
  })
  return file
}

// ══════════════════════════════════════════════════════════════
// 测试套件
// ══════════════════════════════════════════════════════════════
describe('MigrationPanel', () => {
  // ──────────────────────────────────────────────────────────────
  // 用例 1:基础渲染
  // ──────────────────────────────────────────────────────────────
  it('renders upload area', () => {
    renderPage()
    expect(screen.getByText(/拖拽 JSON 文件/i)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /上传/i })).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 2:handleFile 成功路径 — 验证 4 处关键日志中的 2 处(start + 解析成功)
  // ──────────────────────────────────────────────────────────────
  it('parses uploaded JSON and switches to preview tab, logging handleFile/start and success', async () => {
    const file = await uploadFile()

    // 断言 1:handleFile/start 日志应被调用,携带 fileName/fileSize/fileType
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] handleFile/start',
      expect.objectContaining({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      }),
    )

    // 断言 2:文件解析成功日志应被调用,携带 v6/v9 数据计数
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] 文件解析成功',
      expect.objectContaining({
        fileName: file.name,
        v6Stocks: 1,
        v9Stocks: 1,
      }),
    )
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 3:handleFile 解析失败路径 — 验证 error 日志
  // ──────────────────────────────────────────────────────────────
  it('shows error for invalid JSON file and logs error', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    renderPage()

    const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText(/解析失败/i)).toBeInTheDocument()
    })

    // 断言:文件解析失败日志应被调用,携带 fileName 和 error
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MigrationPanel] 文件解析失败',
      expect.objectContaining({
        fileName: 'bad.json',
        error: expect.any(String),
      }),
    )

    // 断言:handleFile/start 仍应被调用一次
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] handleFile/start',
      expect.objectContaining({ fileName: 'bad.json' }),
    )
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 4:handleRunMigration 成功路径 — 验证 5 处日志中的 3 处
  // ──────────────────────────────────────────────────────────────
  it('calls runV6Migration when clicking 一键迁移 and logs start/response/complete', async () => {
    await uploadFile()

    await userEvent.click(screen.getByRole('button', { name: /一键迁移/i }))

    await waitFor(() => {
      expect(mockCallTool).toHaveBeenCalledWith('system', 'run_v6_migration', expect.anything(), expect.anything())
    })

    // 断言 1:handleRunMigration/start 日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] handleRunMigration/start',
      expect.objectContaining({
        hasRawJson: true,
        overwrite: false,
      }),
    )

    // 断言 2:runV6Migration/response 日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] runV6Migration/response',
      expect.objectContaining({
        success: true,
        hasData: true,
      }),
    )

    // 断言 3:快速迁移完成日志,携带 summary 字段
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] 快速迁移完成',
      expect.objectContaining({
        overwrite: false,
        importedRecords: 1,
        skippedRecords: 0,
        failedRecords: 0,
        totalStores: 1,
      }),
    )
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 5:handleRunMigration 失败响应路径 — 验证 warn 日志
  // ──────────────────────────────────────────────────────────────
  it('logs warn when runV6Migration returns success=false', async () => {
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'run_v6_migration':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: '迁移服务错误' }) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()
    await userEvent.click(screen.getByRole('button', { name: /一键迁移/i }))

    await waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[MigrationPanel] 快速迁移失败响应',
        expect.objectContaining({
          error: '迁移服务错误',
          overwrite: false,
        }),
      )
    })
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 6:handleRunMigration 异常路径 — 验证 error 日志
  // ──────────────────────────────────────────────────────────────
  it('logs error when runV6Migration throws', async () => {
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'run_v6_migration':
          throw new Error('Network crash')
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()
    await userEvent.click(screen.getByRole('button', { name: /一键迁移/i }))

    await waitFor(() => {
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[MigrationPanel] 快速迁移异常',
        expect.objectContaining({
          error: 'Network crash',
          overwrite: false,
        }),
      )
    })
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 7:handleImport 非覆盖路径 — 验证跳过备份日志 + 导入完成日志
  // ──────────────────────────────────────────────────────────────
  it('handleImport with overwrite=false skips backup and logs importToV9/start + complete', async () => {
    await uploadFile()

    // overwrite=false(默认),直接点击执行导入
    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    await waitFor(() => {
      expect(mockCallTool).toHaveBeenCalledWith('system', 'import_to_v9', expect.anything(), expect.anything())
    })

    // 断言 1:handleImport/start 日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] handleImport/start',
      expect.objectContaining({
        overwrite: false,
        hasTransformed: true,
        stocksCount: 1,
      }),
    )

    // 断言 2:overwrite=false 跳过备份日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] overwrite=false,跳过备份直接导入',
    )

    // 断言 3:importToV9/start 日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] importToV9/start',
      expect.objectContaining({
        overwrite: false,
        stocksCount: 1,
        hasBackup: false,
      }),
    )

    // 断言 4:导入完成日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] 导入完成',
      expect.objectContaining({
        overwrite: false,
        importedRecords: 1,
        skippedRecords: 0,
        failedRecords: 0,
        totalStores: 1,
        backupCreated: false,
      }),
    )

    // 断言 5:export_data 不应被调用(overwrite=false)
    expect(mockCallTool).not.toHaveBeenCalledWith('system', 'export_data', expect.anything(), expect.anything())
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 8:handleImport 覆盖路径 — 用户取消,验证取消日志
  // ──────────────────────────────────────────────────────────────
  it('handleImport with overwrite=true: user cancels confirm, logs cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await uploadFile()

    // 勾选"覆盖已存在数据"
    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)
    expect(overwriteCheckbox.checked).toBe(true)

    // 点击执行导入
    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    await waitFor(() => {
      // 断言:用户取消覆盖式导入日志
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] 用户取消覆盖式导入',
      )
    })

    // 断言:export_data 不应被调用(用户取消)
    expect(mockCallTool).not.toHaveBeenCalledWith('system', 'export_data', expect.anything())

    // 断言:handleImport/start 和"触发二次确认"日志应被调用
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] handleImport/start',
      expect.objectContaining({ overwrite: true }),
    )
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] overwrite=true,触发二次确认对话框',
    )

    confirmSpy.mockRestore()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 9:handleImport 覆盖路径 — 备份成功,验证备份完成日志
  // ──────────────────────────────────────────────────────────────
  it('handleImport with overwrite=true: backup succeeds, logs backup complete + exportAll', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    // mock export_data 返回成功
    const backupData = {
      stocks: [{ symbol: '000001.SH', name: '上证指数' }],
      orders: [{ id: 'old-1' }],
    }
    mockCallTool.mockImplementation(async (_server: string, tool: string, args: Record<string, unknown>) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'export_data':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: backupData }) }], isError: false }
        case 'import_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(migrationReportMock) }], isError: false }
        case 'generate_migration_report':
          return { content: [{ type: 'text' as const, text: JSON.stringify(args.migrationReport, null, 2) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()

    // 勾选覆盖
    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)

    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    await waitFor(() => {
      // 断言 1:用户确认覆盖式导入日志
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] 用户确认覆盖式导入,开始备份',
      )
    })

    await waitFor(() => {
      // 断言 2:exportAll/start 日志
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] exportAll/start',
      )
    })

    await waitFor(() => {
      // 断言 3:exportAll/response 日志,携带 success/hasData/error
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] exportAll/response',
        expect.objectContaining({
          success: true,
          hasData: true,
          error: undefined,
        }),
      )
    })

    await waitFor(() => {
      // 断言 4:备份完成日志,携带 stores/totalRecords/storeNames
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] 备份完成',
        expect.objectContaining({
          stores: 2,
          totalRecords: 2,
          storeNames: expect.arrayContaining(['stocks', 'orders']),
        }),
      )
    })

    await waitFor(() => {
      // 断言 5:导入完成日志,backupCreated=true
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] 导入完成',
        expect.objectContaining({
          overwrite: true,
          backupCreated: true,
        }),
      )
    })

    confirmSpy.mockRestore()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 10:handleImport 覆盖路径 — 备份失败,验证中止日志
  // ──────────────────────────────────────────────────────────────
  it('handleImport with overwrite=true: backup fails, logs error and aborts', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'export_data':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: '数据库读取失败' }) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()

    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)

    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    await waitFor(() => {
      expect(screen.getByText(/备份失败/i)).toBeInTheDocument()
    })

    // 断言:备份失败,中止导入日志
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MigrationPanel] 备份失败,中止导入',
      expect.objectContaining({
        error: '数据库读取失败',
      }),
    )

    // 断言:import_to_v9 不应被调用(已中止)
    expect(mockCallTool).not.toHaveBeenCalledWith('system', 'import_to_v9', expect.anything())

    confirmSpy.mockRestore()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 11:handleImport 覆盖路径 — 备份异常,验证异常日志
  // ──────────────────────────────────────────────────────────────
  it('handleImport with overwrite=true: backup throws, logs exception', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'export_data':
          throw new Error('IndexedDB 连接断开')
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()

    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)

    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    await waitFor(() => {
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[MigrationPanel] 备份异常',
        expect.objectContaining({
          error: 'IndexedDB 连接断开',
        }),
      )
    })

    confirmSpy.mockRestore()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 12:handleImport 异常路径 — importToV9 抛出异常,验证导入失败日志
  // ──────────────────────────────────────────────────────────────
  it('handleImport: importToV9 throws, logs 导入失败', async () => {
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'import_to_v9':
          throw new Error('写入失败')
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()

    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    await waitFor(() => {
      expect(screen.getByText(/导入失败/i)).toBeInTheDocument()
    })

    // 断言:导入失败日志
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MigrationPanel] 导入失败',
      expect.objectContaining({
        error: '写入失败',
        overwrite: false,
        hasBackup: false,
      }),
    )
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 13:handleDownloadBackup — 验证下载备份日志
  // ──────────────────────────────────────────────────────────────
  it('handleDownloadBackup: logs start and downloaded', async () => {
    // 通过覆盖式导入成功路径触发备份,然后点击下载备份按钮
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const backupData = { stocks: [{ symbol: 'X' }] }
    mockCallTool.mockImplementation(async (_server: string, tool: string, args: Record<string, unknown>) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'export_data':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: backupData }) }], isError: false }
        case 'import_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(migrationReportMock) }], isError: false }
        case 'generate_migration_report':
          return { content: [{ type: 'text' as const, text: JSON.stringify(args.migrationReport, null, 2) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    // jsdom 不提供 URL.createObjectURL,用 defineProperty 直接注入 mock
    // (vi.spyOn 要求属性已存在,会抛 "createObjectURL does not exist")
    const createObjectURLMock = vi.fn(() => 'blob:fake-url')
    const revokeObjectURLMock = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await uploadFile()

    // 勾选覆盖并导入,触发备份
    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    // 导入完成后页面会切换到"报告"Tab,需要切回"预览"Tab 才能看到下载备份按钮
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /报告/i })).toHaveAttribute('aria-selected', 'true')
    })
    await userEvent.click(screen.getByRole('tab', { name: /预览/i }))

    // 等待下载备份按钮出现
    const downloadButton = await screen.findByRole('button', { name: /下载备份文件/i })
    await userEvent.click(downloadButton)

    await waitFor(() => {
      // 断言 1:handleDownloadBackup/start 日志
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] handleDownloadBackup/start',
        expect.objectContaining({
          stores: 1,
          totalRecords: 1,
        }),
      )
    })

    await waitFor(() => {
      // 断言 2:备份已下载日志
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] 备份已下载',
        expect.objectContaining({
          stores: 1,
          totalRecords: 1,
          blobSize: expect.any(Number),
        }),
      )
    })

    confirmSpy.mockRestore()
    clickSpy.mockRestore()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 14:handleRollback — 验证回滚日志(warn + info×2)
  // ──────────────────────────────────────────────────────────────
  it('handleRollback: logs warn start + trigger download + complete', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const backupData = { stocks: [{ symbol: 'X' }] }
    
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'export_data':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: backupData }) }], isError: false }
        case 'import_to_v9':
          throw new Error('写入失败')
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    // jsdom 不提供 URL.createObjectURL,用 defineProperty 直接注入 mock
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:fake-url'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await uploadFile()

    // 勾选覆盖并导入,触发备份 + 导入失败
    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    // 等待错误展示,回滚按钮出现
    const rollbackButton = await screen.findByRole('button', { name: /回滚到备份/i })
    await userEvent.click(rollbackButton)

    await waitFor(() => {
      // 断言 1:handleRollback/start 日志(warn 级别)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[MigrationPanel] handleRollback/start',
        expect.objectContaining({
          backupStores: 1,
          backupTotalRecords: 1,
        }),
      )
    })

    // 断言 2:触发备份下载以供手动恢复 日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] 触发备份下载以供手动恢复',
    )

    // 断言 3:handleRollback/complete 日志
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] handleRollback/complete',
      expect.objectContaining({
        rollbackStatus: 'done',
        message: '已下载备份文件,等待用户手动恢复',
      }),
    )

    confirmSpy.mockRestore()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 15:FileReader.onerror 触发 — 验证文件读取失败日志
  // 覆盖分支:reader.onerror 回调(L82-89)
  // ──────────────────────────────────────────────────────────────
  it('FileReader.onerror: logs error when file read fails', async () => {
    const OriginalFileReader = global.FileReader

    // mock FileReader:readAsText 同步触发 onerror 而非 onload
    class MockFileReader {
      onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null
      result: string | ArrayBuffer | null = null
      readAsText(): void {
        if (this.onerror) {
          this.onerror({} as ProgressEvent<FileReader>)
        }
      }
    }

    global.FileReader = MockFileReader as unknown as typeof FileReader

    const file = new File(['{"test":1}'], 'error.json', { type: 'application/json' })
    renderPage()
    const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText(/读取文件失败/i)).toBeInTheDocument()
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MigrationPanel] 文件读取失败',
      expect.objectContaining({
        fileName: 'error.json',
        error: 'FileReader.onerror triggered',
      }),
    )

    global.FileReader = OriginalFileReader
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 16:handleImport 覆盖路径 — 备份失败响应且无 error 字段
  // 覆盖分支:backupResult.error ?? '未知错误'(L164)的 ?? false 分支
  // ──────────────────────────────────────────────────────────────
  it('handleImport with overwrite=true: backup fails without error field, uses 未知错误', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    // success=false 且无 error 字段,触发 ?? '未知错误'
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'export_data':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false }) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()

    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    await waitFor(() => {
      expect(screen.getByText(/备份失败.*未知错误/i)).toBeInTheDocument()
    })

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MigrationPanel] 备份失败,中止导入',
      expect.objectContaining({
        error: '未知错误',
      }),
    )

    // import_to_v9 不应被调用(已中止)
    expect(mockCallTool).not.toHaveBeenCalledWith('system', 'import_to_v9', expect.anything())
    confirmSpy.mockRestore()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 17:handleRunMigration — 失败响应且无 error 字段
  // 覆盖分支:result.error ?? '迁移失败'(L299)的 ?? false 分支
  // ──────────────────────────────────────────────────────────────
  it('handleRunMigration: returns success=false without error, uses 迁移失败', async () => {
    // success=false 且无 error 字段,触发 ?? '迁移失败'
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'run_v6_migration':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: false }) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()
    await userEvent.click(screen.getByRole('button', { name: /一键迁移/i }))

    await waitFor(() => {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[MigrationPanel] 快速迁移失败响应',
        expect.objectContaining({
          error: '迁移失败',
          overwrite: false,
        }),
      )
    })

    // 错误展示应包含"迁移失败"
    expect(screen.getByText('迁移失败')).toBeInTheDocument()
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 18:handleFile 解析抛出非 Error 对象
  // 覆盖分支:err instanceof Error ? ... 的 false 分支(L70 message + L77 stack)
  // ──────────────────────────────────────────────────────────────
  it('handleFile: parseV6Export throws non-Error, logs String(err) and stack undefined', async () => {
    // 抛出字符串而非 Error,触发 err instanceof Error 的 false 分支
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          throw 'parse error string'
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    const file = new File([JSON.stringify(sampleJson)], 'v6.json', { type: 'application/json' })
    renderPage()
    const input = screen.getByLabelText(/上传 V6 导出 JSON/i) as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText(/解析失败：parse error string/i)).toBeInTheDocument()
    })

    // 断言:error 字段为 String(err),stack 字段为 undefined
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[MigrationPanel] 文件解析失败',
      expect.objectContaining({
        fileName: 'v6.json',
        error: 'parse error string',
        stack: undefined,
      }),
    )
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 19:v6Export 字段为 undefined
  // 覆盖分支:v6Export.stocks?.length ?? 0 等多个 ?. 和 ?? 的 false 分支(L64-65, L322-333)
  // ──────────────────────────────────────────────────────────────
  it('handleFile: v6Export with undefined fields covers ?.length ?? 0 false branches', async () => {
    // 所有字段为 undefined,触发 ?. 和 ?? 的 false 分支
    const v6ExportWithUndefined = {
      stocks: undefined,
      daily_quotes: undefined,
      v6_scores: undefined,
      orders: undefined,
      sector_scores: undefined,
      rotation_scores: undefined,
      score_docs: undefined,
      strategy_snapshots: undefined,
      local_docs: undefined,
      news: undefined,
      news_stock_map: undefined,
      sentiment_cache: undefined,
    }
    mockCallTool.mockImplementation(async (_server: string, tool: string) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportWithUndefined) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()

    // 断言:解析成功日志,v6Stocks 和 v6Orders 都为 0(因字段 undefined,?.length ?? 0 = 0)
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[MigrationPanel] 文件解析成功',
      expect.objectContaining({
        v6Stocks: 0,
        v6Orders: 0,
      }),
    )
  })

  // ──────────────────────────────────────────────────────────────
  // 用例 20:handleImport 备份 — backupData 包含 undefined 的 store
  // 覆盖分支:backupData[store]?.length ?? 0(L148)的 ?. 和 ?? false 分支
  // ──────────────────────────────────────────────────────────────
  it('handleImport with overwrite=true: backupData with undefined store value covers ?.length ?? 0', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    // backupData 中 emptyStore 的值为 null,触发 backupData[store]?.length 的 ?. false 分支
    const backupData = {
      stocks: [{ symbol: 'X' }],
      emptyStore: null,
    }
    mockCallTool.mockImplementation(async (_server: string, tool: string, args: Record<string, unknown>) => {
      switch (tool) {
        case 'parse_v6_export':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v6ExportMock) }], isError: false }
        case 'transform_v6_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(v9TransformedMock) }], isError: false }
        case 'export_data':
          return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: backupData }) }], isError: false }
        case 'import_to_v9':
          return { content: [{ type: 'text' as const, text: JSON.stringify(migrationReportMock) }], isError: false }
        case 'generate_migration_report':
          return { content: [{ type: 'text' as const, text: JSON.stringify(args.migrationReport, null, 2) }], isError: false }
        default:
          return { content: [{ type: 'text' as const, text: '{}' }], isError: false }
      }
    })

    await uploadFile()

    const overwriteCheckbox = screen.getByRole('checkbox') as HTMLInputElement
    await userEvent.click(overwriteCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /执行导入/i }))

    // 断言:备份完成日志
    // - stores=2(stocks + emptyStore 两个 key)
    // - totalRecords=1(只有 stocks 有 1 条,emptyStore 为 undefined → 0)
    await waitFor(() => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[MigrationPanel] 备份完成',
        expect.objectContaining({
          stores: 2,
          totalRecords: 1,
        }),
      )
    })

    confirmSpy.mockRestore()
  })
})
