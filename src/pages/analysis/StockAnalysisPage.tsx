import React, { useEffect, useMemo } from 'react'
import { useParams } from 'react-router'
import { Card, CardContent } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { PageContainer, PageHeader } from '@/components/templates'
import { ScoreHistoryPanel } from '@/components/organisms/analysis/score/ScoreHistoryPanel'
import { CandlestickChart, type CandlestickChartData } from '@/components/chart/CandlestickChart'
import { useStockAnalysisStore } from '@/store/stockAnalysisStore'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * StockAnalysisPage
 */
export default function StockAnalysisPage(): React.JSX.Element {
  const { symbol } = useParams<{ symbol?: string }>()

  // 从 Store 获取状态
  const stock = useStockAnalysisStore((s) => s.stock)
  const quotes = useStockAnalysisStore((s) => s.quotes)
  const score = useStockAnalysisStore((s) => s.v6Score)
  const scoreLoading = useStockAnalysisStore((s) => s.scoreLoading)

  // K线数据映射为 CandlestickChart 所需结构
  const candleData = useMemo<CandlestickChartData[]>(() => {
    if (!quotes?.history?.length) return []
    return quotes.history.map((bar) => ({
      time: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    }))
  }, [quotes])

  // 从 Store 获取 actions
  const loadStockAnalysis = useStockAnalysisStore((s) => s.loadStockAnalysis)
  const refreshScore = useStockAnalysisStore((s) => s.refreshScore)

  // 监听 symbol 变化，加载数据
  useEffect(() => {
    if (!symbol) return

    logger.info('[StockAnalysisPage] symbol 变化，开始加载数据', { symbol })

    // 创建 AbortController 用于取消请求
    const controller = new AbortController()

    const runIfNotAborted = (fn: () => void): void => {
      if (!controller.signal.aborted) {
        fn()
      }
    }

    loadStockAnalysis(symbol, controller.signal).then(() => {
      runIfNotAborted(() => logger.info('[StockAnalysisPage] 数据加载完成', { symbol }))
    }).catch((err) => {
      runIfNotAborted(() => logger.error('[StockAnalysisPage] 数据加载失败', { symbol, error: err.message }))
    })

    return () => {
      logger.info('[StockAnalysisPage] 取消加载', { symbol })
      controller.abort()
    }
  }, [symbol, loadStockAnalysis])

  // 刷新评分
  const handleScore = async (): Promise<void> => {
    if (symbol) {
      logger.info('[StockAnalysisPage] 开始刷新 V6 评分', { symbol })

      try {
        await refreshScore(symbol)
        logger.info('[StockAnalysisPage] V6 评分刷新完成', { symbol })
      } catch (err) {
        logger.error('[StockAnalysisPage] V6 评分刷新失败', { symbol, error: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  return (
    <PageContainer className="space-y-4">
      <PageHeader title="个股分析" />

      <Card>
        <CardContent className="space-y-4">
          {stock ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{stock.symbol}</h2>
                  <p className="text-muted-foreground">{stock.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{stock.researchStatus}</Badge>
                  {/* 阶段 A-3：数据血缘降级徽章 */}
                  {stock.dataProvenance === 'mock' && (
                    <Badge variant="destructive" className="gap-1">
                      Mock 数据
                    </Badge>
                  )}
                  {stock.dataProvenance === 'real' && stock.dataSource && (
                    <Badge variant="secondary" className="gap-1">
                      来源 {stock.dataSource}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">最新价</p>
                  <p className="text-lg font-semibold">
                    {stock.price?.toFixed(2) ?? '—'}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">PE</p>
                  <p className="text-lg font-semibold">
                    {stock.pe?.toFixed(2) ?? '—'}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">PB</p>
                  <p className="text-lg font-semibold">
                    {stock.pb?.toFixed(2) ?? '—'}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">K线数据</p>
                  <p className="text-lg font-semibold">
                    {quotes ? `${quotes.history.length} 条` : '—'}
                  </p>
                </div>
              </div>

              {quotes?.latest && (
                <div className="text-sm text-muted-foreground">
                  最新 K线 {quotes.latest.date}：开 {quotes.latest.open.toFixed(2)} / 高{' '}
                  {quotes.latest.high.toFixed(2)} / 低 {quotes.latest.low.toFixed(2)} / 收{' '}
                  {quotes.latest.close.toFixed(2)}
                </div>
              )}

              {candleData.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">K线走势</p>
                  <CandlestickChart data={candleData} height={400} />
                </div>
              )}

              {score ? (
                <div className="rounded-md bg-muted p-4">
                  <p className="text-lg font-semibold">
                    V6 评分: {score.score.toFixed(2)} / 5.0
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {Object.entries(score.factors).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span>{key}</span>
                        <span className="font-medium">{value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">暂无评分</p>
              )}

              <Button onClick={handleScore} disabled={scoreLoading}>
                {scoreLoading ? '评分中...' : '运行 V6 评分'}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              {symbol ? `未找到 ${symbol}` : '请指定股票代码'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 评分历史面板 */}
      {stock && score && <ScoreHistoryPanel symbol={stock.symbol} />}
    </PageContainer>
  )
}
