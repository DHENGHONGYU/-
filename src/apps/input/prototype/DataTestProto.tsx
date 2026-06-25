import React, { useState } from 'react'
import { Wifi, Activity, AlertCircle, CheckCircle2, Loader2, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { mockDataSources, mockTasks } from './mockData'

function SourceBadge({
  status,
  latency,
}: {
  status: 'ok' | 'error' | 'testing' | 'idle'
  latency?: number
}): React.JSX.Element {
  if (status === 'ok')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> 正常 {latency !== undefined ? `(${latency}ms)` : ''}
      </span>
    )
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5" /> 异常
      </span>
    )
  if (status === 'testing')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 检测中
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Wifi className="h-3.5 w-3.5" /> 未启用
    </span>
  )
}

export default function DataTestProto(): React.JSX.Element {
  const [quoteSymbol, setQuoteSymbol] = useState('600519.SH')
  const [quoteResult, setQuoteResult] = useState<string | null>(null)
  const [cleanResult, setCleanResult] = useState<string | null>(null)

  const handleProbe = (): void => {
    setQuoteResult(`实时行情 ${quoteSymbol}：价格 ¥1688.00，涨跌 +1.25%，成交量 2.1万手`)
  }

  const handleClean = (): void => {
    setCleanResult('清洗检查：未发现异常值，缺失字段 0 个，K线连续性正常。')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-4 w-4" /> 数据源健康度
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockDataSources.map((source) => (
              <div
                key={source.name}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span className="font-medium">{source.name}</span>
                <div className="flex items-center gap-3">
                  <SourceBadge status={source.status} latency={source.latency} />
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                    检测
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" /> 实时行情探测
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={quoteSymbol}
                onChange={(e) => setQuoteSymbol(e.target.value)}
                placeholder="输入代码"
              />
              <Button onClick={handleProbe}>探测</Button>
            </div>
            {quoteResult && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">{quoteResult}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> 批量采集进度
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={50} max={100} showMax={false} label="总体进度" />
            <div className="space-y-2">
              {mockTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span className="font-mono">{task.symbol}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    {task.status === 'running' && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    )}
                    {task.status === 'success' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    {task.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> 数据清洗检查
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              对最新采集的 K线/行情数据执行异常值、缺失值、连续性检查。
            </p>
            <Button variant="secondary" onClick={handleClean}>
              执行清洗检查
            </Button>
            {cleanResult && (
              <div className="rounded-md border bg-emerald-500/5 p-3 text-sm text-emerald-400">
                {cleanResult}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
