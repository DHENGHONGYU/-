import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { useToast } from '@/hooks/useToast'
import { useDensityConfig } from '@/components/cockpit/DensityContext'
import { AnalysisTemplateCards } from '@/components/organisms/analysis/hub/AnalysisTemplateCards'
import { PageContainer, PageHeader } from '@/components/templates'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'
import SimilarStockRecallCard from '@/components/organisms/analysis/SimilarStockRecallCard'
import VectorConsistencyRankingCard from '@/components/organisms/analysis/VectorConsistencyRankingCard'
import {
  useAnalysisStore,
  // 派生查询 Hook（通过 export * 从 .derived.ts 导入）
  useIsLoadingAny,
  useErrorUnion,
} from '@/store/analysisStore'
import type { AnalysisScope } from '@/types/modules/analysis.types'
import type { ScreenSource } from '@/data/types/types.stock'

function getScoreColorClass(score: number): string {
  if (score >= 4.0) return 'text-[hsl(var(--stock-up))]'
  if (score >= 3.0) return 'text-primary'
  return 'text-[hsl(var(--stock-down))]'
}

// ── Lazy 页面导入 ────────────────────────────────────────────────────────────
// 注：SectorAnalysisPage 已废弃，功能合并到 IndustryDashboardPage（行业全景仪表盘）
const BacktestPage = React.lazy(() => import('@/pages/analysis/BacktestPage'))
const IndustryScorePage = React.lazy(() => import('@/pages/analysis/IndustryScorePage'))
const IndustryDashboardPage = React.lazy(() => import('@/pages/analysis/IndustryDashboardPage'))
const IntelligentScorePage = React.lazy(() => import('@/pages/analysis/IntelligentScorePage'))
const ScoreDocPage = React.lazy(() => import('@/pages/analysis/ScoreDocPage'))
const ScoreComparisonPage = React.lazy(() => import('@/pages/analysis/ScoreComparisonPage'))
const NewsPage = React.lazy(() => import('@/pages/analysis/NewsPage'))
const NewsV6Page = React.lazy(() => import('@/pages/analysis/NewsV6Page'))
const HotSectorPage = React.lazy(() => import('@/pages/analysis/HotSectorPage'))
const ValuePitPage = React.lazy(() => import('@/pages/analysis/ValuePitPage'))
const MultiFactorFilterPage = React.lazy(() => import('@/pages/analysis/MultiFactorFilterPage'))
const ReviewLaunchPage = React.lazy(() => import('@/pages/analysis/ReviewLaunchPage'))

const logger = getLogger()

interface AnalysisRoute {
  path: string
  branch: string
  componentName: string
  /** false 表示同时匹配 path 与 path/ 前缀；默认 true 为精确匹配 */
  exact?: boolean
  component: React.ReactNode
  fallback: string
}

const ANALYSIS_ROUTES: AnalysisRoute[] = [
  { path: '/analysis/intelligent-score', branch: 'intelligent-score', componentName: 'IntelligentScorePage', exact: false, component: <IntelligentScorePage />, fallback: '加载个股智能分析页...' },
  { path: '/analysis/backtest', branch: 'backtest', componentName: 'BacktestPage', component: <BacktestPage />, fallback: '加载回测页...' },
  { path: '/analysis/industry-score', branch: 'industry-score', componentName: 'IndustryScorePage', component: <IndustryScorePage />, fallback: '加载行业评分页...' },
  { path: '/analysis/industry-dashboard', branch: 'industry-dashboard', componentName: 'IndustryDashboardPage', component: <IndustryDashboardPage />, fallback: '加载行业全景仪表盘...' },
  { path: '/analysis/score-docs', branch: 'score-docs', componentName: 'ScoreDocPage', component: <ScoreDocPage />, fallback: '加载评分文档页...' },
  { path: '/analysis/score-comparison', branch: 'score-comparison', componentName: 'ScoreComparisonPage', component: <ScoreComparisonPage />, fallback: '加载评分比对看板...' },
  { path: '/analysis/news', branch: 'news', componentName: 'NewsPage', component: <NewsPage />, fallback: '加载新闻页...' },
  { path: '/analysis/news-v6', branch: 'news-v6', componentName: 'NewsV6Page', component: <NewsV6Page />, fallback: '加载新闻 V6 页...' },
  { path: '/analysis/hot-sector', branch: 'hot-sector', componentName: 'HotSectorPage', component: <HotSectorPage />, fallback: '加载热门板块页...' },
  { path: '/analysis/value-pit', branch: 'value-pit', componentName: 'ValuePitPage', component: <ValuePitPage />, fallback: '加载价值洼地页...' },
  { path: '/analysis/multi-factor', branch: 'multi-factor', componentName: 'MultiFactorFilterPage', component: <MultiFactorFilterPage />, fallback: '加载多因子筛选页...' },
  { path: '/analysis/review-launch', branch: 'review-launch', componentName: 'ReviewLaunchPage', exact: false, component: <ReviewLaunchPage />, fallback: '加载复盘启动分析页...' },
]

function matchAnalysisRoute(path: string): AnalysisRoute {
  for (const route of ANALYSIS_ROUTES) {
    if (route.exact === false) {
      if (path === route.path || path.startsWith(route.path + '/')) return route
    } else if (path === route.path) {
      return route
    }
  }
  return { path: '', branch: 'default', componentName: 'V6ScoreCard', component: null, fallback: '' }
}

/**
 * 分析舱子路由分发
 *
 * @description
 * 使用 useLocation + 条件渲染替代嵌套 <Routes>。
 *
 * 根因：React Router v7 在 descendant <Routes> 场景下，绝对路径匹配行为
 * 与 v6 不一致。当 App.tsx 顶层已通过 <Route path="/analysis"> 匹配并渲染
 * PortalShell → AnalysisApp 时，AnalysisApp 内部的 <Routes path="/analysis/...">
 * 不会再次匹配当前 URL。
 *
 * 修复方案：直接读取 location.pathname 进行条件渲染，绕过 descendant
 * Routes 的路径匹配问题。新增子面板仅需在 ANALYSIS_ROUTES 中追加条目。
 */
export default function AnalysisApp(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const path = location.pathname
  const prevPathRef = useRef<string | null>(null)

  // ── 输入舱 → 分析舱交接：携带 scope=intention 进入时自动加载意向候选池 ────────
  const loadStocksAction = useAnalysisStore((s) => s.loadStocks)
  const handoffScope: AnalysisScope = searchParams.get('scope') === 'intention' ? 'intention' : 'all'
  useEffect(() => {
    if (handoffScope === 'intention') {
      logger.info('[AnalysisApp] 交接：加载输入舱意向候选池', {
        source: searchParams.get('source') ?? 'all',
      })
      void loadStocksAction('intention')
    }
  }, [handoffScope, loadStocksAction, searchParams])

  // ── 废弃路由重定向：/analysis/sector → /analysis/industry-dashboard ──────────
  // SectorAnalysisPage 已合并到 IndustryDashboardPage，旧链接自动跳转
  useEffect(() => {
    if (path === '/analysis/sector' || path.startsWith('/analysis/sector/')) {
      logger.info('[AnalysisApp] 废弃路由重定向', { from: path, to: '/analysis/industry-dashboard' })
      void navigate('/analysis/industry-dashboard', { replace: true })
    }
  }, [path, navigate])

  // ── 路由切换检测日志 ────────────────────────────────────────────────────────
  useEffect(() => {
    const prevPath = prevPathRef.current
    const isRouteChange = prevPath !== null && prevPath !== path

    if (isRouteChange) {
      logger.info('[AnalysisApp] 路由切换', { from: prevPath, to: path })
    }

    const { branch, componentName } = matchAnalysisRoute(path)

    logger.info('[AnalysisApp] 渲染分析舱', {
      path,
      branch,
      component: componentName,
      isRouteChange,
    })

    prevPathRef.current = path
  }, [path])

  // ── 子路由页面渲染 ──────────────────────────────────────────────────────────
  const matched = matchAnalysisRoute(path)

  const content =
    matched.component != null ? (
      <Suspense fallback={<PageSkeleton />}>
        {matched.component}
      </Suspense>
    ) : (
      // ── 默认视图：分析模板卡片 + V6 九维评分卡片 ────────────────────────────────
      <>
        <PageHeader
          title="分析舱"
          description="多因子深度研究工作台"
          actions={
            <Button size="sm" variant="secondary" asChild className="shadow-sm">
              <Link to="/analysis/intelligent-score">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                快速评分
              </Link>
            </Button>
          }
        />
        <AnalysisTemplateCards />
        {/* Phase 1: 相似股票语义召回 — 零侵入辅助入口，不修改原有评分流程 */}
        <SimilarStockRecallCard />
        {/* Phase 2: 向量一致性融合排名 — 基于 V6 评分 + 语义相似度的双轨排序 */}
        <VectorConsistencyRankingCard />
        <V6ScoreCard />
      </>
    )

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <Breadcrumb aria-label="breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>分析舱</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {content}
      </PageContainer>
    </ErrorBoundary>
  )
}

// ── V6 评分卡片（接入 analysisStore + 派生查询 Hook）─────────────────────────
// 业务行为完全保留：原 useState 替换为 Store 订阅；原 try/catch toast 替换为 useEffect 订阅 error
// 派生查询接入：useIsLoadingAny (合并 loading || trendLoading)、useErrorUnion (合并 error ?? trendError)

function V6ScoreCard(): React.JSX.Element {
  const { spacing, padding } = useDensityConfig()
  // ── 接入 analysisStore，替代本地 useState ────────────────────────────────────
  const stocks = useAnalysisStore((s) => s.stocks)
  const candidates = useAnalysisStore((s) => s.candidates)
  const scope = useAnalysisStore((s) => s.scope)
  const scores = useAnalysisStore((s) => s.scores)
  const loadStocks = useAnalysisStore((s) => s.loadStocks)
  const runBatchScoreAction = useAnalysisStore((s) => s.runBatchScore)
  const handleScoreAction = useAnalysisStore((s) => s.handleScore)
  const clearError = useAnalysisStore((s) => s.clearError)

  // ── 派生查询 Hook（来自 .derived.ts，含 memoizeByRef 缓存优化）─────────────────
  const loading = useIsLoadingAny()
  const error = useErrorUnion()

  const { toast } = useToast()

  // ── 错误变化时触发 toast（替代原 try/catch 中的 toast 调用）────────────────────
  // 注意：Store 内部已通过 logger.error 记录错误，此处仅负责用户感知
  useEffect(() => {
    if (error !== null && error.length > 0) {
      toast({
        variant: 'error',
        title: '操作失败',
        description: error,
      })
      clearError()
    }
  }, [error, clearError, toast])

  // ── 评分索引（在循环外构建一次，O(n) 构建 + O(1) 查找）────────────────────────
  // 注意：派生查询 scoreBySymbol(symbol) 是单次 find，循环中使用会产生 O(n²) 复杂度
  // 因此保留 useMemo + Map 构建一次索引
  const scoreMap = useMemo(
    () => new Map(scores.map((s) => [s.symbol, s] as const)),
    [scores],
  )

  // 意向候选池中尚未评分的标的（已有 V6 评分则跳过批量）
  const unscoredCandidates = useMemo(
    () => candidates.filter((c) => !scoreMap.has(c.symbol)),
    [candidates, scoreMap],
  )

  // 双源输入来源标签（与输入舱 InputDashboardPoolTable 语义一致）
  const sourceMeta = (source?: ScreenSource): { label: string; className: string } => {
    if (source === 'hot-sector') {
      return { label: '热门板块', className: 'text-info' }
    }
    if (source === 'manual') {
      return { label: '自定义检索', className: 'text-muted-foreground' }
    }
    // 历史数据无来源标记
    return { label: '—', className: 'text-muted-foreground' }
  }

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">分析舱 · V6 九维评分</CardTitle>
          <Badge variant="outline" className="border-border/50">
            {scope === 'intention' ? '意向候选池' : '全量标的'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-3">
        {/* 作用域切换 + 批量评分工具条 */}
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-3.5 py-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadStocks('all')}
            disabled={loading}
            className="shadow-sm"
          >
            加载全部标的
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadStocks('intention')}
            disabled={loading}
            className="shadow-sm"
          >
            加载意向候选池
          </Button>
          {scope === 'intention' && unscoredCandidates.length > 0 && (
            <Button
              size="sm"
              onClick={() =>
                void runBatchScoreAction(unscoredCandidates.map((c) => c.symbol))
              }
              disabled={loading}
              className="ml-auto shadow-sm"
            >
              {loading ? '评分中...' : `批量评分（${unscoredCandidates.length}）`}
            </Button>
          )}
        </div>

        <div className={`grid ${spacing} sm:grid-cols-2 lg:grid-cols-3`}>
          {/* 意向候选池作用域：展示输入舱候选（含来源溯源与已有评分） */}
          {scope === 'intention' && candidates.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/10 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                <Sparkles className="h-6 w-6 opacity-50 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                暂无意向候选
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                请先在输入舱录入股票或纳入热门板块核心标的
              </p>
              <Button variant="secondary" size="sm" asChild className="mt-4 shadow-sm">
                <Link to="/input">去输入舱录入 →</Link>
              </Button>
            </div>
          )}
          {scope === 'intention' &&
            candidates.map((candidate) => {
              const score = scoreMap.get(candidate.symbol)
              const source = sourceMeta(candidate.screenSource)
              return (
                <div
                  key={candidate.symbol}
                  className={`rounded-lg border border-border/40 ${padding} transition-colors hover:bg-muted/30`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{candidate.symbol}</span>
                        <span className={`truncate text-[11px] font-medium ${source.className}`}>
                          {source.label}
                        </span>
                        {candidate.group != null && (
                          <Badge variant="outline" className="border-border/40 text-[10px] h-4.5 px-1.5">
                            {candidate.group}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{candidate.name}</p>
                    </div>
                    <Badge
                      variant={score ? 'default' : 'outline'}
                      className={cn(
                        'shrink-0 text-[11px] font-semibold',
                        score && !getScoreColorClass(score.score).includes('stock-up') && getScoreColorClass(score.score).includes('primary') ? 'bg-primary/10 text-primary border-primary/20' : '',
                        score ? getScoreColorClass(score.score) : 'border-border/50',
                      )}
                    >
                      {score ? `V6: ${score.score.toFixed(2)}` : '未评分'}
                    </Badge>
                  </div>
                  <Button
                    className="mt-3 w-full shadow-sm"
                    size="sm"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => void handleScoreAction(candidate.symbol)}
                  >
                    {loading ? '评分中...' : '运行评分'}
                  </Button>
                </div>
              )
            })}

          {/* 全量作用域：展示全部标的（向后兼容） */}
          {scope !== 'intention' && stocks.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/10 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                <Sparkles className="h-6 w-6 opacity-50 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">暂无标的</p>
              <p className="mt-1 text-xs text-muted-foreground/70">请先在输入舱录入股票</p>
              <Button variant="secondary" size="sm" asChild className="mt-4 shadow-sm">
                <Link to="/input">去输入舱录入 →</Link>
              </Button>
            </div>
          )}
          {scope !== 'intention' &&
            stocks.map((stock) => {
              const score = scoreMap.get(stock.symbol)
              return (
                <div
                  key={stock.symbol}
                  className={`rounded-lg border border-border/40 ${padding} transition-colors hover:bg-muted/30`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-mono text-sm font-semibold">{stock.symbol}</span>
                      <p className="mt-1 text-sm text-muted-foreground">{stock.name}</p>
                    </div>
                    <Badge
                      variant={score ? 'default' : 'outline'}
                      className={cn(
                        'shrink-0 text-[11px] font-semibold',
                        score && !getScoreColorClass(score.score).includes('stock-up') && getScoreColorClass(score.score).includes('primary') ? 'bg-primary/10 text-primary border-primary/20' : '',
                        score ? getScoreColorClass(score.score) : 'border-border/50',
                      )}
                    >
                      {score ? `V6: ${score.score.toFixed(2)}` : '未评分'}
                    </Badge>
                  </div>
                  <Button
                    className="mt-3 w-full shadow-sm"
                    size="sm"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => void handleScoreAction(stock.symbol)}
                  >
                    {loading ? '评分中...' : '运行评分'}
                  </Button>
                </div>
              )
            })}
        </div>
      </CardContent>
    </Card>
  )
}
