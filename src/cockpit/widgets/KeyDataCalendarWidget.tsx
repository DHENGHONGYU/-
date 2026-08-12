/**
 * @module cockpit/widgets/KeyDataCalendarWidget
 * @description 核心数据日历 — 投资者视角的持续关注组件
 *
 * 展示即将公布的核心经济数据（CPI、GDP、PMI、社融等），
 * 帮助投资者持续跟踪"什么数据即将发布"和"预期值是多少"。
 *
 * 数据源：当前使用内置 mock 数据，后续接入 /market/key-data-calendar API。
 */
import React from 'react'
import { BarChart3, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import type { WidgetConfig } from '@/types/modules/widget.types'
import { twBg, twText, COLOR_SHADES } from '@/constants/theme.tokens'

interface KeyDataItem {
  date: string
  indicator: string
  expected: string
  previous: string
  impact: 'high' | 'medium' | 'low'
}

const KEY_DATA: KeyDataItem[] = [
  { date: '08-12', indicator: '7月 CPI', expected: '2.5%', previous: '2.4%', impact: 'high' },
  { date: '08-15', indicator: '工业增加值', expected: '5.2%', previous: '5.1%', impact: 'high' },
  { date: '08-15', indicator: '社零总额', expected: '3.8%', previous: '3.6%', impact: 'medium' },
  { date: '08-20', indicator: 'LPR 利率', expected: '3.35%', previous: '3.35%', impact: 'high' },
  { date: '08-27', indicator: '8月 PMI', expected: '49.5', previous: '49.3', impact: 'medium' },
  { date: '08-30', indicator: '二季度 GDP', expected: '5.1%', previous: '5.3%', impact: 'high' },
]

const IMPACT_STYLE: Record<KeyDataItem['impact'], string> = {
  high: `${twBg('red', 50)} ${twText('red', 600)}`,
  medium: `${twBg('amber', 50)} ${twText('amber', 600)}`,
  low: `${twBg('gray', 50)} ${twText('gray', 500)}`,
}

const IMPACT_LABEL: Record<KeyDataItem['impact'], string> = {
  high: '高影响',
  medium: '中',
  low: '低',
}

export default function KeyDataCalendarWidget({ config }: { config: WidgetConfig }): React.JSX.Element {
  const title = config?.title ?? '核心数据日历'
  const items = KEY_DATA

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 transition-colors hover:bg-muted/30"
          >
            {/* 日期 */}
            <div className="flex w-12 shrink-0 flex-col items-center">
              <span className="text-sm font-bold text-foreground">{item.date.split('-')[1]}</span>
              <span className={`text-[10px] ${COLOR_SHADES.gray[400]}`}>{item.date.split('-')[0]}月</span>
            </div>

            <div className="h-8 w-px bg-border/40" />

            {/* 指标 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">{item.indicator}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>
                  前值: <span className="font-medium text-foreground/70">{item.previous}</span>
                </span>
                <span className={`text-xs ${COLOR_SHADES.gray[400]}`}>
                  预期: <span className="font-medium text-foreground/70">{item.expected}</span>
                </span>
              </div>
            </div>

            {/* 影响度 */}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${IMPACT_STYLE[item.impact]}`}>
              {IMPACT_LABEL[item.impact]}
            </span>
          </div>
        ))}

        <div className={`flex items-center gap-1 pt-2 text-xs ${COLOR_SHADES.gray[400]}`}>
          <Clock className="h-3 w-3" />
          下一个数据点：{items[0]?.date ?? '—'}
        </div>
      </CardContent>
    </Card>
  )
}
