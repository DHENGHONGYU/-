import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/atoms/Input'
import { useInputHubStore } from '@/store/inputHubStore'
import type { StockSearchResult } from '@/services/fetcher/fetcherInputService'
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
 * StockSearch
 */
export function StockSearch({
  onSelect,
  onAdded,
  mode = 'fill',
  placeholder = mode === 'add' ? '搜索并直接录入候选池' : '搜索代码 / 名称 / 行业',
  className,
}: StockSearchProps): React.JSX.Element {
  const storeSearchStocks = useInputHubStore((s) => s.searchStocks)
  const storeAddStockFromSearch = useInputHubStore((s) => s.addStockFromSearch)
  const isAddingStock = useInputHubStore((s) => s.isAddingStock)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const { toast } = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

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

    debounceRef.current = setTimeout(() => {
      const matches = storeSearchStocks(trimmed)
      setResults(matches)
      setOpen(matches.length > 0)
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
        description: `${result.symbol} ${result.name} 已加入候选池`,
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
          {results.map((result, index) => (
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
              onClick={() => void handleSelect(result)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{result.symbol}</span>
                <span className="text-xs text-muted-foreground">{result.industry}</span>
              </div>
              <div className="text-xs text-muted-foreground">{result.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
