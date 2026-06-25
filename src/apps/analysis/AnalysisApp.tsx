import React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { runV6Score } from '@/services/scoring/v6ScoreService'
import { listStocks, listV6Scores } from '@/services/analysis/analysisService'
import { useToast } from '@/hooks/useToast'
import type { Stock, V6Score } from '@/data/types'

export default function AnalysisApp(): React.JSX.Element {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [scores, setScores] = useState<V6Score[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadStocks = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await listStocks()
      if (result.success && result.data) {
        setStocks(result.data)
      } else {
        toast({
          variant: 'error',
          title: '加载失败',
          description: result.error ?? '无法加载标的列表',
        })
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: '加载失败',
        description: err instanceof Error ? err.message : '无法加载标的列表',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleScore = async (symbol: string): Promise<void> => {
    setLoading(true)
    try {
      const result = await runV6Score(symbol)
      if (result.success) {
        await loadScores()
      } else {
        toast({
          variant: 'error',
          title: '评分失败',
          description: result.error ?? `无法对 ${symbol} 运行评分`,
        })
      }
    } catch (err) {
      toast({
        variant: 'error',
        title: '评分失败',
        description: err instanceof Error ? err.message : `无法对 ${symbol} 运行评分`,
      })
    } finally {
      setLoading(false)
    }
  }

  const loadScores = async (): Promise<void> => {
    const result = await listV6Scores()
    if (result.success && result.data) {
      setScores(result.data)
    }
  }

  const scoreMap = new Map(scores.map((s) => [s.symbol, s]))

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>分析舱 · V6 九维评分</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" size="sm" onClick={loadStocks} disabled={loading}>
            加载标的
          </Button>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stocks.map((stock) => {
              const score = scoreMap.get(stock.symbol)
              return (
                <div
                  key={stock.symbol}
                  className="rounded-md border p-3 hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{stock.symbol}</span>
                    <Badge variant={score ? 'default' : 'outline'}>
                      {score ? `V6: ${score.score.toFixed(2)}` : '未评分'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{stock.name}</p>
                  <Button
                    className="mt-2"
                    size="sm"
                    disabled={loading}
                    onClick={() => handleScore(stock.symbol)}
                  >
                    {loading ? '评分中...' : '运行评分'}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
