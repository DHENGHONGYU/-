import React, { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { useSectorAnalysisStore } from '@/store/sectorAnalysisStore'
import { SectorRotationHeatmap } from '@/components/organisms/analysis/sector/SectorRotationHeatmap'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * SectorAnalysisPage
 */
export default function SectorAnalysisPage(): React.JSX.Element {
  // @compliance AGENTS.md §一：pages 只能依赖 store/services，禁止直接调用 dataLayer
  // 数据来源从 useState + dataLayer 迁移至 useSectorAnalysisStore
  const rotationScores = useSectorAnalysisStore((s) => s.rotationScores)
  const industryScores = useSectorAnalysisStore((s) => s.industryScores)
  const loading = useSectorAnalysisStore((s) => s.loading)
  const error = useSectorAnalysisStore((s) => s.error)
  const fetchSectorAnalysis = useSectorAnalysisStore((s) => s.fetchSectorAnalysis)

  useEffect(() => {
    void fetchSectorAnalysis()
    logger.info('[SectorAnalysisPage] 挂载，触发 fetchSectorAnalysis')
  }, [fetchSectorAnalysis])

  const handleRetry = (): void => {
    void fetchSectorAnalysis()
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
          <CardContent className="p-8 text-center text-destructive">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={handleRetry} className="mt-2">
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

      <Card>
        <CardHeader>
          <CardTitle>板块轮动热力图</CardTitle>
        </CardHeader>
        <CardContent>
          <SectorRotationHeatmap />
        </CardContent>
      </Card>
    </div>
  )
}
