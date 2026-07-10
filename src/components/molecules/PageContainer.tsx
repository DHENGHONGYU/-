/**
 * @module components/ui/PageContainer
 * @description 页面统一容器组件
 *
 * 提供一致的页面最大宽度（1200px）、内边距（24px）与居中策略，
 * 是多页面结构一致性的基础。所有页面应使用本组件作为根容器。
 *
 * 设计原则：
 *   1. 宽度约束：最大宽度 1200px，避免过宽导致阅读疲劳
 *   2. 响应式：移动端自动占满屏幕宽度
 *   3. 可定制：支持通过 centered 属性控制居中行为
 *   4. 可扩展：支持通过 className 属性添加自定义样式
 *
 * @compliance AGENTS.md §三 颜色令牌规范：使用 THEME_TOKENS 而非硬编码颜色
 */

import React from 'react'
import { cn } from '@/lib/utils'

export interface PageContainerProps {
  children: React.ReactNode
  /** 附加类名 */
  className?: string
  /** 是否限制最大宽度并居中（默认 true） */
  centered?: boolean
}

/**
 * 页面统一容器
 * @description 提供一致的页面最大宽度（1200px）、内边距（24px）与居中策略，
 * 是多页面结构一致性的基础。所有页面应使用本组件作为根容器。
 */
export function PageContainer({
  children,
  className,
  centered = true,
}: PageContainerProps): React.JSX.Element {
  return (
    <main
      className={cn(
        'w-full px-6 py-6',
        centered && 'mx-auto max-w-[1200px]',
        className,
      )}
    >
      {children}
    </main>
  )
}

export default PageContainer
