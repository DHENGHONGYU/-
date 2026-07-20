/**
 * @module PoolBoardPage
 * @description 输入舱 · 研究候选池总览 + 数据采集进度监控
 *
 * 职责定位：
 * - 展示已纳入研究候选池的所有股票基本信息
 * - 展示每只股票的数据采集进度（七维度完成状态 + 质量评级）
 * - 展示资讯采集统计（时效性 × 高质量双维度）
 * - 提供"去驾驶舱管理"入口
 *
 * 注：研究池的状态管理（流转/分组/批量操作）已迁移至驾驶舱 Widget。
 *
 * @created 2026-07-19
 */

import React from 'react'
import { Button } from '@/components/atoms'
import { Card, CardContent } from '@/components/atoms'
import { Badge } from '@/components/atoms'
import { PageContainer, PageHeader } from '@/components/templates'
import { CollectionProgress } from '@/components/organisms/pool/CollectionProgress'
import { StockNewsStats } from '@/components/organisms/pool/StockNewsStats'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { COLOR_TOKENS, twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'
import type { PoolItem } from '@/types/modules/pool.types'

// ============================================================
// 辅助函数
// ============================================================

function formatMarketCap(cap?: number): string {
  if (cap === undefined || cap === null) return '—'
  if (cap >= 10_000) return `${(cap / 10_000).toFixed(1)}万亿`
  if (cap >= 1) return `${cap.toFixed(0)}亿`
  return `${(cap * 10_000).toFixed(0)}万`
}

const STATUS_LABELS: Record<string, string> = {
  candidate: '候选',
  screened: '初筛',
  deepDive: '深研',
  watching: '跟踪',
  archived: '归档',
}

const STATUS_COLORS: Record<string, string> = {
  candidate: 'bg-stone-100 text-stone-700 dark:bg-neutral-800 dark:text-neutral-300',
  screened: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  deepDive: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  watching: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  archived: 'bg-stone-200 text-stone-500 dark:bg-neutral-800 dark:text-neutral-500',
}

// ============================================================
// 股票卡片
// ============================================================

function StockOverviewCard({ item }: { item: PoolItem }): React.JSX.Element {
  const status = item.status as string
  return (
    <div className={cn('rounded-lg border p-4 transition-shadow hover:shadow-md', twBorder('stone', 200), DARK.borderNeutral700)}>
      {/* ── 头部：代码 + 名称 + 状态 ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('font-mono text-sm font-semibold', twText('stone', 800), DARK.textNeutral100)}>
            {item.symbol}
          </p>
          <p className={cn('truncate text-sm', twText('stone', 600), DARK.textNeutral300)}>
            {item.name}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[status] ?? STATUS_COLORS.candidate)}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* ── 基本信息 ── */}
      <div className={cn('mt-2 grid grid-cols-3 gap-x-3 gap-y-1 rounded-md border px-2.5 py-2 text-xs', twBorder('stone', 100), twBg('stone', 50), DARK.borderNeutral800, DARK.bgNeutral900)}>
        {item.sector && (
          <div>
            <span className={twText('stone', 400)}>行业</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.sector}</p>
          </div>
        )}
        {item.marketCap !== undefined && (
          <div>
            <span className={twText('stone', 400)}>市值</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{formatMarketCap(item.marketCap)}</p>
          </div>
        )}
        {item.price !== undefined && (
          <div>
            <span className={twText('stone', 400)}>价格</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.price.toFixed(2)}</p>
          </div>
        )}
        {item.pe !== undefined && (
          <div>
            <span className={twText('stone', 400)}>PE</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.pe.toFixed(1)}</p>
          </div>
        )}
        {item.pb !== undefined && (
          <div>
            <span className={twText('stone', 400)}>PB</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.pb.toFixed(1)}</p>
          </div>
        )}
        {item.roe !== undefined && (
          <div>
            <span className={twText('stone', 400)}>ROE</span>
            <p className={cn('font-medium', twText('stone', 700), DARK.textNeutral200)}>{item.roe.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* ── 数据采集进度 ── */}
      <div className={cn('mt-3 rounded-md border p-3', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('mb-2 text-[10px] font-medium uppercase tracking-wider', twText('stone', 400))}>
          数据采集进度
        </p>
        <CollectionProgress symbol={item.symbol} />
      </div>

      {/* ── 资讯采集统计 ── */}
      <div className={cn('mt-3 rounded-md border p-3', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('mb-2 text-[10px] font-medium uppercase tracking-wider', twText('stone', 400))}>
          资讯采集（时效 × 质量）
        </p>
        <StockNewsStats symbol={item.symbol} />
      </div>
    </div>
  )
}

// ============================================================
// 主页面
// ============================================================

export default function PoolBoardPage(): React.JSX.Element {
  const items = useResearchPoolStore((s) => s.items)
  const loading = useResearchPoolStore((s) => s.loading)
  const refresh = useResearchPoolStore((s) => s.refresh)

  const stats = React.useMemo(() => {
    const total = items.length
    const statusCounts: Record<string, number> = {}
    for (const item of items) {
      const s = item.status as string
      statusCounts[s] = (statusCounts[s] ?? 0) + 1
    }
    return { total, statusCounts }
  }, [items])

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="研究候选池"
        description="已纳入研究候选池的股票基本信息与数据采集进度总览"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={COLOR_TOKENS.info.tailwind}>
              {stats.total} 只标的
            </Badge>
            {Object.entries(stats.statusCounts).map(([status, count]) => (
              <Badge key={status} variant="secondary" className={cn('text-[10px]', twText('stone', 500))}>
                {STATUS_LABELS[status] ?? status} {count}
              </Badge>
            ))}
          </div>
        }
      />

      {/* ── 工具栏 ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新数据'}
        </Button>
        <span className={cn('text-xs', twText('stone', 400))}>
          状态管理（流转/分组/批量操作）请在
          <a href="#/cockpit" className={cn('mx-1 underline', COLOR_TOKENS.info.tailwind)}>
            驾驶舱
          </a>
          中操作
        </span>
      </div>

      {/* ── 说明 ── */}
      <div className={cn('rounded-md border px-4 py-3 text-xs', twBorder('stone', 100), twBg('stone', 50) + '/50', DARK.borderNeutral800, DARK.bgNeutral900)}>
        <p className={cn('font-medium', twText('stone', 600), DARK.textNeutral300)}>
          采集进度说明
        </p>
        <ul className={cn('mt-1 space-y-0.5', twText('stone', 500))}>
          <li>七维度采集：基础数据 / K线行情 / 筹码分布 / 事件驱动 / 新闻资讯 / 行业数据 / 指数数据</li>
          <li>质量评级：优秀(≥85%) / 良好(≥70%) / 一般(≥40%) / 较差(&lt;40%)</li>
          <li>资讯双维度：时效性（近1周/1月/3月/全部）× 高质量（sentimentConfidence ≥ 0.7）</li>
        </ul>
      </div>

      {/* ── 股票卡片网格 ── */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className={cn('text-lg', twText('stone', 400))}>研究候选池暂无标的</p>
            <p className={cn('mt-2 text-sm', twText('stone', 400))}>
              请先通过"批量导入"功能添加股票到研究候选池
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <StockOverviewCard key={item.symbol} item={item} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
