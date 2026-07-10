import { useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input, Button } from '@/components/atoms'

export interface SearchBarProps {
  /** 占位符 */
  placeholder?: string
  /** 默认值 */
  defaultValue?: string
  /** 搜索回调 */
  onSearch: (value: string) => void
  /** 是否加载中 */
  loading?: boolean
  /** 容器 className */
  className?: string
}

/**
 * 搜索栏分子
 *
 * 组合：Input + 搜索按钮 + 清除按钮
 */
export function SearchBar({
  placeholder = '搜索...',
  defaultValue = '',
  onSearch,
  loading,
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(value)
  }

  const handleClear = () => {
    setValue('')
    onSearch('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex items-center gap-2', className)}
    >
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="清除搜索"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button type="submit" isLoading={loading}>
        搜索
      </Button>
    </form>
  )
}
