import { cn } from '@/lib/utils'

export interface CockpitLayoutProps {
  /** 顶部工具栏 */
  toolbar?: React.ReactNode
  /** 主内容：通常为 Widget 网格 */
  children: React.ReactNode
  /** 容器 className */
  className?: string
}

/**
 * 驾驶舱布局模板
 *
 * 结构：顶部 toolbar + Widget 网格内容区
 */
export function CockpitLayout({
  toolbar,
  children,
  className,
}: CockpitLayoutProps) {
  const showToolbar = toolbar != null

  return (
    <div className={cn('flex h-screen flex-col overflow-hidden bg-background', className)}>
      {showToolbar && (
        <div className="shrink-0 border-b bg-card p-4">{toolbar}</div>
      )}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  )
}
