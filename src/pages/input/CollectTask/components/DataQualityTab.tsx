/**
 * 数据质量指标 Tab
 *
 * 对标 Acceldata/IBM 6 维数据质量模型：
 * 1. Accuracy（准确性）— 采集数据与实际行情的匹配度
 * 2. Completeness（完整性）— 必填字段非空率
 * 3. Consistency（一致性）— 跨 store 引用完整性
 * 4. Timeliness（时效性）— 数据新鲜度
 * 5. Validity（有效性）— 数据格式合规率
 * 6. Integrity（完整性）— 引用关系完整率
 *
 * 数据来源：qualityMetrics + traceSpans + dimHealth
 *
 * @module CollectTask/components/DataQualityTab
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Progress } from '@/components/atoms/Progress'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { ScoreStats, DimHealth } from '../hooks/useCollectionTaskStats'

interface DataQualityTabProps {
  // 采集质量指标
  successRate: number
  writeRate: number
  fallbackCount: number
  totalCollects: number
  // 维度健康度
  dimHealth: Map<string, DimHealth>
  // 数据新鲜度
  lastSuccessAt: number | null
  // 评分统计
  scoreStats: ScoreStats
}

/** 质量等级 */
function qualityLevel(score: number): { label: string; color: string } {
  if (score >= 95) return { label: '优秀', color: COLOR_TOKENS.success.hex }
  if (score >= 80) return { label: '良好', color: COLOR_TOKENS.info.hex }
  if (score >= 60) return { label: '一般', color: COLOR_TOKENS.warning.hex }
  return { label: '需改进', color: COLOR_TOKENS.danger.hex }
}

/** 格式化新鲜度 */
function formatFreshness(ts: number | null): string {
  if (ts === null) return '暂无数据'
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return `${Math.floor(diff / 86_400_000)} 天前`
}

/**
 * DataQualityTab — 6 维数据质量指标看板
 */
export function DataQualityTab({
  successRate,
  writeRate,
  fallbackCount,
  totalCollects,
  dimHealth,
  lastSuccessAt,
  scoreStats,
}: DataQualityTabProps): React.JSX.Element {
  // ── 计算 6 维分数 ──

  // 1. Accuracy：采集成功率（已采集成功 / 总采集次数）
  const accuracyScore = successRate

  // 2. Completeness：写入成功率（写入成功 / 写入总次数）
  const completenessScore = writeRate

  // 3. Consistency：维度一致性（成功维度数 / 总维度数）
  let consistentDims = 0
  let totalDims = 0
  dimHealth.forEach((health) => {
    totalDims++
    if (health.success > 0 && health.total === health.success) consistentDims++
  })
  const consistencyScore = totalDims > 0 ? Math.round((consistentDims / totalDims) * 100) : 0

  // 4. Timeliness：时效性（最近采集 < 1h = 100, < 24h = 80, > 24h = 50, 无 = 0）
  let timelinessScore = 0
  if (lastSuccessAt !== null) {
    const diff = Date.now() - lastSuccessAt
    if (diff < 3_600_000) timelinessScore = 100
    else if (diff < 86_400_000) timelinessScore = 80
    else timelinessScore = 50
  }

  // 5. Validity：有效性（非降级采集 / 总采集，降级次数越少分越高）
  const validityScore = totalCollects > 0
    ? Math.round(Math.max(0, (totalCollects - fallbackCount) / totalCollects) * 100)
    : 0

  // 6. Integrity：引用完整性（有评分的股票 / 已采集的股票）
  const integrityScore = scoreStats.total > 0 && totalCollects > 0
    ? Math.round(Math.min(100, (scoreStats.total / Math.max(1, totalCollects / 8)) * 100))
    : 0

  const metrics = [
    { name: '准确性', code: 'Accuracy', score: accuracyScore, desc: '采集数据与实际行情匹配度' },
    { name: '完整性', code: 'Completeness', score: completenessScore, desc: '必填字段非空率（写入成功/总写入）' },
    { name: '一致性', code: 'Consistency', score: consistencyScore, desc: `${consistentDims}/${totalDims} 维度全部成功` },
    { name: '时效性', code: 'Timeliness', score: timelinessScore, desc: `最近采集: ${formatFreshness(lastSuccessAt)}` },
    { name: '有效性', code: 'Validity', score: validityScore, desc: `降级 ${fallbackCount} 次 / 共 ${totalCollects} 次` },
    { name: '引用完整性', code: 'Integrity', score: integrityScore, desc: `评分覆盖 ${scoreStats.total} 条` },
  ]

  // 总分
  const overallScore = Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length)

  return (
    <div className="space-y-4">
      {/* 总分概览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">数据质量总览</CardTitle>
            <Badge
              variant="outline"
              className="text-sm font-bold"
              style={{ color: qualityLevel(overallScore).color, borderColor: qualityLevel(overallScore).color }}
            >
              {overallScore} 分 · {qualityLevel(overallScore).label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>总体数据质量</span>
            <span>{overallScore}/100</span>
          </div>
          <Progress value={overallScore} className="h-3" />
        </CardContent>
      </Card>

      {/* 6 维指标卡片 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const level = qualityLevel(metric.score)
          return (
            <Card key={metric.code}>
              <CardContent className="py-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.code}</p>
                    <p className="text-sm font-semibold">{metric.name}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs font-bold"
                    style={{ color: level.color, borderColor: level.color }}
                  >
                    {metric.score}
                  </Badge>
                </div>
                <Progress value={metric.score} className="mb-2 h-2" />
                <p className="text-xs text-muted-foreground">{metric.desc}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 维度明细 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">维度采集质量明细</CardTitle>
        </CardHeader>
        <CardContent>
          {totalDims === 0 ? (
            <p className="text-center text-sm text-muted-foreground">暂无采集数据</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">维度</th>
                    <th className="px-3 py-2 text-right">成功</th>
                    <th className="px-3 py-2 text-right">总计</th>
                    <th className="px-3 py-2 text-right">成功率</th>
                    <th className="px-3 py-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(dimHealth.entries()).map(([code, health]) => {
                    const rate = health.total > 0 ? Math.round((health.success / health.total) * 100) : 0
                    const level = qualityLevel(rate)
                    return (
                      <tr key={code} className="border-t">
                        <td className="px-3 py-2">{code} · {health.name}</td>
                        <td className="px-3 py-2 text-right">{health.success}</td>
                        <td className="px-3 py-2 text-right">{health.total}</td>
                        <td className="px-3 py-2 text-right font-medium" style={{ color: level.color }}>
                          {rate}%
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]" style={{ color: level.color, borderColor: level.color }}>
                            {level.label}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
