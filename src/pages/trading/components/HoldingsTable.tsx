/**
 * @module HoldingsTable
 * @description 持仓数据表格组件。左侧固定证券代码/名称列，右侧固定操作列，盈亏列使用语义化颜色渲染。
 * 加载状态显示骨架屏，空数据显示空状态提示。
 * 所有颜色、列宽、固定配置从 @/constants/trade.constants 引用，禁止硬编码。
 */

import React from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/atoms/Table'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { Badge } from '@/components/atoms/Badge'
import {
  HOLDING_ACTION,
  HOLDING_ACTION_LABELS,
  STRATEGY_TYPE_LABELS,
  STRATEGY_TYPE_COLORS,
  getPnlColorClass,
  getPnlBgClass,
  SKELETON_ROW_COUNT,
  SKELETON_COLUMNS,
} from '@/constants/trade.constants'
import type { HoldingItem } from '@/types/modules/trade.types'
import type { HoldingAction } from '@/constants/trade.constants'

interface HoldingsTableProps {
  /** 持仓数据列表 */
  data: HoldingItem[]
  /** 是否加载中 */
  isLoading: boolean
  /** 操作列点击回调 */
  onAction: (item: HoldingItem, action: HoldingAction) => void
}

function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/** 骨架屏行 */
function SkeletonRow(): React.JSX.Element {
  return (
    <TableRow>
      {SKELETON_COLUMNS.map((col, idx) => (
        <TableCell key={idx}>
          <Skeleton className={`h-5 ${col.width}`} />
        </TableCell>
      ))}
    </TableRow>
  )
}

/** 空数据状态 */
function EmptyState(): React.JSX.Element {
  return (
    <TableRow>
      <td colSpan={9} className="h-48 text-center p-4 align-middle">
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-sm">暂无持仓数据</p>
          <p className="text-xs">调整筛选条件或添加持仓后重试</p>
        </div>
      </td>
    </TableRow>
  )
}

/**
 * HoldingsTable
 */
export default function HoldingsTable({
  data,
  isLoading,
  onAction,
}: HoldingsTableProps): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {/* 左侧固定列：证券代码 */}
            <TableHead className="sticky left-0 z-10 bg-background min-w-[100px]">
              证券代码
            </TableHead>
            {/* 左侧固定列：证券名称 */}
            <TableHead className="sticky left-[100px] z-10 bg-background min-w-[120px]">
              证券名称
            </TableHead>
            <TableHead className="text-right">持仓数量</TableHead>
            <TableHead className="text-right">当前价格</TableHead>
            <TableHead className="text-right">成本价</TableHead>
            <TableHead className="text-right">浮动盈亏</TableHead>
            <TableHead className="text-right">市值占比</TableHead>
            <TableHead>策略类型</TableHead>
            {/* 右侧固定列：操作 */}
            <TableHead className="sticky right-0 z-10 bg-background text-center min-w-[140px]">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
              <SkeletonRow key={i} />
            ))
          ) : data.length === 0 ? (
            <EmptyState />
          ) : (
            data.map((item) => {
              const pnlColorClass = getPnlColorClass(item.floatingPnl)
              const pnlBgClass = getPnlBgClass(item.floatingPnl)
              const strategyConfig = STRATEGY_TYPE_COLORS[item.strategyType]

              return (
                <TableRow key={item.code}>
                  {/* 左侧固定列 */}
                  <TableCell className="sticky left-0 z-10 bg-background font-mono text-sm">
                    {item.code}
                  </TableCell>
                  <TableCell className="sticky left-[100px] z-10 bg-background font-medium">
                    {item.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(item.quantity, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(item.currentPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(item.avgCost)}
                  </TableCell>
                  {/* 浮动盈亏：语义化颜色 */}
                  <TableCell className={`text-right tabular-nums ${pnlBgClass}`}>
                    <div className="flex items-center justify-end gap-1">
                      {item.floatingPnl > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : item.floatingPnl < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : null}
                      <span className={pnlColorClass}>
                        {formatPercent(item.floatingPnlPercent)}
                      </span>
                      <span className={`text-xs ${pnlColorClass}`}>
                        ({formatNumber(item.floatingPnl)})
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(item.marketValueRatio * 100)}
                  </TableCell>
                  {/* 策略类型标签 */}
                  <TableCell>
                    {strategyConfig ? (
                      <Badge
                        variant="outline"
                        className={`${strategyConfig.bg} ${strategyConfig.text} ${strategyConfig.border}`}
                      >
                        {STRATEGY_TYPE_LABELS[item.strategyType]}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  {/* 右侧固定列 */}
                  <TableCell className="sticky right-0 z-10 bg-background">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAction(item, HOLDING_ACTION.ADD_POSITION)}
                        className="h-7 text-xs"
                      >
                        {HOLDING_ACTION_LABELS[HOLDING_ACTION.ADD_POSITION]}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onAction(item, HOLDING_ACTION.CLOSE_POSITION)}
                        className="h-7 text-xs"
                      >
                        {HOLDING_ACTION_LABELS[HOLDING_ACTION.CLOSE_POSITION]}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}