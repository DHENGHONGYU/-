import { memo, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, BarChart3, CheckCircle2, Newspaper, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { EmptyState, LoadingState } from '@/components/organisms/shared'
import { useCommandStore } from '@/store/commandStore'
import { useScoreDocStore } from '@/store/scoreDocStore'
import { useDisciplineStore } from '@/store/disciplineStore'
import { useSectorAnalysisStore } from '@/store/sectorAnalysisStore'
import { COLOR_TOKENS, COLOR_SHADES } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'
import { PageContainer, PageHeader } from '@/components/templates'
import { scanAllReportQualities, type QualityScanResult } from '@/services/orchestration/reportQualityChecker'

const logger = getLogger()

/**
 * 仪表盘页面（阶段 D-3：从"待实现占位"升级为"真实统计概览"）
 * - 数据来源：useCommandStore.stats（系统统计）+ useScoreDocStore.versions（研报版本库）
 * - 新增：useDisciplineStore.latestReport（交易复盘摘要）+ useSectorAnalysisStore.industryScores（行业热力图）
 */
const DashboardPage = memo(() => {
  const stats = useCommandStore((s) => s.stats)
  const loadStats = useCommandStore((s) => s.loadStats)
  const versions = useScoreDocStore((s) => s.versions)

  const latestReport = useDisciplineStore((s) => s.latestReport)
  const realDisciplineScore = useDisciplineStore((s) => s.realDisciplineScore)
  const refreshDiscipline = useDisciplineStore((s) => s.refresh)

  const industryScores = useSectorAnalysisStore((s) => s.industryScores)
  const sectorLoading = useSectorAnalysisStore((s) => s.loading)
  const fetchSectorAnalysis = useSectorAnalysisStore((s) => s.fetchSectorAnalysis)

  const [qualityScan, setQualityScan] = useState<QualityScanResult | null>(null)
  const [qualityLoading, setQualityLoading] = useState(false)

  const runQualityScan = async (): Promise<void> => {
    setQualityLoading(true)
    try {
      const result = await scanAllReportQualities()
      setQualityScan(result)
    } catch (err) {
      logger.error('[DashboardPage] 质量扫描失败', { error: err })
    } finally {
      setQualityLoading(false)
    }
  }

  useEffect(() => {
    logger.info('[DashboardPage] 挂载，加载真实统计')
    void loadStats()
    void refreshDiscipline()
    void fetchSectorAnalysis()
    void runQualityScan()
  }, [loadStats, refreshDiscipline, fetchSectorAnalysis])

  const totalScoreDocs = versions.length

  const topIndustries = [...industryScores]
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
    .slice(0, 8)

  const maxIndustryScore = Math.max(1, ...topIndustries.map((s) => s.overallScore ?? 0))

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-4">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/output">输出舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>仪表盘</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="输出舱 · 仪表盘"
          description="系统统计概览与关键指标监控"
          actions={<Badge variant="secondary">实时统计</Badge>}
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">股票池</CardTitle>
              <CardDescription>当前维护的股票标的数</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.stocks ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">订单</CardTitle>
              <CardDescription>模拟盘订单总数</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.orders ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">评分记录</CardTitle>
              <CardDescription>系统已生成评分数</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.scores ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">研报版本</CardTitle>
              <CardDescription>已落库的研究报告数</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalScoreDocs}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 交易复盘摘要 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">交易复盘摘要</CardTitle>
              <CardDescription>最新 AI 交易复盘关键指标</CardDescription>
            </CardHeader>
            <CardContent>
              {!latestReport ? (
                <EmptyState
                  icon={<BarChart3 />}
                  title="暂无复盘数据"
                  description="尚未生成交易复盘报告"
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">总交易笔数</p>
                    <p className="text-h2 font-bold">{latestReport.summary.totalTrades}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">胜率</p>
                    <p className={`text-h2 font-bold ${COLOR_TOKENS.success.tailwind}`}>
                      {latestReport.summary.winRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">盈亏比</p>
                    <p className="text-h2 font-bold text-warning">
                      {latestReport.summary.profitLossRatio}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">纪律评分</p>
                    <p
                      className={`text-h2 font-bold ${
                        latestReport.summary.disciplineScore >= 80
                          ? COLOR_TOKENS.success.tailwind
                          : COLOR_TOKENS.warning.tailwind
                      }`}
                    >
                      {latestReport.summary.disciplineScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">真实复盘评分</p>
                    <p
                      className={`text-h2 font-bold ${
                        realDisciplineScore >= 80
                          ? COLOR_TOKENS.success.tailwind
                          : COLOR_TOKENS.warning.tailwind
                      }`}
                    >
                      {realDisciplineScore > 0 ? realDisciplineScore : '—'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 行业热力图 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">行业评分热力图</CardTitle>
              <CardDescription>行业评分 Top 8 分布</CardDescription>
            </CardHeader>
            <CardContent>
              {sectorLoading ? (
                <LoadingState message="加载中..." />
              ) : topIndustries.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 />}
                  title="暂无行业评分数据"
                  description="行业评分数据尚未生成"
                />
              ) : (
                <div className="space-y-2">
                  {topIndustries.map((score) => {
                    const ratio = (score.overallScore ?? 0) / maxIndustryScore
                    const barColor =
                      ratio > 0.7 ? 'bg-destructive' : ratio > 0.4 ? 'bg-warning' : 'bg-success'
                    return (
                      <div key={score.code} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{score.name}</span>
                          <span className="text-muted-foreground">{score.overallScore ?? 0}</span>
                        </div>
                        <div className={`${COLOR_SHADES.gray[200]} h-2 rounded-full`}>
                          <div className={`${barColor} h-2 rounded-full`} style={{ width: `${Math.round(ratio * 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 研报导出记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">研报导出记录</CardTitle>
              <CardDescription>最近生成的评分研报</CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <EmptyState
                  icon={<Newspaper />}
                  title="暂无研报记录"
                  description="尚未生成评分研报"
                />
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {versions.slice(0, 10).map((version) => (
                    <div
                      key={`${version.symbol}-${version.version}`}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{version.symbol}</span>
                        <span className="ml-2 text-xs text-muted-foreground">v{version.version}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {new Date(version.createdAt).toLocaleDateString('zh-CN')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 报告质量红线告警 —— P0-3 */}
        <Card className={(qualityScan?.redAlerts ?? 0) > 0 ? 'border-destructive/50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {qualityLoading ? (
                  <Clock className="h-4 w-4 animate-pulse text-muted-foreground" />
                ) : qualityScan && qualityScan.redAlerts > 0 ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : qualityScan && qualityScan.yellowAlerts > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                )}
                报告质量监控
                <Badge variant="secondary" className="text-xs">
                  {qualityScan ? `${qualityScan.totalReports} 份报告` : '扫描中...'}
                </Badge>
              </CardTitle>
              <CardDescription>
                {qualityScan
                  ? `通过率 ${(qualityScan.summary.passRate * 100).toFixed(0)}% · 平均分 ${qualityScan.summary.avgScore}`
                  : '正在扫描报告质量状态...'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void runQualityScan()
              }}
              disabled={qualityLoading}
            >
              {qualityLoading ? '扫描中...' : '重新扫描'}
            </Button>
          </CardHeader>
          <CardContent>
            {qualityLoading ? (
              <LoadingState message="正在扫描报告质量..." />
            ) : !qualityScan || qualityScan.totalReports === 0 ? (
              <EmptyState
                icon={<Newspaper />}
                title="暂无报告数据"
                description="生成分析报告后将自动进行质量检查"
              />
            ) : (
              <div className="space-y-4">
                {/* 告警汇总 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <span className="text-2xl font-bold text-destructive">{qualityScan.redAlerts}</span>
                    <span className="text-xs text-muted-foreground">红色告警</span>
                  </div>
                  <div className="flex flex-col items-center rounded-md border border-warning/30 bg-warning/5 p-3">
                    <span className="text-2xl font-bold text-warning">{qualityScan.yellowAlerts}</span>
                    <span className="text-xs text-muted-foreground">黄色警告</span>
                  </div>
                  <div className="flex flex-col items-center rounded-md border border-success/30 bg-success/5 p-3">
                    <span className="text-2xl font-bold text-success">{qualityScan.greenAlerts}</span>
                    <span className="text-xs text-muted-foreground">通过报告</span>
                  </div>
                </div>

                {/* 高频问题 */}
                {qualityScan.summary.mostCommonIssues.length > 0 && (
                  <div className="rounded-md border border-border/40 bg-muted/20 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">高频问题 TOP5</p>
                    <div className="flex flex-wrap gap-2">
                      {qualityScan.summary.mostCommonIssues.map((issue) => (
                        <Badge key={issue} variant="outline" className="text-xs">
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 红色告警详情 */}
                {qualityScan.redAlerts > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-destructive">需立即修复的报告</p>
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {qualityScan.reports
                        .filter((r) => r.overallLevel === 'red')
                        .slice(0, 5)
                        .map((r) => (
                          <div
                            key={r.docId}
                            className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
                          >
                            <div>
                              <span className="font-medium">{r.symbol}</span>
                              <div className="mt-0.5 flex gap-1">
                                {r.missingCriticalDeliverables.map((d) => (
                                  <Badge key={d} variant="destructive" className="text-[10px]">
                                    {d}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-destructive">{r.score}分</span>
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(r.createdAt).toLocaleDateString('zh-CN')}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </ErrorBoundary>
  )
})

DashboardPage.displayName = 'DashboardPage'
export default DashboardPage
