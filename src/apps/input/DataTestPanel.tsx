/**
 * @module DataTestPanel
 * @description 数据采集测试面板（v3）。
 *
 * 支持服务健康检查、单接口/批量链路测试，并实时展示：
 * - 采集链路时间线
 * - 实时日志流
 * - 质量指标统计
 */

import { useMemo } from 'react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Badge } from '@/components/atoms/Badge'
import { Select, SelectItem } from '@/components/atoms/Select'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { useDataTestStore } from '@/store/dataTestStore'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { getLogger } from '@/lib/logger'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import CollectionTimeline from '@/components/organisms/input/CollectionTimeline'
import LiveLogStream from '@/components/organisms/input/LiveLogStream'

const logger = getLogger()

function parseSymbols(text: string): string[] {
  return text
    .split(/[\n,;、]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}

const DIMENSION_OPTIONS = [
  { value: '01', label: '基本信息（行情）' },
  { value: '02', label: 'K线数据' },
] as const

export default function DataTestPanel(): React.JSX.Element {
  const store = useDataTestStore()
  const runtime = useCollectionRuntimeStore()
  const configStore = useSevenDimConfigStore()

  const config = useMemo(() => configStore.getCollectionConfig(), [configStore])
  const traceSpans = useMemo(
    () => Object.values(runtime.traceSpans),
    [runtime.traceSpans],
  )

  const handleCheckHealth = async (): Promise<void> => {
    logger.info('[DataTestPanel] 检查采集服务健康状态')
    await store.checkHealth()
  }

  const handleRunSingleTrace = async (): Promise<void> => {
    logger.info('[DataTestPanel] 运行单链路测试', {
      dimension: store.selectedDimension,
      symbol: store.singleSymbol,
    })
    await store.runSingleTrace(config)
  }

  const handleRunBatchTrace = async (): Promise<void> => {
    logger.info('[DataTestPanel] 运行批量链路测试', {
      symbolCount: parseSymbols(store.batchText).length,
    })
    await store.runBatchTrace(config)
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
          {store.health === null ? (
            <Badge variant="outline">未检查</Badge>
          ) : store.health ? (
            <Badge className={`${COLOR_TOKENS.success.bgClass} text-white`}>已连接</Badge>
          ) : (
            <Badge variant="destructive">未连接</Badge>
          )}
          <Button size="sm" variant="secondary" onClick={() => void handleCheckHealth()} disabled={store.checking}>
            {store.checking ? '检查中...' : '检查连接'}
          </Button>
        </div>

        {/* 质量指标 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="采集成功率" value={`${runtime.stats.successRate}%`} color={COLOR_TOKENS.success} />
          <StatCard label="平均延迟" value={`${runtime.stats.avgLatency}ms`} color={COLOR_TOKENS.info} />
          <StatCard label="降级次数" value={String(runtime.stats.fallbackCount)} color={COLOR_TOKENS.warning} />
          <StatCard label="写入成功率" value={`${runtime.stats.writeRate}%`} color={COLOR_TOKENS.success} />
        </div>

        {/* 单链路测试 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">单链路测试</h4>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[160px] flex-1"
              placeholder="股票代码，如 600519.SH"
              value={store.singleSymbol}
              onChange={(e) => store.setSingleSymbol(e.target.value)}
            />
            <Select
              value={store.selectedDimension}
              onValueChange={(value) => store.setSelectedDimension(value as '01' | '02')}
              className="h-9 w-40 text-sm"
            >
              {DIMENSION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </Select>
            <Button size="sm" onClick={() => void handleRunSingleTrace()} disabled={store.singleStatus === 'running'}>
              {store.singleStatus === 'running' ? '运行中...' : '运行链路测试'}
            </Button>
          </div>
          {store.singleStatus === 'running' && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          {store.singleStatus === 'done' && store.singleResult && (
            <pre className="max-h-60 overflow-auto rounded-md border bg-muted p-3 text-xs">
              {store.singleResult}
            </pre>
          )}
        </div>

        {/* 批量采集测试 */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">批量采集测试（含进度）</h4>
          <textarea
            className="min-h-[100px] w-full rounded-md border bg-background p-3 text-sm"
            placeholder="每行一个股票代码，如：&#10;600519,贵州茅台&#10;000001,平安银行"
            value={store.batchText}
            onChange={(e) => store.setBatchText(e.target.value)}
          />
          <Button
            onClick={() => void handleRunBatchTrace()}
            disabled={store.batchRunning || parseSymbols(store.batchText).length === 0}
          >
            {store.batchRunning ? '采集中...' : '开始批量采集测试'}
          </Button>

          {store.batchRunning && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>总体进度</span>
                <span>{store.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${store.progress}%` }}
                />
              </div>
            </div>
          )}

          {store.tasks.length > 0 && (
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
                  {store.tasks.map((task) => (
                    <tr key={task.symbol} className="border-t">
                      <td className="px-3 py-1">{task.symbol}</td>
                      <td className="px-3 py-1">
                        {task.status === 'success' && (
                          <Badge className={`${COLOR_TOKENS.success.bgClass} text-white`}>成功</Badge>
                        )}
                        {task.status === 'error' && <Badge variant="destructive">失败</Badge>}
                        {task.status === 'running' && <Badge variant="outline">采集中</Badge>}
                        {task.status === 'pending' && <Badge variant="outline">等待中</Badge>}
                      </td>
                      <td className="px-3 py-1 text-xs text-muted-foreground">{task.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 链路时间线 */}
        <CollectionTimeline spans={traceSpans} />

        {/* 实时日志流 */}
        <LiveLogStream logs={runtime.logs} onClear={() => runtime.clearLogs()} />
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: { tailwind: string }
}): React.JSX.Element {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color.tailwind}`}>{value}</p>
    </div>
  )
}
