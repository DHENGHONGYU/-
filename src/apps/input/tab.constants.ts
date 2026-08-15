/**
 * 采集模块 Tab 切换样式常量（共享）
 *
 * 用于 CollectionMonitorPanel 和 CollectionStrategyPage 的 Segment/Tab 样式
 */
import { cn } from '@/lib/utils'

export const TAB_BASE = 'rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ease-out'
export const TAB_ACTIVE = 'bg-card text-foreground shadow-sm shadow-primary/5'
export const TAB_INACTIVE = 'text-muted-foreground hover:text-foreground hover:bg-muted/50'

export function tabClass(active: boolean) {
  return cn(TAB_BASE, active ? TAB_ACTIVE : TAB_INACTIVE)
}