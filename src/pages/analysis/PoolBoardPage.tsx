/**
 * @fileoverview 研究候选池总览页面 (PoolBoardPage)
 *
 * 重构说明：
 * 本文件已从 679 行重构为纯容器组件，业务逻辑已迁移至：
 * - usePoolBoardData.ts: 数据获取、事件订阅
 * - usePoolBoardCollect.ts: 批量采集控制、防断连机制
 * - StockOverviewCard.tsx: 股票卡片展示
 * - BatchCollectionPanel.tsx: 批量采集进度面板
 *
 * 技术收益：
 * - 主文件仅负责布局和组件组合，符合单一职责原则
 * - 业务逻辑封装在 Hook 中，易于测试和复用
 * - 无任何 Service 直接依赖，符合防腐层架构
 */

import React, { useCallback, useState } from 'react'
import { usePoolBoardData } from '@/hooks/pool/usePoolBoardData'
import { usePoolBoardCollect } from '@/hooks/pool/usePoolBoardCollect'
import { StockOverviewCard } from '@/components/organisms/pool/StockOverviewCard'
import { BatchCollectionPanel } from '@/components/organisms/pool/BatchCollectionPanel'
import { useResearchPoolStore } from '@/store/researchPoolStore'
import { eventBus } from '@/lib/eventBus'
import { cn } from '@/lib/utils'
import type { CollectionProgress as ProgressType } from '@/types/modules/collection.types'

/**
 * PoolBoardPage 容器组件
 */
const PoolBoardPage: React.FC = () => {
  // 数据层：获取列表、加载状态、概览统计
  const { items, loading, summary, loadSummary } = usePoolBoardData()

  // UI 状态
  const [batchProgressMap, setBatchProgressMap] = useState<Map<string, ProgressType> | null>(null)

  // 回调：处理采集进度更新（必须用 useCallback 包裹，防止 handleCollect 闭包失效）
  const handleProgressUpdate = useCallback((progressMap: Map<string, ProgressType>) => {
    setBatchProgressMap(new Map(progressMap))
  }, [])

  // 采集层：控制批量采集逻辑
  const { collecting, collectError, refreshError, handleCollect } = usePoolBoardCollect(
    items,
    handleProgressUpdate,
  )

  // 清空研究池
  const handleClearPool = useCallback(async () => {
    const store = useResearchPoolStore.getState()
    for (const item of items) {
      await store.deleteItem(item.symbol)
    }
    eventBus.emit('POOL_CHANGED', {})
  }, [items])

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    await useResearchPoolStore.getState().refresh()
    await loadSummary(useResearchPoolStore.getState().items)
    eventBus.emit('POOL_CHANGED', {})
  }, [loadSummary])

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* 页面标题区 */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className={cn('text-h2 font-bold', 'text-foreground')}>
              研究候选池
            </h2>
            <p className={cn('mt-1 text-sm', 'text-muted-foreground')}>
              共 <span className="font-semibold">{items.length}</span> 只股票 · 平均采集进度{' '}
              <span className={cn('font-semibold', 'text-info')}>
                {summary?.avgPercent ?? 0}%
              </span>
            </p>
            {summary && Object.keys(summary.ratingCounts).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(summary.ratingCounts).map(([rating, count]) => (
                  <span
                    key={rating}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      'bg-muted',
                      'text-muted-foreground',
                    )}
                  >
                    {rating} 级: {count} 只
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                'border-input text-foreground hover:bg-muted',
                (collecting || loading) && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => void handleRefresh()}
              disabled={collecting || loading}
            >
              刷新
            </button>
            <button
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                'border-destructive/30 text-destructive hover:bg-destructive/10',
                (collecting || items.length === 0) && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => void handleClearPool()}
              disabled={collecting || items.length === 0}
            >
              清空池
            </button>
            <button
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90',
                (collecting || items.length === 0) && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => void handleCollect()}
              disabled={collecting || items.length === 0}
            >
              {collecting ? '采集中...' : '批量采集'}
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示区 */}
      // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
      {((collectError ?? '') !== '' || (refreshError ?? '') !== '') && (
        <div
          className={cn(
            'mb-4 rounded-lg border p-4',
            'border-destructive/30 bg-destructive/10',
          )}
        >
          // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
          {(collectError ?? '') !== '' && (
            <p className={cn('text-sm', 'text-destructive')}>
              采集异常: {collectError}
            </p>
          )}
          // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
          {(refreshError ?? '') !== '' && (
            <p className={cn('mt-1 text-sm', 'text-warning')}>
              进度刷新异常: {refreshError}
            </p>
          )}
        </div>
      )}

      {/* 批量采集进度面板 */}
      <BatchCollectionPanel
        collecting={collecting}
        symbols={items.map((i) => ({ symbol: i.symbol, name: i.name }))}
        progressMap={batchProgressMap}
        refreshError={refreshError}
      />

      {/* 主内容区 */}
      {loading ? (
        <div className="py-12 text-center">
          <div
            className={cn(
              'mx-auto h-8 w-8 animate-spin rounded-full border-2',
              'border-muted border-t-primary',
            )}
          />
          <p className={cn('mt-2 text-sm', 'text-muted-foreground')}>加载研究池数据...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <p className={cn('text-sm', 'text-muted-foreground')}>研究池为空</p>
          <p className={cn('mt-1 text-xs', 'text-muted-foreground/70')}>
            在个股分析页面点击"加入研究池"或使用批量导入功能
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <StockOverviewCard key={item.symbol} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

export default PoolBoardPage
