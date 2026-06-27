import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { dataLayer } from '@/data/dataLayer'
import type { RotationSectorScore, IndustryScore } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export default function SectorAnalysisPage(): React.JSX.Element {
  const [rotationScores, setRotationScores] = useState<RotationSectorScore[]>([])
  const [industryScores, setIndustryScores] = useState<IndustryScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const rotation = await dataLayer.rotationScores.list()
      const industry = await dataLayer.industryScores.list()
      setRotationScores(rotation.sort((a, b) => b.total - a.total))
      setIndustryScores(industry.sort((a, b) => b.scoredAt - a.scoredAt))
      logger.info('[SectorAnalysisPage] 数据加载完成', {
        rotation: rotation.length,
        industry: industry.length,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      logger.error('[SectorAnalysisPage] 数据加载失败', { error: msg })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            加载中...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center text-red-500">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={loadData} className="mt-2">
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>板块轮动评分</CardTitle>
            <Badge variant="outline">{rotationScores.length} 个板块</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {rotationScores.length === 0 ? (
            <p className="text-muted-foreground">暂无轮动评分数据</p>
          ) : (
            <div className="space-y-2">
              {rotationScores.slice(0, 10).map((score) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div>
                    <span className="font-medium">{score.sectorName}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {score.signal}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{score.total}</span>
                    <Badge variant={score.alertLevel === '常态锁仓' ? 'default' : 'destructive'}>
                      {score.alertLevel}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>行业评分</CardTitle>
            <Badge variant="outline">{industryScores.length} 条记录</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {industryScores.length === 0 ? (
            <p className="text-muted-foreground">暂无行业评分数据</p>
          ) : (
            <div className="space-y-2">
              {industryScores.slice(0, 10).map((score) => (
                <div
                  key={score.id ?? `${score.code}-${score.scoredAt}`}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div>
                    <span className="font-medium">{score.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {score.configSnapshot.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {score.overallScore !== null ? score.overallScore.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
