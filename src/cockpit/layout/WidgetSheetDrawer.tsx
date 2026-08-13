/**
 * @module cockpit/layout/WidgetSheetDrawer
 * @description 重型 Widget 的 Sheet 抽屉触发器
 *
 * 在交叉网格中以紧凑触发卡片形式呈现，点击后通过 Sheet 抽屉
 * 展开完整 Widget 内容。避免重型 Widget（StockChat、IndustryChain）
 * 挤占网格空间。
 *
 * 引用现有组件：
 * - Sheet / SheetHeader / SheetTitle / SheetClose（`@/components/atoms/Sheet`）
 * - Card（`@/components/atoms/Card`）
 *
 * 设计原则：不重写原子组件，仅做排列组合与重新引用
 */

import { useState, type ReactNode } from 'react'
import { MessageSquare, GitBranch, ChevronRight } from 'lucide-react'
import { Sheet, SheetHeader, SheetTitle, SheetClose } from '@/components/atoms/Sheet'
import { Card, CardContent } from '@/components/atoms/Card'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { COCKPIT_LAYOUT } from '@/constants/cockpit.constants'

// ============================================================
// 常量
// ============================================================

/** Widget ID → 触发卡片图标映射 */
const DRAWER_ICONS: Record<string, ReactNode> = {
  stockChat: <MessageSquare className="h-5 w-5" />,
  industryChain: <GitBranch className="h-5 w-5" />,
}

/** Widget ID → 触发卡片描述映射 */
const DRAWER_DESCRIPTIONS: Record<string, string> = {
  stockChat: '个股 / 市场深度分析对话',
  industryChain: '上下游产业链关系图谱',
}

// ============================================================
// Props
// ============================================================

export interface WidgetSheetDrawerProps {
  /** Widget 实例配置 */
  instance: WidgetConfig
  /** Widget 渲染回调（由 CockpitShell 传入 WidgetWrapper） */
  renderWidget: (instance: WidgetConfig) => ReactNode
}

// ============================================================
// 组件
// ============================================================

/**
 * WidgetSheetDrawer
 *
 * 紧凑触发卡片 → 点击 → Sheet 抽屉展开完整 Widget
 */
export function WidgetSheetDrawer({
  instance,
  renderWidget,
}: WidgetSheetDrawerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const icon = DRAWER_ICONS[instance.widgetId] ?? <ChevronRight className="h-5 w-5" />
  const description = DRAWER_DESCRIPTIONS[instance.widgetId] ?? '点击展开详情'

  return (
    <>
      {/* 触发卡片 */}
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{instance.title}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </CardContent>
      </Card>

      {/* Sheet 抽屉 */}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        className="w-full max-w-2xl p-0 sm:max-w-3xl"
      >
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            {icon}
            {instance.title}
          </SheetTitle>
          <SheetClose />
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: COCKPIT_LAYOUT.ZONE_PADDING }}
        >
          {renderWidget(instance)}
        </div>
      </Sheet>
    </>
  )
}
