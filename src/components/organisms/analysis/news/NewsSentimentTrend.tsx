/**
 * @module NewsSentimentTrend
 * @description DA-008 资讯情感趋势组件。
 * 从 analysisNewsStore 读取 articles 与情感趋势计算结果，
 * 以 100% 堆叠柱状图展示正面/负面/中性资讯占比随时间变化。
 * 禁止直接调用 sentimentTrendEngine，所有计算通过 Store action 完成。
 */

import { getSafeString } from '@/lib/safeCoerce'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Select, SelectItem } from '@/components/atoms/Select'
import { BarChart } from '@/components/chart'
import { DataState } from '@/components/molecules/DataState'
import type { SentimentTrendDimension } from '@/types/modules/news.types'
import { SENTIMENT_TREND_COLORS } from '@/config/chartColors'
import { newsColors } from '@/constants/newsColorTokens'
import { useAnalysisNewsStore } from '@/store/analysisNewsStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

interface NewsSentimentTrendProps {
  loading?: boolean
  error?: string | null
}

const DIMENSION_OPTIONS: { value: SentimentTrendDimension; label: string }[] = [
  { value: 'global', label: '全局' },
  { value: 'stock', label: '股票' },
  { value: 'industry', label: '行业' },
]

const SENTIMENT_BAR_CONFIG = [
  { dataKey: 'positiveRatio', name: '正面', color: SENTIMENT_TREND_COLORS.positive, stackId: 'sentiment' },
  { dataKey: 'negativeRatio', name: '负面', color: SENTIMENT_TREND_COLORS.negative, stackId: 'sentiment' },
  { dataKey: 'neutralRatio', name: '中性', color: SENTIMENT_TREND_COLORS.neutral, stackId: 'sentiment' },
]

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * NewsSentimentTrend
 * @param error
 */
export function NewsSentimentTrend({ loading = false, error = null }: NewsSentimentTrendProps): React.JSX.Element {
  // 从 Store 获取数据
  const articles = useAnalysisNewsStore((s) => s.articles)
  const sentimentTrend = useAnalysisNewsStore((s) => s.sentimentTrend)
  const stockOptions = useAnalysisNewsStore((s) => s.sentimentStockOptions)
  const industryOptions = useAnalysisNewsStore((s) => s.sentimentIndustryOptions)
  const computeSentimentTrend = useAnalysisNewsStore((s) => s.computeSentimentTrend)

  const [dimension, setDimension] = useState<SentimentTrendDimension>('global')
  const [value, setValue] = useState<string>('')

  // 当 articles/dimension/value 变化时，通过 Store action 重新计算
  useEffect(() => {
    logger.info('[NewsSentimentTrend] 触发情感趋势计算', { dimension, value, articleCount: articles.length })
    computeSentimentTrend(dimension, value || undefined)
  }, [articles, dimension, value, computeSentimentTrend])

  const trend = useMemo(() => sentimentTrend ?? {
    dimension,
    value: getSafeString(value),
    data: [],
    summary: { totalArticles: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0, avgDailyArticles: 0 },
  }, [sentimentTrend, dimension, value])

  const handleDimensionChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as SentimentTrendDimension
    setDimension(next)
    setValue('')
  }, [])

  const handleValueChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setValue(event.target.value)
  }, [])

  const isEmpty = !loading && articles.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>情感趋势</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <label htmlFor="sentiment-dimension" className="text-sm font-medium">
              维度
            </label>
            <Select
              id="sentiment-dimension"
              value={dimension}
              onChange={handleDimensionChange}
            >
              {DIMENSION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          {dimension !== 'global' && (
            <div className="space-y-1">
              <label htmlFor="sentiment-value" className="text-sm font-medium">
                {dimension === 'stock' ? '股票代码' : '行业分类'}
              </label>
              <Select
                id="sentiment-value"
                value={value}
                onChange={handleValueChange}
              >
                <SelectItem value="">请选择</SelectItem>
                {(dimension === 'stock' ? stockOptions : industryOptions).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          <div className="ml-auto flex gap-4 text-sm">
            <span className={newsColors.positive.text}>正面 {trend.summary.positiveCount} 条</span>
            <span className={newsColors.negative.text}>负面 {trend.summary.negativeCount} 条</span>
            <span className={newsColors.neutral.text}>中性 {trend.summary.neutralCount} 条</span>
          </div>
        </div>

        <DataState<typeof trend>
          isLoading={loading}
          isError={error !== null}
          isEmpty={isEmpty || trend.data.length === 0}
          data={trend}
          errorProps={{ error: getSafeString(error) }}
          emptyProps={{
            title: '暂无趋势数据',
            description: '当前筛选条件下没有足够资讯生成情感趋势',
          }}
        >
          <BarChart
            data={trend.data as unknown as Array<Record<string, unknown>>}
            xKey="date"
            bars={SENTIMENT_BAR_CONFIG}
            height={320}
          />
        </DataState>

        {trend.summary.totalArticles > 0 && (
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground sm:grid-cols-4">
            <div>总资讯数 <span className="font-medium text-foreground">{trend.summary.totalArticles}</span></div>
            <div>平均每日 <span className="font-medium text-foreground">{trend.summary.avgDailyArticles.toFixed(1)}</span></div>
            <div>正面占比 <span className={`font-medium ${newsColors.positive.text}`}>{formatRatio(trend.summary.positiveCount / trend.summary.totalArticles)}</span></div>
            <div>负面占比 <span className={`font-medium ${newsColors.negative.text}`}>{formatRatio(trend.summary.negativeCount / trend.summary.totalArticles)}</span></div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default NewsSentimentTrend
