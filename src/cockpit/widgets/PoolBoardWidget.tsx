/**
 * @fileoverview 驾驶舱 · 研究池管理 Widget（增强版）
 *
 * 整合完整的研究池管理功能：
 * - 看板/列表视图切换
 * - 状态流转（candidate → screened → deepDive → watching → archived）
 * - 分组筛选与批量操作
 * - 数据质量筛选
 *
 * 注：研究候选池总览 + 采集进度已迁移至输入舱 PoolBoardPage。
 *
 * @module cockpit/widgets/PoolBoardWidget
 * @created 2026-07-19
 */

import React from 'react'
import { WidgetStateShell } from './components/WidgetStateShell'
import { Skeleton } from '@/components/molecules/states'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { PoolBoard } from '@/components/organisms/pool/PoolBoard'
import { usePoolBoard } from '@/hooks/usePoolBoard'
import type { WidgetConfig, MarketData } from '@/types/modules/widget.types'
import { twText, twBg, DARK } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'

interface PoolBoardWidgetProps {
  config: WidgetConfig
  data?: MarketData
}

/**
 * 研究池管理 Widget
 *
 * 整合看板/列表视图、状态流转、分组筛选、批量操作。
 */
export default function PoolBoardWidget({ config }: PoolBoardWidgetProps): React.JSX.Element {
  const board = usePoolBoard()

  const visualState = board.error
    ? 'error'
    : board.loading
      ? 'loading'
      : board.filteredItems.length === 0
        ? 'empty'
        : 'ready'

  return (
    <WidgetStateShell
      title={config.title}
      visualState={visualState}
      error={board.error}
      onRetry={() => void board.refresh()}
      loadingLabel="加载研究池…"
      emptyTitle="暂无研究池标的"
      emptyDescription="请先通过批量导入功能添加股票到研究候选池"
      skeleton={
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton variant="text" className="h-8 w-24" />
            <Skeleton variant="text" className="h-8 w-32" />
          </div>
          <div className="rounded-md border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b p-3 last:border-b-0">
                <Skeleton variant="text" className="h-4 w-20" />
                <Skeleton variant="text" className="h-4 w-24" />
                <Skeleton variant="text" className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      }
      titleAction={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-[10px]', twText('stone', 500))}>
            {board.items.length} 只
          </Badge>
        </div>
      }
      className="h-full flex flex-col"
    >
      <div className="flex-1 overflow-auto flex flex-col">
        {/* ── 工具栏 ── */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void board.refresh()}
            disabled={board.loading}
          >
            {board.loading ? '刷新中...' : '刷新'}
          </Button>

          {/* 视图切换 */}
          <div className={cn('flex rounded-lg p-0.5', twBg('stone', 100), DARK.bgNeutral800)}>
            <button
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-all',
                board.viewMode === 'kanban'
                  ? [twBg('white'), 'shadow-sm', DARK.bgNeutral700, twText('stone', 800), DARK.textNeutral100]
                  : [twText('stone', 500), DARK.textNeutral400],
              )}
              onClick={() => board.setViewMode('kanban')}
            >
              看板
            </button>
            <button
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-all',
                board.viewMode === 'list'
                  ? [twBg('white'), 'shadow-sm', DARK.bgNeutral700, twText('stone', 800), DARK.textNeutral100]
                  : [twText('stone', 500), DARK.textNeutral400],
              )}
              onClick={() => board.setViewMode('list')}
            >
              列表
            </button>
          </div>

          {/* 分组筛选 */}
          <select
            className={cn('h-7 rounded-md border bg-background px-2 text-xs', twText('stone', 600), DARK.borderNeutral700, DARK.bgNeutral800, DARK.textNeutral200)}
            value={board.selectedGroup || board.ALL_GROUPS_VALUE}
            onChange={(e) =>
              board.setSelectedGroup(
                e.target.value === board.ALL_GROUPS_VALUE ? '' : e.target.value,
              )
            }
            aria-label="分组筛选"
          >
            <option value={board.ALL_GROUPS_VALUE}>全部组</option>
            {board.allGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* 质量筛选 */}
          <select
            className={cn('h-7 rounded-md border bg-background px-2 text-xs', twText('stone', 600), DARK.borderNeutral700, DARK.bgNeutral800, DARK.textNeutral200)}
            value={board.qualityFilter}
            onChange={(e) =>
              board.setQualityFilter(e.target.value as typeof board.qualityFilter)
            }
            aria-label="数据质量筛选"
          >
            <option value="all">全部质量</option>
            <option value="missingBasic">缺基础数据</option>
            <option value="missingKline">缺行情</option>
            <option value="missingFinance">缺财务</option>
          </select>

          {/* 批量操作 */}
          {board.selectedSymbols.length > 0 && (
            <>
              <span className={cn('text-xs', twText('stone', 500))}>
                已选 {board.selectedSymbols.length}
              </span>
              <Button size="sm" variant="secondary" onClick={() => void board.handleBulkArchive()}>
                归档
              </Button>
              <Button size="sm" variant="ghost" onClick={() => board.setSelectedSymbols([])}>
                清除
              </Button>
            </>
          )}
        </div>

        {/* ── 看板/列表 ── */}
        <PoolBoard
          items={board.filteredItems}
          viewMode={board.viewMode}
          selectedSymbols={board.selectedSymbols}
          allGroups={board.allGroups}
          onSelectToggle={board.handleSelectToggle}
          onTransition={(symbol, status) => void board.handleTransition(symbol, status)}
          onChangeGroup={(symbol, group) => void board.handleChangeGroup(symbol, group)}
          onRefreshKline={(item) => void board.handleRefreshKline(item)}
          onAnalyze={board.handleAnalyze}
        />
      </div>
    </WidgetStateShell>
  )
}
