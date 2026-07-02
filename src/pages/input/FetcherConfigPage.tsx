/**
 * @module FetcherConfigPage
 * @description 抓取引擎配置页（D-2 框架）。
 *
 * 三大面板：
 * - 数据源列表：腾讯/新浪/网易/AKShare/Mock 等数据源配置展示
 * - 连通性测试面板：测试数据源连通性并展示结果
 * - 采集日志面板：滚动展示抓取引擎日志
 *
 * 使用 src/config/fetcherConfig.ts 中的配置数据，Mock 模式不接入真实 API。
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Server, Wifi, ScrollText, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getLogger } from '@/lib/logger'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { Separator } from '@/components/ui/Separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import {
  getDefaultFetcherConfig,
  getDefaultFetcherDimensions,
  getDefaultFetcherGlobalConfig,
  FETCHER_FREQUENCY_LABELS,
  type FetcherDimensionConfig,
} from '@/config/fetcherConfig'

const logger = getLogger()

// ============================================================
// 数据源定义（Mock）
// ============================================================

type SourceStatus = 'online' | 'offline' | 'unknown'

interface DataSourceItem {
  id: string
  name: string
  type: string
  baseURL: string
  status: SourceStatus
  latencyMs: number
  description: string
}

/** 数据源状态对应颜色 token（引用 constants，不硬编码） */
const SOURCE_STATUS_COLOR: Record<SourceStatus, keyof typeof COLOR_TOKENS> = {
  online: 'success',
  offline: 'danger',
  unknown: 'neutral',
}

const SOURCE_STATUS_BADGE: Record<SourceStatus, { label: string; variant: 'success' | 'destructive' | 'outline' }> = {
  online: { label: '在线', variant: 'success' },
  offline: { label: '离线', variant: 'destructive' },
  unknown: { label: '未知', variant: 'outline' },
}

const MOCK_DATA_SOURCES: DataSourceItem[] = [
  { id: 'tencent', name: '腾讯财经', type: 'HTTP REST', baseURL: 'https://proxy.finance.qq.com', status: 'online', latencyMs: 128, description: '实时行情、K线、板块资金流向' },
  { id: 'sina', name: '新浪财经', type: 'HTTP REST', baseURL: 'https://hq.sinajs.cn', status: 'online', latencyMs: 156, description: '实时行情、分时数据' },
  { id: 'netease', name: '网易财经', type: 'HTTP REST', baseURL: 'https://api.money.126.net', status: 'unknown', latencyMs: 0, description: '历史K线、财务数据' },
  { id: 'akshare', name: 'AKShare', type: 'Python Service', baseURL: 'http://localhost:8000', status: 'online', latencyMs: 320, description: '主数据源，全维度采集服务' },
  { id: 'mock', name: 'Mock 数据源', type: '本地 Mock', baseURL: 'mock://local', status: 'online', latencyMs: 5, description: '本地 Mock，用于开发与测试' },
]

interface FetcherLog {
  id: string
  time: string
  level: 'info' | 'warn' | 'error'
  source: string
  message: string
}

const MOCK_FETCHER_LOGS: FetcherLog[] = [
  { id: 'F1', time: '09:21:05', level: 'info', source: 'akshare', message: 'AKShare 服务连接成功，baseURL=http://localhost:8000' },
  { id: 'F2', time: '09:21:03', level: 'info', source: 'tencent', message: '腾讯财经数据源连通，延迟 128ms' },
  { id: 'F3', time: '09:20:58', level: 'warn', source: 'netease', message: '网易财经接口响应缓慢，建议降级处理' },
  { id: 'F4', time: '09:20:50', level: 'info', source: 'sina', message: '新浪财经数据源连通，延迟 156ms' },
  { id: 'F5', time: '09:20:42', level: 'error', source: 'akshare', message: '维度 05 热点新闻采集超时，触发重试机制' },
  { id: 'F6', time: '09:20:30', level: 'info', source: 'mock', message: 'Mock 数据源已就绪，供开发调试使用' },
]

// ============================================================
// 连通性测试结果
// ============================================================

type TestState = 'idle' | 'testing' | 'done'

interface TestResult {
  sourceId: string
  ok: boolean
  latencyMs: number
  message: string
}

// ============================================================
// 主页面
// ============================================================

export default function FetcherConfigPage(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [logs] = useState<FetcherLog[]>(MOCK_FETCHER_LOGS)

  const fetcherConfig = useMemo(() => getDefaultFetcherConfig(), [])
  const dimensions = useMemo<FetcherDimensionConfig[]>(() => getDefaultFetcherDimensions(), [])
  const globalConfig = useMemo(() => getDefaultFetcherGlobalConfig(), [])

  useEffect(() => {
    logger.info('[FetcherConfigPage] 挂载，加载 fetcherConfig 数据')
    const timer = window.setTimeout(() => {
      try {
        setIsLoading(false)
      } catch (err) {
        logger.error('[FetcherConfigPage] 加载失败', { err })
        setIsLoading(false)
      }
    }, 400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const handleConnectivityTest = (): void => {
    setTestState('testing')
    setTestResults([])
    logger.info('[FetcherConfigPage] 开始连通性测试')
    const timer = window.setTimeout(() => {
      try {
        const results: TestResult[] = MOCK_DATA_SOURCES.map((src) => {
          // Mock 测试：网易为失败，其余成功
          const ok = src.id !== 'netease'
          return {
            sourceId: src.id,
            ok,
            latencyMs: ok ? src.latencyMs : 0,
            message: ok ? '连通正常' : '连接超时，建议检查网络或降级',
          }
        })
        setTestResults(results)
        setTestState('done')
        logger.info('[FetcherConfigPage] 连通性测试完成', { successCount: results.filter(r => r.ok).length })
      } catch (err) {
        logger.error('[FetcherConfigPage] 连通性测试异常', { err })
        setTestState('done')
      }
    }, 800)
    // cleanup 在组件卸载时无法清除已触发逻辑，但定时器本身在 effect 外需手动管理
    // 此处通过 testState 防止重复触发
    void timer
  }

  const onlineCount = MOCK_DATA_SOURCES.filter((s) => s.status === 'online').length
  const enabledDimCount = dimensions.filter((d) => d.enabled).length

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {/* 面包屑 */}
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

        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">抓取引擎配置</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              数据源管理 · 连通性测试 · 引擎日志
            </p>
          </div>
          <Badge variant="outline">D-2 框架 · v{fetcherConfig.version}</Badge>
        </div>

        {/* 全局配置概览 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">数据源数量</p>
              <p className="mt-1 text-2xl font-bold">{MOCK_DATA_SOURCES.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">在线数据源</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: COLOR_TOKENS.success.hex }}>{onlineCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">启用维度</p>
              <p className="mt-1 text-2xl font-bold">{enabledDimCount} / {dimensions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">日调用上限</p>
              <p className="mt-1 text-2xl font-bold">{globalConfig.rateLimitPerDay}</p>
            </CardContent>
          </Card>
        </div>

        {/* 数据源列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>数据源列表</CardTitle>
                <CardDescription>已配置的数据源供应商及其连通状态</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : MOCK_DATA_SOURCES.length === 0 ? (
              <EmptyState title="暂无数据源" description="尚未配置任何数据源" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>数据源</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>地址</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>延迟</TableHead>
                      <TableHead>说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_DATA_SOURCES.map((src) => {
                      const statusInfo = SOURCE_STATUS_BADGE[src.status]
                      const colorToken = COLOR_TOKENS[SOURCE_STATUS_COLOR[src.status]]
                      return (
                        <TableRow key={src.id}>
                          <TableCell className="font-medium">{src.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{src.type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{src.baseURL}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: colorToken.hex }}
                              />
                              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {src.latencyMs > 0 ? `${src.latencyMs}ms` : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{src.description}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 连通性测试面板 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>连通性测试</CardTitle>
                  <CardDescription>一键测试所有数据源的连通性与响应延迟</CardDescription>
                </div>
              </div>
              <Button
                onClick={handleConnectivityTest}
                disabled={testState === 'testing' || isLoading}
                isLoading={testState === 'testing'}
                className="gap-1.5"
              >
                {testState !== 'testing' && <Play className="h-4 w-4" />}
                {testState === 'testing' ? '测试中...' : testState === 'done' ? '重新测试' : '开始测试'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {testState === 'idle' ? (
              <EmptyState
                title="尚未执行连通性测试"
                description="点击右上角「开始测试」按钮，检测各数据源是否可正常访问"
                icon={<Wifi className="h-12 w-12 text-muted-foreground/40" />}
              />
            ) : testState === 'testing' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在测试数据源连通性...
                </div>
                <Progress value={50} max={100} showMax={false} />
              </div>
            ) : (
              <div className="space-y-2">
                {testResults.map((result) => {
                  const source = MOCK_DATA_SOURCES.find((s) => s.id === result.sourceId)
                  const colorToken = result.ok ? COLOR_TOKENS.success : COLOR_TOKENS.danger
                  return (
                    <div
                      key={result.sourceId}
                      className="flex items-center justify-between rounded-md border p-3"
                      style={{ borderLeftColor: colorToken.hex, borderLeftWidth: 3 }}
                    >
                      <div className="flex items-center gap-2">
                        {result.ok ? (
                          <CheckCircle className="h-4 w-4" style={{ color: COLOR_TOKENS.success.hex }} />
                        ) : (
                          <XCircle className="h-4 w-4" style={{ color: COLOR_TOKENS.danger.hex }} />
                        )}
                        <span className="text-sm font-medium">{source?.name ?? result.sourceId}</span>
                        <Badge variant={result.ok ? 'success' : 'destructive'}>
                          {result.ok ? '成功' : '失败'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{result.message}</span>
                        {result.ok && <span>延迟 {result.latencyMs}ms</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 维度采集配置（来自 fetcherConfig） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">维度采集配置</CardTitle>
            <CardDescription>来自 src/config/fetcherConfig.ts 的默认维度配置</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {dimensions.map((dim) => (
                  <div key={dim.code} className="flex items-center justify-between rounded-md border p-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={dim.enabled ? 'default' : 'outline'}>
                        {dim.enabled ? '启用' : '禁用'}
                      </Badge>
                      <span className="text-sm font-medium">{dim.code}·{dim.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>频率：{FETCHER_FREQUENCY_LABELS[dim.frequency]}</span>
                      <span>·</span>
                      <span>源：{dim.sources.join(', ')}</span>
                      <span>·</span>
                      <span>缓存：{dim.cacheTtlMinutes}min</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 采集日志面板 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>采集日志</CardTitle>
                <CardDescription>抓取引擎运行日志</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <EmptyState title="暂无日志" description="抓取引擎启动后将在此展示日志" />
            ) : (
              <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {logs.map((log) => {
                  const levelColor =
                    log.level === 'error'
                      ? COLOR_TOKENS.danger.hex
                      : log.level === 'warn'
                        ? COLOR_TOKENS.warning.hex
                        : COLOR_TOKENS.info.hex
                  return (
                    <div key={log.id} className="flex items-start gap-2 py-0.5">
                      <span className="shrink-0 text-muted-foreground">{log.time}</span>
                      <span className="shrink-0 font-semibold uppercase" style={{ color: levelColor }}>
                        [{log.level}]
                      </span>
                      <span className="shrink-0 text-muted-foreground">[{log.source}]</span>
                      <span className="min-w-0 break-words text-foreground">{log.message}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 全局参数 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">全局参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">最大标的数</span>
              <span className="text-sm">{globalConfig.maxSymbols}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">批量大小</span>
              <span className="text-sm">{globalConfig.batchSize}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">默认频率</span>
              <span className="text-sm">{FETCHER_FREQUENCY_LABELS[globalConfig.defaultFrequency]}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">每分钟限流</span>
              <span className="text-sm">{globalConfig.rateLimitPerMinute}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">每小时限流</span>
              <span className="text-sm">{globalConfig.rateLimitPerHour}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">每日限流</span>
              <span className="text-sm">{globalConfig.rateLimitPerDay}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  )
}
