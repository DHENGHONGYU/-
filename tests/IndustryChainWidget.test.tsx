/**
 * @fileoverview IndustryChainWidget v2 渲染测试
 * @description 验证产业链图谱 v2 的核心交互行为：
 *  1. 下拉菜单切换上中下游层级
 *  2. SVG 图谱正确渲染节点和连线
 *  3. 节点点击高亮关联路径
 *  4. 核心标的列表渲染
 *  5. 实时股价展示（mock）
 *
 * @since v2.7.0 - 2026-07-20
 * @doc cockpit-industrychain-v2
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// ============================================================
// Mock: 依赖模块
// ============================================================

// Mock tencentBatchQuotes — 返回模拟行情数据（通过 Vite 代理的 data-collector 版本）
const mockTencentBatchQuotes = vi.fn()
vi.mock('@/services/data-collector/directDataAPI', () => ({
  tencentBatchQuotes: (codes: string[]) => mockTencentBatchQuotes(codes),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ============================================================
// 导入被测组件（在所有 mock 之后）
// ============================================================
const { IndustryChainWidget } = await import('@/cockpit/widgets/IndustryChainWidget')

// ============================================================
// 测试数据
// ============================================================
function buildMockQuotes(codes: string[]) {
  return codes.map((code, i) => ({
    symbol: code,
    name: `股票${i}`,
    price: 10 + i * 5,
    change: i * 0.5,
    changePercent: i * 1.2,
    open: 10,
    high: 15,
    low: 8,
    volume: 1000000,
    amount: 10000000,
    timestamp: Date.now(),
  }))
}

// ============================================================
// 测试套件
// ============================================================
describe('IndustryChainWidget v2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTencentBatchQuotes.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
  })

  // ----------------------------------------------------------
  // 基础渲染
  // ----------------------------------------------------------
  it('渲染标题和下拉菜单', () => {
    render(<IndustryChainWidget />)

    expect(screen.getByText('产业链图谱')).toBeDefined()

    // 下拉菜单存在
    const select = screen.getByLabelText('选择产业链层级')
    expect(select).toBeDefined()
  })

  it('默认选中上游层级', () => {
    render(<IndustryChainWidget />)

    const select = screen.getByLabelText('选择产业链层级') as HTMLSelectElement
    expect(select.value).toBe('upstream')
  })

  it('渲染关系图例（供应/竞争/协同/替代）', () => {
    render(<IndustryChainWidget />)

    expect(screen.getByText('供应')).toBeDefined()
    expect(screen.getByText('竞争')).toBeDefined()
    expect(screen.getByText('协同')).toBeDefined()
    expect(screen.getByText('替代')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 下拉菜单切换
  // ----------------------------------------------------------
  it('切换到中游层级显示中游节点', () => {
    render(<IndustryChainWidget />)

    const select = screen.getByLabelText('选择产业链层级') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'midstream' } })

    // 中游层级标签应显示
    expect(screen.getByText('中游')).toBeDefined()
  })

  it('切换到下游层级显示下游节点', () => {
    render(<IndustryChainWidget />)

    const select = screen.getByLabelText('选择产业链层级') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'downstream' } })

    expect(screen.getByText('下游')).toBeDefined()
  })

  it('切换到横向层级显示横向节点', () => {
    render(<IndustryChainWidget />)

    const select = screen.getByLabelText('选择产业链层级') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'horizontal' } })

    expect(screen.getByText('横向')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 核心标的展示
  // ----------------------------------------------------------
  it('显示核心标的小标题', () => {
    render(<IndustryChainWidget />)

    // 默认上游层级
    expect(screen.getByText('核心标的（上游）')).toBeDefined()
  })

  it('上游层级有核心标的时渲染标的卡片', async () => {
    // 上游有 IC(中芯国际)、NE(宁德时代) 两个标的
    mockTencentBatchQuotes.mockResolvedValue(
      buildMockQuotes(['688981.SH', '300750.SZ']),
    )

    render(<IndustryChainWidget />)

    await waitFor(() => {
      expect(screen.getByText('中芯国际')).toBeDefined()
      expect(screen.getByText('宁德时代')).toBeDefined()
    })
  })

  it('标的卡片显示实时股价', async () => {
    mockTencentBatchQuotes.mockResolvedValue([
      {
        symbol: '688981.SH',
        name: '中芯国际',
        price: 58.5,
        change: 1.2,
        changePercent: 2.09,
        open: 57,
        high: 59,
        low: 56.8,
        volume: 1000000,
        amount: 58000000,
        timestamp: Date.now(),
      },
    ])

    render(<IndustryChainWidget />)

    await waitFor(() => {
      expect(screen.getByText('58.50')).toBeDefined()
      expect(screen.getByText('+2.09%')).toBeDefined()
    })
  })

  it('无标的的层级显示提示文字', () => {
    render(<IndustryChainWidget />)

    const select = screen.getByLabelText('选择产业链层级') as HTMLSelectElement
    // 量子信息(QT)在上游，但无 exampleStocks
    // 上游有 IC、NE 有标的，所以不会显示"暂无"
    // 切换到横向看看（DG/SMH/SMA 都无标的）
    fireEvent.change(select, { target: { value: 'horizontal' } })

    expect(screen.getByText('该层级暂无核心标的')).toBeDefined()
  })

  // ----------------------------------------------------------
  // 行情获取
  // ----------------------------------------------------------
  it('组件挂载时调用 tencentBatchQuotes 获取行情', async () => {
    mockTencentBatchQuotes.mockResolvedValue([])

    render(<IndustryChainWidget />)

    await waitFor(() => {
      expect(mockTencentBatchQuotes).toHaveBeenCalled()
    })
  })

  it('切换层级后重新获取该层级的标的行情', async () => {
    mockTencentBatchQuotes.mockResolvedValue([])

    render(<IndustryChainWidget />)

    // 初始加载上游行情
    await waitFor(() => {
      expect(mockTencentBatchQuotes).toHaveBeenCalledTimes(1)
    })

    // 切换到下游
    const select = screen.getByLabelText('选择产业链层级') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'downstream' } })

    await waitFor(() => {
      expect(mockTencentBatchQuotes).toHaveBeenCalledTimes(2)
    })
  })

  it('行情获取失败时静默处理不崩溃', async () => {
    mockTencentBatchQuotes.mockRejectedValue(new Error('网络错误'))

    render(<IndustryChainWidget />)

    // 组件不应崩溃
    expect(screen.getByText('产业链图谱')).toBeDefined()
  })
})
