import React from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  /** 标题（建议用字符串，自动套用 h1 排版阶梯） */
  title: React.ReactNode
  /** 辅助描述 */
  description?: React.ReactNode
  /** 右侧操作区（按钮、筛选器等） */
  actions?: React.ReactNode
  /** 附加类名 */
  className?: string
}

/**
 * 页面统一页头
 * @description 提供一致的页头结构：标题（h1 排版阶梯）+ 描述（辅助文字）
 * + 右侧操作区，下方以分隔线收口。建立清晰的页面信息层级。
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1.5">
        <h1 className="text-h1 text-foreground">{title}</h1>
        {description && (
          <p className="text-body-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export default PageHeader
