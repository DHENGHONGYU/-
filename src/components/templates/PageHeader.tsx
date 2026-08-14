/**
 * @module components/ui/PageHeader
 * @description 页面统一页头组件
 *
 * 提供一致的页头结构：标题（h1 排版阶梯）+ 描述（辅助文字）
 * + 右侧操作区，下方以分隔线收口。建立清晰的页面信息层级。
 *
 * 设计原则：
 *   1. 信息层级：标题 → 描述 → 操作区，视觉权重递减
 *   2. 响应式：移动端标题和操作区堆叠，桌面端左右分布
 *   3. 排版阶梯：标题使用 text-h1，描述使用 text-body-sm
 *   4. 分隔线：底部 border-b 提供视觉收口
 *   5. 可扩展：支持通过 className 属性添加自定义样式
 *
 * 推荐用法：在 PageContainer 内作为首个子组件使用
 *
 * @compliance AGENTS.md §三 颜色令牌规范：使用 THEME_TOKENS 而非硬编码颜色
 */

/**
 * @fileoverview PageHeader - 页面 / 头部组件（Template层组件）
 * @module components/templates/PageHeader
 */

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
        {description != null && (
          <p className="text-body-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions != null && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export default PageHeader
