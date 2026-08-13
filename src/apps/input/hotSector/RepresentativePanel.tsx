import React from 'react'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RepresentativePick } from '../hotSector.utils'

export interface RepresentativePanelProps {
  picks: RepresentativePick[]
  timelyOnly: boolean
  onReExtract: () => void
}

/**
 * 代表股筛选面板（来源一·热门赛道）
 *
 * 展示按板块综合评分抽取的 15-20 只代表股清单，
 * 附带板块归属、板块评分与及时性（近一周）标记。
 */
export function RepresentativePanel({
  picks,
  timelyOnly,
  onReExtract,
}: RepresentativePanelProps): React.JSX.Element | null {
  if (picks.length === 0) return null

  return (
    <Card className="border-info/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-info" />
            <CardTitle className="text-sm">热门赛道代表股筛选清单</CardTitle>
          </div>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onReExtract}>
            重新抽取
          </Button>
        </div>
        <CardDescription className="text-xs">
          按板块综合评分降序跨板块抽取 {picks.length} 只代表股（上限 20）·{' '}
          {timelyOnly ? '仅含近一周评分板块' : '含全部评分板块'} · 勾选「加入代表股」可一键入池
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn('grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3')}>
          {picks.map((pick) => (
            <div
              key={pick.symbol}
              className={cn(
                'flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm',
                pick.timely ? 'border-success/30' : 'border-destructive/30',
              )}
            >
              <span className="font-mono text-xs text-foreground">{pick.symbol}</span>
              <span className="flex-1 truncate text-xs text-muted-foreground">{pick.name}</span>
              <span className="hidden truncate text-[11px] text-muted-foreground/70 sm:inline">
                {pick.sectorName}
              </span>
              <Badge variant="outline" className="text-[10px]">{pick.sectorScore}</Badge>
              {pick.timely ? (
                <Badge className="bg-success/10 text-success text-[10px]">
                  {pick.daysAgo !== null && pick.daysAgo <= 1 ? '今日' : `${pick.daysAgo}天前`}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  {pick.daysAgo !== null ? `${pick.daysAgo}天前` : '未标注'}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}