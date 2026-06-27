import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { Target, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
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
import { analyze, type ValuePitAnalyzerInput, type ValuePitScore } from '@/services/scoring/valuePitAnalyzer'
import { detect, type RotationSignalInput, type RotationSignal } from '@/services/scoring/rotationSignalDetector'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 预设价值洼地板块样本数据
// ============================================================

interface SectorEntry {
  input: ValuePitAnalyzerInput
  rotationInput: RotationSignalInput
}

const SECTOR_SAMPLES: SectorEntry[] = [
  {
    input: {
      symbol: '银行',
      sectorName: '银行',
      catalyst: { policyCatalyst: 4.0, cycleTurningPoint: 3.5, techBreakthrough: 2.0, orderSurge: 2.5 },
      valuationMargin: { pePercentile: 5, pbPercentile: 8, dividendYield: 4.5, peg: 0.6 },
      chipStructure: { northBoundChange: 2.5, fundPositionChange: 3.0, shareholderChange: -1.5 },
      rotationPosition: { sectorVolumePercentile: 15, capitalInflowStrength: 4.0, hasGoldenCross: true },
      liquidity: { avgDailyAmount: 80000, turnoverRate: 1.5, marketCap: 1500 },
    },
    rotationInput: {
      sectorId: '银行',
      volume: { history: [...Array(50).fill(60000), 100000, 110000, 120000, 115000, 105000] },
      capitalFlow: { dailyNetFlow: [10, 20, 15, 30, 25] },
      goldenCross: { closes: [...Array(20).fill(105), 100, 100, 100, 100, 130] },
    },
  },
  {
    input: {
      symbol: '钢铁',
      sectorName: '钢铁',
      catalyst: { policyCatalyst: 3.0, cycleTurningPoint: 3.0, techBreakthrough: 2.0, orderSurge: 2.0 },
      valuationMargin: { pePercentile: 15, pbPercentile: 20, dividendYield: 3.0, peg: 0.8 },
      chipStructure: { northBoundChange: 1.0, fundPositionChange: 1.5, shareholderChange: -0.5 },
      rotationPosition: { sectorVolumePercentile: 40, capitalInflowStrength: 3.0, hasGoldenCross: false },
      liquidity: { avgDailyAmount: 30000, turnoverRate: 2.5, marketCap: 500 },
    },
    rotationInput: {
      sectorId: '钢铁',
      volume: { history: [...Array(50).fill(30000), 35000, 32000, 31000, 33000, 34000] },
      capitalFlow: { dailyNetFlow: [5, 3, -2, 8, 2] },
      goldenCross: { closes: [...Array(25).fill(100)] },
    },
  },
  {
    input: {
      symbol: '煤炭',
      sectorName: '煤炭',
      catalyst: { policyCatalyst: 2.5, cycleTurningPoint: 2.0, techBreakthrough: 1.5, orderSurge: 1.5 },
      valuationMargin: { pePercentile: 10, pbPercentile: 12, dividendYield: 5.0, peg: 0.5 },
      chipStructure: { northBoundChange: -0.5, fundPositionChange: 0.5, shareholderChange: 2.0 },
      rotationPosition: { sectorVolumePercentile: 55, capitalInflowStrength: 2.0, hasGoldenCross: false },
      liquidity: { avgDailyAmount: 15000, turnoverRate: 1.0, marketCap: 300 },
    },
    rotationInput: {
      sectorId: '煤炭',
      volume: { history: [...Array(40).fill(15000), ...Array(10).fill(20000), 16000, 16000, 16000, 16000, 16000] },
      capitalFlow: { dailyNetFlow: [-3, -5, -2, 1, -1] },
      goldenCross: { closes: Array(25).fill(100).map((v, i) => v - i * 0.5) },
    },
  },
]

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
  strong: { label: '强信号', color: 'text-green-600' },
  medium: { label: '中等信号', color: 'text-yellow-600' },
  weak: { label: '弱信号', color: 'text-red-600' },
}

// ============================================================
// 页面组件
// ============================================================

interface SectorResult {
  score: ValuePitScore
  rotation: RotationSignal
}

export default function ValuePitPage(): React.JSX.Element {
  const [results, setResults] = useState<SectorResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)

  const runAnalysis = useCallback(() => {
    setLoading(true)
    setError(null)
    logger.info('[ValuePitPage] 开始运行价值洼地分析')

    try {
      const sectorResults: SectorResult[] = SECTOR_SAMPLES.map((entry) => {
        const score = analyze(entry.input)
        const rotation = detect(entry.rotationInput)
        logger.info(
          `[ValuePitPage] ${entry.input.symbol} 评分完成: score=${score.score.toFixed(2)} ` +
          `action=${score.action} rotation=${rotation.triggered ? rotation.strength : '无'}`,
        )
        return { score, rotation }
      })

      sectorResults.sort((a, b) => b.score.score - a.score.score)
      setResults(sectorResults)
      logger.info(`[ValuePitPage] 分析完成: ${sectorResults.length} 个板块`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[ValuePitPage] 分析失败: ${message}`)
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
    logger.info(`[ValuePitPage] 切换展开: ${symbol} → ${expandedSymbol === symbol ? '收起' : '展开'}`)
  }

  // ============================================================
  // Loading 状态
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">正在计算价值洼地评分...</p>
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

  if (results.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <Target className="h-8 w-8 text-muted-foreground" />
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
            <BreadcrumbPage>价值洼地策略</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">价值洼地策略</h1>
          <p className="text-muted-foreground">
            五维评分引擎 · 催化确定性 · 估值安全垫 · 筹码结构 · 轮动位置 · 流动性
          </p>
        </div>
        <Button variant="outline" onClick={runAnalysis} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 板块列表 */}
      <div className="grid gap-4">
        {results.map(({ score, rotation }) => {
          const isExpanded = expandedSymbol === score.symbol
          const actionCfg = ACTION_CONFIG[score.action]
          const strengthCfg = rotation.triggered ? STRENGTH_CONFIG[rotation.strength] : null
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
                      <Target className="h-5 w-5 text-primary" />
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
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className="text-xs">成交量突破</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rotation.conditions.capitalInflow ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                        <span className="text-xs">资金净流入</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {rotation.conditions.goldenCross ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
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
                      score.action === 'immediate' ? 'border-green-200 bg-green-50' :
                      score.action === 'wait' ? 'border-red-200 bg-red-50' :
                      'border-yellow-200 bg-yellow-50'
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
    </div>
  )
}