import { cn } from '@/lib/utils'

export interface SidebarLayoutProps {
  /** 侧边栏内容 */
  sidebar: React.ReactNode
  /** 主内容 */
  children: React.ReactNode
  /** 是否可折叠 */
  collapsible?: boolean
  /** 容器 className */
  className?: string
}

/**
 * 侧边栏布局模板
 *
 * 结构：固定左侧边栏 + 主内容区
 */
export function SidebarLayout({
  sidebar,
  children,
  className,
}: SidebarLayoutProps) {
  return (
    <div className={cn('flex min-h-screen', className)}>
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 overflow-y-auto border-r bg-card">
        {sidebar}
      </aside>
      <main className="ml-64 flex-1 bg-background p-6">{children}</main>
    </div>
  )
}
