/**
 * @module VirtualizedHoldingsTable
 * @description 虚拟滚动持仓表格组件。使用 @tanstack/react-virtual 实现大数据量表格的高性能渲染。
 * 当持仓数量超过100条时自动启用虚拟滚动，避免DOM节点过多导致的性能问题。
 * v0.9.11 P2-PERF002
 */

import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { Badge } from '@/components/atoms/Badge'
import {
  HOLDING_ACTION,
  HOLDING_ACTION_LABELS,
  STRATEGY_TYPE_LABELS,
  STRATEGY_TYPE_COLORS,
  getPnlColorClass,
  getPnlBgClass,
} from '@/constants/trade.constants'
import type { HoldingItem } from '@/types/modules/trade.types'
import type { HoldingAction } from '@/constants/trade.constants'

// 虚拟滚动阈值，超过此数量启用
const VIRTUALIZATION_THRESHOLD = 100

// 静态样式常量（避免每次渲染创建新对象引用）
const ROW_MIN_HEIGHT_STYLE: React.CSSProperties = { minHeight: '48px' }
const HEADER_MIN_HEIGHT_STYLE: React.CSSProperties = { minHeight: '40px' }
const CONTAIN_STRICT_STYLE: React.CSSProperties = { contain: 'strict' }

interface VirtualizedHoldingsTableProps {
  /** 持仓数据列表 */
  data: HoldingItem[]
  /** 是否加载中 */
  isLoading: boolean
  /** 操作列点击回调 */
  onAction: (item: HoldingItem, action: HoldingAction) => void
}

interface HoldingsRowProps {
  holding: HoldingItem
  onAction: (item: HoldingItem, action: HoldingAction) => void
}

function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/** 单行持仓数据渲染 */
function HoldingsRow({ holding, onAction }: HoldingsRowProps): React.JSX.Element {
  const pnlColorClass = getPnlColorClass(holding.floatingPnl)
  const pnlBgClass = getPnlBgClass(holding.floatingPnl)
  const strategyConfig = STRATEGY_TYPE_COLORS[holding.strategyType]

  return (
    <div
      className="grid grid-cols-[100px_120px_1fr_1fr_1fr_1fr_1fr_100px_140px] items-center border-b px-4"
      style={ROW_MIN_HEIGHT_STYLE}
    >
      {/* 左侧固定列：证券代码 */}
      <div className="sticky left-0 z-10 bg-background font-mono text-sm">{holding.code}</div>
      {/* 左侧固定列：证券名称 */}
      <div className="sticky left-[100px] z-10 bg-background font-medium">{holding.name}</div>
      <div className="text-right tabular-nums">{formatNumber(holding.quantity, 0)}</div>
      <div className="text-right tabular-nums">{formatNumber(holding.currentPrice)}</div>
      <div className="text-right tabular-nums">{formatNumber(holding.avgCost)}</div>
      {/* 浮动盈亏：语义化颜色 */}
      <div className={`text-right tabular-nums ${pnlBgClass}`}>
        <div className="flex items-center justify-end gap-1">
          {holding.floatingPnl > 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : holding.floatingPnl < 0 ? (
            <TrendingDown className="h-3.5 w-3.5" />
          ) : null}
          <span className={pnlColorClass}>{formatPercent(holding.floatingPnlPercent)}</span>
          <span className={`text-xs ${pnlColorClass}`}>({formatNumber(holding.floatingPnl)})</span>
        </div>
      </div>
      <div className="text-right tabular-nums">{formatPercent(holding.marketValueRatio * 100)}</div>
      {/* 策略类型标签 */}
      <div>
        { }
        {strategyConfig ? (
          <Badge
            variant="outline"
            className={`${strategyConfig.bg} ${strategyConfig.text} ${strategyConfig.border}`}
          >
            {STRATEGY_TYPE_LABELS[holding.strategyType]}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>
      {/* 右侧固定列：操作 */}
      <div className="sticky right-0 z-10 flex items-center justify-center gap-2 bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction(holding, HOLDING_ACTION.ADD_POSITION)}
          className="h-7 text-xs"
        >
          {HOLDING_ACTION_LABELS[HOLDING_ACTION.ADD_POSITION]}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onAction(holding, HOLDING_ACTION.CLOSE_POSITION)}
          className="h-7 text-xs"
        >
          {HOLDING_ACTION_LABELS[HOLDING_ACTION.CLOSE_POSITION]}
        </Button>
      </div>
    </div>
  )
}

/** 骨架屏行 */
function SkeletonRow(): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-[100px_120px_1fr_1fr_1fr_1fr_1fr_100px_140px] items-center border-b px-4 py-2"
      style={ROW_MIN_HEIGHT_STYLE}
    >
      {Array.from({ length: 9 }).map((_, idx) => (
        <Skeleton key={idx} className="h-5 w-full" />
      ))}
    </div>
  )
}

/** 空数据状态 */
function EmptyState(): React.JSX.Element {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
      <svg
        className="h-10 w-10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <p className="text-sm">暂无持仓数据</p>
      <p className="text-xs">调整筛选条件或添加持仓后重试</p>
    </div>
  )
}

/** 表头 */
function TableHeader(): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-[100px_120px_1fr_1fr_1fr_1fr_1fr_100px_140px] items-center border-b bg-muted/50 px-4 py-2 font-medium"
      style={HEADER_MIN_HEIGHT_STYLE}
    >
      <div className="sticky left-0 z-20 bg-muted/50">证券代码</div>
      <div className="sticky left-[100px] z-20 bg-muted/50">证券名称</div>
      <div className="text-right">持仓数量</div>
      <div className="text-right">当前价格</div>
      <div className="text-right">成本价</div>
      <div className="text-right">浮动盈亏</div>
      <div className="text-right">市值占比</div>
      <div className="text-center">策略类型</div>
      <div className="sticky right-0 z-20 text-center bg-muted/50">操作</div>
    </div>
  )
}

/**
 * 虚拟滚动持仓表格组件
 * 当数据量超过 VIRTUALIZATION_THRESHOLD (100条) 时自动启用虚拟滚动
 */
export function VirtualizedHoldingsTable({
  data,
  isLoading,
  onAction,
}: VirtualizedHoldingsTableProps): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null)

  // 根据数据量决定是否启用虚拟滚动
  const useVirtual = data.length > VIRTUALIZATION_THRESHOLD

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // 每行高度
    overscan: 5, // 预渲染行数
  })

  // 加载状态
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-md border">
        <TableHeader />
        <div>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    )
  }

  // 空数据状态
  if (data.length === 0) {
    return (
      <div className="overflow-hidden rounded-md border">
        <TableHeader />
        <EmptyState />
      </div>
    )
  }

  // 小数据量：直接渲染（避免虚拟滚动开销）
  if (!useVirtual) {
    return (
      <div className="overflow-hidden rounded-md border">
        <TableHeader />
        <div>
          {data.map((item) => (
            <HoldingsRow key={item.code} holding={item} onAction={onAction} />
          ))}
        </div>
      </div>
    )
  }

  // 大数据量：虚拟滚动渲染
  return (
    <div className="overflow-hidden rounded-md border">
      <TableHeader />
      <div
        ref={parentRef}
        className="h-[500px] overflow-auto"
        style={CONTAIN_STRICT_STYLE}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const holding = data[virtualRow.index]
            if (!holding) return null
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <HoldingsRow holding={holding} onAction={onAction} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default VirtualizedHoldingsTable
