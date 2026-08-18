import React from 'react'
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Eye, RefreshCw } from 'lucide-react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import type { WidgetConfig, WatchlistData } from '@/types/modules/widget.types'
import { useMarketData } from '@/cockpit/providers/MarketDataProvider'
import { getStockColorHex } from '@/constants/theme.tokens'
import { eventBus } from '@/lib/eventBus'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { getObservationPoolReviewer, type ObservationReviewResult } from '@/services/orchestration/observationPoolReviewer'

interface WatchlistWidgetProps {
  config: WidgetConfig
}

/**
 * WatchlistWidget — 观察池行情 + 复盘摘要
 *
 * 复盘摘要闭环投研全链路 spec 缺口②「结果可见性」：
 * 订阅 OBSERVATION_REVIEW_COMPLETED 事件，并初始读取最近一次内存复盘结果，
 * 在行情列表上方展示评分漂移与晋升情况。仅在存在复盘结果时渲染
 * （初始/无复盘时为 null，不影响 empty/loading/error 态与既有测试）。
 *
 * 另提供「立即复盘」按钮，供用户主动触发一次复盘（闭环交互完备性）。
 */
export default function WatchlistWidget({ config }: WatchlistWidgetProps): React.JSX.Element {
  const { data, loadingMap, errorMap, refreshWidget } = useMarketData()
  const watchlist = data.watchlist
  const loading = loadingMap[config.instanceId] ?? true
  const error = errorMap[config.instanceId]

  const [lastReview, setLastReview] = useState<ObservationReviewResult | null>(() =>
    getObservationPoolReviewer().getLastReview(),
  )
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  useEffect(() => {
    const unsub = eventBus.on(EVENT_NAMES.OBSERVATION_REVIEW_COMPLETED, (p) => {
      setLastReview(p as ObservationReviewResult)
    })
    return () => unsub()
  }, [])

  const handleManualReview = async () => {
    if (reviewing) return
    setReviewing(true)
    setReviewError(null)
    try {
      const result = await getObservationPoolReviewer().manualTrigger()
      setLastReview(result)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '复盘失败')
    } finally {
      setReviewing(false)
    }
  }

  const getChangeIcon = (change: number) => {
    const color = getStockColorHex(change)
    if (change > 0) return <TrendingUp className="h-4 w-4" style={{ color }} />
    if (change < 0) return <TrendingDown className="h-4 w-4" style={{ color }} />
    return <Minus className="h-4 w-4" style={{ color }} />
  }

  const getChangeColor = (change: number) => {
    return getStockColorHex(change)
  }

  let visualState: 'ready' | 'loading' | 'empty' | 'error' = 'ready'
  if (error) {
    visualState = 'error'
  } else if (loading) {
    visualState = 'loading'
  } else if (watchlist.length === 0) {
    visualState = 'empty'
  }

  return (
    <WidgetStateShell
      title={config.title}
      titleIcon={<Eye className="text-success" />}
      visualState={visualState}
      error={error}
      onRetry={() => refreshWidget(config.instanceId)}
      loadingLabel="加载自选行情…"
      emptyTitle="暂无自选标的"
      emptyDescription="当前观察池为空，添加股票后将自动展示行情"
      className="widget-card-elevated"
      skeleton={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="text" className="bg-muted" />
              <div className="flex gap-2">
                <Skeleton variant="text" className="bg-muted" />
                <Skeleton variant="text" className="bg-muted" />
              </div>
            </div>
          ))}
        </div>
      }
    >
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleManualReview}
          disabled={reviewing}
          title="立即对观察池标的执行一次评分复盘"
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={reviewing ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
          {reviewing ? '复盘中…' : '立即复盘'}
        </button>
        {reviewError && (
          <span className="text-[11px] font-medium text-destructive" title={reviewError}>
            复盘未执行
          </span>
        )}
      </div>
      {lastReview && (
        <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">观察池复盘</span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(lastReview.generatedAt).toLocaleString('zh-CN')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div>
              <div className="text-[11px] text-muted-foreground">复盘标的</div>
              <div className="text-base font-semibold">{lastReview.summary.total}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">评分↑</div>
              <div className="text-base font-semibold" style={{ color: getStockColorHex(1) }}>{lastReview.summary.improved}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">评分↓</div>
              <div className="text-base font-semibold" style={{ color: getStockColorHex(-1) }}>{lastReview.summary.declined}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">平稳</div>
              <div className="text-base font-semibold text-muted-foreground">{lastReview.summary.unchanged}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">晋升候选</div>
              <div className="text-base font-semibold">{lastReview.promotionCandidates.length}</div>
            </div>
          </div>
          {lastReview.promotionCandidates.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {lastReview.promotionCandidates.slice(0, 6).map((s) => (
                <span key={s} className="rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">{s}</span>
              ))}
              {lastReview.promotionCandidates.length > 6 && (
                <span className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">等 {lastReview.promotionCandidates.length} 只</span>
              )}
            </div>
          )}
          {lastReview.enrolled.length > 0 && (
            <div className="mt-2 text-[11px] font-medium" style={{ color: getStockColorHex(1) }}>
              已自动入研究池 {lastReview.enrolled.length} 只
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {watchlist.map((stock: WatchlistData) => (
          <div key={stock.code} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{stock.name}</span>
              {getChangeIcon(stock.changePercent)}
            </div>
            <div className="text-muted-foreground/70">{stock.code}</div>
            <div className="text-lg font-bold">{stock.price.toFixed(2)}</div>
            <div className="text-sm font-medium" style={{ color: getChangeColor(stock.changePercent) }}>
              {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </WidgetStateShell>
  )
}
