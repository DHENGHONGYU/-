/**
 * @fileoverview InputDashboard 纯工具函数与样式常量
 * @module apps/input/inputDashboard.utils
 */

import { cn } from '@/lib/utils'

/** 市场代码 → 中文标签 */
export function getMarketLabel(market: string): string {
  const map: Record<string, string> = { SH: '沪市', SZ: '深市', HK: '港股', BJ: '北交所' }
  return map[market.toUpperCase()] ?? market
}

// Tab 与分段控件样式常量 — 柔性 pill 风格
export const TAB_BASE = 'rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-300 ease-out'
export const TAB_ACTIVE = cn('bg-card text-foreground shadow-sm shadow-primary/5')
export const TAB_INACTIVE = cn('text-muted-foreground hover:text-foreground hover:bg-muted/50')
