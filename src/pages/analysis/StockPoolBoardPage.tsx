/**
 * @module StockPoolBoardPage
 * @description 分析舱 · 股票池看板独立页面。
 *
 * 原“输入舱”中的股票池看板迁移至此，专注于研究状态池管理、分组筛选与批量流转。
 */

import React from 'react'
import { Button } from '@/components/atoms'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms'
import { Input } from '@/components/atoms'
import { Badge } from '@/components/atoms'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/molecules'
import { Select, SelectItem } from '@/components/atoms'
import { PoolBoard } from '@/components/organisms/pool/PoolBoard'
import { useStockPoolBoard } from '@/hooks/useStockPoolBoard'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

export default function StockPoolBoardPage(): React.JSX.Element {
  const board = useStockPoolBoard()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">股票池看板</h1>
          <p className="text-sm text-muted-foreground">
            研究状态池管理 · 分组筛选 · 批量流转
          </p>
        </div>
        <Badge variant="outline" className={COLOR_TOKENS.info.tailwind}>
          {board.stocks.length} 只标的
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>股票池</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void board.refresh()}
              disabled={board.loading}
            >
              {board.loading ? '刷新中...' : '刷新看板'}
            </Button>
            <Button
              size="sm"
              variant={board.viewMode === 'kanban' ? 'secondary' : 'ghost'}
              onClick={() => board.setViewMode('kanban')}
            >
              看板视图
            </Button>
            <Button
              size="sm"
              variant={board.viewMode === 'list' ? 'secondary' : 'ghost'}
              onClick={() => board.setViewMode('list')}
            >
              列表视图
            </Button>
            <Select
              className="h-8 w-auto min-w-[140px]"
              value={board.selectedGroup || board.ALL_GROUPS_VALUE}
              onChange={(e) =>
                board.setSelectedGroup(
                  e.target.value === board.ALL_GROUPS_VALUE ? '' : e.target.value,
                )
              }
              aria-label="分组筛选"
            >
              <SelectItem value={board.ALL_GROUPS_VALUE}>全部组</SelectItem>
              {board.allGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => board.setNewGroupDialogOpen(true)}
            >
              新建分组
            </Button>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={board.qualityFilter}
              onChange={(e) =>
                board.setQualityFilter(e.target.value as typeof board.qualityFilter)
              }
              aria-label="数据质量筛选"
            >
              <option value="all">全部质量状态</option>
              <option value="missingBasic">缺失基础数据</option>
              <option value="missingKline">缺失行情数据</option>
              <option value="missingFinance">缺失财务数据</option>
            </select>
            {board.selectedSymbols.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">
                  已选 {board.selectedSymbols.length} 只
                </span>
                <Button size="sm" variant="secondary" onClick={() => void board.handleBulkArchive()}>
                  批量归档
                </Button>
                <Select
                  className="h-8 w-auto min-w-[120px]"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      void board.runBulkChangeGroup(e.target.value)
                    }
                  }}
                  aria-label="批量移入分组"
                >
                  <SelectItem value="">批量移入分组</SelectItem>
                  {board.allGroups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => board.setSelectedSymbols([])}
                >
                  清除选择
                </Button>
              </>
            )}
          </div>

          {Boolean(board.message || board.error) && (
            <p className="mb-3 text-sm text-muted-foreground">
              {board.message || board.error}
            </p>
          )}

          <PoolBoard
            stocks={board.filteredStocks}
            viewMode={board.viewMode}
            selectedSymbols={board.selectedSymbols}
            allGroups={board.allGroups}
            onSelectToggle={board.handleSelectToggle}
            onTransition={(symbol, status) => void board.handleTransition(symbol, status)}
            onChangeGroup={(symbol, group) => void board.handleChangeGroup(symbol, group)}
            onRefreshKline={(stock) => void board.handleRefreshKline(stock)}
            onAnalyze={board.handleAnalyze}
          />
        </CardContent>
      </Card>

      <Dialog
        open={board.newGroupDialogOpen}
        onOpenChange={board.setNewGroupDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建股票池分组</DialogTitle>
            <DialogDescription>输入新分组名称，创建后可用于筛选与录入。</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="分组名称，如 核心持仓"
            aria-label="分组名称"
            value={board.newGroupName}
            onChange={(e) => board.setNewGroupName(e.target.value)}
            maxLength={20}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => board.setNewGroupDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void board.handleCreateGroup()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
