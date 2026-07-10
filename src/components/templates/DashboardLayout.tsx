import { cn } from '@/lib/utils'

export interface DashboardLayoutProps {
  /** 顶部区域 */
  header?: React.ReactNode
  /** 左侧边栏 */
  sidebar?: React.ReactNode
  /** 主内容 */
  children: React.ReactNode
  /** 容器 className */
  className?: string
}

/**
 * 仪表盘布局模板
 *
 * 结构：顶部 header + 左侧 sidebar + 右侧主内容区
 */
export function DashboardLayout({
  header,
  sidebar,
  children,
  className,
}: DashboardLayoutProps) {
  const showHeader = header != null
  const showSidebar = sidebar != null

  return (
    <div className={cn('flex h-screen flex-col', className)}>
      {showHeader && <header className="shrink-0 border-b">{header}</header>}
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <aside className="w-64 shrink-0 overflow-y-auto border-r bg-card">
            {sidebar}
          </aside>
        )}
        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
