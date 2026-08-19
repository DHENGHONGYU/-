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
import { cn } from '@/lib/utils'
import { Info, Zap, FileText, LineChart } from 'lucide-react'
import InputFlowOverview from './components/InputFlowOverview'
import type { InputTab, ManualMode } from './inputDashboard.types'
import { TAB_BASE, TAB_ACTIVE, TAB_INACTIVE } from './inputDashboard.utils'
import { useInputDashboardData } from './hooks/useInputDashboardData'
import InputDashboardStats from './components/InputDashboardStats'
import InputDashboardPoolTable from './components/InputDashboardPoolTable'
import { useNavigate } from 'react-router'

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
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      {/* ─── 流程总览条（新 UI） ─── */}
      <InputFlowOverview />

      {/* ─── 新用户引导 ─── */}
      {!loading && stats.total === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">开始您的投研之旅</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Step 1：录入股票标的 → Step 2：启动深度采集 → Step 3：进入分析舱查看智能评分
            </p>
          </div>
        </div>
      )}

      {/* ─── 统计卡片 ─── */}
      <InputDashboardStats loading={loading} stats={stats} fetcherOk={fetcherOk} />

      {/* ─── 录入 Tab 切换区 ─── */}
      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold">录入候选股票</CardTitle>
            <div className={cn('inline-flex self-start rounded-xl bg-muted/50 p-1 sm:self-auto')}>
              <button
                onClick={() => setActiveTab('manual')}
                className={`${TAB_BASE} ${activeTab === 'manual' ? TAB_ACTIVE : TAB_INACTIVE}`}
              >
                <Zap className="mr-1.5 inline h-3.5 w-3.5" />
                自行意向输入
              </button>
              <button
                onClick={() => navigate('/input/hot-sectors')}
                className={`${TAB_BASE} ${TAB_INACTIVE}`}
                title="在新页面查看热门板块"
              >
                <LineChart className="mr-1.5 inline h-3.5 w-3.5" />
                热门板块（独立页）
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-3">
          {/* ── Tab 1: 自行意向输入 ── */}
          {activeTab === 'manual' && (
            <div className="space-y-5">
              {/* 子分段：逐项 / 批量 — 下划线 Tab 样式 */}
              <div className="inline-flex border-b border-border/60">
                <button
                  onClick={() => setManualMode('single')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                    manualMode === 'single'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                  )}
                >
                  <FileText className="mr-1.5 inline h-3.5 w-3.5" />
                  逐项输入
                </button>
                <button
                  onClick={() => setManualMode('bulk')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                    manualMode === 'bulk'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
                  )}
                >
                  批量导入
                </button>
              </div>

              {manualMode === 'single' ? (
                <div className="space-y-4">
                  {/* 搜索栏 */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <StockSearch
                      className="flex-1 sm:max-w-md"
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
                    <div className="inline-flex gap-1 self-start sm:self-auto shrink-0">
                      <button
                        onClick={() => setSearchMode('fill')}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                          searchMode === 'fill'
                            ? 'bg-primary/10 text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        填充
                      </button>
                      <button
                        onClick={() => setSearchMode('add')}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                          searchMode === 'add'
                            ? 'bg-primary/10 text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                      >
                        直接录入
                      </button>
                    </div>
                  </div>

                  {/* 输入+操作行 */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Input
                      className="h-10 min-w-[160px] sm:flex-1"
                      placeholder="股票代码，如 600519.SH"
                      aria-label="股票代码"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                    />
                    <Input
                      className="h-10 min-w-[120px] sm:flex-1"
                      placeholder="股票名称"
                      aria-label="股票名称"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <Select
                      className="h-10 min-w-[140px] sm:flex-1"
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
                    <div className="flex flex-wrap gap-2 pt-1 sm:pt-0 sm:border-l sm:pl-2 sm:border-border/40">
                      <Tooltip content="仅录入代码，不启动采集" side="bottom">
                        <Button
                          className="min-w-[96px] shadow-sm"
                          variant="outline"
                          onClick={() => void handleAdd(false, false)}
                          disabled={submitting}
                        >
                          {submitting ? '处理中...' : '仅代码'}
                        </Button>
                      </Tooltip>
                      <Tooltip content="采集三表+行情数据，约30秒" side="bottom">
                        <Button
                          className="min-w-[96px] shadow-sm"
                          variant="secondary"
                          onClick={() => void handleAdd(true, false)}
                          disabled={submitting}
                        >
                          {submitting ? '处理中...' : '基础资料'}
                        </Button>
                      </Tooltip>
                      <Tooltip content="采集研报+公告+三表+行情，约2分钟" side="bottom">
                        <Button
                          className="min-w-[96px] shadow-sm"
                          variant="default"
                          onClick={() => void handleAdd(true, true)}
                          disabled={submitting}
                        >
                          {submitting ? '处理中...' : '深度资料'}
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* 采集服务状态行 */}
                  <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/40 bg-muted/20 px-3.5 py-2.5 text-sm">
                    <span className="text-xs font-medium text-muted-foreground">采集服务状态：</span>
                    {fetcherOk === null ? (
                      <Skeleton className="h-6 w-16" />
                    ) : fetcherOk ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                          已连接
                        </span>
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
                          未连接
                        </span>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRefreshHealth()}
                      disabled={fetcherOk === null}
                      className="ml-auto h-8 text-xs"
                    >
                      {fetcherOk === null ? '检查中...' : '刷新'}
                    </Button>
                  </div>

                  {/* 消息提示 */}
                  {(message !== '' || (error != null && error !== '')) && (
                    <div className="rounded-md border border-border/40 bg-muted/10 px-3.5 py-2.5 text-sm text-muted-foreground">
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
                    </div>
                  )}
                </div>
              ) : (
                // 批量导入区块（整合自原独立页）
                <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载批量导入...</div>}>
                  <BulkImportPanel />
                </Suspense>
              )}
            </div>
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
