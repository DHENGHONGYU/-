/**
 * StockQuoteDashboard - 实时行情 + K 线图组件
 * @module components/organisms/market/StockQuoteDashboard
 */
 
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { getLogger } from '@/lib/logger'
import { Skeleton } from '@/components/atoms/Skeleton'
import { WidgetErrorBoundary } from '@/components/organisms/shared/WidgetErrorBoundary'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { collectBasic, collectKline } from '@/services/fetcher/fetcherClient'
import type {
  CollectBasicData,
  CollectKlineData,
  CollectKlineRequest,
} from '@/services/fetcher/fetcherTypes'
import { cn } from '@/lib/utils'

const logger = getLogger()
type KlinePeriod = NonNullable<CollectKlineRequest['period']>

interface KlineBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

interface PriceSummary {
  lastPrice: number | null
  prevClose: number | null
  change: number | null
  changePercent: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  amount: number | null
}

export interface StockQuoteDashboardProps {
  symbol?: string
  adjust?: CollectKlineRequest['adjust']
  className?: string
}

const PERIOD_OPTIONS: ReadonlyArray<{ value: KlinePeriod; label: string }> = [
  { value: 'daily', label: '日K' },
  { value: 'weekly', label: '周K' },
  { value: 'monthly', label: '月K' },
]

const DEFAULT_SYMBOL = '600519'

function mergeKlineHistory(data: CollectKlineData | null | undefined): KlineBar[] {
  if (!data) return []
  const map = new Map<string, KlineBar>()
  for (const bar of data.history ?? []) map.set(bar.date, bar)
  if (data.latest) map.set(data.latest.date, data.latest)
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function computePriceSummary(basicData: CollectBasicData | null | undefined, bars: KlineBar[]): PriceSummary {
  const latest = bars.length > 0 ? bars[bars.length - 1] : null
  const prev = bars.length > 1 ? bars[bars.length - 2] : null
  const lastPrice = basicData?.price ?? latest?.close ?? null
  const prevClose = prev?.close ?? null
  const change = lastPrice !== null && prevClose !== null ? lastPrice - prevClose : null
  const changePercent = change !== null && prevClose !== null && prevClose !== 0 ? (change / prevClose) * 100 : null
  return {
    lastPrice, prevClose, change, changePercent,
    open: latest?.open ?? null,
    high: latest?.high ?? null,
    low: latest?.low ?? null,
    volume: latest?.volume ?? null,
    amount: latest?.amount ?? null,
  }
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--'
  const abs = Math.abs(value)
  const YI = 1e8; const WAN = 1e4
  if (abs >= YI) return `${(value / YI).toFixed(2)}亿`
  if (abs >= WAN) return `${(value / WAN).toFixed(2)}万`
  return value.toFixed(0)
}

interface PriceHeaderProps {
  symbol: string
  name?: string
  summary: PriceSummary
}

const PriceHeader = memo(function PriceHeader({ symbol, name, summary }: PriceHeaderProps) {
  const isUp = summary.change !== null && summary.change >= 0
  const changeColorClass = isUp ? 'text-success' : 'text-destructive'
  const changeSign = summary.change !== null && summary.change >= 0 ? '+' : ''
  const arrow = isUp ? '▲' : '▼'
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
          <span className="text-lg font-semibold md:text-xl">{name ?? '--'}</span>
          <span className="text-xs text-muted-foreground md:text-sm">{symbol}</span>
        </div>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums md:text-4xl">{formatNumber(summary.lastPrice)}</span>
            <span className={cn('text-base font-medium tabular-nums md:text-lg', changeColorClass)}>
              {summary.change !== null ? `${arrow} ${changeSign}${formatNumber(summary.change)}` : '--'}
            </span>
            <span className={cn('text-sm font-medium tabular-nums', changeColorClass)}>
              {summary.changePercent !== null ? `${changeSign}${formatNumber(summary.changePercent)}%` : '--'}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4 md:gap-4">
          <MetricItem label="今开" value={formatNumber(summary.open)} />
          <MetricItem label="最高" value={formatNumber(summary.high)} />
          <MetricItem label="最低" value={formatNumber(summary.low)} />
          <MetricItem label="昨收" value={formatNumber(summary.prevClose)} />
          <MetricItem label="成交量" value={formatLargeNumber(summary.volume)} />
          <MetricItem label="成交额" value={formatLargeNumber(summary.amount)} />
        </div>
      </CardContent>
    </Card>
  )
})

interface MetricItemProps { label: string; value: string }
const MetricItem = memo(function MetricItem({ label, value }: MetricItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
})

function PriceHeaderSkeleton(): React.JSX.Element {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex gap-3"><Skeleton className="h-6 w-28" /><Skeleton className="h-4 w-16" /></div>
        <div className="mt-4 flex items-end gap-4"><Skeleton className="h-10 w-36" /><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-20" /></div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1"><Skeleton className="h-3 w-8" /><Skeleton className="h-5 w-20" /></div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface PeriodSwitcherProps { value: KlinePeriod; onChange: (period: KlinePeriod) => void }
const PeriodSwitcher = memo(function PeriodSwitcher({ value, onChange }: PeriodSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
})

interface KlineChartProps { data: KlineBar[]; height: number }
const KlineChart = memo(function KlineChart({ data, height }: KlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      height,
      layout: { background: { color: 'transparent' }, textColor: CHART_PALETTE.axis },
      grid: { vertLines: { color: CHART_PALETTE.gridLight }, horzLines: { color: CHART_PALETTE.gridLight } },
      crosshair: { mode: 1, vertLine: { color: CHART_PALETTE.accent, width: 1, style: 2 }, horzLine: { color: CHART_PALETTE.accent, width: 1, style: 2 } },
      rightPriceScale: { borderColor: CHART_PALETTE.gridLight },
      timeScale: { borderColor: CHART_PALETTE.gridLight, timeVisible: false },
    })
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_PALETTE.upColor, downColor: CHART_PALETTE.downColor,
      borderUpColor: CHART_PALETTE.upColor, borderDownColor: CHART_PALETTE.downColor,
      wickUpColor: CHART_PALETTE.upColor, wickDownColor: CHART_PALETTE.downColor,
    })
    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    chartRef.current = chart; candleSeriesRef.current = candleSeries; volumeSeriesRef.current = volumeSeries
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) { const width = entry.contentRect.width; if (width > 0) chart.applyOptions({ width }) }
    })
    resizeObserver.observe(containerRef.current)
    return () => { resizeObserver.disconnect(); chart.remove(); chartRef.current = null; candleSeriesRef.current = null; volumeSeriesRef.current = null }
  }, [height])
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return
    const candleData: CandlestickData<Time>[] = data.map((bar) => ({ time: bar.date, open: bar.open, high: bar.high, low: bar.low, close: bar.close }))
    const volumeData: HistogramData<Time>[] = data.map((bar) => ({ time: bar.date, value: bar.volume, color: bar.close >= bar.open ? CHART_PALETTE.upColor : CHART_PALETTE.downColor }))
    candleSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)
    chartRef.current?.timeScale().fitContent()
  }, [data])
  return <div ref={containerRef} style={{ height, width: '100%' }} />
})

interface KlinePanelProps {
  data: KlineBar[]
  period: KlinePeriod
  onPeriodChange: (period: KlinePeriod) => void
  onRefresh: () => void
  loading: boolean
}
const KlinePanel = memo(function KlinePanel({ data, period, onPeriodChange, onRefresh, loading }: KlinePanelProps) {
  const [chartHeight, setChartHeight] = useState<number>(400)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const update = () => setChartHeight(mql.matches ? 400 : 300)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">K线图</CardTitle>
        <div className="flex items-center gap-2">
          <PeriodSwitcher value={period} onChange={onPeriodChange} />
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-label="刷新">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <Skeleton className="w-full" style={{ height: chartHeight }} />
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartHeight }}>暂无 K 线数据</div>
        ) : (
          <KlineChart data={data} height={chartHeight} />
        )}
      </CardContent>
    </Card>
  )
})

function StockQuoteDashboardInner({ symbol = DEFAULT_SYMBOL, adjust = 'qfq', className }: StockQuoteDashboardProps): React.JSX.Element {
  const [period, setPeriod] = useState<KlinePeriod>('daily')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [basicData, setBasicData] = useState<CollectBasicData | null>(null)
  const [klineData, setKlineData] = useState<CollectKlineData | null>(null)
  const loadData = useCallback(async () => {
    logger.info('[StockQuoteDashboard] 开始加载数据', { symbol, period, adjust })
    setLoading(true); setError(null)
    try {
      const [basicRes, klineRes] = await Promise.all([collectBasic(symbol), collectKline({ symbol, period, adjust })])
      logger.debug('[StockQuoteDashboard] API 响应', {
        basicSuccess: basicRes.success, basicError: basicRes.error,
        klineSuccess: klineRes.success, klineError: klineRes.error,
        basicRecords: basicRes.records, klineRecords: klineRes.records,
        basicName: basicRes.data?.name, basicPrice: basicRes.data?.price,
      })
      setBasicData(basicRes.success ? basicRes.data : null)
      setKlineData(klineRes.success ? klineRes.data : null)
      if (!basicRes.success && !klineRes.success) {
        const errMsg = basicRes.error ?? klineRes.error ?? '数据加载失败'
        logger.warn('[StockQuoteDashboard] 两个接口均失败', { errMsg })
        setError(errMsg)
      } else if (!basicRes.success || !klineRes.success) {
        logger.warn('[StockQuoteDashboard] 部分接口失败', { basicSuccess: basicRes.success, klineSuccess: klineRes.success })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[StockQuoteDashboard] 数据加载异常', { message, stack: err instanceof Error ? err.stack : undefined })
      setError(message)
    } finally {
      setLoading(false)
      logger.debug('[StockQuoteDashboard] 数据加载完成', { loading: false })
    }
  }, [symbol, period, adjust])
  useEffect(() => { void loadData() }, [loadData])
  const bars = useMemo(() => {
    const result = mergeKlineHistory(klineData)
    logger.debug('[StockQuoteDashboard] K线数据合并完成', {
      klineDataLatest: klineData?.latest ? { date: klineData.latest.date, close: klineData.latest.close } : null,
      historyCount: klineData?.history?.length ?? 0, barsCount: result.length,
      firstBar: result[0] ? { date: result[0].date, close: result[0].close } : null,
      lastBar: result.length > 0 ? { date: result.at(-1)?.date, close: result.at(-1)?.close } : null,
    })
    return result
  }, [klineData])
  const summary = useMemo(() => {
    const result = computePriceSummary(basicData, bars)
    logger.debug('[StockQuoteDashboard] 价格摘要计算完成', {
      name: basicData?.name, lastPrice: result.lastPrice, change: result.change,
      changePercent: result.changePercent, volume: result.volume, barsCount: bars.length,
    })
    return result
  }, [basicData, bars])
  return (
    <WidgetErrorBoundary
      onRetry={() => { void loadData() }}
      widgetId="StockQuoteDashboard"
      instanceId="market-stock-quote-dashboard"
      errorTitle="行情数据加载失败"
    >
      <div className={cn('w-full space-y-4', className)}>
        {error && (
          <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <span>行情数据加载失败：{error}</span>
            <Button variant="danger" size="sm" onClick={() => { void loadData() }}>重试</Button>
          </div>
        )}
        {loading && !basicData && !klineData ? <PriceHeaderSkeleton /> : <PriceHeader symbol={symbol} name={basicData?.name} summary={summary} />}
        <KlinePanel data={bars} period={period} onPeriodChange={setPeriod} onRefresh={loadData} loading={loading} />
      </div>
    </WidgetErrorBoundary>
  )
}

export const StockQuoteDashboard = memo(StockQuoteDashboardInner)
export default StockQuoteDashboard
