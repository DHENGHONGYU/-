import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Label } from '@/components/atoms/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/Select'
import { Badge } from '@/components/atoms/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/atoms/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules/Tabs'
import { Download, RotateCcw, Play, BarChart3, TrendingUp, AlertCircle, Info, History } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/templates'
import { useBacktestStore, type BacktestStrategy } from '@/store/backtestStore'
import { COLOR_TOKENS, CHART_PALETTE, THEME_TOKENS, STOCK_COLOR_TOKENS } from '@/constants/theme.tokens'

/**
 * BacktestPage
 */
export default function BacktestPage(): React.JSX.Element {
  const {
    config,
    results,
    history,
    loading,
    error,
    setConfig,
    runBacktest,
    clearResults,
    exportReport,
    exportReportById,
  } = useBacktestStore()

  const [activeTab, setActiveTab] = useState('results')

  const handleRun = () => {
    void runBacktest()
  }

  const handleExport = async () => {
    if (!results) return
    try {
      await exportReport(results, config, { format: 'pdf' })
    } catch { console.warn('[BacktestPage.tsx] 导出失败由 store 处理日志, using fallback') }
  }

  const handleExportById = async (id: string) => {
    try {
      await exportReportById(id, { format: 'pdf' })
    } catch { console.warn('[BacktestPage.tsx] 导出失败由 store 处理日志, using fallback') }
  }

  const metrics = results
    ? [
        { label: '总收益率', value: `${results.totalReturn.toFixed(2)}%`, color: results.totalReturn >= 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind },
        { label: '年化收益率', value: `${results.annualizedReturn.toFixed(2)}%`, color: results.annualizedReturn >= 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind },
        { label: '最大回撤', value: `${results.maxDrawdown.toFixed(2)}%`, color: 'text-destructive' },
        { label: '夏普比率', value: results.sharpeRatio.toFixed(2), color: results.sharpeRatio >= 1 ? 'text-success' : results.sharpeRatio >= 0 ? 'text-warning' : 'text-destructive' },
        { label: '胜率', value: `${results.winRate.toFixed(2)}%`, color: results.winRate >= 50 ? 'text-success' : 'text-destructive' },
        { label: '交易次数', value: `${results.tradeCount}`, color: 'text-info' },
      ]
    : []

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="策略回测"
        description="基于历史信号/订单数据的策略验证与绩效分析"
        actions={<Badge variant="secondary">分析舱</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            回测配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="strategy">策略类型</Label>
              <Select
                value={config.strategy}
                onValueChange={(value) => setConfig({ strategy: value as BacktestStrategy })}
              >
                <SelectTrigger id="strategy">
                  <SelectValue placeholder="选择策略" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot_sector">热门板块策略</SelectItem>
                  <SelectItem value="value_pit">价值洼地策略</SelectItem>
                  <SelectItem value="composite">复合策略</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig({ startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={config.endDate}
                onChange={(e) => setConfig({ endDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialCapital">初始资金（元）</Label>
              <Input
                id="initialCapital"
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig({ initialCapital: Number(e.target.value) })}
                placeholder="1000000"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>手续费率: 0.03% | 滑点: 0.1% | 单股最大仓位: 20%</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={clearResults} disabled={loading || !results}>
                <RotateCcw className="h-4 w-4 mr-2" />
                清除结果
              </Button>
              <Button onClick={handleRun} disabled={loading}>
                <Play className="h-4 w-4 mr-2" />
                {loading ? '回测中...' : '开始回测'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(error ?? '') !== '' && (
        <Card className={`border-destructive/50 bg-destructive/5`}>
          <CardContent className="flex items-center gap-3">
            <AlertCircle className={`h-5 w-5 text-destructive`} />
            <span className="text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      {results && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="results">
                <TrendingUp className="h-4 w-4 mr-2" />
                绩效指标
              </TabsTrigger>
              <TabsTrigger value="trades">
                <BarChart3 className="h-4 w-4 mr-2" />
                交易记录
              </TabsTrigger>
              {results.positions && results.positions.length > 0 && (
                <TabsTrigger value="positions">持仓快照</TabsTrigger>
              )}
            </TabsList>
            <Button variant="outline" onClick={() => void handleExport()}>
              <Download className="h-4 w-4 mr-2" />
              导出报告
            </Button>
          </div>

          <TabsContent value="results" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {metrics.map((m) => (
                <Card key={m.label}>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{m.label}</p>
                    <p className={`text-xl font-bold mt-1 ${m.color}`}>{m.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(results.pnlCurve ?? null) !== null && results.pnlCurve.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>净值曲线</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`h-64 rounded-lg p-4 overflow-hidden bg-success/5`}>
                    <svg viewBox={`0 0 ${results.pnlCurve.length} 100`} className="w-full h-full">
                      <defs>
                        <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor={COLOR_TOKENS.success.hex} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={COLOR_TOKENS.success.hex} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={results.pnlCurve
                          .map((val, i) => {
                            const x = i
                            const y = 100 - (val - 1) * 50
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')}
                        fill="none"
                        stroke={COLOR_TOKENS.success.hex}
                        strokeWidth="2"
                      />
                      <path
                        d={`${results.pnlCurve
                          .map((val, i) => {
                            const x = i
                            const y = 100 - (val - 1) * 50
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                          })
                          .join(' ')} L ${results.pnlCurve.length - 1} 100 L 0 100 Z`}
                        fill="url(#pnlGradient)"
                      />
                      <line x1="0" y1="50" x2={results.pnlCurve.length - 1} y2="50" stroke={CHART_PALETTE.grid} strokeWidth="1" strokeDasharray="4" />
                    </svg>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>基准线 (1.0)</span>
                      <span>{config.startDate} — {config.endDate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trades" className="mt-4">
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>标的</TableHead>
                      <TableHead>方向</TableHead>
                      <TableHead>价格</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>盈亏</TableHead>
                      <TableHead>盈亏比</TableHead>
                      <TableHead>原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.trades.map((trade, index) => (
                      <TableRow key={index}>
                        <TableCell>{trade.date}</TableCell>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          {/* 交易方向标签色（A股惯例：买入=红涨，卖出=绿跌） */}
                          <Badge className={trade.direction === 'buy' ? `bg-destructive/10 text-destructive` : `bg-success/10 text-success`}>
                            {trade.direction === 'buy' ? '买入' : '卖出'}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.price.toFixed(2)}</TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell className={trade.pnl >= 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
                          {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                        </TableCell>
                        <TableCell className={trade.pnlPct >= 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
                          {trade.pnlPct >= 0 ? '+' : ''}{trade.pnlPct.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{trade.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {results.positions && results.positions.length > 0 && (
            <TabsContent value="positions" className="mt-4">
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>标的</TableHead>
                        <TableHead>持仓数量</TableHead>
                        <TableHead>平均成本</TableHead>
                        <TableHead>当前价格</TableHead>
                        <TableHead>市值</TableHead>
                        <TableHead>浮动盈亏</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.positions.map((pos) => (
                        <TableRow key={pos.symbol}>
                          <TableCell className="font-medium">{pos.symbol}</TableCell>
                          <TableCell>{pos.quantity}</TableCell>
                          <TableCell>{pos.avgCost.toFixed(2)}</TableCell>
                          <TableCell>{pos.currentPrice.toFixed(2)}</TableCell>
                          <TableCell>{pos.marketValue.toFixed(2)}</TableCell>
                          <TableCell className={pos.unrealizedPnL >= 0 ? STOCK_COLOR_TOKENS.up.tailwind : STOCK_COLOR_TOKENS.down.tailwind}>
                            {pos.unrealizedPnL >= 0 ? '+' : ''}{pos.unrealizedPnL.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}

      {!results && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">开始策略回测</h3>
            <p className="text-muted-foreground">
              选择策略类型和日期范围，点击"开始回测"按钮验证策略绩效
            </p>
          </CardContent>
        </Card>
      )}
      {(history ?? null) !== null && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              历史回测记录
              <span className={THEME_TOKENS.typography.fontSize.sm}>
                <Badge variant="outline">{history.length} 条</Badge>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>策略</TableHead>
                  <TableHead>时间区间</TableHead>
                  <TableHead>总收益率</TableHead>
                  <TableHead>夏普比率</TableHead>
                  <TableHead>交易次数</TableHead>
                  <TableHead>回测时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {record.config.strategy === 'hot_sector'
                          ? '热门板块'
                          : record.config.strategy === 'value_pit'
                            ? '价值洼地'
                            : '复合策略'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {record.config.startDate} ~ {record.config.endDate}
                    </TableCell>
                    <TableCell
                      className={
                        record.result.totalReturn >= 0
                          ? STOCK_COLOR_TOKENS.up.tailwind
                          : STOCK_COLOR_TOKENS.down.tailwind
                      }
                    >
                      {record.result.totalReturn >= 0 ? '+' : ''}
                      {record.result.totalReturn.toFixed(2)}%
                    </TableCell>
                    <TableCell>{record.result.sharpeRatio.toFixed(2)}</TableCell>
                    <TableCell>{record.result.tradeCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(record.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleExportById(record.id)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        导出
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </PageContainer>
  )
}
