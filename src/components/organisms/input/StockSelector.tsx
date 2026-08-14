/**
 * @fileoverview 股票选择器组件
 * 基于本地股票列表的下拉选择器，支持搜索、选择、键盘导航功能
 *
 * @module components/organisms/input/StockSelector
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Search, ChevronDown, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { POPULAR_STOCKS, getStockBySymbol, type StockOption } from '@/constants/stockList'
import { getLogger } from '@/lib/logger'

const logger = getLogger()
const LOG_PREFIX = '[StockSelector]'

// ============================================================
// 类型定义
// ============================================================

export interface StockSelectorProps {
  /** 当前选中的股票代码 */
  value: string
  /** 选择股票后的回调 */
  onChange: (stock: StockOption) => void
  /** 外部传入的股票列表（优先于 POPULAR_STOCKS） */
  stocks?: StockOption[]
  /** 初始搜索关键词 */
  initialKeyword?: string
  /** 自定义类名 */
  className?: string
  /** 占位符文本 */
  placeholder?: string
  /** 是否显示图标 */
  showIcon?: boolean
  /** 最大显示数量 */
  maxDisplayCount?: number
}

// ============================================================
// 组件
// ============================================================

/**
 * 股票选择器组件
 *
 * 基于常用股票列表的下拉选择器，支持按名称或代码搜索、键盘导航。
 * 适用于实时行情展示、智能评分等场景，无需后端 API 支持。
 */
export function StockSelector({
  value,
  onChange,
  stocks,
  initialKeyword = '',
  className,
  placeholder = '搜索股票名称或代码...',
  showIcon = true,
  maxDisplayCount = 20,
}: StockSelectorProps): React.JSX.Element {
  const [searchKeyword, setSearchKeyword] = useState(initialKeyword)
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const sourceStocks = stocks ?? POPULAR_STOCKS

  useEffect(() => {
    if (initialKeyword) {
      logger.debug(`${LOG_PREFIX} 初始化，带搜索关键词`, { initialKeyword })
    }
    if (stocks?.length === 0) {
      logger.warn(`${LOG_PREFIX} 外部股票列表为空`, { source: 'stocks prop' })
    }
    if (sourceStocks.length === 0) {
      logger.warn(`${LOG_PREFIX} 数据源股票列表为空`, { source: stocks ? 'stocks prop' : 'POPULAR_STOCKS' })
    }
    logger.info(`${LOG_PREFIX} 组件初始化`, {
      source: stocks ? 'external' : 'POPULAR_STOCKS',
      totalStocks: sourceStocks.length,
      initialKeyword: initialKeyword || '(none)',
      preselectedValue: value || '(none)',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedStock = useMemo(() => {
    if (stocks) {
      const found = stocks.find((s) => s.symbol === value)
      if (found) return found
    }
    return getStockBySymbol(value) ?? { symbol: value, name: '未知股票', market: 'sh' as const }
  }, [value, stocks])

  const searchResults = useMemo(() => {
    if (!searchKeyword.trim()) return sourceStocks.slice(0, maxDisplayCount)
    const kw = searchKeyword.trim().toLowerCase()
    const results = sourceStocks.filter(
      (s) => s.symbol.includes(kw) || s.name.toLowerCase().includes(kw),
    )
    if (results.length === 0 && searchKeyword.trim()) {
      logger.warn(`${LOG_PREFIX} 搜索无结果`, { keyword: searchKeyword })
    }
    return results
  }, [searchKeyword, maxDisplayCount, sourceStocks])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [searchKeyword, showDropdown])

  useEffect(() => {
    logger.debug(`${LOG_PREFIX} 外部 value 变更`, { value, source: value ? 'preselected' : 'cleared' })
  }, [value])

  useEffect(() => {
    logger.debug(`${LOG_PREFIX} 股票源变更`, {
      source: stocks ? 'external' : 'POPULAR_STOCKS',
      count: sourceStocks.length,
    })
  }, [stocks, sourceStocks.length])

  useEffect(() => {
    if (showDropdown && inputRef.current) {
      logger.debug(`${LOG_PREFIX} 下拉框打开，聚焦搜索框`)
      inputRef.current.focus()
    }
  }, [showDropdown])

  useEffect(() => {
    if (!showDropdown) return
    const highlighted = itemRefs.current[highlightedIndex]
    if (highlighted && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect()
      const itemRect = highlighted.getBoundingClientRect()
      if (itemRect.bottom > listRect.bottom) {
        const scrollAmt = itemRect.bottom - listRect.bottom + 8
        logger.debug(`${LOG_PREFIX} 自动滚动↓`, { scrollAmt, highlightedIndex })
        listRef.current.scrollTop += scrollAmt
      } else if (itemRect.top < listRect.top) {
        const scrollAmt = itemRect.top - listRect.top - 8
        logger.debug(`${LOG_PREFIX} 自动滚动↑`, { scrollAmt, highlightedIndex })
        listRef.current.scrollTop -= scrollAmt
      }
    }
  }, [highlightedIndex, showDropdown])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        logger.info(`${LOG_PREFIX} 点击外部关闭下拉框`)
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleSelectStock = useCallback((stock: StockOption) => {
    const isDuplicate = stock.symbol === value
    if (isDuplicate) {
      logger.info(`${LOG_PREFIX} 重复选择同一股票`, {
        symbol: stock.symbol,
        name: stock.name,
        note: 'onChange 仍会触发',
      })
    } else {
      logger.info(`${LOG_PREFIX} 选择股票`, {
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
      })
    }
    onChange(stock)
    setShowDropdown(false)
    setSearchKeyword('')
  }, [onChange, value])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key
    logger.debug(`${LOG_PREFIX} 键盘事件`, {
      key,
      showDropdown,
      highlightedIndex,
      resultCount: searchResults.length,
    })

    if (!showDropdown && (key === 'ArrowDown' || key === 'Enter')) {
      logger.info(`${LOG_PREFIX} 键盘打开下拉框`, { key })
      setShowDropdown(true)
      return
    }

    if (!showDropdown) return

    switch (key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => {
          const next = prev + 1
          const wrapped = next >= searchResults.length ? 0 : next
          logger.debug(`${LOG_PREFIX} ↓ 导航`, { from: prev, to: wrapped, wrap: wrapped === 0 && searchResults.length > 1 })
          return wrapped
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => {
          const next = prev - 1
          const wrapped = next < 0 ? searchResults.length - 1 : next
          logger.debug(`${LOG_PREFIX} ↑ 导航`, { from: prev, to: wrapped, wrap: next < 0 })
          return wrapped
        })
        break
      case 'Enter':
        e.preventDefault()
        if (searchResults[highlightedIndex]) {
          const stock = searchResults[highlightedIndex]
          logger.info(`${LOG_PREFIX} Enter 确认选择`, {
            index: highlightedIndex,
            symbol: stock.symbol,
            name: stock.name,
          })
          handleSelectStock(stock)
        } else {
          logger.warn(`${LOG_PREFIX} Enter 无效：高亮项为空`, { highlightedIndex })
        }
        break
      case 'Escape':
        e.preventDefault()
        logger.info(`${LOG_PREFIX} Esc 关闭下拉框`)
        setShowDropdown(false)
        break
      case 'Tab':
        logger.info(`${LOG_PREFIX} Tab 关闭下拉框`)
        setShowDropdown(false)
        break
      default:
        logger.debug(`${LOG_PREFIX} 未处理的按键`, { key })
    }
  }, [showDropdown, searchResults, highlightedIndex, handleSelectStock])

  const toggleDropdown = () => {
    const next = !showDropdown
    logger.debug(`${LOG_PREFIX} 切换下拉框`, { visible: next })
    setShowDropdown(next)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 选择器按钮 */}
      <div className="flex items-center gap-2">
        {showIcon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', 'bg-primary/10')}>
            <BarChart3 className={cn('h-5 w-5', 'text-primary')} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={toggleDropdown}
            className={cn(
              'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
              'border-border bg-background hover:bg-accent',
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn('truncate text-base font-semibold', 'text-foreground')}>
                {selectedStock.name}
              </span>
              <span className={cn('shrink-0 text-sm', 'text-muted-foreground')}>
                {selectedStock.market === 'sh' ? '沪' : '深'}{selectedStock.symbol}
              </span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', showDropdown && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {/* 下拉面板 */}
      {showDropdown && (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 rounded-md border shadow-lg',
            'border-border bg-background',
            'max-w-[calc(100vw-2rem)]',
          )}
        >
          {/* 搜索框 */}
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value)
                  if (e.target.value) {
                    const count = sourceStocks.filter(
                      (s) => s.symbol.includes(e.target.value.toLowerCase()) || s.name.toLowerCase().includes(e.target.value.toLowerCase()),
                    ).length
                    logger.debug(`${LOG_PREFIX} 搜索执行`, {
                      keyword: e.target.value,
                      resultCount: count,
                    })
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                inputMode="search"
                className={cn(
                  'w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none transition-colors',
                  'border-border bg-background placeholder:text-muted-foreground',
                  'focus:border-primary focus:ring-1 focus:ring-primary',
                )}
                autoComplete="off"
              />
            </div>
          </div>

          {/* 股票列表 */}
          <div
            ref={listRef}
            className="max-h-[50vh] overflow-y-auto py-1 sm:max-h-60"
            role="listbox"
            aria-label="股票列表"
          >
            {searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                未找到匹配的股票
              </div>
            ) : (
              searchResults.map((stock, index) => {
                const isHighlighted = index === highlightedIndex
                const isSelected = value === stock.symbol
                return (
                  <button
                    key={`${stock.symbol}-${stock.market}-${index}`}
                    ref={(el) => { itemRefs.current[index] = el }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelectStock(stock)}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left text-sm transition-colors sm:py-2',
                      'hover:bg-accent hover:text-accent-foreground',
                      isHighlighted && 'bg-accent text-accent-foreground',
                      isSelected && 'bg-primary/10 text-primary',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{stock.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {stock.market === 'sh' ? '沪' : '深'}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{stock.symbol}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* 键盘导航提示 */}
          <div className="border-t border-border px-3 py-1.5 text-center text-xs text-muted-foreground">
            {searchResults.length > 0 && `↑↓ 选择 · Enter 确认 · Esc 关闭`}
          </div>
        </div>
      )}
    </div>
  )
}
