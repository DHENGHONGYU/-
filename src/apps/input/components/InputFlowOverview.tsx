/**
 * @fileoverview 输入舱流程阶段总览条
 *
 * 体现输入舱整体思路：双源输入（股票清单）→ 数据采集（过程显示）→ 结果汇总（数据库/本地文件夹）→ 分析舱调用。
 * 数据来自意向候选池 store（清单数与采集覆盖度），各阶段可点击跳转。
 *
 * @module apps/input/components/InputFlowOverview
 */
import React from 'react'
import { Link } from 'react-router'
import { ChevronRight, Database, FlaskConical, Inbox, Radar } from 'lucide-react'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'input', title: '双源输入', desc: '股票清单', path: '/input', icon: Inbox },
  { key: 'collect', title: '数据采集', desc: '采集过程显示', path: '/input/collection-monitor', icon: Radar },
  { key: 'summary', title: '结果汇总', desc: '数据库 · 本地文件夹', path: '/input/pool-board', icon: Database },
  { key: 'analysis', title: '分析舱调用', desc: '个股智能分析等', path: '/analysis?scope=intention', icon: FlaskConical },
] as const

/**
 * InputFlowOverview —— 输入舱流程阶段总览条
 */
export default function InputFlowOverview(): React.JSX.Element {
  const items = useIntentionPoolStore((s) => s.items)

  const total = items.length
  const hotCount = items.filter((s) => (s.pool === 'intention' ? s.screenSource === 'hot-sector' : false)).length
  const manualCount = total - hotCount
  const withPrice = items.filter((s) => s.price !== undefined).length
  const coverage = total > 0 ? Math.round((withPrice / total) * 100) : 0

  const metrics: string[] = [
    `来源二 手动 ${manualCount} · 来源一 热门 ${hotCount}`,
    `已采 ${withPrice}/${total}（${coverage}%）`,
    `${total} 只清单入库`,
    '→ 分析舱',
  ]

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {STEPS.map((step, i) => {
          const isCurrent = step.key === 'input'
          const isLast = i === STEPS.length - 1
          const Icon = step.icon
          return (
            <React.Fragment key={step.key}>
              <Link
                to={step.path}
                className={cn(
                  'group flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-muted/60',
                  isCurrent && 'bg-muted/70 ring-1 ring-border',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isCurrent ? 'bg-info/10 text-info' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
                <Icon className={cn('h-4 w-4 shrink-0', isCurrent ? 'text-info' : 'text-muted-foreground')} />
                <div className="min-w-0">
                  <div className={cn('text-sm font-medium', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                    {step.title}
                    {isCurrent && <span className="ml-1.5 text-[10px] text-info">当前</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground/70">{metrics[i]}</div>
                </div>
              </Link>
              {!isLast && (
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 lg:block" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}