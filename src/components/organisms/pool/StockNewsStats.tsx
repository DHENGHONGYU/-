/**
 * @fileoverview 个股资讯统计展示组件
 *
 * 双维度展示：
 * - 时效性维度：近1周 / 近1月 / 近3月 / 全部
 * - 质量维度：总条数 / 高质量条数（sentimentConfidence >= 0.7）
 *
 * @module components/organisms/pool/StockNewsStats
 * @created 2026-07-19
 */

import React, { useEffect, useState } from 'react'
import {
  getStockNewsStats,
  type StockNewsStats as StatsType,
  type NewsTimeWindow,
} from '@/services/pool/newsStatsService'
import { twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'

export interface StockNewsStatsProps {
  symbol: string
  activeWindow?: NewsTimeWindow
  onWindowChange?: (window: NewsTimeWindow) => void
  compact?: boolean
}

const WINDOW_LABELS: Record<NewsTimeWindow, string> = {
  '1w': '近1周',
  '1m': '近1月',
  '3m': '近3月',
  all: '全部',
}

const WINDOW_ORDER: NewsTimeWindow[] = ['1w', '1m', '3m', 'all']

function getStatsForWindow(stats: StatsType, window: NewsTimeWindow): { total: number; highQuality: number } {
  switch (window) {
    case '1w': return stats.last1w
    case '1m': return stats.last1m
    case '3m': return stats.last3m
    default: return stats.all
  }
}

export function StockNewsStats({
  symbol,
  activeWindow = '1m',
  onWindowChange,
  compact = false,
}: StockNewsStatsProps): React.JSX.Element {
  const [stats, setStats] = useState<StatsType | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const result = await getStockNewsStats(symbol)
      if (!cancelled) {
        setStats(result)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [symbol])

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1 text-xs', twText('stone', 400))}>
        <div className={cn('h-3 w-3 animate-spin rounded-full border', twBorder('stone', 300), 'border-t-emerald-500')} />
        <span>加载中</span>
      </div>
    )
  }

  if (!stats || stats.all.total === 0) {
    return <span className={cn('text-xs', twText('stone', 400))}>暂无资讯</span>
  }

  const currentStats = getStatsForWindow(stats, activeWindow)

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          {WINDOW_ORDER.map((w) => (
            <button
              key={w}
              onClick={() => onWindowChange?.(w)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] transition-colors',
                w === activeWindow
                  ? [twBg('emerald', 100), twText('emerald', 700), 'font-medium']
                  : [twText('stone', 400), 'hover:' + twBg('stone', 100)],
              )}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={twText('stone', 600)}>
            共 <strong className={twText('stone', 800)}>{currentStats.total}</strong> 条
          </span>
          {currentStats.highQuality > 0 && (
            <span className={twText('emerald', 600)}>
              高质量 <strong className={twText('emerald', 700)}>{currentStats.highQuality}</strong>
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {WINDOW_ORDER.map((w) => (
          <button
            key={w}
            onClick={() => onWindowChange?.(w)}
            className={cn(
              'rounded-md px-2 py-1 text-xs transition-colors',
              w === activeWindow
                ? [twBg('emerald', 100), twText('emerald', 700), 'font-medium', DARK.bgNeutral700, DARK.textEmerald400]
                : [twText('stone', 500), 'hover:' + twBg('stone', 100), DARK.textNeutral400, DARK.hoverBgNeutral900Half],
            )}
          >
            {WINDOW_LABELS[w]}
            {w !== 'all' && (
              <span className={cn('ml-1 text-[10px]', twText('stone', 400))}>
                {getStatsForWindow(stats, w).total}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={cn('flex items-center gap-4 rounded-md border px-3 py-2', twBorder('stone', 200), twBg('stone', 50), DARK.borderNeutral700, DARK.bgNeutral900)}>
        <div className="text-center">
          <p className={cn('text-lg font-bold', twText('stone', 800), DARK.textNeutral100)}>{currentStats.total}</p>
          <p className={cn('text-[10px]', twText('stone', 500))}>总条数</p>
        </div>
        <div className={cn('h-8 w-px', twBg('stone', 200), DARK.bgNeutral700)} />
        <div className="text-center">
          <p className={cn('text-lg font-bold', twText('emerald', 600), DARK.textEmerald400)}>{currentStats.highQuality}</p>
          <p className={cn('text-[10px]', twText('stone', 500))}>高质量</p>
        </div>
        <div className={cn('h-8 w-px', twBg('stone', 200), DARK.bgNeutral700)} />
        <div className="text-center">
          <p className={cn('text-lg font-bold', twText('amber', 600), DARK.textAmber300)}>
            {currentStats.total > 0 ? Math.round((currentStats.highQuality / currentStats.total) * 100) : 0}%
          </p>
          <p className={cn('text-[10px]', twText('stone', 500))}>高质量占比</p>
        </div>
      </div>
    </div>
  )
}
