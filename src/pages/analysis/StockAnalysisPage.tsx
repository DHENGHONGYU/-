import React from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import {
  loadDailyQuotesForAnalysis,
  loadStockForAnalysis,
  loadV6ScoreForAnalysis,
} from '@/services/analysis/scorePageService'
import type { DailyQuotes, Stock, V6Score } from '@/data/types'

export default function StockAnalysisPage(): React.JSX.Element {
  const { symbol } = useParams<{ symbol?: string }>()
  const [stock, setStock] = useState<Stock | undefined>()
  const [quotes, setQuotes] = useState<DailyQuotes | undefined>()
  const [score, setScore] = useState<V6Score | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (symbol) {
      loadStockForAnalysis(symbol).then(setStock)
      loadDailyQuotesForAnalysis(symbol).then(setQuotes)
      loadV6ScoreForAnalysis(symbol).then(setScore)
    }
  }, [symbol])

  const handleScore = async (): Promise<void> => {
    if (!symbol) return
    setLoading(true)
    try {
      await runV6Score(symbol)
      const latest = await loadV6ScoreForAnalysis(symbol)
      setScore(latest)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>个股分析</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stock ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{stock.symbol}</h2>
                  <p className="text-muted-foreground">{stock.name}</p>
                </div>
                <Badge variant="outline">{stock.researchStatus}</Badge>
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

              <Button onClick={handleScore} disabled={loading}>
                {loading ? '评分中...' : '运行 V6 评分'}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              {symbol ? `未找到 ${symbol}` : '请指定股票代码'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
