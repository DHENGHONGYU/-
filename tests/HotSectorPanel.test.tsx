import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_HOT_SECTORS } from './helpers/widget-test.utils'
import { UI_TEXT } from '@/constants/uiText'

// ============================================================
// Mock: hotSectorService
// ============================================================
const mockAddHotSectorStock = vi.fn()
const mockAddHotSectorStocks = vi.fn()
vi.mock('@/services/input/hotSectorService', () => ({
  getHotSectors: async () => DEFAULT_HOT_SECTORS,
  getHotSectorByCode: async (code: string) => DEFAULT_HOT_SECTORS.find((s) => s.code === code) ?? null,
  addHotSectorStock: (...args: unknown[]) => mockAddHotSectorStock(...args),
  addHotSectorStocks: (...args: unknown[]) => mockAddHotSectorStocks(...args),
}))

// ============================================================
// Mock: intentionPoolStore
// ============================================================
// 使用可变 store，避免 vi.clearAllMocks 清空 mockReturnValue 后同步测试拿不到值
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

// ============================================================
// Mock: useToast
// ============================================================
const mockToast = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

// 延迟导入被测组件，确保 mock 先注册
const HotSectorPanel = (await import('@/apps/input/HotSectorSection')).default

// ============================================================
// 测试辅助函数
// ============================================================
function setupPoolStore(stocks: Array<{ symbol: string; name: string; group?: string }> = []) {
  intentionPoolState.items = stocks.map((s) => ({
    ...s,
    pool: 'intention',
    status: 'candidate',
  }))
}

/** 等待组件初始化动画（300ms setTimeout）完成，sector 卡片渲染出来 */
async function waitForLoadingToFinish() {
  await waitFor(() => {
    expect(screen.getByText('半导体')).toBeInTheDocument()
  }, { timeout: 2000 })
}

// ============================================================
// 测试套件
// ============================================================
describe('HotSectorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddHotSectorStock.mockResolvedValue({ success: true, data: undefined })
    mockAddHotSectorStocks.mockResolvedValue({
      success: true,
      data: { added: ['600519.SH', '000001.SZ'], failed: [] },
    })
    intentionPoolState.refresh.mockResolvedValue(undefined)
    setupPoolStore()
  })

  // ----------------------------------------------------------
  // 初始化逻辑
  // ----------------------------------------------------------
  it('calls refresh on mount to load pool data', async () => {
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    expect(intentionPoolState.refresh).toHaveBeenCalledTimes(1)
  })

  // ----------------------------------------------------------
  // 基本渲染
  // ----------------------------------------------------------

  it('renders score badge for each sector', async () => {
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('76')).toBeInTheDocument()
    expect(screen.getByText('71')).toBeInTheDocument()
  })

  it('renders factor labels for each sector', async () => {
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    expect(screen.getByText(/动量 85/)).toBeInTheDocument()
    expect(screen.getByText(/资金 78/)).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 加载状态
  // ----------------------------------------------------------
  it('renders sector cards after initialization', async () => {
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    // 初始化完成后应显示板块卡片
    expect(screen.getByText('半导体')).toBeInTheDocument()
    expect(screen.getByText('人工智能')).toBeInTheDocument()
    expect(screen.getByText('新能源')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 板块选择交互
  // ----------------------------------------------------------
  it('selects a sector and shows its stocks when clicked', async () => {
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    // 默认选中第一个板块（半导体），应直接显示关联股票
    expect(screen.getByText('贵州茅台')).toBeInTheDocument()
    expect(screen.getByText('平安银行')).toBeInTheDocument()
    expect(screen.getByText('宁德时代')).toBeInTheDocument()

    await user.click(screen.getByText('人工智能'))

    expect(screen.getByText('科大讯飞')).toBeInTheDocument()
    expect(screen.getByText('寒武纪')).toBeInTheDocument()
    expect(screen.getByText('昆仑万维')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 分组选择器
  // ----------------------------------------------------------
  it('renders target group select with allGroups options', async () => {
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    expect(screen.getByLabelText('热门板块目标分组')).toBeInTheDocument()
    expect(screen.getByText(UI_TEXT.errors.defaultGroup)).toBeInTheDocument()
    expect(screen.getByText('自选')).toBeInTheDocument()
  })

  it('passes selected target group to addHotSectorStock', async () => {
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const select = screen.getByLabelText('热门板块目标分组')
    await user.selectOptions(select, '自选')

    const addButtons = screen.getAllByRole('button', { name: '加入意向候选池' })
    await user.click(addButtons[0]!)

    await waitFor(() => {
      expect(mockAddHotSectorStock).toHaveBeenCalledWith(
        'semiconductor',
        '600519.SH',
        expect.objectContaining({ fetchBasicAfterAdd: false, group: '自选' }),
      )
    })
  })

  // ----------------------------------------------------------
  // 单只加入意向候选池
  // ----------------------------------------------------------
  it('calls addHotSectorStock when "加入意向候选池" button is clicked', async () => {
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const addButtons = screen.getAllByRole('button', { name: '加入意向候选池' })
    await user.click(addButtons[0]!)

    await waitFor(() => {
      expect(mockAddHotSectorStock).toHaveBeenCalledWith(
        'semiconductor',
        '600519.SH',
        expect.objectContaining({ fetchBasicAfterAdd: false }),
      )
    })
  })

  it('shows success message after adding a stock', async () => {
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const addButtons = screen.getAllByRole('button', { name: '加入意向候选池' })
    await user.click(addButtons[0]!)

    await waitFor(() => {
      expect(screen.getByText('已将 600519.SH 加入意向候选池')).toBeInTheDocument()
    })
  })

  it('shows error message when addHotSectorStock fails', async () => {
    mockAddHotSectorStock.mockResolvedValue({ success: false, error: '股票已存在' })
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const addButtons = screen.getAllByRole('button', { name: '加入意向候选池' })
    await user.click(addButtons[0]!)

    await waitFor(() => {
      expect(screen.getByText('股票已存在')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------
  // 批量加入意向候选池
  // ----------------------------------------------------------
  it('calls addHotSectorStocks when "全部加入意向候选池" button is clicked', async () => {
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const batchButton = screen.getByRole('button', { name: /全部加入意向候选池/ })
    await user.click(batchButton)

    await waitFor(() => {
      expect(mockAddHotSectorStocks).toHaveBeenCalledWith(
        'semiconductor',
        expect.objectContaining({ fetchBasicAfterAdd: false }),
      )
    })
  })

  it('shows toast and message after batch add succeeds', async () => {
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const batchButton = screen.getByRole('button', { name: /全部加入意向候选池/ })
    await user.click(batchButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '批量加入完成',
          variant: 'success',
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText(/成功加入 2 只/)).toBeInTheDocument()
    })
  })

  it('shows error toast when batch add fails', async () => {
    mockAddHotSectorStocks.mockResolvedValue({ success: false, error: '服务异常' })
    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const batchButton = screen.getByRole('button', { name: /全部加入意向候选池/ })
    await user.click(batchButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '批量加入失败',
          variant: 'error',
        }),
      )
    })
  })

  // ----------------------------------------------------------
  // "已加入"状态（已在意向候选池中的股票）
  // ----------------------------------------------------------
  it('shows "已加入" and disables button for stocks already in pool', async () => {
    setupPoolStore([{ symbol: '600519.SH', name: '贵州茅台', group: '默认' }])

    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const addedButton = screen.getByRole('button', { name: '已加入' })
    expect(addedButton).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '加入意向候选池' }).length).toBe(2)
  })

  // ----------------------------------------------------------
  // 防重入：批量加入中禁用按钮
  // ----------------------------------------------------------
  it('disables batch add button while adding', async () => {
    let resolveBatch: (value: unknown) => void
    mockAddHotSectorStocks.mockReturnValue(new Promise((resolve) => { resolveBatch = resolve }))

    const user = userEvent.setup()
    render(<HotSectorPanel />)
    await waitForLoadingToFinish()

    const batchButton = screen.getByRole('button', { name: /全部加入意向候选池/ })
    await user.click(batchButton)

    // 批量按钮应变为 disabled 且文本为"加入中..."
    await waitFor(() => {
      const header = screen.getByText(/关联股票/).closest('div') as HTMLElement
      const batchBtn = header?.querySelector('button')
      expect(batchBtn).toHaveTextContent('加入中...')
      expect(batchBtn).toBeDisabled()
    }, { timeout: 5000 })

    // 释放 Promise 恢复状态
    resolveBatch!({ success: true, data: { added: [], failed: [] } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /全部加入意向候选池/ })).toBeEnabled()
    }, { timeout: 5000 })
  })
})
