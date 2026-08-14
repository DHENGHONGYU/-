import { getSafeString, getSafeNumber } from '@/lib/safeCoerce'
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { TrendingUp, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { PageContainer, PageHeader } from '@/components/templates'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import type { HotSectorScore } from '@/data/types'
import { useHotSectorStore } from '@/store/hotSectorStore'
import { getLogger } from '@/lib/logger'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { usePageGuard } from '@/hooks/usePageGuard'
import { WidgetShell } from '@/components/widgets/WidgetShell'
import ScoreRadar from '@/components/chart/ScoreRadar'
import type { WidgetConfig } from '@/types/widget'
import type { ScoreRadarData } from '@/components/chart/ScoreRadar'

const logger = getLogger()

// ============================================================
// 常量
// ============================================================

const DIMENSION_LABELS: Record<string, string> = {
  momentum: '动量强度',
  sentiment: '情绪热度',
  technical: '技术突破',
  valuation: '估值风险',
  composite: '综合评分',
}

const ACTION_CONFIG: Record<HotSectorScore['action'], { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  immediate: { label: '立即跟进', variant: 'default' },
  probe: { label: '试探', variant: 'secondary' },
  ignore: { label: '回避', variant: 'destructive' },
}

// ============================================================
// 页面组件
// ============================================================

/**
 * HotSectorPage
 */
export default function HotSectorPage(): React.JSX.Element {
  const scores = useHotSectorStore((s) => s.scores)
  const loading = useHotSectorStore((s) => s.loading)
  const error = useHotSectorStore((s) => s.error)
  const fetchScores = useHotSectorStore((s) => s.fetchScores)

  // UI 状态保留本地
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)

  const runAnalysis = useCallback(() => {
    logger.info('[HotSectorPage] 触发热门板块分析，通过 Store action 分发')
    void fetchScores()
  }, [fetchScores])

  useEffect(() => {
    runAnalysis()
  }, [runAnalysis])

  const toggleExpand = useCallback((symbol: string) => {
    setExpandedSymbol((prev) => {
      const next = prev === symbol ? null : symbol
      logger.info(`[HotSectorPage] 切换展开: ${symbol} → ${getSafeString(next) || '收起'}`)
      return next
    })
  }, [])

  const { guardProps } = usePageGuard('hot-sector')

  // ============================================================
  // Loading 状态
  // ============================================================

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">正在计算热门板块评分...</p>
        </div>
      </PageContainer>
    )
  }

  // ============================================================
  // Error 状态
  // ============================================================

  // 静默回退(空字符串兜底)：确认数据源可能为 undefined/null
  if ((error ?? '') !== '') {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={runAnalysis}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </PageContainer>
    )
  }

  // ============================================================
  // Empty 状态
  // ============================================================

  if (scores.length === 0) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无评分数据</p>
          <Button variant="outline" onClick={runAnalysis}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </PageContainer>
    )
  }

  // ============================================================
  // 正常渲染
  // ============================================================

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/analysis">分析舱</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>热门板块策略</BreadcrumbPage>
          </BreadcrumbItem>
        </Breadcrumb>

        <PageHeader
          title="热门板块策略"
          description="五维评分引擎 · 动量强度 · 情绪热度 · 技术突破 · 估值风险 · 综合评分"
          actions={
            <Button variant="outline" {...guardProps} onClick={runAnalysis}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
          }
        />

        {/* 板块列表 */}
        <div className="grid gap-4">
          {scores.map((score) => {
            const isExpanded = expandedSymbol === score.symbol
            const actionCfg = ACTION_CONFIG[score.action]
            const scoreNum = score.score || 0
              const scoreColor =
                scoreNum >= 4 ? 'text-success' :
                scoreNum >= 3 ? 'text-warning' :
                'text-destructive'

            // 构造雷达图数据
            const radarData: ScoreRadarData[] = Object.entries(score.dimensions).map(([key, value]) => ({
              dimension: DIMENSION_LABELS[key] ?? key,
              score: (getSafeNumber(value) * 100),
              fullMark: 100,
            }))

            // WidgetShell 配置
            const widgetConfig: WidgetConfig = {
              id: `hot-sector-${score.symbol}`,
              widgetId: `hot-sector-${score.symbol}`,
              position: { x: 0, y: 0 },
              size: { cols: 12, rows: 3 },
              settings: { title: `${score.name} (${score.symbol})` },
            }

            return (
              <WidgetShell key={score.symbol} widgetId={`hot-sector-${score.symbol}`} config={widgetConfig}>
                <Card className="transition-shadow hover:shadow-elevation-2" style={{ marginBottom: 0 }}>
                  <CardHeader
                    className="cursor-pointer pb-2"
                    onClick={() => toggleExpand(score.symbol)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{score.name}</CardTitle>
                          <CardDescription>{score.symbol}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
                        <span className={`text-xl font-bold ${scoreColor}`}>
                          {score.score.toFixed(2)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="space-y-4 pt-0">
                      {/* 五维评分雷达图 */}
                      <ScoreRadar data={radarData} height={280} className="w-full" />

                      {/* 交易建议卡片 */}
                      <div
                        className={`rounded-md border p-4 ${
                          score.action === 'immediate' ? 'border-success/30 bg-success/10' :
                          score.action === 'ignore' ? 'border-destructive/30 bg-destructive/10' :
                          'border-warning/30 bg-warning/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
                          <span className="text-sm font-medium">
                            {score.action === 'immediate'
                              ? '建议关注，可择机入场'
                              : score.action === 'probe'
                                ? '建议观望，等待更好的入场时机'
                                : '建议回避，当前风险过高'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          综合评分 {score.score.toFixed(2)} / 5.0
                          · 生成时间 {new Date(score.calculatedAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </WidgetShell>
            )
          })}
        </div>
      </PageContainer>
    </ErrorBoundary>
  )
}
