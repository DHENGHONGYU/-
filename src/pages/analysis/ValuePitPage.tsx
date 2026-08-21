import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Target, RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { LoadingState, ErrorState, EmptyState } from '@/components/molecules'
import { PageContainer, PageHeader } from '@/components/templates'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import type { ValuePitScore } from '@/types'
import type { RotationSignal } from '@/types/modules/strategy.types'
import { useValuePitStore, type ValuePitSectorResult } from '@/store/valuePitStore'
import { getLogger } from '@/lib/logger'


const logger = getLogger()

// ============================================================
// 常量
// ============================================================

const DIMENSION_LABELS: Record<string, string> = {
  catalyst: '催化确定性',
  valuation: '估值安全垫',
  chip: '筹码结构',
  rotation: '轮动位置',
  liquidity: '流动性',
  composite: '综合评分',
}

const DIMENSION_WEIGHTS: Record<string, string> = {
  catalyst: '30%',
  valuation: '25%',
  chip: '20%',
  rotation: '15%',
  liquidity: '10%',
  composite: '—',
}

const ACTION_CONFIG: Record<ValuePitScore['action'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; description: string }> = {
  immediate: { label: '建仓', variant: 'default', description: '评分达标，建议建仓' },
  probe: { label: '试探', variant: 'secondary', description: '接近达标，可小仓位试探' },
  wait: { label: '等待信号', variant: 'destructive', description: '等待轮动信号触发后再评估' },
  ignore: { label: '不建', variant: 'outline', description: '评分不足，暂不建仓' },
}

const STRENGTH_CONFIG: Record<RotationSignal['strength'], { label: string; color: string }> = {
  strong: { label: '强信号', color: 'text-success' },
  medium: { label: '中等信号', color: 'text-warning' },
  weak: { label: '弱信号', color: 'text-destructive' },
}

// ============================================================
// 页面组件
// ============================================================

/**
 * ValuePitPage
 */
export default function ValuePitPage(): React.JSX.Element {
  // 从 Store 获取状态
  const combinedResults = useValuePitStore((s) => s.combinedResults)
  const loading = useValuePitStore((s) => s.loading)
  const error = useValuePitStore((s) => s.error)
  const runAnalysis = useValuePitStore((s) => s.runAnalysis)

  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)

  useEffect(() => {
    logger.info('[ValuePitPage] 初始化，运行价值洼地分析')
    runAnalysis()
  }, [runAnalysis])

  const toggleExpand = (symbol: string) => {
    setExpandedSymbol((prev) => (prev === symbol ? null : symbol))
    logger.info(`[ValuePitPage] 切换展开: ${symbol} → ${expandedSymbol === symbol ? '收起' : '展开'}`)
  }

  // ============================================================
  // Loading 状态
  // ============================================================

  if (loading) {
    return (
      <PageContainer>
        <LoadingState variant="spinner" message="正在计算价值洼地评分..." />
      </PageContainer>
    )
  }

  // ============================================================
  // Error 状态
  // ============================================================

  if (error) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={runAnalysis} variant="card" />
      </PageContainer>
    )
  }

  // ============================================================
  // Empty 状态
  // ============================================================

  if (combinedResults.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          title="暂无评分数据"
          action={{ label: '刷新', onClick: runAnalysis }}
        />
      </PageContainer>
    )
  }

  // ============================================================
  // 正常渲染
  // ============================================================

  return (
    <PageContainer className="space-y-6">
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
            <BreadcrumbPage>价值洼地策略</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="价值洼地策略"
        description="五维评分引擎 · 催化确定性 · 估值安全垫 · 筹码结构 · 轮动位置 · 流动性"
        actions={
          <Button variant="outline" onClick={runAnalysis} disabled={loading}>
            { }
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        }
      />

      {/* 板块列表 */}
      <div className="grid gap-4">
        {combinedResults.map(({ score, rotation }: ValuePitSectorResult) => {
          const isExpanded = expandedSymbol === score.symbol
          const actionCfg = ACTION_CONFIG[score.action]
          const strengthCfg = rotation.triggered ? STRENGTH_CONFIG[rotation.strength] : null
          const scoreColor =
            score.score >= 4 ? 'text-success' :
            score.score >= 3 ? 'text-warning' :
            'text-destructive'

          return (
            <Card key={score.symbol} className="transition-shadow hover:shadow-elevation-2">
              <CardHeader
                className="cursor-pointer pb-2"
                onClick={() => toggleExpand(score.symbol)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{score.name}</CardTitle>
                      <CardDescription>{score.symbol}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
                    <span className={`text-h2 font-bold ${scoreColor}`}>
                      {score.score.toFixed(2)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* 轮动信号徽章（列表行内） */}
                <div className="mt-2 flex items-center gap-2">
                  {rotation.triggered ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      轮动已触发
                      {strengthCfg && <span className={`ml-1 ${strengthCfg.color}`}>{strengthCfg.label}</span>}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="mr-1 h-3 w-3" />
                      轮动未触发
                    </Badge>
                  )}
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

                  {/* 轮动信号详情 */}
                  <div className="rounded-md border p-4">
                    <h4 className="mb-3 text-sm font-medium">轮动信号检测</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex items-center gap-2">
                        {rotation.conditions.volumeBreakthrough ? (
                          <CheckCircle className={`h-4 w-4 text-success`} />
                        ) : (
                          <XCircle className={`h-4 w-4 text-destructive`} />
                        )}
                        <span className="text-xs">成交量突破</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rotation.conditions.capitalInflow ? (
                          <CheckCircle className={`h-4 w-4 text-success`} />
                        ) : (
                          <XCircle className={`h-4 w-4 text-destructive`} />
                        )}
                        <span className="text-xs">资金净流入</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rotation.conditions.goldenCross ? (
                          <CheckCircle className={`h-4 w-4 text-success`} />
                        ) : (
                          <XCircle className={`h-4 w-4 text-destructive`} />
                        )}
                        <span className="text-xs">技术金叉</span>
                      </div>
                    </div>
                    {rotation.triggered && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        检测时间: {new Date(rotation.detectedAt).toLocaleString('zh-CN')}
                      </p>
                    )}
                  </div>

                  {/* 建仓建议卡片 */}
                  <div
                    className={`rounded-md border p-4 ${
                      score.action === 'immediate' ? `border-success/30 bg-success/10` :
                      score.action === 'wait' ? `border-destructive/30 bg-destructive/10` :
                      `border-warning/30 bg-warning/10`
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={actionCfg.variant}>{actionCfg.label}</Badge>
                      <span className="text-sm font-medium">{actionCfg.description}</span>
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
    </PageContainer>
  )
}
