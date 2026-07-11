/**
 * @module FetcherConfigPage
 * @description 抓取引擎配置页（D-2 框架）。
 *
 * 从 `dataSourceRegistry` 读取真实数据源端点，提供：
 * - 数据源列表与能力标签（行情/K线/启用/超时/重试）
 * - 单源 / 全局连通性测试
 * - 维度与数据源映射展示
 * - 实时采集日志流
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router'
import {
  Server,
  Wifi,
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { getLogger } from '@/lib/logger'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { EmptyState } from '@/components/molecules/EmptyState'
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
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/atoms/Breadcrumb'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { DATA_SOURCE_ENDPOINTS } from '@/config/dataSourceRegistry'
import type { DataSourceEndpoint } from '@/types/modules/collection.types'
import { useSevenDimConfigStore } from '@/store/sevenDimConfigStore'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { mcpBridge } from '@/mcp/bridge/mcpBridge'
import type { SourceConnectivityResult } from '@/services/data-collector/dataSourceOrchestrator'
import LiveLogStream from '@/components/organisms/input/LiveLogStream'
import SourcePrioritySelect from '@/components/organisms/input/SourcePrioritySelect'
import type {
  QuoteDataSourceId,
  SourcePriorityItem,
} from '@/types/modules/collection.types'

const logger = getLogger()

type TestResult = {
  state: 'idle' | 'testing' | 'done'
  ok: boolean
  latencyMs: number
  message: string
}

function initialTestResults(): Record<QuoteDataSourceId, TestResult> {
  return DATA_SOURCE_ENDPOINTS.reduce((acc, endpoint) => {
    acc[endpoint.id] = {
      state: 'idle',
      ok: false,
      latencyMs: 0,
      message: '未测试',
    }
    return acc
  }, {} as Record<QuoteDataSourceId, TestResult>)
}

function sourceTypeLabel(type: DataSourceEndpoint['type']): string {
  switch (type) {
    case 'http':
      return 'HTTP REST'
    case 'python':
      return 'Python 服务'
    case 'mock':
      return '本地 Mock'
    default:
      return type
  }
}

/**
 * FetcherConfigPage
 */
export default function FetcherConfigPage(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [testResults, setTestResults] = useState<Record<QuoteDataSourceId, TestResult>>(
    initialTestResults,
  )
  const [testingAll, setTestingAll] = useState(false)

  const dimensions = useSevenDimConfigStore((s) => s.dimensions)
  const logs = useCollectionRuntimeStore((s) => s.logs)
  const clearLogs = useCollectionRuntimeStore((s) => s.clearLogs)

  const enabledEndpoints = useMemo(
    () => DATA_SOURCE_ENDPOINTS.filter((e) => e.enabled).length,
    [],
  )
  const enabledDimensions = useMemo(
    () => dimensions.filter((d) => d.enabled).length,
    [dimensions],
  )

  useEffect(() => {
    logger.info('[FetcherConfigPage] 挂载，加载数据源注册表')
    const timer = window.setTimeout(() => setIsLoading(false), 300)
    return () => window.clearTimeout(timer)
  }, [])

  const testOne = useCallback(async (id: QuoteDataSourceId): Promise<void> => {
    setTestResults((prev) => ({
      ...prev,
      [id]: { ...prev[id], state: 'testing' },
    }))
    const result = await mcpBridge.callTool('fetcher', 'test_source_connectivity', { source: id })
    const text = result.content[0]?.text ?? '{}'
    const parsed: SourceConnectivityResult = JSON.parse(text) as SourceConnectivityResult
    setTestResults((prev) => ({
      ...prev,
      [id]: {
        state: 'done',
        ok: parsed.ok,
        latencyMs: parsed.latencyMs,
        message: parsed.message,
      },
    }))
  }, [])

  const handleTestAll = useCallback(async (): Promise<void> => {
    setTestingAll(true)
    logger.info('[FetcherConfigPage] 开始全部数据源连通性测试')
    for (const endpoint of DATA_SOURCE_ENDPOINTS) {
      await testOne(endpoint.id)
    }
    setTestingAll(false)
    logger.info('[FetcherConfigPage] 全部数据源连通性测试完成')
  }, [testOne])

  const handleUpdateDimensionPriority = useCallback(
    (code: string, priority: SourcePriorityItem[]) => {
      logger.info(`[FetcherConfigPage] 维度 ${code} 优先级变更`, { priority })
      useSevenDimConfigStore.getState().setDimensionSourcePriority(code, priority)
    },
    [],
  )

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/input">输入舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>抓取引擎配置</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">抓取引擎配置</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              数据源管理 · 连通性测试 · 维度映射 · 实时日志
            </p>
          </div>
          <Badge variant="outline">D-2 框架</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">数据源数量</p>
              <p className="mt-1 text-2xl font-bold">{DATA_SOURCE_ENDPOINTS.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">已启用</p>
              <p
                className="mt-1 text-2xl font-bold"
                style={{ color: COLOR_TOKENS.success.hex }}
              >
                {enabledEndpoints}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">启用维度</p>
              <p className="mt-1 text-2xl font-bold">
                {enabledDimensions} / {dimensions.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">日志条数</p>
              <p className="mt-1 text-2xl font-bold">{logs.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>数据源列表</CardTitle>
                  <CardDescription>来自 dataSourceRegistry 的端点注册信息</CardDescription>
                </div>
              </div>
              <Button
                onClick={() => void handleTestAll()}
                disabled={testingAll}
                isLoading={testingAll}
                className="gap-1.5"
              >
                {!testingAll && <Play className="h-4 w-4" />}
                {testingAll ? '测试中...' : '全部测试'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>数据源</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>baseURL</TableHead>
                      <TableHead>能力</TableHead>
                      <TableHead>超时 / 重试</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DATA_SOURCE_ENDPOINTS.map((endpoint) => {
                      const result = testResults[endpoint.id]
                      const testing = result.state === 'testing'
                      return (
                        <TableRow key={endpoint.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {endpoint.name}
                              {endpoint.enabled ? (
                                <Badge variant="success" className="text-[10px]">
                                  启用
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  禁用
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{sourceTypeLabel(endpoint.type)}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {endpoint.baseUrl}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {endpoint.supportsQuote && (
                                <Badge variant="outline" className="text-[10px]">
                                  行情
                                </Badge>
                              )}
                              {endpoint.supportsKline && (
                                <Badge variant="outline" className="text-[10px]">
                                  K线
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {endpoint.timeoutMs}ms / {endpoint.retries}次
                          </TableCell>
                          <TableCell>
                            {result.state === 'done' && (
                              <div className="flex items-center gap-1.5">
                                {result.ok ? (
                                  <CheckCircle
                                    className="h-4 w-4"
                                    style={{ color: COLOR_TOKENS.success.hex }}
                                  />
                                ) : (
                                  <XCircle
                                    className="h-4 w-4"
                                    style={{ color: COLOR_TOKENS.danger.hex }}
                                  />
                                )}
                                <span className="text-xs">{result.latencyMs}ms</span>
                              </div>
                            )}
                            {testing && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void testOne(endpoint.id)}
                              disabled={testing}
                            >
                              {testing ? '测试中' : '测试'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>连通性测试结果</CardTitle>
                <CardDescription>各数据源实际探测结果</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {Object.values(testResults).every((r) => r.state === 'idle') ? (
              <EmptyState
                title="尚未执行测试"
                description="点击「全部测试」或单个数据源「测试」按钮"
                icon={<Wifi className="h-12 w-12 text-muted-foreground/40" />}
              />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {DATA_SOURCE_ENDPOINTS.filter((endpoint) => testResults[endpoint.id].state !== 'idle').map((endpoint) => {
                  const result = testResults[endpoint.id]
                  const color = result.ok ? COLOR_TOKENS.success : COLOR_TOKENS.danger
                  return (
                    <div
                      key={endpoint.id}
                      className="flex items-center justify-between rounded-md border p-3"
                      style={{ borderLeftColor: color.hex, borderLeftWidth: 3 }}
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">{endpoint.name}</div>
                        <div className="text-xs text-muted-foreground">{result.message}</div>
                      </div>
                      <div className="text-right">
                        {result.state === 'testing' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <div className="text-sm font-bold" style={{ color: color.hex }}>
                              {result.ok ? '成功' : '失败'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.latencyMs}ms
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>维度数据源映射</CardTitle>
                <CardDescription>各维度与直连数据源优先级的当前配置</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {dimensions.map((dim) => (
                  <div
                    key={dim.code}
                    className={`rounded-md border p-3 ${dim.enabled ? '' : 'opacity-60'}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {dim.code} · {dim.name}
                        </span>
                        <Badge variant={dim.enabled ? 'default' : 'outline'}>
                          {dim.enabled ? '启用' : '禁用'}
                        </Badge>
                      </div>
                    </div>
                    <SourcePrioritySelect
                      value={dim.sourcePriority}
                      onChange={(priority) => handleUpdateDimensionPriority(dim.code, priority)}
                      disabled={!dim.enabled}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <LiveLogStream logs={logs} onClear={clearLogs} maxHeight="300px" />
      </div>
    </ErrorBoundary>
  )
}
