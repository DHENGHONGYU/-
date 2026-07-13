/**
 * 测试总览舱（数据处理能力压测总览）
 *
 * 路径: /command/test
 * 用途: 从 usePerfMetricsStore 读取历次压测结果，呈现
 *   - 汇总表（历次运行的总耗时 / P95 / 通过率 / 维度耗时）
 *   - 折线图（各维度耗时趋势，复用 LineChart）
 *   - 柱状图（最新一次单任务耗时分布，复用 BarChart）
 *   - 因子热力图（计算密集型任务耗时占比，复用 FactorHeatmap）
 * 并接入统一的加载 / 空态守卫。
 *
 * @module pages/command/test/StressOverviewPage
 * @created 2026-07-13 修复任务
 */
import { useMemo, useState } from 'react'
import { Activity, BarChart3, Grid3x3, LineChart as LineIcon, Play, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Skeleton } from '@/components/molecules/states/Skeleton'
import { PageContainer, PageHeader } from '@/components/templates'
import { usePerfMetricsStore } from '@/store/perfMetricsStore'
import { runStressTest } from '@/services/perf/stressTestService'
import { LineChart } from '@/components/chart/LineChart'
import { BarChart } from '@/components/chart/BarChart'
import { FactorHeatmap } from '@/components/chart/FactorHeatmap'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import type { StressTestResult, TaskStatSummary } from '@/types/modules/perf.types'

/** 成功率 → 颜色令牌（涨绿跌红规则不适用，此处用语义色） */
function rateColor(rate: number): string {
  if (rate >= 1) return COLOR_TOKENS.success.hex
  if (rate >= 0.9) return COLOR_TOKENS.warning.hex
  return COLOR_TOKENS.danger.hex
}

function fmtMs(v: number): string {
  return `${Math.round(v)} ms`
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN')
}

function successRate(r: StressTestResult): number {
  const total = r.metrics.length
  if (total === 0) return 0
  return r.summary.successCount / total
}

/**
 * 测试总览舱页面
 */
export default function StressOverviewPage(): React.JSX.Element {
  const results = usePerfMetricsStore((s) => s.results)
  const running = usePerfMetricsStore((s) => s.running)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const latest: StressTestResult | undefined = results.length > 0 ? results[results.length - 1] : undefined
  const isLoading = running || busy

  // 折线图：各维度耗时趋势（按运行时间升序）
  const lineData = useMemo(
    () =>
      [...results]
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((r) => ({
          t: fmtTime(r.timestamp),
          total: r.summary.totalDurationMs,
          v6: r.summary.avgV6ScoreMs,
          dual: r.summary.avgDualStrategyMs,
          rot: r.summary.avgRotationDetectionMs,
        })),
    [results],
  )

  // 柱状图：最新一次单任务耗时分布
  const barData = useMemo(() => {
    if (!latest) return []
    return Object.values(latest.taskSummaries).map((s: TaskStatSummary) => ({
      task: s.taskName,
      avgMs: s.avgMs,
      p95Ms: s.p95Ms,
    }))
  }, [latest])

  // 因子热力图：计算密集型任务耗时占比（V6 / 双策略 / 轮动）
  const heatData = useMemo<{ items: { name: string; value: number; category: string }[]; min: number; max: number }>(() => {
    if (!latest) return { items: [], min: 0, max: 1 }
    const items = Object.values(latest.taskSummaries).map((s: TaskStatSummary) => ({
      name: s.taskName,
      value: s.avgMs,
      category: '计算任务耗时(ms)',
    }))
    const values = items.map((i) => i.value)
    const min = values.length > 0 ? Math.min(...values) : 0
    const max = values.length > 0 ? Math.max(...values) : 1
    return { items, min, max }
  }, [latest])

  const handleRun = async (): Promise<void> => {
    setBusy(true)
    setLocalError(null)
    try {
      await runStressTest()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // 加载态
  if (isLoading && !latest) {
    return (
      <PageContainer className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="测试总览舱"
        description={
          latest
            ? `最近一次 ${fmtTime(latest.timestamp)} · 共 ${results.length} 次运行`
            : '数据处理能力压测总览 · 暂无运行记录'
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => void handleRun()} disabled={isLoading}>
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {isLoading ? '压测中...' : '运行压测'}
          </Button>
        }
      />

      {localError && (
        <div className="text-sm" style={{ color: COLOR_TOKENS.danger.hex }}>
          压测执行失败：{localError}
        </div>
      )}

      {/* 空态 */}
      {!latest && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Grid3x3 className="h-10 w-10" style={{ color: CHART_PALETTE.axis }} />
            <div>
              <p className="font-medium text-foreground">暂无压测数据</p>
              <p className="mt-1 text-sm text-muted-foreground">
                点击右上角「运行压测」触发 V6 评分引擎 / 双策略分析 / 轮动检测的集中压力测试。
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleRun()} disabled={isLoading}>
              <Play className="mr-2 h-4 w-4" />
              立即运行
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 关键指标卡 */}
      {latest && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>总耗时</CardDescription>
              <CardTitle className="text-2xl">{fmtMs(latest.summary.totalDurationMs)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>P95 耗时</CardDescription>
              <CardTitle className="text-2xl">{fmtMs(latest.summary.p95Ms)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>通过率</CardDescription>
              <CardTitle className="text-2xl" style={{ color: rateColor(successRate(latest)) }}>
                {Math.round(successRate(latest) * 100)}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>V6 平均耗时</CardDescription>
              <CardTitle className="text-2xl">{fmtMs(latest.summary.avgV6ScoreMs)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* 汇总表：历次运行 */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">运行汇总表</CardTitle>
            <CardDescription>保留最近 {results.length} 次压测结果</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">时间</th>
                  <th className="py-2 pr-4 font-medium">标的数</th>
                  <th className="py-2 pr-4 font-medium">总耗时</th>
                  <th className="py-2 pr-4 font-medium">P95</th>
                  <th className="py-2 pr-4 font-medium">通过率</th>
                  <th className="py-2 pr-4 font-medium">V6均</th>
                  <th className="py-2 pr-4 font-medium">双策略均</th>
                  <th className="py-2 pr-4 font-medium">轮动均</th>
                </tr>
              </thead>
              <tbody>
                {[...results].reverse().map((r) => (
                  <tr key={r.runId} className="border-t border-border">
                    <td className="py-2 pr-4 text-muted-foreground">{fmtTime(r.timestamp)}</td>
                    <td className="py-2 pr-4">{r.symbols.length}</td>
                    <td className="py-2 pr-4">{fmtMs(r.summary.totalDurationMs)}</td>
                    <td className="py-2 pr-4">{fmtMs(r.summary.p95Ms)}</td>
                    <td className="py-2 pr-4" style={{ color: rateColor(successRate(r)) }}>
                      {Math.round(successRate(r) * 100)}%
                    </td>
                    <td className="py-2 pr-4">{fmtMs(r.summary.avgV6ScoreMs)}</td>
                    <td className="py-2 pr-4">{fmtMs(r.summary.avgDualStrategyMs)}</td>
                    <td className="py-2 pr-4">{fmtMs(r.summary.avgRotationDetectionMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 折线图：各维度耗时趋势 */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LineIcon className="h-4 w-4" style={{ color: CHART_PALETTE.series1 }} />
              耗时趋势
            </CardTitle>
            <CardDescription>历次运行的各维度平均耗时（毫秒）</CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              data={lineData}
              xKey="t"
              height={260}
              lines={[
                { dataKey: 'total', name: '总耗时', color: CHART_PALETTE.series1 },
                { dataKey: 'v6', name: 'V6评分', color: CHART_PALETTE.series2 },
                { dataKey: 'dual', name: '双策略', color: CHART_PALETTE.series3 },
                { dataKey: 'rot', name: '轮动检测', color: CHART_PALETTE.series4 },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* 柱状图：最新一次单任务耗时分布 */}
      {latest && barData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" style={{ color: CHART_PALETTE.series2 }} />
              单任务耗时分布
            </CardTitle>
            <CardDescription>最新一次运行 · 各计算任务的平均与 P95 耗时</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              data={barData}
              xKey="task"
              height={260}
              bars={[
                { dataKey: 'avgMs', name: '平均耗时', color: CHART_PALETTE.series2 },
                { dataKey: 'p95Ms', name: 'P95耗时', color: CHART_PALETTE.series4 },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* 因子热力图：计算密集型任务耗时占比 */}
      {latest && heatData.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3x3 className="h-4 w-4" style={{ color: CHART_PALETTE.factorHeatmapHigh }} />
              计算任务耗时热力图
            </CardTitle>
            <CardDescription>V6 评分引擎 / 双策略分析 / 轮动检测 的平均耗时对比</CardDescription>
          </CardHeader>
          <CardContent>
            <FactorHeatmap data={heatData.items} minValue={heatData.min} maxValue={heatData.max} height={160} />
          </CardContent>
        </Card>
      )}

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: CHART_PALETTE.accent }} />
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            1. 本页数据来自 <code>usePerfMetricsStore</code>，由 <code>runStressTest()</code> 压测服务写入；
            亦可由 <code>scripts/stress-test-runner.ts</code> 在 CLI 触发。
          </p>
          <p>
            2. 点击「运行压测」会随机抽取 20 只标的，对 V6 评分引擎、双策略分析、轮动检测执行并行压力测试，
            结果实时汇总至上方表格与图表。
          </p>
          <p>
            3. 图表均复用项目统一组件（LineChart / BarChart / FactorHeatmap），配色走 CHART_PALETTE 设计令牌，
            缺数据或退化数据已做空态 / 中点色守卫，避免异常显示。
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
