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
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-primary" />
        <span>加载中</span>
      </div>
    )
  }

  if (!stats || stats.all.total === 0) {
    return <span className="text-xs text-muted-foreground">暂无资讯</span>
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
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            共 <strong className="text-foreground">{currentStats.total}</strong> 条
          </span>
          {currentStats.highQuality > 0 && (
            <span className="text-success">
              高质量 <strong className="text-success">{currentStats.highQuality}</strong>
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
                ? 'bg-primary/15 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {WINDOW_LABELS[w]}
            {w !== 'all' && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                {getStatsForWindow(stats, w).total}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4 rounded-md border border-border bg-surface-2 px-3 py-2">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{currentStats.total}</p>
          <p className="text-[10px] text-muted-foreground">总条数</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-success">{currentStats.highQuality}</p>
          <p className="text-[10px] text-muted-foreground">高质量</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-warning">
            {currentStats.total > 0 ? Math.round((currentStats.highQuality / currentStats.total) * 100) : 0}%
          </p>
          <p className="text-[10px] text-muted-foreground">高质量占比</p>
        </div>
      </div>
    </div>
  )
}
