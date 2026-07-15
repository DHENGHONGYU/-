import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================================
// Mock: batchImportService
// ============================================================
const mockParseBulkInput = vi.fn()
const mockImportStocksWithProgress = vi.fn()
const mockDetectDuplicates = vi.fn()
vi.mock('@/services/input/batchImportService', () => ({
  parseBulkInput: (...args: unknown[]) => mockParseBulkInput(...args),
  importStocksWithProgress: (...args: unknown[]) => mockImportStocksWithProgress(...args),
  detectDuplicates: (...args: unknown[]) => mockDetectDuplicates(...args),
}))

// ============================================================
// Mock: intentionPoolStore
// ============================================================
interface IntentionPoolItem {
  symbol: string
  name: string
  group?: string
  pool?: string
  status?: string
}
const intentionPoolState: {
  items: IntentionPoolItem[]
  loading: boolean
  refresh: ReturnType<typeof vi.fn>
} = {
  items: [],
  loading: false,
  refresh: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/store/intentionPoolStore', () => ({
  useIntentionPoolStore: (selector: (state: typeof intentionPoolState) => unknown) =>
    selector(intentionPoolState),
  getIntentionPoolGroups: () => {
    const groups = new Set(intentionPoolState.items.map((s) => s.group ?? '默认'))
    groups.add('自选')
    return Array.from(groups).sort()
  },
}))

// 延迟导入被测组件，确保 mock 先注册
const BulkImportPanel = (await import('@/apps/input/BulkImportPanel')).default

// ============================================================
// 测试套件
// ============================================================
describe('BulkImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    intentionPoolState.refresh.mockResolvedValue(undefined)
    intentionPoolState.items = []
    mockParseBulkInput.mockReturnValue([])
    mockDetectDuplicates.mockImplementation((rows: unknown[]) =>
      rows.map((r) => ({ ...(r as Record<string, unknown>), status: 'valid' })),
    )
    mockImportStocksWithProgress.mockResolvedValue({
      success: true,
      data: { success: 0, failed: 0, errors: [] },
    })
  })

  // ----------------------------------------------------------
  // 初始化逻辑
  // ----------------------------------------------------------
  it('calls refresh on mount to load pool data', async () => {
    render(<BulkImportPanel />)

    await waitFor(() => {
      expect(intentionPoolState.refresh).toHaveBeenCalledTimes(1)
    })
  })

  // ----------------------------------------------------------
  // 基本渲染
  // ----------------------------------------------------------
  it('renders panel title and import textarea', async () => {
    render(<BulkImportPanel />)

    expect(screen.getByText('批量导入候选股票')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/600519\.SH,贵州茅台/)).toBeInTheDocument()
  })

  it('renders target group select with allGroups options', async () => {
    render(<BulkImportPanel />)

    expect(screen.getByLabelText('批量导入目标分组')).toBeInTheDocument()
    expect(screen.getByText('默认分组')).toBeInTheDocument()
    expect(screen.getByText('自选')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 解析功能
  // ----------------------------------------------------------
  it('calls parseBulkInput when text is entered', async () => {
    const user = userEvent.setup()
    mockParseBulkInput.mockReturnValue([
      { code: '600519', name: '贵州茅台', symbol: '600519.SH' },
    ])

    render(<BulkImportPanel />)

    const textarea = screen.getByPlaceholderText(/600519\.SH,贵州茅台/)
    await user.type(textarea, '600519,贵州茅台')

    expect(mockParseBulkInput).toHaveBeenCalledWith('600519,贵州茅台')
  })

  it('shows preview table after parsing', async () => {
    const user = userEvent.setup()
    mockParseBulkInput.mockReturnValue([
      { code: '600519', name: '贵州茅台', symbol: '600519.SH' },
      { code: '000001', name: '平安银行', symbol: '000001.SZ' },
    ])

    render(<BulkImportPanel />)

    const textarea = screen.getByPlaceholderText(/600519\.SH,贵州茅台/)
    await user.type(textarea, '600519,贵州茅台\n000001,平安银行')

    await waitFor(() => {
      expect(screen.getByText('600519.SH')).toBeInTheDocument()
      expect(screen.getByText('000001.SZ')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------
  // 导入功能
  // ----------------------------------------------------------
  it('calls importStocks when confirm button is clicked', async () => {
    const user = userEvent.setup()
    mockParseBulkInput.mockReturnValue([
      { code: '600519', name: '贵州茅台', symbol: '600519.SH' },
    ])
    mockImportStocksWithProgress.mockResolvedValue({
      success: true,
      data: { success: 1, failed: 0, errors: [] },
    })

    render(<BulkImportPanel />)

    const textarea = screen.getByPlaceholderText(/600519\.SH,贵州茅台/)
    await user.type(textarea, '600519,贵州茅台')

    const confirmButton = screen.getByRole('button', { name: /确认导入/ })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockImportStocksWithProgress).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ code: '600519', name: '贵州茅台', symbol: '600519.SH', status: 'valid' }),
        ]),
        expect.objectContaining({ fetchBasicAfterAdd: false }),
        expect.any(Function),
      )
    })
  })

  it('calls refresh after successful import', async () => {
    const user = userEvent.setup()
    mockParseBulkInput.mockReturnValue([
      { code: '600519', name: '贵州茅台', symbol: '600519.SH' },
    ])
    mockImportStocksWithProgress.mockResolvedValue({
      success: true,
      data: { success: 1, failed: 0, errors: [] },
    })

    render(<BulkImportPanel />)

    const textarea = screen.getByPlaceholderText(/600519\.SH,贵州茅台/)
    await user.type(textarea, '600519,贵州茅台')

    const confirmButton = screen.getByRole('button', { name: /确认导入/ })
    await user.click(confirmButton)

    await waitFor(() => {
      // 初始化调用 1 次 + 导入成功后调用 1 次 = 2 次
      expect(intentionPoolState.refresh).toHaveBeenCalledTimes(2)
    })
  })

  it('shows success message after import', async () => {
    const user = userEvent.setup()
    mockParseBulkInput.mockReturnValue([
      { code: '600519', name: '贵州茅台', symbol: '600519.SH' },
    ])
    mockImportStocksWithProgress.mockResolvedValue({
      success: true,
      data: { success: 1, failed: 0, errors: [] },
    })

    render(<BulkImportPanel />)

    const textarea = screen.getByPlaceholderText(/600519\.SH,贵州茅台/)
    await user.type(textarea, '600519,贵州茅台')

    const confirmButton = screen.getByRole('button', { name: /确认导入/ })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(/导入完成/)).toBeInTheDocument()
      expect(screen.getByText(/成功 1 条/)).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------
  // 错误处理
  // ----------------------------------------------------------
  it('shows error message when import fails', async () => {
    const user = userEvent.setup()
    mockParseBulkInput.mockReturnValue([
      { code: '600519', name: '贵州茅台', symbol: '600519.SH' },
    ])
    mockImportStocksWithProgress.mockResolvedValue({
      success: false,
      error: '数据库写入失败',
    })

    render(<BulkImportPanel />)

    const textarea = screen.getByPlaceholderText(/600519\.SH,贵州茅台/)
    await user.type(textarea, '600519,贵州茅台')

    const confirmButton = screen.getByRole('button', { name: /确认导入/ })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText('数据库写入失败')).toBeInTheDocument()
    })
  })

  it('disables confirm button when no valid stocks parsed', async () => {
    const user = userEvent.setup()
    mockParseBulkInput.mockReturnValue([])

    render(<BulkImportPanel />)

    const textarea = screen.getByPlaceholderText(/600519\.SH,贵州茅台/)
    await user.type(textarea, 'invalid text')

    const confirmButton = screen.getByRole('button', { name: /确认导入/ })
    expect(confirmButton).toBeDisabled()
    expect(confirmButton).toHaveTextContent('确认导入')
  })
})
