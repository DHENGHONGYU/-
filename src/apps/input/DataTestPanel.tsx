import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useDataTestStore } from '@/store/dataTestStore'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

const logger = getLogger()

function parseSymbols(text: string): string[] {
  return text
    .split(/[\n,;、]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

export default function DataTestPanel(): React.JSX.Element {
  // 从 Store 获取状态
  const health = useDataTestStore((s) => s.health)
  const checking = useDataTestStore((s) => s.checking)
  const singleSymbol = useDataTestStore((s) => s.singleSymbol)
  const singleResult = useDataTestStore((s) => s.singleResult)
  const singleStatus = useDataTestStore((s) => s.singleStatus)
  const batchText = useDataTestStore((s) => s.batchText)
  const tasks = useDataTestStore((s) => s.tasks)
  const batchRunning = useDataTestStore((s) => s.batchRunning)
  const progress = useDataTestStore((s) => s.progress)

  // 从 Store 获取 actions
  const setSingleSymbol = useDataTestStore((s) => s.setSingleSymbol)
  const setBatchText = useDataTestStore((s) => s.setBatchText)
  const checkHealth = useDataTestStore((s) => s.checkHealth)
  const runSingleTest = useDataTestStore((s) => s.runSingleTest)
  const runBatchTest = useDataTestStore((s) => s.runBatchTest)

  const handleCheckHealth = async (): Promise<void> => {
    logger.info('[DataTestPanel] 检查采集服务健康状态')
    await checkHealth()
  }

  const handleRunSingleTest = async (
    dimension: 'basic' | 'kline',
  ): Promise<void> => {
    logger.info('[DataTestPanel] 运行单接口测试', { dimension, symbol: singleSymbol })
    await runSingleTest(dimension)
  }

  const handleRunBatchTest = async (): Promise<void> => {
    logger.info('[DataTestPanel] 运行批量采集测试', { symbolCount: parseSymbols(batchText).length })
    await runBatchTest()
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
            <Badge className={`${COLOR_TOKENS.up.bgClass} ${COLOR_TOKENS.up.tailwind}`}>已连接</Badge>
          ) : (
            <Badge variant="destructive">未连接</Badge>
          )}
          <Button size="sm" variant="secondary" onClick={() => void handleCheckHealth()} disabled={checking}>
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
              onClick={() => void handleRunSingleTest('basic')}
              disabled={singleStatus === 'running'}
            >
              测试基础接口
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleRunSingleTest('kline')}
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
            onClick={() => void handleRunBatchTest()}
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
                          <Badge className={`${COLOR_TOKENS.up.bgClass} ${COLOR_TOKENS.up.tailwind}`}>成功</Badge>
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
