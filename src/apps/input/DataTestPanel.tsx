import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  checkFetcherHealth,
  fetchStockBasic,
  fetchStockKline,
} from '@/services/fetcher/fetcherService'
import type { DataLayerResult, Stock } from '@/data/types'
import type { DailyQuotes } from '@/data/types'

interface TestTask {
  symbol: string
  status: 'pending' | 'running' | 'success' | 'error'
  message: string
}

function parseSymbols(text: string): string[] {
  return text
    .split(/[\n,;、]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

export default function DataTestPanel(): React.JSX.Element {
  const [health, setHealth] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const [singleSymbol, setSingleSymbol] = useState('')
  const [singleResult, setSingleResult] = useState<string>('')
  const [singleStatus, setSingleStatus] = useState<'idle' | 'running' | 'done'>('idle')

  const [batchText, setBatchText] = useState('')
  const [tasks, setTasks] = useState<TestTask[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleCheckHealth = async (): Promise<void> => {
    setChecking(true)
    setHealth(null)
    const result = await checkFetcherHealth()
    setHealth(result.ok)
    setChecking(false)
  }

  const runSingleTest = async (
    dimension: 'basic' | 'kline',
  ): Promise<void> => {
    const symbol = singleSymbol.trim().toUpperCase()
    if (!symbol) return

    setSingleStatus('running')
    setSingleResult('')

    let result: DataLayerResult<Stock> | DataLayerResult<DailyQuotes>
    if (dimension === 'basic') {
      result = await fetchStockBasic(symbol)
    } else {
      result = await fetchStockKline(symbol)
    }

    setSingleResult(JSON.stringify(result, null, 2))
    setSingleStatus('done')
  }

  const runBatchTest = async (): Promise<void> => {
    const symbols = parseSymbols(batchText)
    if (symbols.length === 0) return

    setBatchRunning(true)
    setProgress(0)
    setTasks(
      symbols.map((symbol) => ({
        symbol,
        status: 'pending',
        message: '等待中',
      })),
    )

    const updated: TestTask[] = []

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i]!
      setTasks((prev) =>
        prev.map((t, idx) =>
          idx === i ? { ...t, status: 'running', message: '采集中...' } : t,
        ),
      )

      const basicResult = await fetchStockBasic(symbol)
      let message: string
      let status: TestTask['status']

      if (!basicResult.success) {
        message = `基础数据失败：${basicResult.error ?? '未知错误'}`
        status = 'error'
      } else {
        const klineResult = await fetchStockKline(symbol)
        if (!klineResult.success) {
          message = `K线失败：${klineResult.error ?? '未知错误'}`
          status = 'error'
        } else {
          message = `成功：price=${klineResult.data?.price ?? basicResult.data?.price ?? '-'}, K线=${klineResult.data ? '有' : '无'}`
          status = 'success'
        }
      }

      const task: TestTask = { symbol, status, message }
      updated.push(task)
      setTasks((prev) => prev.map((t, idx) => (idx === i ? task : t)))
      setProgress(Math.round(((i + 1) / symbols.length) * 100))
    }

    setBatchRunning(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>数据采集测试</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 服务健康 */}
        <div className="flex items-center gap-3 rounded-md border p-3">
          <span className="text-sm text-muted-foreground">采集服务状态：</span>
          {health === null ? (
            <Badge variant="outline">未检查</Badge>
          ) : health ? (
            <Badge className="bg-green-100 text-green-800">已连接</Badge>
          ) : (
            <Badge variant="destructive">未连接</Badge>
          )}
          <Button size="sm" variant="secondary" onClick={handleCheckHealth} disabled={checking}>
            {checking ? '检查中...' : '检查连接'}
          </Button>
        </div>

        {/* 单接口测试 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">单接口测试</h4>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[160px] flex-1"
              placeholder="股票代码，如 600519.SH"
              value={singleSymbol}
              onChange={(e) => setSingleSymbol(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => runSingleTest('basic')}
              disabled={singleStatus === 'running'}
            >
              测试基础接口
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => runSingleTest('kline')}
              disabled={singleStatus === 'running'}
            >
              测试 K线接口
            </Button>
          </div>
          {singleStatus === 'done' && (
            <pre className="max-h-60 overflow-auto rounded-md border bg-muted p-3 text-xs">
              {singleResult}
            </pre>
          )}
        </div>

        {/* 批量采集测试 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">批量采集测试（含进度）</h4>
          <textarea
            className="min-h-[100px] w-full rounded-md border p-3 text-sm"
            placeholder="每行一个股票代码，如：&#10;600519,贵州茅台&#10;000001,平安银行"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          <Button
            onClick={runBatchTest}
            disabled={batchRunning || parseSymbols(batchText).length === 0}
          >
            {batchRunning ? '采集中...' : '开始批量采集测试'}
          </Button>

          {batchRunning && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>总体进度</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="max-h-60 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-1 text-left">代码</th>
                    <th className="px-3 py-1 text-left">状态</th>
                    <th className="px-3 py-1 text-left">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.symbol} className="border-t">
                      <td className="px-3 py-1">{task.symbol}</td>
                      <td className="px-3 py-1">
                        {task.status === 'success' && (
                          <Badge className="bg-green-100 text-green-800">成功</Badge>
                        )}
                        {task.status === 'error' && (
                          <Badge variant="destructive">失败</Badge>
                        )}
                        {task.status === 'running' && (
                          <Badge variant="outline">采集中</Badge>
                        )}
                        {task.status === 'pending' && (
                          <Badge variant="outline">等待中</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs text-muted-foreground">
                        {task.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
