import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { useToast } from '@/hooks/useToast'
import { AnalysisTemplateCards } from '@/components/organisms/analysis/hub/AnalysisTemplateCards'
import { getLogger } from '@/lib/logger'
import {
  useAnalysisStore,
  // 派生查询 Hook（通过 export * 从 .derived.ts 导入）
  useIsLoadingAny,
  useErrorUnion,
} from '@/store/analysisStore'
import type { AnalysisScope } from '@/types/modules/analysis.types'
import type { ScreenSource } from '@/data/types/types.stock'

// ── Lazy 页面导入 ────────────────────────────────────────────────────────────
// 注：SectorAnalysisPage 已废弃，功能合并到 IndustryDashboardPage（行业全景仪表盘）
const BacktestPage = React.lazy(() => import('@/pages/analysis/BacktestPage'))
const IndustryScorePage = React.lazy(() => import('@/pages/analysis/IndustryScorePage'))
const IndustryDashboardPage = React.lazy(() => import('@/pages/analysis/IndustryDashboardPage'))
const IntelligentScorePage = React.lazy(() => import('@/pages/analysis/IntelligentScorePage'))
const ScoreDocPage = React.lazy(() => import('@/pages/analysis/ScoreDocPage'))
const ScoreComparisonPage = React.lazy(() => import('@/pages/analysis/ScoreComparisonPage'))
const NewsPage = React.lazy(() => import('@/pages/analysis/NewsPage'))
const HotSectorPage = React.lazy(() => import('@/pages/analysis/HotSectorPage'))
const ValuePitPage = React.lazy(() => import('@/pages/analysis/ValuePitPage'))
const MultiFactorFilterPage = React.lazy(() => import('@/pages/analysis/MultiFactorFilterPage'))

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
  { path: '/analysis/hot-sector', branch: 'hot-sector', componentName: 'HotSectorPage', component: <HotSectorPage />, fallback: '加载热门板块页...' },
  { path: '/analysis/value-pit', branch: 'value-pit', componentName: 'ValuePitPage', component: <ValuePitPage />, fallback: '加载价值洼地页...' },
  { path: '/analysis/multi-factor', branch: 'multi-factor', componentName: 'MultiFactorFilterPage', component: <MultiFactorFilterPage />, fallback: '加载多因子筛选页...' },
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
  if (matched.component != null) {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">{matched.fallback}</div>}>
        {matched.component}
      </Suspense>
    )
  }

  // ── 默认视图：分析模板卡片 + V6 九维评分卡片 ────────────────────────────────
  return (
    <div className="space-y-4">
      <AnalysisTemplateCards />
      <V6ScoreCard />
    </div>
  )
}

// ── V6 评分卡片（接入 analysisStore + 派生查询 Hook）─────────────────────────
// 业务行为完全保留：原 useState 替换为 Store 订阅；原 try/catch toast 替换为 useEffect 订阅 error
// 派生查询接入：useIsLoadingAny (合并 loading || trendLoading)、useErrorUnion (合并 error ?? trendError)

function V6ScoreCard(): React.JSX.Element {
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
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>分析舱 · V6 九维评分</CardTitle>
            <Badge variant="outline">
              {scope === 'intention' ? '意向候选池' : '全量标的'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 作用域切换 + 批量评分工具条 */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadStocks('all')}
              disabled={loading}
            >
              加载全部标的
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void loadStocks('intention')}
              disabled={loading}
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
              >
                {loading ? '评分中...' : `批量评分（${unscoredCandidates.length}）`}
              </Button>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {/* 意向候选池作用域：展示输入舱候选（含来源溯源与已有评分） */}
            {scope === 'intention' && candidates.length === 0 && (
              <div className="col-span-full rounded-md border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  暂无意向候选，请先在输入舱录入股票或纳入热门板块核心标的
                </p>
                <Button variant="secondary" size="sm" asChild className="mt-2">
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
                    className="rounded-md border p-3 hover:bg-accent"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-medium">{candidate.symbol}</span>
                        <span className={`truncate text-xs ${source.className}`}>
                          {source.label}
                        </span>
                        {candidate.group != null && (
                          <span className="truncate text-xs text-muted-foreground">
                            {candidate.group}
                          </span>
                        )}
                      </div>
                      <Badge variant={score ? 'default' : 'outline'}>
                        {score ? `V6: ${score.score.toFixed(2)}` : '未评分'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{candidate.name}</p>
                    <Button
                      className="mt-2"
                      size="sm"
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
              <div className="col-span-full rounded-md border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">暂无标的，请先在输入舱录入股票</p>
                <Button variant="secondary" size="sm" asChild className="mt-2">
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
                    className="rounded-md border p-3 hover:bg-accent"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{stock.symbol}</span>
                      <Badge variant={score ? 'default' : 'outline'}>
                        {score ? `V6: ${score.score.toFixed(2)}` : '未评分'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{stock.name}</p>
                    <Button
                      className="mt-2"
                      size="sm"
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
    </div>
  )
}
