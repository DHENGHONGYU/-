/**
 * @module cockpit/widgets/CatalystEventWidget
 * @description 催化剂事件监控 — 投资者视角的策略与时机组件
 *
 * 展示即将到来的催化剂事件（业绩发布、政策会议、解禁、分红等），
 * 帮助投资者判断"何时该关注"和"什么事件可能触发行情"。
 *
 * 数据源：当前使用内置 mock 数据，后续接入 /strategy/catalyst-events API。
 */
import React from 'react'
import { Calendar, TrendingUp, Landmark, Unlock, Coins, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { COLOR_SHADES } from '@/constants/theme.tokens'

interface CatalystEvent {
  date: string
  name: string
  type: 'earnings' | 'policy' | 'unlock' | 'dividend' | 'alert'
  importance: 'high' | 'medium' | 'low'
  targets: string
}

const CATALYST_EVENTS: CatalystEvent[] = [
  { date: '08-12', name: 'CPI 数据公布', type: 'policy', importance: 'high', targets: '大盘' },
  { date: '08-15', name: '半年报密集披露期', type: 'earnings', importance: 'high', targets: '多只持仓' },
  { date: '08-18', name: '美联储议息会议', type: 'policy', importance: 'high', targets: '全球市场' },
  { date: '08-20', name: '限售股解禁', type: 'unlock', importance: 'medium', targets: '某某科技' },
  { date: '08-25', name: '分红除权日', type: 'dividend', importance: 'low', targets: '某某药业' },
  { date: '08-28', name: 'PMI 数据公布', type: 'policy', importance: 'medium', targets: '大盘' },
]

const TYPE_META: Record<CatalystEvent['type'], { icon: React.ElementType; label: string }> = {
  earnings: { icon: TrendingUp, label: '业绩' },
  policy: { icon: Landmark, label: '政策' },
  unlock: { icon: Unlock, label: '解禁' },
  dividend: { icon: Coins, label: '分红' },
  alert: { icon: AlertCircle, label: '预警' },
}

const IMPORTANCE_STYLE: Record<CatalystEvent['importance'], string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-warning/10 text-warning',
  low: 'bg-muted text-muted-foreground',
}

const IMPORTANCE_LABEL: Record<CatalystEvent['importance'], string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export default function CatalystEventWidget({ config }: { config: WidgetConfig }): React.JSX.Element {
  const title = config?.title ?? '催化剂事件'
  const events = CATALYST_EVENTS

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {events.map((event, idx) => {
          const TypeIcon = TYPE_META[event.type].icon
          return (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/30"
            >
              {/* 日期 */}
              <div className="flex w-12 shrink-0 flex-col items-center">
                <span className="text-sm font-bold text-foreground">{event.date.split('-')[1]}</span>
                <span className={`text-[10px] ${COLOR_SHADES.gray[400]}`}>{event.date.split('-')[0]}月</span>
              </div>

              {/* 分割线 */}
              <div className="h-8 w-px bg-border/40" />

              {/* 事件信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{event.name}</span>
                </div>
                <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>{event.targets}</span>
              </div>

              {/* 重要度标签 */}
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${IMPORTANCE_STYLE[event.importance]}`}>
                {IMPORTANCE_LABEL[event.importance]}
              </span>
            </div>
          )
        })}

        <div className={`pt-2 text-xs ${COLOR_SHADES.gray[400]}`}>
          共 {events.length} 个近期催化剂事件
        </div>
      </CardContent>
    </Card>
  )
}
