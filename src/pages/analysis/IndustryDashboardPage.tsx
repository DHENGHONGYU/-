import React, { useEffect, useState } from 'react'
import { RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
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
import { SignalBadge, ScoreGauge, TrendArrow, RankedCard, DataQualityIndicator } from '@/components/molecules'
import { IndustryHeatmap } from '@/components/chart/industry'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/atoms'
import { getLogger } from '@/lib/logger'
import { dataBridge } from '@/core/databridge'
import { mcpBridge } from '@/mcp'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import type {
  IndustryV4AnalysisEnhanced,
  IndustryRotationSignal,
  RotationSignalType,
  TrendDirection,
} from '@/data/types/types.sector'
import { Loading, Empty } from '@/components/molecules/states'

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
export default function IndustryDashboardPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [v4Analyses, setV4Analyses] = useState<IndustryV4AnalysisEnhanced[]>([])
  const [rotationSignals, setRotationSignals] = useState<IndustryRotationSignal[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('composite')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
      const resultText = mcpResult.content[0] && 'text' in mcpResult.content[0]
        ? (mcpResult.content[0] as { text: string }).text
        : '{}'
      const parsed = JSON.parse(resultText) as {
        v4Analyses: IndustryV4AnalysisEnhanced[]
        rotationSignals: IndustryRotationSignal[]
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
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
              重试
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  const renderSortArrow = (columnKey: SortKey) => {
    if (sortKey === columnKey) {
      return sortOrder === 'asc'
        ? <ChevronUp className="inline h-3.5 w-3.5 ml-1" />
        : <ChevronDown className="inline h-3.5 w-3.5 ml-1" />
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
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
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
          <CardDescription>按综合评分着色，点击查看详情</CardDescription>
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
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>行业</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted select-none"
                    onClick={() => {
                      setSortKey('composite')
                      setSortOrder(sortKey === 'composite' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    综合评分{renderSortArrow('composite')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted select-none"
                    onClick={() => {
                      setSortKey('prosperity')
                      setSortOrder(sortKey === 'prosperity' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    景气度{renderSortArrow('prosperity')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted select-none"
                    onClick={() => {
                      setSortKey('valuation')
                      setSortOrder(sortKey === 'valuation' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    估值{renderSortArrow('valuation')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted select-none"
                    onClick={() => {
                      setSortKey('trend')
                      setSortOrder(sortKey === 'trend' && sortOrder === 'desc' ? 'asc' : 'desc')
                    }}
                  >
                    趋势{renderSortArrow('trend')}
                  </TableHead>
                  <TableHead>轮动信号</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAnalyses.map((analysis, index) => (
                  <TableRow key={analysis.industryCode}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{analysis.industryName}</div>
                      <div className="text-xs text-muted">{analysis.industryCode}</div>
                    </TableCell>
                    <TableCell>
                      <ScoreGauge score={analysis.v4Composite} size="sm" />
                    </TableCell>
                    <TableCell>
                      <ScoreGauge score={analysis.dimensions.prosperity.score} size="sm" />
                    </TableCell>
                    <TableCell>
                      <ScoreGauge score={analysis.valuation?.valuationScore ?? null} size="sm" />
                    </TableCell>
                    <TableCell>
                      <TrendArrow
                        direction={getTrendDirection(analysis)}
                        strength={analysis.trend?.prosperityTrend.strength}
                        size="sm"
                        showLabel
                      />
                    </TableCell>
                    <TableCell>
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
