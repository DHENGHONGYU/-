import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Download, RotateCcw, Play, BarChart3, TrendingUp, AlertCircle, Info } from 'lucide-react'
import { useBacktestStore, type BacktestStrategy } from '@/store/backtestStore'
import { STOCK_COLOR_MAPPING } from '@/constants/cockpit.constants'
import { COLOR_TOKENS, CHART_PALETTE } from '@/constants/theme.tokens'

export default function BacktestPage(): React.JSX.Element {
  const { config, results, loading, error, setConfig, runBacktest, clearResults, exportReport } =
    useBacktestStore()

  const [activeTab, setActiveTab] = useState('results')

  const handleRun = () => {
    runBacktest()
  }

  const handleExport = async () => {
    if (!results) return
    try {
      await exportReport(results, config, { format: 'pdf' })
    } catch {
      // 导出失败由 store 处理日志
    }
  }

  const metrics = results
    ? [
        { label: '总收益率', value: `${results.totalReturn.toFixed(2)}%`, color: results.totalReturn >= 0 ? STOCK_COLOR_MAPPING.UP_CLASS : STOCK_COLOR_MAPPING.DOWN_CLASS },
        { label: '年化收益率', value: `${results.annualizedReturn.toFixed(2)}%`, color: results.annualizedReturn >= 0 ? STOCK_COLOR_MAPPING.UP_CLASS : STOCK_COLOR_MAPPING.DOWN_CLASS },
        { label: '最大回撤', value: `${results.maxDrawdown.toFixed(2)}%`, color: 'text-red-500' },
        { label: '夏普比率', value: results.sharpeRatio.toFixed(2), color: results.sharpeRatio >= 1 ? 'text-green-500' : results.sharpeRatio >= 0 ? 'text-yellow-500' : 'text-red-500' },
        { label: '胜率', value: `${results.winRate.toFixed(2)}%`, color: results.winRate >= 50 ? 'text-green-500' : 'text-red-500' },
        { label: '交易次数', value: `${results.tradeCount}`, color: 'text-blue-500' },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">策略回测</h1>
          <p className="text-muted-foreground">
            基于历史信号/订单数据的策略验证与绩效分析
          </p>
        </div>
        <Badge variant="secondary">分析舱</Badge>
      </div>

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

      {error && (
        <Card className="border-red-500 bg-red-50/50">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-600">{error}</span>
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
            <Button variant="outline" onClick={handleExport}>
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

            {results.pnlCurve && results.pnlCurve.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>净值曲线</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-gradient-to-r from-green-50 to-red-50 rounded-lg p-4 overflow-hidden">
                    <svg viewBox={`0 0 ${results.pnlCurve.length} 100`} className="w-full h-full">
                      <defs>
                        <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(34, 197, 94, 0.3)" />
                          <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
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
                          <Badge className={trade.direction === 'buy' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                            {trade.direction === 'buy' ? '买入' : '卖出'}
                          </Badge>
                        </TableCell>
                        <TableCell>{trade.price.toFixed(2)}</TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell className={trade.pnl >= 0 ? STOCK_COLOR_MAPPING.UP_CLASS : STOCK_COLOR_MAPPING.DOWN_CLASS}>
                          {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                        </TableCell>
                        <TableCell className={trade.pnlPct >= 0 ? STOCK_COLOR_MAPPING.UP_CLASS : STOCK_COLOR_MAPPING.DOWN_CLASS}>
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
                          <TableCell className={pos.unrealizedPnL >= 0 ? STOCK_COLOR_MAPPING.UP_CLASS : STOCK_COLOR_MAPPING.DOWN_CLASS}>
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
    </div>
  )
}