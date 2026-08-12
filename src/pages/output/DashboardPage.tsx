import { memo, useEffect } from 'react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { useCommandStore } from '@/store/commandStore'
import { useScoreDocStore } from '@/store/scoreDocStore'
import { useDisciplineStore } from '@/store/disciplineStore'
import { useSectorAnalysisStore } from '@/store/sectorAnalysisStore'
import { COLOR_TOKENS, COLOR_SHADES, twBg, twText } from '@/constants/theme.tokens'
import { getLogger } from '@/lib/logger'
import { PageContainer, PageHeader } from '@/components/templates'

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
  const refreshDiscipline = useDisciplineStore((s) => s.refresh)

  const industryScores = useSectorAnalysisStore((s) => s.industryScores)
  const sectorLoading = useSectorAnalysisStore((s) => s.loading)
  const fetchSectorAnalysis = useSectorAnalysisStore((s) => s.fetchSectorAnalysis)

  useEffect(() => {
    logger.info('[DashboardPage] 挂载，加载真实统计')
    void loadStats()
    void refreshDiscipline()
    void fetchSectorAnalysis()
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
                <p className="text-sm text-muted-foreground">暂无复盘数据</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">总交易笔数</p>
                    <p className="text-xl font-bold">{latestReport.summary.totalTrades}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">胜率</p>
                    <p className={`text-xl font-bold ${COLOR_TOKENS.success.tailwind}`}>
                      {latestReport.summary.winRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">盈亏比</p>
                    <p className={`text-xl font-bold ${twText('yellow', 600)}`}>
                      {latestReport.summary.profitLossRatio}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">纪律评分</p>
                    <p
                      className={`text-xl font-bold ${
                        latestReport.summary.disciplineScore >= 80
                          ? COLOR_TOKENS.success.tailwind
                          : COLOR_TOKENS.warning.tailwind
                      }`}
                    >
                      {latestReport.summary.disciplineScore}
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
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : topIndustries.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无行业评分数据</p>
              ) : (
                <div className="space-y-2">
                  {topIndustries.map((score) => {
                    const ratio = (score.overallScore ?? 0) / maxIndustryScore
                    const barColor =
                      ratio > 0.7 ? twBg('red', 500) : ratio > 0.4 ? twBg('orange', 500) : twBg('green', 500)
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
                <p className="text-sm text-muted-foreground">暂无研报记录</p>
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
      </PageContainer>
    </ErrorBoundary>
  )
})

DashboardPage.displayName = 'DashboardPage'
export default DashboardPage
