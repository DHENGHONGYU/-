import { memo } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Filter, Layers, TrendingUp, AlertTriangle, Target, Download, Search, ChevronRight, Gauge, BookOpen, Scale, BarChart3, Activity, RefreshCw, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/atoms/Input'
import { Select, SelectItem } from '@/components/atoms/Select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms/Table'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageContainer, PageHeader } from '@/components/templates'
import { CandlestickChart, ChipDistributionChart } from '@/components/chart'
import { useChipStrategyCharts } from '@/hooks/chip/useChipStrategyCharts'
import { useChipStockAnalysis } from '@/hooks/chip/useChipStockAnalysis'
import { useChipSignalTable } from '@/hooks/chip/useChipSignalTable'
import { cn } from '@/lib/utils'
import { MOCK_EXAMPLES } from '@/fixtures/chipStrategyMockData'
import { FILTER_OPTIONS } from '@/domain/chip/types'
import { computeActualMatch } from '@/domain/chip/analysis'
import { getDebugLogContent, clearDebugLog, getDebugLogCount } from '@/domain/chip/debugLog'
import { getPositionLabel, getEnergyLabel, getActionBadgeVariant, getActionColor } from '@/domain/chip/helpers'

// eslint-disable-next-line react-refresh/only-export-components
export { getDebugLogContent, clearDebugLog, getDebugLogCount }

// ============================================================
// 主组件
// ============================================================

export default memo(function ChipStrategyReviewPage(): React.JSX.Element {
  // === 个股筹码分析（业务逻辑提取到 Hook）===
  const stockAnalysis = useChipStockAnalysis()
  const {
    selectedSymbol,
    turnover,
    volumeRatio,
    return60d,
    priceChange,
    analysisResult,
    poolOptions,
    selectedOption,
    setTurnover,
    setVolumeRatio,
    setReturn60d,
    setPriceChange,
    handleSelectStock,
    handleAnalyze,
    handleReset,
  } = stockAnalysis

  // === 信号筛选表（业务逻辑提取到 Hook）===
  const signalTable = useChipSignalTable()
  const {
    filter,
    setFilter,
    filteredSignals,
    signalCounts,
    debugLogCount,
    handleExportExcel,
    handleDownloadDebugLog,
    handleClearDebugLog,
  } = signalTable

  // === K线图 + 筹码分布图数据（随 symbol 变动自动加载）===
  const chartData = useChipStrategyCharts(
    selectedSymbol || null,
    selectedOption?.item.price,
    turnover ? parseFloat(turnover) : undefined,
    return60d ? parseFloat(return60d) : undefined,
    analysisResult?.tradeAction,
  )

  const { buy: buyCount, sell: sellCount, hold: holdCount, escape: escapeCount } = signalCounts

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/output">输出舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>筹码与交易策略复盘</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="筹码与交易策略复盘舱"
          description="基于换手率、量比、筹码分布、K线形态的核心指标体系分析"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/output">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Link>
            </Button>
          }
        />

        {/* === 个股筹码分析（下拉式菜单 + 判断引擎）=== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              个股筹码逐项分析与判断
              <Badge variant="outline" className="ml-2 text-xs">
                股票池共 {poolOptions.length} 只
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 说明 */}
            <div className={cn('rounded-md border border-dashed p-3 text-xs text-muted-foreground leading-relaxed', 'border-info/70', 'bg-info/10')}>
              <span className="font-medium text-foreground">使用说明：</span>
              从下方下拉菜单选择股票池中的个股，填入当日行情软件读取的换手率/量比/60日收益/当日涨跌（PE/PB/行业自动从股票池带入），
              系统将<strong>五层判断框架 + 7 条核心经验法则 + 12 种主力筹码信号矩阵</strong>作为内在嵌入判断规则，
              逐项解析该股筹码状态并给出买点/卖点/持仓/逃离判断，判断依据逐条对照上述原则给出结论。
            </div>

            {/* 下拉菜单 + 输入区 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">选择股票（下拉式）</label>
                <Select
                  value={selectedSymbol}
                  onValueChange={handleSelectStock}
                  className="w-full"
                >
                  <SelectItem value="">— 请选择股票池个股 —</SelectItem>
                  <optgroup label="📋 模拟示例（6 种典型场景）">
                    {poolOptions.filter((o) => o.label === '模拟示例').map((opt) => (
                      <SelectItem key={opt.item.symbol} value={opt.item.symbol}>
                        {opt.item.name} · {MOCK_EXAMPLES.find((m) => m.stock.symbol === opt.item.symbol)?.scenario}
                      </SelectItem>
                    ))}
                  </optgroup>
                  <optgroup label="📊 股票池数据">
                    {poolOptions.filter((o) => o.label !== '模拟示例').map((opt) => (
                      <SelectItem key={opt.item.symbol} value={opt.item.symbol}>
                        {opt.item.name} ({opt.item.symbol}) · {opt.label}
                        {(opt.item.sector ?? '') !== '' ? ` · ${opt.item.sector}` : ''}
                      </SelectItem>
                    ))}
                  </optgroup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">换手率 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 4.2"
                  value={turnover}
                  onChange={(e) => setTurnover(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">量比</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 3.1"
                  value={volumeRatio}
                  onChange={(e) => setVolumeRatio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">60日收益率 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 -8.5"
                  value={return60d}
                  onChange={(e) => setReturn60d(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">当日涨跌幅 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="如 1.8"
                  value={priceChange}
                  onChange={(e) => setPriceChange(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleAnalyze} size="sm" className="flex-1">
                  <Search className="mr-1 h-3.5 w-3.5" />
                  逐项分析
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm">
                  重置
                </Button>
              </div>
            </div>

            {/* 快速示例场景按钮（点击即载入该示例到输入框）*/}
            <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <BookOpen className="h-3.5 w-3.5" />
                快速载入示例场景（点击按钮自动填入筹码指标 + 分析）
              </div>
              <div className="flex flex-wrap gap-2">
                {MOCK_EXAMPLES.map((ex) => (
                  <Button
                    key={ex.stock.symbol}
                    size="sm"
                    variant={ex.expectedAction === 'buy' ? 'default' : ex.expectedAction === 'escape' ? 'danger' : 'outline'}
                    onClick={() => {
                      stockAnalysis.handleQuickExample(ex)
                    }}
                    className="text-xs"
                  >
                    {ex.scenario}
                  </Button>
                ))}
              </div>
            </div>

            {/* 选中股票的基本信息 */}
            {selectedOption && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium text-sm">
                    {selectedOption.item.name} ({selectedOption.item.symbol})
                  </span>
                  <Badge variant="outline" className="text-xs">{selectedOption.label}</Badge>
                  {(selectedOption.item.sector ?? '') !== '' && (
                    <Badge variant="secondary" className="text-xs">{selectedOption.item.sector}</Badge>
                  )}
                  {selectedOption.item.pe !== undefined && (
                    <span className="text-muted-foreground">PE: <span className={cn('font-medium', (selectedOption.item.pe < 25) ? 'text-destructive' : 'text-success')}>{selectedOption.item.pe.toFixed(1)}</span></span>
                  )}
                  {selectedOption.item.pb !== undefined && (
                    <span className="text-muted-foreground">PB: <span className={cn('font-medium', (selectedOption.item.pb < 20) ? 'text-destructive' : 'text-success')}>{selectedOption.item.pb.toFixed(2)}</span></span>
                  )}
                  {selectedOption.item.price !== undefined && (
                    <span className="text-muted-foreground">现价: ¥{selectedOption.item.price.toFixed(2)}</span>
                  )}
                </div>
                {selectedOption.label === '模拟示例' && (() => {
                  const mock = MOCK_EXAMPLES.find((m) => m.stock.symbol === selectedOption.item.symbol)
                  if (!mock) return null
                  return (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>换手率 {mock.chip.turnover}%</span>
                      <span>量比 {mock.chip.volumeRatio}</span>
                      <span>60日 {mock.chip.return60d}%</span>
                      <span>涨跌 {mock.chip.priceChange}%</span>
                      <span className="font-medium">预期：{mock.expectedSignal}（{mock.expectedAction === 'buy' ? '买入' : mock.expectedAction === 'escape' ? '逃离' : mock.expectedAction === 'hold' ? '持有' : '观望'}）</span>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* === K线图 + 筹码分布图（随股票变动自动加载）=== */}
            {selectedSymbol && (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* K线图 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <BarChart3 className="h-4 w-4" />
                        K线图
                        {chartData.klineDataSource === 'demo' && (
                          <Badge variant="outline" className={cn('text-xs', 'text-warning')}>模拟数据</Badge>
                        )}
                        {chartData.klineDataSource === 'real' && (
                          <Badge variant="outline" className={cn('text-xs', 'text-success')}>实时数据</Badge>
                        )}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={chartData.refresh}
                        disabled={chartData.klineLoading}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', chartData.klineLoading && 'animate-spin')} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartData.klineLoading ? (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        加载 K 线数据中...
                      </div>
                    ) : chartData.klineData.length > 0 ? (
                      <CandlestickChart
                        data={chartData.klineData}
                        height={400}
                        markers={chartData.markers}
                        showVolume
                        showToolbar={false}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        暂无 K 线数据
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 筹码分布图 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4" />
                        筹码分布
                        {chartData.chipDataSource === 'demo' && (
                          <Badge variant="outline" className={cn('text-xs', 'text-warning')}>模拟数据</Badge>
                        )}
                        {chartData.chipDataSource === 'real' && (
                          <Badge variant="outline" className={cn('text-xs', 'text-success')}>实时数据</Badge>
                        )}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={chartData.refresh}
                        disabled={chartData.chipLoading}
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', chartData.chipLoading && 'animate-spin')} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chartData.chipLoading ? (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        加载筹码数据中...
                      </div>
                    ) : chartData.chipData ? (
                      <ChipDistributionChart
                        data={chartData.chipData}
                        height={400}
                        tradePoints={chartData.chipTradePoints}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[400px] text-sm text-muted-foreground">
                        暂无筹码数据
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 分析结果 */}
            {analysisResult && (
              <div className="space-y-4">
                {/* 最终结论 */}
                <div className={cn(
                  'rounded-md border-2 p-4',
                  analysisResult.tradeAction === 'buy'
                    ? 'border-destructive/30 bg-destructive/10'
                    : analysisResult.tradeAction === 'sell' || analysisResult.tradeAction === 'escape'
                      ? 'border-success/30 bg-success/10'
                      : analysisResult.tradeAction === 'hold'
                        ? 'border-info/70 bg-info/10'
                        : 'border-input bg-muted'
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full text-white',
                      analysisResult.tradeAction === 'buy'
                        ? 'bg-destructive'
                        : analysisResult.tradeAction === 'sell' || analysisResult.tradeAction === 'escape'
                          ? 'bg-success'
                          : analysisResult.tradeAction === 'hold'
                            ? 'bg-primary'
                            : 'bg-muted-foreground'
                    )}>
                      {analysisResult.tradeAction === 'buy' ? <TrendingUp className="h-5 w-5" />
                        : analysisResult.tradeAction === 'escape' ? <AlertTriangle className="h-5 w-5" />
                          : analysisResult.tradeAction === 'sell' ? <Target className="h-5 w-5" />
                            : analysisResult.tradeAction === 'hold' ? <Gauge className="h-5 w-5" />
                              : <BookOpen className="h-5 w-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getActionBadgeVariant(analysisResult.tradeAction)} className="text-sm">
                          {analysisResult.tradeSignal}
                        </Badge>
                        {analysisResult.isCompositeBuy && (
                          <Badge variant="default" className="text-xs">共振买点</Badge>
                        )}
                      </div>
                      <p className={cn('mt-2 text-base font-semibold', getActionColor(analysisResult.tradeAction))}>
                        {analysisResult.conclusion}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">操作建议：{analysisResult.action}</p>
                    </div>
                  </div>
                </div>

                {/* 筹码状态四维解析 */}
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Scale className="h-3.5 w-3.5" /> 位置判断
                    </div>
                    <Badge variant="outline" className="text-xs">{getPositionLabel(analysisResult.position)}</Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">{analysisResult.positionReason}</p>
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Gauge className="h-3.5 w-3.5" /> 能量等级
                    </div>
                    <Badge variant={analysisResult.energy.level >= 4 ? 'default' : 'secondary'} className="text-xs">
                      L{analysisResult.energy.level} {analysisResult.energy.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      仓位≤{analysisResult.energy.positionCapPct}% · 止盈{analysisResult.energy.takeProfitPct}% · 止损{analysisResult.energy.stopLossPct}%
                    </p>
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" /> 量价配合
                    </div>
                    <Badge variant={analysisResult.volumePriceMatch ? 'default' : 'outline'} className="text-xs">
                      {analysisResult.volumePriceMatch ? '放量配合' : '缩量背离'}
                    </Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">{analysisResult.volumePriceReason}</p>
                  </div>
                  <div className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5" /> 估值层
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {analysisResult.valuationAdvice ?? '缺少 PE/PB 数据'}
                    </p>
                  </div>
                </div>

                {/* 命中的信号 */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-xs font-medium">命中信号矩阵（共 {analysisResult.matchedSignals.length} 个）</div>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.matchedSignals.map((sig) => (
                      <div key={sig.id} className={cn('rounded border px-2 py-1 text-xs', 'border-border')}>
                        <span className="font-medium">{sig.name}</span>
                        <span className="text-muted-foreground ml-1">· {sig.tradeSignal}</span>
                        <span className={cn('ml-1', getActionColor(sig.tradeAction))}>· {sig.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 判断依据（逐条对照规则）*/}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <ChevronRight className="h-3.5 w-3.5" />
                    判断依据（逐条对照五层框架/7法则/12信号/估值层）
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">来源</TableHead>
                        <TableHead className="w-36">规则名称</TableHead>
                        <TableHead className="w-16">命中</TableHead>
                        <TableHead>详细说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.basis.map((b, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge
                              variant={b.source === 'framework' ? 'default' : b.source === 'rule' ? 'secondary' : 'outline'}
                              className={cn(
                                'text-xs',
                                b.source === 'framework' && 'text-info',
                                b.source === 'rule' && 'text-warning',
                                b.source === 'signal' && 'text-info',
                                b.source === 'valuation' && 'text-success',
                              )}
                            >
                              {b.source === 'framework' ? '五层框架' : b.source === 'rule' ? '7法则' : b.source === 'signal' ? '12信号' : '估值层'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{b.name}</TableCell>
                          <TableCell>
                            <Badge variant={b.matched ? 'default' : 'outline'} className="text-xs">
                              {b.matched ? '✓ 命中' : '未命中'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground leading-relaxed">{b.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground border-t">
                    <span className="flex items-center gap-1"><Badge variant="default" className={cn('text-xs', 'text-info')}>五层框架</Badge> 行情启动判断框架（5层）</span>
                    <span className="flex items-center gap-1"><Badge variant="secondary" className={cn('text-xs', 'text-warning')}>7法则</Badge> 核心经验法则（7条）</span>
                    <span className="flex items-center gap-1"><Badge variant="outline" className={cn('text-xs', 'text-info')}>12信号</Badge> 主力筹码变动信号矩阵（12种）</span>
                    <span className="flex items-center gap-1"><Badge variant="outline" className={cn('text-xs', 'text-success')}>估值层</Badge> PE/PB 估值判断</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 概览统计 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">买入信号</p>
                  <p className={cn('text-h1 font-bold', 'text-destructive')}>{buyCount}</p>
                </div>
                <TrendingUp className={cn('h-8 w-8', 'text-destructive/70')} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">卖出信号</p>
                  <p className={cn('text-h1 font-bold', 'text-success')}>{sellCount}</p>
                </div>
                <Target className={cn('h-8 w-8', 'text-success/70')} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">持有信号</p>
                  <p className={cn('text-h1 font-bold', 'text-info')}>{holdCount}</p>
                </div>
                <Layers className={cn('h-8 w-8', 'text-info/70')} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">逃离信号</p>
                  <p className={cn('text-h1 font-bold', 'text-warning')}>{escapeCount}</p>
                </div>
                <AlertTriangle className={cn('h-8 w-8', 'text-warning/70')} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 筹码信号矩阵表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                主力筹码变动信号矩阵（12种模式）
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {FILTER_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <Button
                        key={opt.value}
                        variant={filter === opt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(opt.value)}
                      >
                        <Icon className="mr-1 h-3.5 w-3.5" />
                        {opt.label}
                      </Button>
                    )
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={() => void handleExportExcel()}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  导出 Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDebugLog}
                  className={cn(debugLogCount > 0 && 'border-warning/50 text-warning')}
                >
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  下载 debug.log
                  {debugLogCount > 0 && (
                    <Badge variant="outline" className={cn('ml-1 text-[10px] px-1 py-0', 'bg-warning/10 text-warning border-warning/30')}>
                      {debugLogCount}
                    </Badge>
                  )}
                </Button>
                {debugLogCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearDebugLog} title="清空 debug 日志缓冲区">
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    清空
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">信号名称</TableHead>
                  <TableHead className="w-20">换手率</TableHead>
                  <TableHead className="w-20">量比</TableHead>
                  <TableHead className="w-16">位置</TableHead>
                  <TableHead className="w-20">价变</TableHead>
                  <TableHead>指标组合</TableHead>
                  <TableHead className="w-20">交易信号</TableHead>
                  <TableHead className="w-16">机会分</TableHead>
                  <TableHead className="w-20">能量级</TableHead>
                  <TableHead className="w-40">操作建议</TableHead>
                  <TableHead className="w-32">模拟案例</TableHead>
                  <TableHead className="w-36">实际匹配信号</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignals.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                        row.turnoverRange.includes('> 10') || row.turnoverRange.includes('> 15')
                          ? 'bg-destructive/10 text-destructive'
                          : row.turnoverRange.includes('< 1') || row.turnoverRange.includes('< 3')
                            ? 'bg-info/10 text-info'
                            : 'bg-muted text-muted-foreground'
                      )}>
                        {row.turnoverRange}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-xs font-medium',
                        row.volumeRatioRange.includes('> 5')
                          ? 'bg-warning/10 text-warning'
                          : row.volumeRatioRange.includes('< 0.5') || row.volumeRatioRange.includes('< 1.5')
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-info/10 text-info'
                      )}>
                        {row.volumeRatioRange}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getPositionLabel(row.position)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.priceChange}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">{row.indicatorCombo}</TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(row.tradeAction)} className="text-xs">
                        {row.tradeSignal}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-sm font-bold',
                        row.opportunityScore >= 4 ? 'text-destructive'
                          : row.opportunityScore <= 1.5 ? 'text-success'
                            : 'text-info'
                      )}>
                        {row.opportunityScore.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getEnergyLabel(row.energyLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn('text-xs font-medium', getActionColor(row.tradeAction))}>
                      {row.action}
                    </TableCell>
                    <TableCell>
                      {(row.mockSymbol ?? '') !== '' ? (
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium">
                            {row.mockName} <span className="text-muted-foreground">({row.mockSymbol})</span>
                          </div>
                          <div className="flex gap-1 text-[10px] text-muted-foreground">
                            <span>换{row.mockTurnover}%</span>
                            <span>量{row.mockVolumeRatio}</span>
                            <span className={cn(row.mockPriceChange !== undefined && row.mockPriceChange >= 0 ? 'text-destructive' : 'text-success')}>
                              {row.mockPriceChange !== undefined ? `${row.mockPriceChange >= 0 ? '+' : ''}${row.mockPriceChange}%` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const actual = computeActualMatch(row)
                        if ((row.mockSymbol ?? '') === '') {
                          return <span className="text-xs text-muted-foreground">-</span>
                        }
                        return (
                          <div className="space-y-0.5">
                            {actual.isExpected ? (
                              <Badge variant="outline" className={cn('text-xs', 'text-success')}>
                                ✓ {actual.matchedNames.join('、')}
                              </Badge>
                            ) : actual.isGrayZone ? (
                              <>
                                <Badge variant="outline" className={cn('text-xs', 'text-warning')}>
                                  ⚠ {actual.matchedNames.join('、')}
                                </Badge>
                                {(actual.grayZoneReason ?? '') !== '' && (
                                  <p className={cn('text-[10px] leading-tight', 'text-warning')}>{actual.grayZoneReason}</p>
                                )}
                              </>
                            ) : (
                              <Badge variant="outline" className={cn('text-xs', 'text-destructive')}>
                                ✗ {actual.matchedNames.join('、')}
                              </Badge>
                            )}
                          </div>
                        )
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 对倒陷阱 vs 暴力吸筹 对比 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              易混淆信号对比：对倒陷阱 vs 暴力吸筹
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">对比维度</TableHead>
                  <TableHead>对倒陷阱</TableHead>
                  <TableHead>暴力吸筹</TableHead>
                  <TableHead className="w-32">区别核心</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { dim: '换手率', fake: '≥ 5% (活跃)', violent: '≥ 10% (极高)', diff: '暴力更高' },
                  { dim: '量比', fake: '< 1.5 (低)', violent: '≥ 5 (极高)', diff: '关键分水岭' },
                  { dim: '位置', fake: '不限', violent: '必须低位', diff: '安全垫' },
                  { dim: '指标组合', fake: '高换手 + 低量比 (背离)', violent: '高换手 + 高量比 (共振)', diff: '背离 vs 共振' },
                  { dim: '机会评分', fake: '1.5 (极低)', violent: '4.0 (较高)', diff: '完全相反' },
                  { dim: '交易信号', fake: 'escape (逃离)', violent: 'follow_buy (跟进)', diff: '操作相反' },
                  { dim: '资金方向', fake: 'neutral (无新增)', violent: 'inflow (流入)', diff: '资金性质' },
                  { dim: '操作建议', fake: '先跑，安全第一', violent: '可跟，控仓', diff: '' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.dim}</TableCell>
                    <TableCell className={cn('text-sm', 'text-success')}>{row.fake}</TableCell>
                    <TableCell className={cn('text-sm', 'text-destructive')}>{row.violent}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.diff}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">判断口诀：</span>
              <span className="text-muted-foreground"> 高换手低量比，不跑就是傻；高换手高量比，低位才是宝。</span>
            </div>
          </CardContent>
        </Card>

        {/* 能量等级仓位对照 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              能量等级 × 仓位/止盈/止损 对照表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>能量等级</TableHead>
                  <TableHead>能量阈值</TableHead>
                  <TableHead>示例</TableHead>
                  <TableHead>仓位上限</TableHead>
                  <TableHead>止盈间距</TableHead>
                  <TableHead>止损间距</TableHead>
                  <TableHead>交易风格</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { level: 'L1 冷清', threshold: '< 0.005', example: '0.5% × 1.0', posCap: '10%', tp: '5%', sl: '2%', style: '观望待突破' },
                  { level: 'L2 温和', threshold: '0.005 - 0.03', example: '2% × 1.5', posCap: '20%', tp: '8%', sl: '3%', style: '价值型突破' },
                  { level: 'L3 活跃', threshold: '0.03 - 0.08', example: '4% × 2.0', posCap: '35%', tp: '12%', sl: '5%', style: '稳健型突破' },
                  { level: 'L4 激进', threshold: '0.08 - 0.15', example: '6% × 2.5', posCap: '50%', tp: '18%', sl: '7%', style: '动量型突破' },
                  { level: 'L5 爆炸', threshold: '> 0.15', example: '8% × 3.0', posCap: '70%', tp: '25%', sl: '10%', style: '狙击型突破' },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <Badge variant={i >= 3 ? 'default' : 'secondary'} className="text-xs">{row.level}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{row.threshold}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.example}</TableCell>
                    <TableCell>
                      <span className={cn('text-sm font-bold', 'text-destructive')}>{row.posCap}</span>
                    </TableCell>
                    <TableCell className="text-sm">{row.tp}</TableCell>
                    <TableCell className="text-sm">{row.sl}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.style}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 风控约束 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              风控约束（三条禁令 + 仓位纪律）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className={cn('rounded-md border p-4 space-y-2', 'border-destructive/30')}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', 'bg-destructive')}>!</span>
                  <h4 className="text-sm font-medium">景气恶化线</h4>
                </div>
                <p className="text-xs text-muted-foreground">行业景气度连续两期 &lt; 45 → 禁止加仓</p>
              </div>
              <div className={cn('rounded-md border p-4 space-y-2', 'border-warning/30')}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', 'bg-warning')}>!</span>
                  <h4 className="text-sm font-medium">资金破位线</h4>
                </div>
                <p className="text-xs text-muted-foreground">主力资金流出 &gt; 3天 → 减仓</p>
              </div>
              <div className={cn('rounded-md border p-4 space-y-2', 'border-warning/30')}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', 'bg-warning')}>!</span>
                  <h4 className="text-sm font-medium">回撤风控线</h4>
                </div>
                <p className="text-xs text-muted-foreground">单票亏损 &gt; 7% 或回撤 &gt; 10% → 止损</p>
              </div>
              <div className={cn('rounded-md border p-4 space-y-2', 'border-info/50')}>
                <div className="flex items-center gap-2">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white', 'bg-primary')}>i</span>
                  <h4 className="text-sm font-medium">仓位纪律</h4>
                </div>
                <p className="text-xs text-muted-foreground">单票≤25%，总仓位≤80%，间隔24h，每日≤5笔</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </ErrorBoundary>
  )
})
