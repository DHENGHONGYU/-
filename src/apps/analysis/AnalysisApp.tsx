import React, { Suspense, useEffect, useRef } from 'react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { listStocks, listV6Scores } from '@/services/analysis/analysisService'
import { useToast } from '@/hooks/useToast'
import { AnalysisTemplateCards } from '@/components/analysis/hub/AnalysisTemplateCards'
import { getLogger } from '@/lib/logger'
import type { Stock, V6Score } from '@/data/types'

// ── Lazy 页面导入 ────────────────────────────────────────────────────────────
const StockAnalysisPage = React.lazy(() => import('@/pages/analysis/StockAnalysisPage'))
const SectorAnalysisPage = React.lazy(() => import('@/pages/analysis/SectorAnalysisPage'))
const BacktestPage = React.lazy(() => import('@/pages/analysis/BacktestPage'))
const IndustryScorePage = React.lazy(() => import('@/pages/analysis/IndustryScorePage'))
const IntelligentScorePage = React.lazy(() => import('@/pages/analysis/IntelligentScorePage'))
const ScoreDocPage = React.lazy(() => import('@/pages/analysis/ScoreDocPage'))
const NewsPage = React.lazy(() => import('@/pages/analysis/NewsPage'))
const HotSectorPage = React.lazy(() => import('@/pages/analysis/HotSectorPage'))
const ValuePitPage = React.lazy(() => import('@/pages/analysis/ValuePitPage'))

const logger = getLogger()

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
 * Routes 的路径匹配问题。新增子面板仅需在此处追加 else-if 分支。
 */
export default function AnalysisApp(): React.JSX.Element {
  const location = useLocation()
  const path = location.pathname
  const prevPathRef = useRef<string | null>(null)

  // ── 路由切换检测日志 ────────────────────────────────────────────────────────
  useEffect(() => {
    const prevPath = prevPathRef.current
    const isRouteChange = prevPath !== null && prevPath !== path

    if (isRouteChange) {
      logger.info('[AnalysisApp] 路由切换', { from: prevPath, to: path })
    }

    let branch: string
    let componentName: string
    if (path === '/analysis/stock-score' || path.startsWith('/analysis/stock-score/')) {
      branch = 'stock-score'
      componentName = 'StockAnalysisPage'
    } else if (path === '/analysis/sector') {
      branch = 'sector'
      componentName = 'SectorAnalysisPage'
    } else if (path === '/analysis/backtest') {
      branch = 'backtest'
      componentName = 'BacktestPage'
    } else if (path === '/analysis/industry-score') {
      branch = 'industry-score'
      componentName = 'IndustryScorePage'
    } else if (path === '/analysis/intelligent-score') {
      branch = 'intelligent-score'
      componentName = 'IntelligentScorePage'
    } else if (path === '/analysis/score-docs') {
      branch = 'score-docs'
      componentName = 'ScoreDocPage'
    } else if (path === '/analysis/news') {
      branch = 'news'
      componentName = 'NewsPage'
    } else if (path === '/analysis/hot-sector') {
      branch = 'hot-sector'
      componentName = 'HotSectorPage'
    } else if (path === '/analysis/value-pit') {
      branch = 'value-pit'
      componentName = 'ValuePitPage'
    } else {
      branch = 'default'
      componentName = 'V6ScoreCard'
    }

    logger.info('[AnalysisApp] 渲染分析舱', {
      path,
      branch,
      component: componentName,
      isRouteChange,
    })

    prevPathRef.current = path
  }, [path])

  // ── 子路由页面渲染 ──────────────────────────────────────────────────────────
  if (path === '/analysis/stock-score' || path.startsWith('/analysis/stock-score/')) {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载个股评分页...</div>}>
        <StockAnalysisPage />
      </Suspense>
    )
  }

  if (path === '/analysis/sector') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载板块分析页...</div>}>
        <SectorAnalysisPage />
      </Suspense>
    )
  }

  if (path === '/analysis/backtest') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载回测页...</div>}>
        <BacktestPage />
      </Suspense>
    )
  }

  if (path === '/analysis/industry-score') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载行业评分页...</div>}>
        <IndustryScorePage />
      </Suspense>
    )
  }

  if (path === '/analysis/intelligent-score') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载智能评分页...</div>}>
        <IntelligentScorePage />
      </Suspense>
    )
  }

  if (path === '/analysis/score-docs') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载评分文档页...</div>}>
        <ScoreDocPage />
      </Suspense>
    )
  }

  if (path === '/analysis/news') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载新闻页...</div>}>
        <NewsPage />
      </Suspense>
    )
  }

  if (path === '/analysis/hot-sector') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载热门板块页...</div>}>
        <HotSectorPage />
      </Suspense>
    )
  }

  if (path === '/analysis/value-pit') {
    return (
      <Suspense fallback={<div className="p-4 text-muted-foreground">加载价值洼地页...</div>}>
        <ValuePitPage />
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

// ── V6 评分卡片（原有组件逻辑提取为独立组件）─────────────────────────────────

function V6ScoreCard(): React.JSX.Element {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [scores, setScores] = useState<V6Score[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadStocks = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await listStocks()
      if (result.success && result.data) {
        setStocks(result.data)
      } else {
        toast({
          variant: 'error',
          title: '加载失败',
          description: result.error ?? '无法加载标的列表',
        })
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: '加载失败',
        description: err instanceof Error ? err.message : '无法加载标的列表',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleScore = async (symbol: string): Promise<void> => {
    setLoading(true)
    try {
      const result = await runV6Score(symbol)
      if (result.success) {
        await loadScores()
      } else {
        toast({
          variant: 'error',
          title: '评分失败',
          description: result.error ?? `无法对 ${symbol} 运行评分`,
        })
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: '评分失败',
        description: err instanceof Error ? err.message : `无法对 ${symbol} 运行评分`,
      })
    } finally {
      setLoading(false)
    }
  }

  const loadScores = async (): Promise<void> => {
    const result = await listV6Scores()
    if (result.success && result.data) {
      setScores(result.data)
    }
  }

  const scoreMap = new Map(scores.map((s) => [s.symbol, s]))

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>分析舱 · V6 九维评分</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" size="sm" onClick={loadStocks} disabled={loading}>
            加载标的
          </Button>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stocks.map((stock) => {
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
                    onClick={() => handleScore(stock.symbol)}
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
