import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import { useInputHubStore } from '@/store/inputHubStore'
import type { StockSearchResult } from '@/services/input/inputService'
import { INPUT_CONFIG } from '@/config/inputConfig'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

export interface StockSearchProps {
  onSelect?: (result: StockSearchResult) => void
  onAdded?: (result: StockSearchResult) => void
  mode?: 'fill' | 'add'
  placeholder?: string
  className?: string
}

/**
 * 市场标签映射
 */
const MARKET_LABELS: Record<string, { label: string; className: string }> = {
  SH: { label: '沪', className: 'bg-warning/10 text-warning' },
  SZ: { label: '深', className: 'bg-success/10 text-success' },
  HK: { label: 'HK', className: 'bg-info/10 text-info' },
  BJ: { label: '京', className: 'bg-info/10 text-info' },
}

function getMarketLabel(industry: string | undefined): { label: string; className: string } {
  if (!industry) return { label: '—', className: 'bg-muted text-muted-foreground' }
  const key = industry.toUpperCase()
  return MARKET_LABELS[key] ?? { label: industry, className: 'bg-muted text-muted-foreground' }
}

/**
 * StockSearch - A+H 股全市场搜索组件
 *
 * 支持本地字典搜索 + 腾讯 Smartbox API 回退。
 * 已录入意向候选池的股票展示"已导入"标记。
 */
export function StockSearch({
  onSelect,
  onAdded,
  mode = 'fill',
  placeholder = mode === 'add' ? '搜索并直接录入意向候选池' : '搜索代码 / 名称',
  className,
}: StockSearchProps): React.JSX.Element {
  const storeSearchStocks = useInputHubStore((s) => s.searchStocks)
  const storeAddStockFromSearch = useInputHubStore((s) => s.addStockFromSearch)
  const isAddingStock = useInputHubStore((s) => s.isAddingStock)
  const existingSymbols = useInputHubStore((s) => s.existingSymbols)
  const refreshExistingSymbols = useInputHubStore((s) => s.refreshExistingSymbols)

  // 初始化时拉取已导入的 symbol 集合
  useEffect(() => {
    refreshExistingSymbols()
  }, [refreshExistingSymbols])

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // 记录最后交互方式：'mouse' | 'keyboard'，用于 mouseEnter 不覆盖键盘选中（P-mouseEnter 修复）
  const lastInteractionRef = useRef<'mouse' | 'keyboard'>('mouse')
  const { toast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // P-blur 修复：保存 blur timeout ref 以便 mousedown 选项时取消
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSearchDebounce = (): void => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
  }

  useEffect(() => {
    clearSearchDebounce()

    const trimmed = query.trim()
    if (trimmed.length < INPUT_CONFIG.search.minQueryLength) {
      setResults([])
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const matches = await storeSearchStocks(trimmed)
      setResults(matches)
      // A1 修复：始终打开 listbox，由 listbox 内部根据 results.length 决定显示空态或选项
      setOpen(true)
      setActiveIndex(matches.length > 0 ? 0 : -1)
    }, INPUT_CONFIG.search.debounceMs)

    return () => {
      clearSearchDebounce()
    }
  }, [query, storeSearchStocks])

  const handleSelect = async (result: StockSearchResult): Promise<void> => {
    if (mode !== 'add') {
      onSelect?.(result)
      setQuery('')
      setResults([])
      setOpen(false)
      setActiveIndex(-1)
      inputRef.current?.blur()
      return
    }

    if (isAddingStock) return
    try {
      const addResult = await storeAddStockFromSearch(result, {
        fetchBasicAfterAdd: false,
        fetchKlineAfterAdd: false,
      })
      if (!addResult.success) {
        toast({
          variant: 'error',
          title: '录入失败',
          description: addResult.error ?? '无法录入标的',
        })
        return
      }
      toast({
        variant: 'success',
        title: '录入成功',
        description: `${result.symbol} ${result.name} 已加入意向候选池`,
      })
      onAdded?.(result)
      setQuery('')
      setResults([])
      setOpen(false)
      setActiveIndex(-1)
      inputRef.current?.blur()
    } catch (err) {
      toast({
        variant: 'error',
        title: '录入失败',
        description: err instanceof Error ? err.message : '无法录入标的',
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open || results.length === 0) return

    // P-mouseEnter 修复：键盘事件触发时标记最后交互为 keyboard
    lastInteractionRef.current = 'keyboard'

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % results.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length)
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < results.length) {
          void handleSelect(results[activeIndex]!)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
        break
    }
  }

  // P-blur 修复：点空白延迟关闭下拉（避免点选项时先 blur 关闭）
  const handleBlur = (): void => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    blurTimeoutRef.current = setTimeout(() => {
      setOpen(false)
      setActiveIndex(-1)
    }, 120)
  }

  // P-blur 修复：mousedown 选项时取消 blur 关闭（让 click 正常触发）
  const handleOptionMouseDown = (): void => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true)
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={isAddingStock}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={open ? 'stock-search-listbox' : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `stock-search-option-${activeIndex}` : undefined
        }
      />
      {open && (
        <div
          id="stock-search-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md"
        >
          {/* A1 修复：搜索无匹配时显示"无匹配"提示 */}
          {results.length === 0 && query.trim().length >= INPUT_CONFIG.search.minQueryLength && (
            <div className="px-3 py-2 text-sm text-muted-foreground">无匹配结果</div>
          )}
          {results.map((result, index) => {
            const marketInfo = getMarketLabel(result.industry)
            return (
              <div
                key={result.symbol}
                id={`stock-search-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm hover:bg-accent',
                  index === activeIndex && 'bg-accent',
                  isAddingStock && 'pointer-events-none opacity-50',
                )}
                onMouseDown={handleOptionMouseDown}
                onClick={() => void handleSelect(result)}
                onMouseEnter={() => {
                  // P-mouseEnter 修复：仅当最后交互是鼠标时才覆盖 activeIndex
                  if (lastInteractionRef.current === 'mouse') {
                    setActiveIndex(index)
                  } else {
                    // 首次 hover 标记为 mouse 模式（之后才能覆盖）
                    lastInteractionRef.current = 'mouse'
                  }
                }}
              >
                  <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{result.symbol}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', marketInfo.className)}>
                      {marketInfo.label}
                    </span>
                    <span className="text-muted-foreground">{result.name}</span>
                  </div>
                  {existingSymbols.has(result.symbol) && (
                    <Badge variant="secondary" className="text-[10px]">已导入</Badge>
                  )}
                  </div>
                  {/* 申万行业面包屑：仅当 swL1 存在时渲染（港股/未覆盖 A 股不显示） */}
                  {result.swL1 && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[result.swL1, result.swL2, result.swL3].filter(Boolean).join(' / ')}
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
