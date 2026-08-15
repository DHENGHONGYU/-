import React, { useState, lazy, Suspense } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import { Select, SelectItem } from '@/components/atoms/Select'
import { Tooltip } from '@/components/atoms/Tooltip'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { useStockAdd } from '@/hooks/useStockAdd'
import { StockSearch } from '@/components/organisms/input/StockSearch'
import type { StockSearchResult } from '@/services/input/inputService'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'
import HotSectorSection from './HotSectorSection'
import type { InputTab, ManualMode } from './inputDashboard.types'
import { TAB_BASE, TAB_ACTIVE, TAB_INACTIVE } from './inputDashboard.utils'
import { useInputDashboardData } from './hooks/useInputDashboardData'
import InputDashboardStats from './components/InputDashboardStats'
import InputDashboardPoolTable from './components/InputDashboardPoolTable'

// 批量导入区块懒加载（整合自原 BulkImportPanel 独立页）
const BulkImportPanel = lazy(() => import('./BulkImportPanel'))

const logger = getLogger()

export default function InputDashboard(): React.JSX.Element {
  // 数据层 Hook：状态管理、采集/删除/勾选等业务回调
  const {
    loading, error, refresh,
    allGroups, allStocks,
    fetcherOk, collectingSymbols,
    selectedSymbols, selectAllRef,
    stats,
    handleCollectStock, handleCollectAll,
    handleDeleteStock, handleToggleSelect,
    handleToggleSelectAll, handleBatchDelete,
    handleRefreshHealth,
  } = useInputDashboardData()

  // 通过 useStockAdd Hook 管理股票添加流程的表单状态与提交逻辑
  const {
    symbol, name, group,
    setSymbol, setName, setGroup,
    submitting, message, setMessage,
    handleAdd,
  } = useStockAdd()

  // 本地 UI 状态
  const [searchMode, setSearchMode] = useState<'fill' | 'add'>('fill')
  const [activeTab, setActiveTab] = useState<InputTab>('manual')
  const [manualMode, setManualMode] = useState<ManualMode>('single')

  return (
    <div className="space-y-4">
      {/* ─── 新用户引导 ─── */}
      {!loading && stats.total === 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
          <Info className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">新用户引导</p>
            <p className="text-xs text-muted-foreground">1. 录入股票 → 2. 启动采集 → 3. 查看评分</p>
          </div>
        </div>
      )}
      <InputDashboardStats loading={loading} stats={stats} fetcherOk={fetcherOk} />

      {/* ─── 录入 Tab 切换区 ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>录入候选股票</CardTitle>
            <div className={cn('inline-flex rounded-xl bg-muted/60 p-1')}>
              <button
                onClick={() => setActiveTab('manual')}
                className={`${TAB_BASE} ${activeTab === 'manual' ? TAB_ACTIVE : TAB_INACTIVE}`}
              >
                自行意向输入
              </button>
              <button
                onClick={() => setActiveTab('hot-sector')}
                className={`${TAB_BASE} ${activeTab === 'hot-sector' ? TAB_ACTIVE : TAB_INACTIVE}`}
              >
                热门板块纳入
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Tab 1: 自行意向输入 ── */}
          {activeTab === 'manual' && (
            <>
              {/* 子分段：逐项 / 批量 — 下划线 Tab 样式 */}
              <div className="inline-flex border-b border-border">
                <button
                  onClick={() => setManualMode('single')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    manualMode === 'single'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                  )}
                >
                  逐项输入
                </button>
                <button
                  onClick={() => setManualMode('bulk')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    manualMode === 'bulk'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                  )}
                >
                  批量导入
                </button>
              </div>

              {manualMode === 'single' ? (
                <>
                  <div className="flex items-center gap-2">
                    <StockSearch
                      className="flex-1 max-w-md"
                      mode={searchMode}
                      onSelect={(result: StockSearchResult): void => {
                        setSymbol(result.symbol)
                        setName(result.name)
                        setMessage(`已选择 ${result.symbol} ${result.name}，请选择录入方式`)
                      }}
                      onAdded={(): void => {
                        setMessage('搜索标的已录入意向候选池')
                        void refresh()
                      }}
                    />
                    {/* 搜索模式 Chip — 搜索框右侧 */}
                    <div className="inline-flex gap-1 shrink-0">
                      <button
                        onClick={() => setSearchMode('fill')}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                          searchMode === 'fill'
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        填充
                      </button>
                      <button
                        onClick={() => setSearchMode('add')}
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                          searchMode === 'add'
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        直接录入
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="min-w-[160px] flex-1"
                      placeholder="股票代码，如 600519.SH"
                      aria-label="股票代码"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                    />
                    <Input
                      className="min-w-[120px] flex-1"
                      placeholder="股票名称"
                      aria-label="股票名称"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <Select
                      className="h-10 min-w-[140px] flex-1"
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      aria-label="目标分组"
                      aria-invalid={false}
                    >
                      <SelectItem value="">默认分组</SelectItem>
                      {allGroups.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </Select>
                    <Tooltip content="仅录入代码，不启动采集" side="bottom">
                      <Button
                        className="min-w-[100px]"
                        variant="default"
                        onClick={() => void handleAdd(false, false)}
                        disabled={submitting}
                      >
                        {submitting ? '处理中...' : '仅代码'}
                      </Button>
                    </Tooltip>
                    <Tooltip content="采集三表+行情数据，约30秒" side="bottom">
                      <Button
                        className="min-w-[100px]"
                        variant="secondary"
                        onClick={() => void handleAdd(true, false)}
                        disabled={submitting}
                      >
                        {submitting ? '处理中...' : '基础资料'}
                      </Button>
                    </Tooltip>
                    <Tooltip content="采集研报+公告+三表+行情，约2分钟" side="bottom">
                      <Button
                        className="min-w-[100px]"
                        variant="secondary"
                        onClick={() => void handleAdd(true, true)}
                        disabled={submitting}
                      >
                        {submitting ? '处理中...' : '深度资料'}
                      </Button>
                    </Tooltip>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-muted-foreground">采集服务状态：</span>
                    {fetcherOk === null ? (
                      <Skeleton className="h-6 w-16" />
                    ) : fetcherOk ? (
                      <Badge className={`${COLOR_TOKENS.up.bgClass} ${COLOR_TOKENS.up.tailwind}`}>已连接</Badge>
                    ) : (
                      <Badge variant="destructive">未连接</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRefreshHealth()}
                      disabled={fetcherOk === null}
                    >
                      {fetcherOk === null ? '检查中...' : '刷新'}
                    </Button>
                  </div>
                  {(message !== '' || (error != null && error !== '')) && (
                    <p className="text-sm text-muted-foreground">
                      {message !== ''
                        ? message
                        : (() => {
                            // 安全兜底：仅当 error 确为非字符串类型时打日志，
                            // 避免上游塞了 Error 对象却被静默渲染成 [object Object]
                            if (error != null && typeof error !== 'string') {
                              logger.warn('[InputDashboard] error 非字符串类型，请核对上游写入', {
                                type: typeof error,
                                keys: typeof error === 'object' ? Object.keys(error) : undefined,
                              })
                              return String(error)
                            }
                            return error as string
                          })()}
                    </p>
                  )}
                </>
              ) : (
                // 批量导入区块（整合自原独立页）
                <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载批量导入...</div>}>
                  <BulkImportPanel />
                </Suspense>
              )}
            </>
          )}

          {/* ── Tab 2: 热门板块纳入 ── */}
          {activeTab === 'hot-sector' && (
            <HotSectorSection />
          )}
        </CardContent>
      </Card>

      {/* ─── 意向候选池清单（合并采集任务状态展示） ─── */}
      <InputDashboardPoolTable
        allStocks={allStocks}
        collectingSymbols={collectingSymbols}
        selectedSymbols={selectedSymbols}
        selectAllRef={selectAllRef}
        onCollectAll={handleCollectAll}
        onToggleSelectAll={handleToggleSelectAll}
        onBatchDelete={handleBatchDelete}
        onToggleSelect={handleToggleSelect}
        onCollectStock={handleCollectStock}
        onDeleteStock={handleDeleteStock}
      />
    </div>
  )
}
