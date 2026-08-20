import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCw, ChevronUp, ChevronDown, BarChart3 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/atoms'
import { Button } from '@/components/atoms'
import { PageContainer, PageHeader } from '@/components/templates'
import { MetricCard } from '@/components/molecules'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/molecules/Tabs'
import { SignalBadge, ScoreGauge, TrendArrow, RankedCard, DataQualityIndicator } from '@/components/molecules'
import { IndustryHeatmap, IndustryV4Radar, SubIndicatorBar } from '@/components/chart/industry'
import type {
  IndustryV4RadarDataItem,
  IndustryV4RadarSeries,
} from '@/components/chart/industry/IndustryV4Radar'
import type { SubIndicatorBarDataItem } from '@/components/chart/industry/SubIndicatorBar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/atoms'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { dataBridge } from '@/core/databridge'
import { mcpBridge } from '@/mcp'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import type {
  IndustryV4AnalysisEnhanced,
  IndustryRotationSignal,
  RotationSignalType,
  TrendDirection,
} from '@/data/types/types.sector'
import { Loading, Empty } from '@/components/molecules/states'
import { ErrorState } from '@/components/molecules'
import { DensityToggle } from '@/components/cockpit/DensityToggle'
import { useDensityConfig } from '@/components/cockpit/DensityContext'

const logger = getLogger()

type SortKey = 'composite' | 'prosperity' | 'valuation' | 'trend'

interface KPIData {
  title: string
  value: number
  trend?: 'up' | 'down' | 'neutral'
}

/**
 * IndustryDashboardPage
 */
type SubDimensionTab = 'prosperity' | 'competition' | 'policy' | 'technology'

const SUB_DIMENSION_LABELS: Record<SubDimensionTab, { label: string; desc: string }> = {
  prosperity: { label: '景气度', desc: '营收/利润/毛利率/ROE/产能/库存/现金流' },
  competition: { label: '竞争格局', desc: 'CR5/CR10/分化度/壁垒/议价能力' },
  policy: { label: '政策环境', desc: '支持力度/监管风险/补贴/规划契合' },
  technology: { label: '技术成熟度', desc: '研发强度/人才/渗透/迭代/替代风险' },
}

/**
 * 将分析结果转为 radar 4维数据项（支持叠加均值基准线）
 */
function toRadarData(
  analysis: IndustryV4AnalysisEnhanced,
  _avgScores: Record<string, number>,
): IndustryV4RadarDataItem[] {
  type DimKey = 'prosperity' | 'competition' | 'policy' | 'technology'
  const dimMap: Array<{ key: DimKey; label: string }> = [
    { key: 'prosperity', label: '景气度' },
    { key: 'competition', label: '竞争格局' },
    { key: 'policy', label: '政策环境' },
    { key: 'technology', label: '技术成熟度' },
  ]
  const base: Array<IndustryV4RadarDataItem & { dimension: DimKey | 'composite' }> = dimMap.map((d) => ({
    dimension: d.key,
    label: d.label,
    score: analysis.dimensions[d.key].score ?? 0,
    fullMark: 5,
  }))
  base.push({
    dimension: 'composite',
    label: '综合评分',
    score: analysis.v4Composite ?? 0,
    fullMark: 5,
  })
  return base
}

function toRadarSeries(analysis: IndustryV4AnalysisEnhanced): IndustryV4RadarSeries[] {
  return [
    { name: analysis.industryName, dataKey: 'score', color: CHART_PALETTE.series1, fillOpacity: 0.3 },
    { name: '行业均值', dataKey: 'avg', color: CHART_PALETTE.series5, fillOpacity: 0.15 },
  ]
}

/**
 * 将某一维度子指标转为 SubIndicatorBar 数据
 */
function toSubIndicatorData(
  analysis: IndustryV4AnalysisEnhanced,
  dim: SubDimensionTab,
): SubIndicatorBarDataItem[] {
  const subMap: Record<SubDimensionTab, Array<{ key: string; label: string; unit?: string; higherBetter?: boolean }>> = {
    prosperity: [
      { key: 'revenueGrowth', label: '营收增速', unit: '%', higherBetter: true },
      { key: 'profitGrowth', label: '净利增速', unit: '%', higherBetter: true },
      { key: 'grossMargin', label: '毛利率', unit: '%', higherBetter: true },
      { key: 'roe', label: 'ROE', unit: '%', higherBetter: true },
      { key: 'capacityUtilization', label: '产能利用', unit: '%', higherBetter: true },
      { key: 'inventoryTurnoverDays', label: '库存周转', unit: '天', higherBetter: false },
      { key: 'inventoryCyclePosition', label: '库存周期', unit: '', higherBetter: true },
      { key: 'orderVisibility', label: '订单能见', unit: '', higherBetter: true },
      { key: 'cashFlowQuality', label: '现金流质', unit: '', higherBetter: true },
    ],
    competition: [
      { key: 'cr5', label: 'CR5 集中度', unit: '', higherBetter: true },
      { key: 'cr10', label: 'CR10 集中度', unit: '', higherBetter: true },
      { key: 'marginDispersion', label: '毛利分化', unit: '', higherBetter: false },
      { key: 'leaderMarginAdvantage', label: '龙头优势', unit: '%', higherBetter: true },
      { key: 'entryBarrier', label: '进入壁垒', unit: '', higherBetter: true },
      { key: 'pricingPower', label: '议价能力', unit: '', higherBetter: true },
    ],
    policy: [
      { key: 'policySupport', label: '政策支持', unit: '', higherBetter: true },
      { key: 'regulatoryRisk', label: '监管风险', unit: '', higherBetter: false },
      { key: 'subsidyIntensity', label: '补贴力度', unit: '', higherBetter: true },
      { key: 'planAlignment', label: '规划契合', unit: '', higherBetter: true },
    ],
    technology: [
      { key: 'rdRatio', label: '研发费用率', unit: '%', higherBetter: true },
      { key: 'techTalentRatio', label: '技术人才比', unit: '%', higherBetter: true },
      { key: 'maturityStage', label: '成熟阶段', unit: '', higherBetter: true },
      { key: 'penetrationRate', label: '市场渗透', unit: '', higherBetter: true },
      { key: 'iterationSpeed', label: '迭代速度', unit: '', higherBetter: true },
      { key: 'substitutionRisk', label: '替代风险', unit: '', higherBetter: false },
    ],
  }
  const subIndicators = analysis.subIndicators?.[dim]
  const subs: Record<string, number | null | undefined> = subIndicators
    ? { ...(subIndicators as unknown as Record<string, number | null | undefined>) }
    : {}
  return subMap[dim].map((item) => ({
    name: item.key,
    label: item.label,
    value: subs[item.key] ?? null,
    unit: item.unit,
    category: dim,
  }))
}

export default function IndustryDashboardPage(): React.JSX.Element {
  const { rowHeight, fontSize, padding } = useDensityConfig()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [v4Analyses, setV4Analyses] = useState<IndustryV4AnalysisEnhanced[]>([])
  const [rotationSignals, setRotationSignals] = useState<IndustryRotationSignal[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('composite')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedIndustryCode, setSelectedIndustryCode] = useState<string | null>(null)
  const [subDimTab, setSubDimTab] = useState<SubDimensionTab>('prosperity')

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      logger.info('[IndustryDashboardPage] 开始加载行业分析数据')

      const stocksResult = await dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.analyzer,
      })
      const stocks = (stocksResult.success ? (stocksResult.data ?? []) : []) as Array<Record<string, unknown>>

      const financialsResult = await dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.financialReports,
        source: MODULE_ID.analyzer,
      })
      const financials = (financialsResult.success ? (financialsResult.data ?? []) : []) as Array<Record<string, unknown>>

      const quotesResult = await dataBridge.query({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.dailyQuotes,
        source: MODULE_ID.analyzer,
      })
      const quotes = (quotesResult.success ? (quotesResult.data ?? []) : []) as Array<Record<string, unknown>>

      const financialMap = new Map(financials.map((f) => [String(f.symbol), f]))
      const quoteMap = new Map(quotes.map((q) => [String(q.symbol), q]))

      const stocksWithData = stocks.map((stock) => ({
        stock,
        financials: financialMap.get(stock.symbol as string) ?? ({
          revenueGrowth: null,
          profitGrowth: null,
          grossMargin: null,
          netMargin: null,
          roe: null,
          revenue: null,
          profit: null,
        }),
        quotes: quoteMap.get(stock.symbol as string) ?? ({
          close: null,
          open: null,
          high: null,
          low: null,
          volume: null,
          turnover: null,
          change: null,
          changePercent: null,
          periodReturn: null,
          periodReturn1w: null,
          periodReturn1m: null,
          periodReturn3m: null,
          periodReturn6m: null,
          periodReturn1y: null,
        }),
      }))

      const mcpResult = await mcpBridge.callTool('analysis', 'analyze_industry_v4', {
        data: JSON.stringify(stocksWithData),
      })

      if (mcpResult.isError) {
        const errMsg = mcpResult.content[0] && 'text' in mcpResult.content[0]
          ? (mcpResult.content[0] as { text: string }).text
          : 'MCP 调用失败'
        throw new Error(`analyze_industry_v4 失败: ${errMsg}`)
      }

      const resultText = mcpResult.content[0] && 'text' in mcpResult.content[0]
        ? (mcpResult.content[0] as { text: string }).text
        : '{}'

      let parsed: { v4Analyses: IndustryV4AnalysisEnhanced[]; rotationSignals: IndustryRotationSignal[] }
      try {
        parsed = JSON.parse(resultText)
      } catch {
        throw new Error(`MCP 返回非 JSON 数据: ${resultText.slice(0, 120)}`)
      }

      setV4Analyses(parsed.v4Analyses)
      setRotationSignals(parsed.rotationSignals)

      logger.info(`[IndustryDashboardPage] 加载完成：${parsed.v4Analyses.length} 个行业`)
    } catch (err) {
      logger.error('[IndustryDashboardPage] 加载失败', { error: err as Error })
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    void loadData()
  }

  const sortedAnalyses = [...v4Analyses].sort((a, b) => {
    let aValue: number | null = null
    let bValue: number | null = null

    switch (sortKey) {
      case 'composite':
        aValue = a.v4Composite
        bValue = b.v4Composite
        break
      case 'prosperity':
        aValue = a.dimensions.prosperity.score
        bValue = b.dimensions.prosperity.score
        break
      case 'valuation':
        aValue = a.valuation?.valuationScore ?? null
        bValue = b.valuation?.valuationScore ?? null
        break
      case 'trend':
        aValue = a.trend?.trendScore ?? null
        bValue = b.trend?.trendScore ?? null
        break
    }

    if (aValue === null || bValue === null) return 0
    return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
  })

  const top5ByComposite = [...v4Analyses]
    .filter((a) => a.v4Composite !== null)
    .sort((a, b) => (b.v4Composite ?? 0) - (a.v4Composite ?? 0))
    .slice(0, 5)

  // 数据加载完成后自动默认选中 TOP1 行业
  useEffect(() => {
    if (v4Analyses.length > 0 && !selectedIndustryCode) {
      const defaultCode = top5ByComposite[0]?.industryCode ?? v4Analyses[0]?.industryCode
      if (defaultCode) setSelectedIndustryCode(defaultCode)
    }
  }, [v4Analyses, selectedIndustryCode, top5ByComposite])

  const selectedAnalysis = useMemo(
    () => v4Analyses.find((a) => a.industryCode === selectedIndustryCode) ?? null,
    [v4Analyses, selectedIndustryCode],
  )

  // 全行业各维度均值（用于雷达图叠加基准线）
  const avgScores = useMemo<Record<string, number>>(() => {
    if (v4Analyses.length === 0) return {}
    const keys = ['prosperity', 'competition', 'policy', 'technology', 'composite'] as const
    const result: Record<string, number> = {}
    for (const k of keys) {
      let sum = 0
      let count = 0
      for (const a of v4Analyses) {
        const val = k === 'composite'
          ? a.v4Composite
          : a.dimensions[k as 'prosperity' | 'competition' | 'policy' | 'technology'].score
        if (typeof val === 'number') {
          sum += val
          count += 1
        }
      }
      result[k] = count > 0 ? sum / count : 0
    }
    return result
  }, [v4Analyses])

  const radarData = useMemo<IndustryV4RadarDataItem[] | null>(() => {
    if (!selectedAnalysis) return null
    const items = toRadarData(selectedAnalysis, avgScores)
    return items.map((it) => ({
      ...it,
      avg: avgScores[it.dimension] ?? 0,
    })) as IndustryV4RadarDataItem[] & Array<{ avg: number }>
  }, [selectedAnalysis, avgScores])

  const subIndicatorData = useMemo<SubIndicatorBarDataItem[] | null>(() => {
    if (!selectedAnalysis) return null
    return toSubIndicatorData(selectedAnalysis, subDimTab)
  }, [selectedAnalysis, subDimTab])

  const rotationSignalMap = new Map<string, IndustryRotationSignal>(
    rotationSignals.map((s) => [s.industryCode, s])
  )

  const kpiData: KPIData[] = [
    {
      title: '领涨行业',
      value: v4Analyses.filter((a) => a.v4Composite !== null && a.v4Composite >= 3.5).length,
      trend: 'up',
    },
    {
      title: '领跌行业',
      value: v4Analyses.filter((a) => a.v4Composite !== null && a.v4Composite < 2.0).length,
      trend: 'down',
    },
    {
      title: '估值洼地',
      value: v4Analyses.filter((a) => a.valuation?.pePercentileLevel === 'extremely_low').length,
      trend: 'up',
    },
    {
      title: '推荐关注',
      value: rotationSignals.filter((s) => s.signal === 'strong_buy' || s.signal === 'buy').length,
      trend: 'up',
    },
  ]

  const getTrendDirection = (analysis: IndustryV4AnalysisEnhanced): TrendDirection => {
    if (analysis.trend?.prosperityTrend.direction) {
      return analysis.trend.prosperityTrend.direction
    }
    return 'flat'
  }

  const getRotationSignal = (industryCode: string): RotationSignalType | undefined => {
    return rotationSignalMap.get(industryCode)?.signal
  }

  const getRotationSignalStrength = (industryCode: string): number | undefined => {
    return rotationSignalMap.get(industryCode)?.signalStrength
  }

  const qualitySummary = v4Analyses.length > 0
    ? {
        completeness:
          v4Analyses.reduce((sum, a) => sum + a.dataCompleteness, 0) /
          v4Analyses.length,
        sampleCount: v4Analyses.reduce((sum, a) => sum + a.constituentCount, 0),
      }
    : null

  if (loading) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-8">
            <Loading label="正在分析全行业数据..." />
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={handleRefresh} variant="card" />
      </PageContainer>
    )
  }

  const renderSortArrow = (columnKey: SortKey) => {
    if (sortKey === columnKey) {
      return sortOrder === 'asc'
        ? <ChevronUp className="inline h-3.5 w-3.5 ml-1 transition-transform duration-200" />
        : <ChevronDown className="inline h-3.5 w-3.5 ml-1 transition-transform duration-200" />
    }
    return <span className="inline ml-1 text-muted">↕</span>
  }

  if (v4Analyses.length === 0) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="p-8">
            <Empty title="暂无行业数据" />
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="行业全景仪表盘"
        description="全行业V4评分、轮动信号、估值分析一站式视图"
        actions={
          <div className="flex items-center gap-2">
            <DensityToggle />
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
          </div>
        }
      />

      {qualitySummary && (
        <Card>
          <CardContent className="p-3">
            <DataQualityIndicator
              completeness={qualitySummary.completeness}
              sampleCount={qualitySummary.sampleCount}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
          <MetricCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            trend={kpi.trend}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>行业V4评分热力图</CardTitle>
          <CardDescription>按综合评分着色，点击单元格可查看行业详情（雷达图+子指标）</CardDescription>
        </CardHeader>
        <CardContent>
          <IndustryHeatmap
            data={v4Analyses.map((a) => ({
              code: a.industryCode,
              name: a.industryName,
              value: a.v4Composite ?? 0,
              category: a.industryCode.split('.')[0],
            }))}
            colorScheme="blueYellow"
            showValue
            highlightCode={selectedIndustryCode ?? undefined}
            onCellClick={(item) => {
              setSelectedIndustryCode(item.code)
            }}
          />
        </CardContent>
      </Card>

      {/* 行业详情面板：雷达图 + 子指标柱状图 */}
      {selectedAnalysis && radarData && subIndicatorData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              行业分析详情
              <span className="text-base font-normal text-muted ml-2">
                {selectedAnalysis.industryName}（{selectedAnalysis.industryCode}）
              </span>
            </CardTitle>
            <CardDescription>
              四维度雷达图叠加行业均值，下方 Tab 切换各维度子指标
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-muted mb-2">V4 四维度雷达（对比行业均值）</h4>
                <IndustryV4Radar
                  data={radarData}
                  series={toRadarSeries(selectedAnalysis)}
                  height={340}
                  showLegend
                  maxValue={5}
                  radarConfig={{ strokeWidth: 2, dot: true, fillOpacity: 0.3 }}
                />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    title="综合评分"
                    value={selectedAnalysis.v4Composite ?? 0}
                    trend="neutral"
                  />
                  <MetricCard
                    title="成分股数"
                    value={selectedAnalysis.constituentCount}
                    trend="neutral"
                  />
                  <MetricCard
                    title="景气度"
                    value={selectedAnalysis.dimensions.prosperity.score ?? 0}
                    trend="neutral"
                  />
                  <MetricCard
                    title="数据完整度"
                    value={Math.round(selectedAnalysis.dataCompleteness * 100)}
                    trend="neutral"
                  />
                </div>
                <div className="text-xs text-muted space-y-1 border border-border rounded-lg p-3 bg-muted/30">
                  <div><span className="font-semibold">景气度：</span>{selectedAnalysis.dimensions.prosperity.rationale || '—'}</div>
                  <div><span className="font-semibold">竞争格局：</span>{selectedAnalysis.dimensions.competition.rationale || '—'}</div>
                  <div><span className="font-semibold">政策环境：</span>{selectedAnalysis.dimensions.policy.rationale || '—'}</div>
                  <div><span className="font-semibold">技术成熟度：</span>{selectedAnalysis.dimensions.technology.rationale || '—'}</div>
                </div>
              </div>
            </div>

            <div>
              <Tabs value={subDimTab} onValueChange={(v: string) => setSubDimTab(v as SubDimensionTab)}>
                <TabsList className="mb-3">
                  {(Object.keys(SUB_DIMENSION_LABELS) as SubDimensionTab[]).map((k) => (
                    <TabsTrigger key={k} value={k}>
                      {SUB_DIMENSION_LABELS[k].label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {(Object.keys(SUB_DIMENSION_LABELS) as SubDimensionTab[]).map((k) => (
                  <TabsContent key={k} value={k}>
                    <div className="text-xs text-muted mb-2">{SUB_DIMENSION_LABELS[k].desc}</div>
                    <SubIndicatorBar
                      data={subDimTab === k ? subIndicatorData : toSubIndicatorData(selectedAnalysis, k)}
                      height={280}
                      layout="horizontal"
                      showGrid
                      showTooltip
                      barColor={CHART_PALETTE.series1}
                      barRadius={4}
                      labelPosition="top"
                      sortByValue="desc"
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>领涨板块 TOP5</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {top5ByComposite.map((analysis, index) => (
              <RankedCard
                key={analysis.industryCode}
                rank={index + 1}
                name={analysis.industryName}
                mainMetric={{
                  value: analysis.v4Composite,
                  label: '综合评分',
                  unit: '',
                }}
                signal={getRotationSignal(analysis.industryCode)}
                signalStrength={getRotationSignalStrength(analysis.industryCode)}
                score={analysis.v4Composite}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>推荐关注</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rotationSignals
              .filter((s) => s.signal === 'strong_buy' || s.signal === 'buy')
              .slice(0, 5)
              .map((signal, index) => (
                <RankedCard
                  key={signal.industryCode}
                  rank={index + 1}
                  name={signal.industryName}
                  mainMetric={{
                    value: signal.compositeScore,
                    label: '信号得分',
                    unit: '',
                  }}
                  secondaryMetric={{
                    value: signal.scores.v4,
                    label: 'V4评分',
                    unit: '',
                  }}
                  signal={signal.signal}
                  signalStrength={signal.signalStrength}
                  score={signal.scores.v4}
                />
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>估值洼地</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...v4Analyses]
              .filter((a) => a.valuation?.pePercentileLevel === 'extremely_low')
              .slice(0, 5)
              .map((analysis, index) => (
                <RankedCard
                  key={analysis.industryCode}
                  rank={index + 1}
                  name={analysis.industryName}
                  mainMetric={{
                    value: analysis.valuation?.pePercentile ?? null,
                    label: 'PE分位',
                    unit: '',
                  }}
                  secondaryMetric={{
                    value: analysis.v4Composite,
                    label: 'V4评分',
                    unit: '',
                  }}
                  signal={getRotationSignal(analysis.industryCode)}
                  signalStrength={getRotationSignalStrength(analysis.industryCode)}
                />
              ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>行业评分排序表</CardTitle>
          <CardDescription>点击表头排序</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className={fontSize}>
              <TableHeader>
                <TableRow style={{ height: rowHeight }}>
                  <TableHead className={cn('w-12', padding)}>#</TableHead>
                  <TableHead className={padding}>行业</TableHead>
                  <TableHead
                    className={cn('cursor-pointer hover:bg-muted/50 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150', padding)}
                    onClick={() => {
                      setSortKey('composite')
                      setSortOrder(sortKey === 'composite' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    综合评分{renderSortArrow('composite')}
                  </TableHead>
                  <TableHead
                    className={cn('cursor-pointer hover:bg-muted/50 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150', padding)}
                    onClick={() => {
                      setSortKey('prosperity')
                      setSortOrder(sortKey === 'prosperity' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    景气度{renderSortArrow('prosperity')}
                  </TableHead>
                  <TableHead
                    className={cn('cursor-pointer hover:bg-muted/50 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150', padding)}
                    onClick={() => {
                      setSortKey('valuation')
                      setSortOrder(sortKey === 'valuation' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    估值{renderSortArrow('valuation')}
                  </TableHead>
                  <TableHead
                    className={cn('cursor-pointer hover:bg-muted/50 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150', padding)}
                    onClick={() => {
                      setSortKey('trend')
                      setSortOrder(sortKey === 'trend' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    趋势{renderSortArrow('trend')}
                  </TableHead>
                  <TableHead className={padding}>轮动信号</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAnalyses.map((analysis, index) => (
                  <TableRow
                    key={analysis.industryCode}
                    className={`cursor-pointer transition-colors duration-150 ${
                      selectedIndustryCode === analysis.industryCode
                        ? 'bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    style={{ height: rowHeight }}
                    onClick={() => setSelectedIndustryCode(analysis.industryCode)}
                  >
                    <TableCell className={cn('font-medium', padding)}>{index + 1}</TableCell>
                    <TableCell className={padding}>
                      <div className="font-medium">{analysis.industryName}</div>
                      <div className="text-xs text-muted">{analysis.industryCode}</div>
                    </TableCell>
                    <TableCell className={padding}>
                      <ScoreGauge score={analysis.v4Composite} size="sm" />
                    </TableCell>
                    <TableCell className={padding}>
                      <ScoreGauge score={analysis.dimensions.prosperity.score} size="sm" />
                    </TableCell>
                    <TableCell className={padding}>
                      <ScoreGauge score={analysis.valuation?.valuationScore ?? null} size="sm" />
                    </TableCell>
                    <TableCell className={padding}>
                      <TrendArrow
                        direction={getTrendDirection(analysis)}
                        strength={analysis.trend?.prosperityTrend.strength}
                        size="sm"
                        showLabel
                      />
                    </TableCell>
                    <TableCell className={padding}>
                      <SignalBadge
                        signal={getRotationSignal(analysis.industryCode) ?? 'observe'}
                        signalStrength={getRotationSignalStrength(analysis.industryCode)}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
