import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StockSearch } from './StockSearch'
import type { StockSearchResult } from '@/services/input/inputService'

// Mock useToast
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// Mock inputHubStore（zustand 标准 mock 范式）
const mockSearchStocks = vi.fn()
const mockAddStockFromSearch = vi.fn()
vi.mock('@/store/inputHubStore', () => ({
  useInputHubStore: (selector: any) => {
    const state = {
      searchStocks: mockSearchStocks,
      addStockFromSearch: mockAddStockFromSearch,
      isAddingStock: false,
      existingSymbols: new Set<string>(),
      refreshExistingSymbols: vi.fn(),
    }
    return selector(state)
  },
}))

const mockResults: StockSearchResult[] = [
  { symbol: '600519', name: '贵州茅台', industry: 'SH' as unknown as string, swL1: '食品饮料', swL2: '白酒Ⅱ', swL3: '白酒Ⅲ' },
  { symbol: '000001', name: '平安银行', industry: 'SZ' as unknown as string, swL1: '银行', swL2: '股份制银行Ⅱ', swL3: '股份制银行Ⅲ' },
  { symbol: '00700', name: '腾讯控股', industry: 'HK' as unknown as string },
]

describe('StockSearch 独立复检（验收闸门一档实跑）', () => {
  beforeEach(() => {
    mockSearchStocks.mockReset()
    mockAddStockFromSearch.mockReset()
  })

  it('渲染 combobox 角色 + aria-expanded=false', () => {
    render(<StockSearch />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  it('⚠️ P-blur 真实阻断：点空白下拉应自动关闭', async () => {
    mockSearchStocks.mockResolvedValue(mockResults)
    render(<StockSearch />)
    const input = screen.getByRole('combobox')
    // 直接 fireEvent.change 绕过 debounce 时序问题
    fireEvent.change(input, { target: { value: '600' } })
    fireEvent.focus(input)
    // 等待 debounce 触发 storeSearchStocks 并更新 results
    await waitFor(() => expect(mockSearchStocks).toHaveBeenCalledWith('600'))
    // 等待 listbox 出现
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())
    // blur input
    fireEvent.blur(input)
    // 期望：listbox 关闭（修复后 PASS）
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument(), { timeout: 500 })
  })

  it('⚠️ P-mouseEnter 覆盖键盘真实风险：键盘选中后鼠标移过不应被无声覆盖', async () => {
    mockSearchStocks.mockResolvedValue(mockResults)
    render(<StockSearch />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: '6' } })
    fireEvent.focus(input)
    await waitFor(() => expect(mockSearchStocks).toHaveBeenCalledWith('6'))
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())
    // 键盘 ArrowDown 两次：初始 0 → 1 → 2
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const options = screen.getAllByRole('option')
    // 修复后：activeIndex=2，options[2] aria-selected=true
    expect(options[2]?.getAttribute('aria-selected')).toBe('true')
    // 鼠标 hover index=0
    fireEvent.mouseEnter(options[0]!)
    // 期望：键盘选择保持（activeIndex=2，aria-selected 不被覆盖）
    // 实际：lastInteractionRef='keyboard' 时 mouseEnter 不调用 setActiveIndex
    expect(options[2]?.getAttribute('aria-selected')).toBe('true')
    expect(options[0]?.getAttribute('aria-selected')).toBe('false')
  })

  it('⚠️ A1 真实阻断：搜索无匹配时应有"无匹配"提示', async () => {
    mockSearchStocks.mockResolvedValue([])
    render(<StockSearch />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'XYZ' } })
    fireEvent.focus(input)
    // 等待 debounce 触发 storeSearchStocks
    await waitFor(() => expect(mockSearchStocks).toHaveBeenCalledWith('XYZ'))
    // 等待 useEffect 内 setTimeout 完成 + listbox 渲染
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())
    // 期望：listbox 内显示"无匹配"提示
    // 实际：当前 setOpen(matches.length > 0) → 关闭，无任何提示
    expect(screen.queryByText(/无匹配/i)).toBeInTheDocument()
  })

  it('A 股搜索结果展示申万行业面包屑', async () => {
    mockSearchStocks.mockResolvedValue(mockResults)
    render(<StockSearch />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: '600' } })
    fireEvent.focus(input)
    await waitFor(() => expect(mockSearchStocks).toHaveBeenCalledWith('600'))
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())
    // 贵州茅台应显示行业面包屑
    expect(screen.getByText(/食品饮料 \/ 白酒Ⅱ \/ 白酒Ⅲ/)).toBeInTheDocument()
    // 平安银行应显示行业面包屑
    expect(screen.getByText(/银行 \/ 股份制银行Ⅱ \/ 股份制银行Ⅲ/)).toBeInTheDocument()
  })

  it('港股搜索结果不显示申万行业面包屑', async () => {
    mockSearchStocks.mockResolvedValue(mockResults)
    render(<StockSearch />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: '00700' } })
    fireEvent.focus(input)
    await waitFor(() => expect(mockSearchStocks).toHaveBeenCalledWith('00700'))
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument())
    // 腾讯控股（港股）不应包含行业面包屑行
    const options = screen.getAllByRole('option')
    const tencentOption = options.find((opt) => opt.textContent?.includes('腾讯控股'))
    expect(tencentOption).toBeDefined()
    // 港股 swL1 为 undefined，不应渲染任何行业相关信息
    expect(tencentOption?.textContent).not.toMatch(/食品饮料|银行|白酒/)
  })
})
