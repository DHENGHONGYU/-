import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { TrendingUp, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { analyze, type HotSectorAnalyzerInput, type HotSectorScore } from '@/services/scoring/hotSectorAnalyzer'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 预设板块样本数据
// ============================================================

const SECTOR_SAMPLES: HotSectorAnalyzerInput[] = [
  {
    symbol: 'AI_算力',
    sectorName: 'AI 算力',
    momentum: { sectorStrengthScore: 4.5, priceChangeRank: 1, volumeExpansion: 2.5, consecutiveInflow: 8, relativeStrength: 85 },
    sentiment: { sentimentRank: 1, retailSentiment: 0.85, institutionBuyCount: 12, limitUpCount: 5 },
    breakout: { hasBreakoutPattern: true, macdSignal: 'bullish', rsi: 65, priceAboveMA20: true, priceAboveMA60: true },
    valuationRisk: { pe: 65, pbPercentile: 80, marketCap: 8000, dividendYield: 0.5 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '半导体',
    sectorName: '半导体',
    momentum: { sectorStrengthScore: 4.0, priceChangeRank: 3, volumeExpansion: 1.8, consecutiveInflow: 5, relativeStrength: 72 },
    sentiment: { sentimentRank: 4, retailSentiment: 0.7, institutionBuyCount: 8, limitUpCount: 3 },
    breakout: { hasBreakoutPattern: true, macdSignal: 'bullish', rsi: 58, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 55, pbPercentile: 65, marketCap: 5000, dividendYield: 0.8 },
    marketEnv: { marketTrend: 'bull', systemicRisk: 'low' },
  },
  {
    symbol: '新能源',
    sectorName: '新能源',
    momentum: { sectorStrengthScore: 2.5, priceChangeRank: 8, volumeExpansion: 0.8, consecutiveInflow: 1, relativeStrength: 45 },
    sentiment: { sentimentRank: 10, retailSentiment: 0.4, institutionBuyCount: 2, limitUpCount: 0 },
    breakout: { hasBreakoutPattern: false, macdSignal: 'bearish', rsi: 35, priceAboveMA20: false, priceAboveMA60: false },
    valuationRisk: { pe: 18, pbPercentile: 20, marketCap: 2000, dividendYield: 2.0 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
  {
    symbol: '白酒',
    sectorName: '白酒',
    momentum: { sectorStrengthScore: 3.2, priceChangeRank: 5, volumeExpansion: 1.2, consecutiveInflow: 3, relativeStrength: 58 },
    sentiment: { sentimentRank: 6, retailSentiment: 0.55, institutionBuyCount: 5, limitUpCount: 1 },
    breakout: { hasBreakoutPattern: false, macdSignal: 'neutral', rsi: 48, priceAboveMA20: true, priceAboveMA60: false },
    valuationRisk: { pe: 32, pbPercentile: 50, marketCap: 3000, dividendYield: 1.5 },
    marketEnv: { marketTrend: 'sideways', systemicRisk: 'medium' },
  },
]

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

const DIMENSION_WEIGHTS: Record<string, string> = {
  momentum: '35%',
  sentiment: '25%',
  technical: '20%',
  valuation: '15%',
  composite: '5%',
}

const ACTION_CONFIG: Record<HotSectorScore['action'], { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  immediate: { label: '立即跟进', variant: 'default' },
  probe: { label: '试探', variant: 'secondary' },
  ignore: { label: '回避', variant: 'destructive' },
}

// ============================================================
// 页面组件
// ============================================================

export default function HotSectorPage(): React.JSX.Element {
  const [scores, setScores] = useState<HotSectorScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)

  const runAnalysis = useCallback(() => {
    setLoading(true)
    setError(null)
    logger.info('[HotSectorPage] 开始运行热门板块分析')

    try {
      const results = SECTOR_SAMPLES.map((input) => {
        const score = analyze(input)
        logger.info(
          `[HotSectorPage] ${input.symbol} 评分完成: score=${score.score.toFixed(2)} action=${score.action}`,
        )
        return score
      })

      results.sort((a, b) => b.score - a.score)
      setScores(results)
      logger.info(`[HotSectorPage] 分析完成: ${results.length} 个板块`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[HotSectorPage] 分析失败: ${message}`)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    runAnalysis()
  }, [runAnalysis])

  const toggleExpand = (symbol: string) => {
    setExpandedSymbol((prev) => (prev === symbol ? null : symbol))
    logger.info(`[HotSectorPage] 切换展开: ${symbol} → ${expandedSymbol === symbol ? '收起' : '展开'}`)
  }

  // ============================================================
  // Loading 状态
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在计算热门板块评分...</p>
      </div>
    )
  }

  // ============================================================
  // Error 状态
  // ============================================================

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={runAnalysis}>
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      </div>
    )
  }

  // ============================================================
  // Empty 状态
  // ============================================================

  if (scores.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <TrendingUp className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">暂无评分数据</p>
        <Button variant="outline" onClick={runAnalysis}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>
    )
  }

  // ============================================================
  // 正常渲染
  // ============================================================

  return (
    <div className="space-y-6 p-4">
      <Breadcrumb>
        <BreadcrumbList>
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
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">热门板块策略</h1>
          <p className="text-muted-foreground">
            五维评分引擎 · 动量强度 · 情绪热度 · 技术突破 · 估值风险 · 综合评分
          </p>
        </div>
        <Button variant="outline" onClick={runAnalysis} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 板块列表 */}
      <div className="grid gap-4">
        {scores.map((score) => {
          const isExpanded = expandedSymbol === score.symbol
          const actionCfg = ACTION_CONFIG[score.action]
          const scoreColor =
            score.score >= 4 ? 'text-green-600' :
            score.score >= 3 ? 'text-yellow-600' :
            'text-red-600'

          return (
            <Card key={score.symbol} className="transition-shadow hover:shadow-md">
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
                  {/* 五维评分条形图 */}
                  <div className="space-y-3">
                    {(Object.keys(score.dimensions) as Array<keyof typeof score.dimensions>).map((key) => (
                      <Progress
                        key={key}
                        value={score.dimensions[key] * 20}
                        label={`${DIMENSION_LABELS[key]} (${DIMENSION_WEIGHTS[key]})`}
                      />
                    ))}
                  </div>

                  {/* 交易建议卡片 */}
                  <div
                    className={`rounded-md border p-4 ${
                      score.action === 'immediate' ? 'border-green-200 bg-green-50' :
                      score.action === 'ignore' ? 'border-red-200 bg-red-50' :
                      'border-yellow-200 bg-yellow-50'
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
          )
        })}
      </div>
    </div>
  )
}