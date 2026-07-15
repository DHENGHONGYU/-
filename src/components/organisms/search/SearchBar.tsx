/**
 * @fileoverview 搜索栏组件
 *
 * 提供关键词输入和快速检索入口。
 *
 * @module components/organisms/search/SearchBar
 * @created 2026-07-14 - 双通道整改 P2-3
 */

import { useCallback } from 'react'
import { Input } from '@/components/atoms/Input'
import { Button } from '@/components/atoms/Button'
import { useSearchStore } from '@/store/searchStore'

export interface SearchBarProps {
  onSearch?: () => void
}

/**
 * 搜索栏
 *
 * 关键词输入 + 搜索按钮，支持回车触发。
 */
export function SearchBar({ onSearch }: SearchBarProps): React.JSX.Element {
  const keyword = useSearchStore(s => s.keyword)
  const setKeyword = useSearchStore(s => s.setKeyword)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch()
    }
  }, [onSearch])

  return (
    <div className="flex gap-2">
      <Input
        type="text"
        placeholder="搜索关键词、标的代码、文件名..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1"
      />
      <Button onClick={onSearch} variant="default">
        搜索
      </Button>
    </div>
  )
}
