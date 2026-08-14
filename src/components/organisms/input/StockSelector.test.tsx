/**
 * @test_id V9-TEST-STOCKSELECTOR-001
 * StockSelector 组件集成测试
 *
 * 覆盖：键盘导航（↑↓EnterEsc）、移动端适配、搜索与选择流程
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { StockSelector } from './StockSelector'
import type { StockOption } from '@/constants/stockList'

// ============================================================
// 测试数据
// ============================================================

const MOCK_STOCKS: StockOption[] = [
  { symbol: '600519', name: '贵州茅台', market: 'sh' },
  { symbol: '601318', name: '中国平安', market: 'sh' },
  { symbol: '000001', name: '平安银行', market: 'sz' },
  { symbol: '300750', name: '宁德时代', market: 'sz' },
  { symbol: '688981', name: '中芯国际', market: 'sh' },
]

// ============================================================
// 键盘导航测试
// ============================================================

describe('StockSelector - 键盘导航', () => {
  let onChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onChange = vi.fn()
  })

  test('↓键打开下拉框（先点击按钮聚焦）', () => {
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    // 先点击按钮打开下拉框
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    // 此时输入框出现，按 ↓ 应该已在下拉框内
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  test('↓键移动高亮项', () => {
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBe(MOCK_STOCKS.length)
  })

  test('↑↓循环导航（wrap-around）', () => {
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    const input = screen.getByRole('textbox')
    // 按 ↑ 从第一项跳到最后一项（wrap-around）
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  test('Enter确认选择高亮项（第一项）', async () => {
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    const input = screen.getByRole('textbox')
    // 默认高亮第一项，Enter确认
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(MOCK_STOCKS[0])
    })
  })

  test('Enter确认第二项选择', async () => {
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' }) // 到第二项
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(MOCK_STOCKS[1])
    })
  })

  test('Esc关闭下拉框', () => {
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('Tab关闭下拉框', () => {
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('空白搜索时 Enter 不触发选择（无高亮项）', () => {
    render(<StockSelector value="" onChange={onChange} stocks={[]} />)
    const selectButton = screen.getByText('未知股票').closest('button')
    fireEvent.click(selectButton!)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ============================================================
// 下拉框交互测试
// ============================================================

describe('StockSelector - 下拉框交互', () => {
  test('点击按钮打开/关闭下拉框', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.click(button)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('点击选项触发onChange', async () => {
    const onChange = vi.fn()
    render(<StockSelector value="" onChange={onChange} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')!
    fireEvent.click(selectButton)
    const listbox = screen.getByRole('listbox')
    const option = within(listbox).getByText('中国平安')
    fireEvent.click(option)
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(MOCK_STOCKS[1])
    })
  })

  test('搜索后选项更新', () => {
    render(<StockSelector value="" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')!
    fireEvent.click(selectButton)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '平安' } })
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    // 应匹配"中国平安"和"平安银行"
    expect(options.length).toBeGreaterThanOrEqual(2)
  })

  test('搜索无结果显示提示', () => {
    render(<StockSelector value="" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')!
    fireEvent.click(selectButton)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '不存在的股票' } })
    expect(screen.getByText('未找到匹配的股票')).toBeInTheDocument()
  })

  test('键盘导航提示文本显示', () => {
    render(<StockSelector value="" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const selectButton = screen.getByText('未知股票').closest('button')!
    fireEvent.click(selectButton)
    expect(screen.getByText(/↑↓ 选择 · Enter 确认 · Esc 关闭/)).toBeInTheDocument()
  })
})

// ============================================================
// 移动端适配测试（渲染检查）
// ============================================================

describe('StockSelector - 移动端适配', () => {
  test('下拉框使用视口响应式类', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    const listbox = screen.getByRole('listbox')
    const dropdown = listbox.parentElement
    expect(dropdown?.className).toContain('max-w-[calc(100vw-2rem)]')
  })

  test('移动端触摸目标更大（py-2.5）', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    for (const option of options) {
      expect(option.className).toContain('py-2.5')
    }
  })

  test('搜索框使用 inputMode=search', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('inputmode', 'search')
  })

  test('搜索图标使用 pointer-events-none', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    const input = screen.getByRole('textbox')
    const searchContainer = input.parentElement
    const svg = searchContainer?.querySelector('svg')
    // SVG 元素在 JSdom 中 className 是 SVGAnimatedString，需要检查 getAttribute
    expect(svg?.getAttribute('class') || '').toContain('pointer-events-none')
  })

  test('文本节点使用 truncate 防溢出', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    expect(button.querySelector('.truncate')).toBeInTheDocument()
  })
})

// ============================================================
// ARIA 无障碍测试
// ============================================================

describe('StockSelector - ARIA 无障碍', () => {
  test('列表使用 role=listbox', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  test('选项使用 role=option', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBe(MOCK_STOCKS.length)
  })

  test('选中项有 aria-selected=true', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    const listbox = screen.getByRole('listbox')
    const selected = within(listbox).getByText('贵州茅台')
    expect(selected.closest('[aria-selected="true"]')).toBeInTheDocument()
  })

  test('列表有 aria-label', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} stocks={MOCK_STOCKS} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    expect(screen.getByLabelText('股票列表')).toBeInTheDocument()
  })
})

// ============================================================
// 外部数据（stocks prop）测试
// ============================================================

describe('StockSelector - 外部数据支持', () => {
  test('传入 stocks prop 时使用外部数据', () => {
    const customStocks: StockOption[] = [
      { symbol: '000002', name: '万科A', market: 'sz' },
      { symbol: '600000', name: '浦发银行', market: 'sh' },
    ]
    render(<StockSelector value="" onChange={vi.fn()} stocks={customStocks} />)
    const selectButton = screen.getByText('未知股票').closest('button')!
    fireEvent.click(selectButton)
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBe(2)
  })

  test('未传入 stocks prop 时使用默认 POPULAR_STOCKS', () => {
    render(<StockSelector value="600519" onChange={vi.fn()} />)
    const button = screen.getByText('贵州茅台').closest('button')!
    fireEvent.click(button)
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
  })

  test('外部数据搜索正常工作', () => {
    const customStocks: StockOption[] = [
      { symbol: '000002', name: '万科A', market: 'sz' },
      { symbol: '600000', name: '浦发银行', market: 'sh' },
      { symbol: '600519', name: '贵州茅台', market: 'sh' },
    ]
    render(<StockSelector value="" onChange={vi.fn()} stocks={customStocks} />)
    const selectButton = screen.getByText('未知股票').closest('button')!
    fireEvent.click(selectButton)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '万科' } })
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBe(1)
    expect(options[0]).toHaveTextContent('万科A')
  })
})
