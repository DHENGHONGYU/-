import React, { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Progress } from '@/components/atoms/Progress'
import { Textarea } from '@/components/atoms/Textarea'
import { Tooltip } from '@/components/atoms/Tooltip'
import { PageContainer, PageHeader } from '@/components/templates'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ScoreFactorDeltaPanel } from '@/components/organisms/shared/ScoreFactorDeltaPanel'
import { ScoreUpdateAlert } from '@/components/organisms/shared/ScoreUpdateAlert'
import { IndustrySkillSnapshotCard } from '@/components/cabin/IndustrySkillSnapshotCard'
import { IndustryHistoryCard } from '@/components/cabin/IndustryHistoryCard'
import { IndustryV4Radar, SubIndicatorBar } from '@/components/chart/industry'
import type {
  IndustryV4RadarDataItem,
  IndustryV4RadarSeries,
} from '@/components/chart/industry/IndustryV4Radar'
import type { SubIndicatorBarDataItem } from '@/components/chart/industry/SubIndicatorBar'
import { CHART_PALETTE } from '@/constants/theme.tokens'
import { HOT_TRACKS } from '@/constants/sectorConstants'
import {
  useIndustryScoreStore,
  selectSelectedSector,
  selectConfigReady,
  STEP_LABELS,
  STEP_ORDER,
  DIMENSION_ORDER,
  formatIndustryDelta,
} from '@/store/industryScoreStore'
import type { LlmConfig } from '@/config/llmConfig'
import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import type { IndustryScore } from '@/data/types'

function getScoreColorClass(score: number): string {
  if (score >= 4.0) return 'text-[hsl(var(--stock-up))]'
  if (score >= 3.0) return 'text-primary'
  return 'text-[hsl(var(--stock-down))]'
}

/**
 * 行业评分 7 维 → IndustryV4RadarDataItem（雷达图复用）
 */
function industryScoreToRadarData(
  score: IndustryScore,
  previous: IndustryScore | undefined,
): IndustryV4RadarDataItem[] {
  const dims = score.dimensionScores.map((d) => ({
    dimension: d.name,
    label: d.name,
    score: d.score ?? 0,
    fullMark: 5,
    prev: previous?.dimensionScores.find((p) => p.name === d.name)?.score ?? 0,
  }))
  return dims.concat([
    {
      dimension: '综合评分',
      label: '综合评分',
      score: score.overallScore ?? 0,
      fullMark: 5,
      prev: previous?.overallScore ?? 0,
    },
  ]) as IndustryV4RadarDataItem[] & Array<{ prev: number }>
}

function radarSeriesFromScore(_score: IndustryScore): IndustryV4RadarSeries[] {
  return [
    { name: '本次评分', dataKey: 'score', color: CHART_PALETTE.series1, fillOpacity: 0.3 },
    { name: '上次评分', dataKey: 'prev', color: CHART_PALETTE.series5, fillOpacity: 0.15 },
  ]
}

/**
 * 各维度 score + weight + evidence_count → SubIndicatorBar（子指标柱状图复用）
 */
function industryScoreToSubIndicator(score: IndustryScore): SubIndicatorBarDataItem[] {
  return score.dimensionScores.map((d) => ({
    name: d.name,
    label: d.name,
    value: d.score,
    maxValue: 5,
    unit: '',
    category: d.weight > 1 ? '高权重' : '标准',
  }))
}

/**
 * 评分可视化区块：左 7 维雷达图（对比上次），右 维度得分柱状图
 */
function ScoreVisualizationBlock({
  score,
  previous,
}: {
  score: IndustryScore
  previous: IndustryScore | undefined
}): React.JSX.Element {
  const radarData = useMemo(() => industryScoreToRadarData(score, previous), [score, previous])
  const series = useMemo(() => radarSeriesFromScore(score), [score])
  const barData = useMemo(() => industryScoreToSubIndicator(score), [score])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border border-border rounded-xl bg-muted/20">
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
          7 维行业评分雷达{previous ? '（本次 vs 上次）' : ''}
        </h4>
        <IndustryV4Radar
          data={radarData}
          series={series}
          height={320}
          showLegend
          maxValue={5}
          radarConfig={{ strokeWidth: 2, dot: true, fillOpacity: 0.3 }}
        />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">各维度得分（0-5）</h4>
        <SubIndicatorBar
          data={barData}
          height={320}
          layout="vertical"
          showGrid
          showTooltip
          barColor={CHART_PALETTE.series1}
          barRadius={4}
          labelPosition="right"
          sortByValue="desc"
        />
      </div>
    </div>
  )
}

const logger = getLogger()

/**
 * IndustryScorePage
 */
export default function IndustryScorePage(): React.JSX.Element {
  // 从 Store 获取状态
  const selectedCode = useIndustryScoreStore((s) => s.selectedCode)
  const sectors = useIndustryScoreStore((s) => s.sectors)
  const selectedSector = useIndustryScoreStore(selectSelectedSector)
  const files = useIndustryScoreStore((s) => s.files)
  const reportText = useIndustryScoreStore((s) => s.reportText)
  const llmConfig = useIndustryScoreStore((s) => s.llmConfig)
  const showConfig = useIndustryScoreStore((s) => s.showConfig)
  const configReady = useIndustryScoreStore(selectConfigReady)
  const progress = useIndustryScoreStore((s) => s.progress)
  const progressMessage = useIndustryScoreStore((s) => s.progressMessage)
  const result = useIndustryScoreStore((s) => s.result)
  const previousResult = useIndustryScoreStore((s) => s.previousResult)
  const history = useIndustryScoreStore((s) => s.history)
  const logs = useIndustryScoreStore((s) => s.logs)
  const error = useIndustryScoreStore((s) => s.error)
  const loading = useIndustryScoreStore((s) => s.loading)

  // 从 Store 获取 actions
  const setSelectedCode = useIndustryScoreStore((s) => s.setSelectedCode)
  const setFiles = useIndustryScoreStore((s) => s.setFiles)
  const setReportText = useIndustryScoreStore((s) => s.setReportText)
  const setLlmConfig = useIndustryScoreStore((s) => s.setLlmConfig)
  const setShowConfig = useIndustryScoreStore((s) => s.setShowConfig)
  const loadHistory = useIndustryScoreStore((s) => s.loadHistory)
  const loadLogs = useIndustryScoreStore((s) => s.loadLogs)
  const runScore = useIndustryScoreStore((s) => s.runScore)

  // selectedCode 变化时加载历史和日志
  useEffect(() => {
    if (!selectedCode) return
    logger.info('[IndustryScorePage] selectedCode 变化，加载历史和日志', { selectedCode })
    void loadHistory(selectedCode)
    void loadLogs(selectedCode)
  }, [selectedCode, loadHistory, loadLogs])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = event.target.files
    if (!selected) return
    logger.info('[IndustryScorePage] 文件上传', { count: selected.length })
    setFiles(Array.from(selected))
  }

  const handleStart = async (): Promise<void> => {
    logger.info('[IndustryScorePage] 开始运行行业评分', { selectedCode })
    await runScore()
  }

  const runTooltip = loading
    ? '评分运行中，请稍候...'
    : !configReady
      ? 'LLM 未配置：请填写 baseURL、API Key 与模型名称后再运行评分'
      : undefined

  const runButton = (
    <Button onClick={() => void handleStart()} disabled={loading || !configReady} className="w-full">
      {loading ? '评分中...' : '运行行业智能评分'}
    </Button>
  )

  return (
    <PageContainer className="space-y-4">
      <Breadcrumb aria-label="breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/analysis">分析</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>V4 行业评分</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader title="V4 行业评分 · 第四次工业革命稀缺核心资源" />

      <Card>
        <CardContent className="space-y-4">
          <ScoreUpdateAlert
            lastScoredAt={previousResult?.scoredAt}
            onRefresh={() => void handleStart()}
            loading={loading}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择行业/赛道</label>
                <select
                  aria-label="选择行业赛道"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedCode}
                  onChange={(e) => setSelectedCode(e.target.value)}
                >
                  <option value="">请选择行业</option>
                  {sectors.map((sector) => (
                    <option key={sector.code} value={sector.code}>
                      {sector.name} {sector.isCore ? '⭐' : ''} (综合 {sector.composite})
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-2">
                  {HOT_TRACKS.map((hot) => (
                    <button
                      key={`${hot.sector}-${hot.track}`}
                      onClick={() => setSelectedCode(hot.sector)}
                      className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent"
                    >
                      {hot.track}
                    </button>
                  ))}
                </div>
              </div>

              {selectedSector && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{selectedSector.name}</p>
                  <p className="text-xs text-muted-foreground">
                    申万三级: {selectedSector.swLevel3.join(' / ')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedSector.subTracks.map((track) => (
                      <Badge key={track.name} variant="outline" className="text-xs">
                        {track.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">大模型配置</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfig((prev: boolean) => !prev)}
                  >
                    {showConfig ? '收起' : '展开'}
                  </Button>
                </div>
                {showConfig && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Input
                      placeholder="Base URL"
                      aria-label="大模型 Base URL"
                      value={llmConfig.baseURL}
                      onChange={(e) => setLlmConfig((prev: LlmConfig) => ({ ...prev, baseURL: e.target.value }))}
                    />
                    <Input
                      type="password"
                      placeholder="API Key"
                      aria-label="大模型 API Key"
                      value={llmConfig.apiKey}
                      onChange={(e) => setLlmConfig((prev: LlmConfig) => ({ ...prev, apiKey: e.target.value }))}
                    />
                    <Input
                      placeholder="Model"
                      aria-label="大模型 Model"
                      value={llmConfig.model}
                      onChange={(e) => setLlmConfig((prev: LlmConfig) => ({ ...prev, model: e.target.value }))}
                    />
                  </div>
                )}
                {!configReady && (
                  <p className="text-xs text-destructive">LLM 未配置，无法开始评分</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">补充资料上传</label>
                <Input type="file" multiple accept=".txt,.md,.json" aria-label="补充资料上传" onChange={handleFileChange} />
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {files.map((file) => (
                      <Badge key={file.name} variant="secondary">
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">行业分析报告 / 资料</label>
                <Textarea
                  placeholder="粘贴最新行业研报、政策文件、新闻事件等..."
                  aria-label="行业分析报告文本"
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  rows={5}
                />
              </div>

              {runTooltip ? (
                <Tooltip content={runTooltip} side="top">
                  {runButton}
                </Tooltip>
              ) : (
                runButton
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">评分进度</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {STEP_ORDER.map((step) => {
                    const status = progress[step]
                    const { label, description } = STEP_LABELS[step]
                    return (
                      <div key={step} className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {status === 'done' && <span className="text-primary">✓</span>}
                          {status === 'running' && <span className="animate-pulse text-primary">●</span>}
                          {status === 'error' && <span className="text-destructive">✕</span>}
                          {status === 'pending' && <span className="text-muted-foreground">○</span>}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                      </div>
                    )
                  })}
                  {progressMessage && <p className="text-xs text-muted-foreground">{progressMessage}</p>}
                </CardContent>
              </Card>

              {result && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      评分结果 · {result.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={cn('text-4xl font-bold', result.overallScore !== null && getScoreColorClass(result.overallScore))}>
                        {result.overallScore !== null ? result.overallScore.toFixed(2) : '—'}
                      </div>
                      <div className="text-sm text-muted-foreground">综合分 / 5.0</div>
                      {previousResult && previousResult.scoredAt !== result.scoredAt && (
                        <Badge variant={result.overallScore && previousResult.overallScore && result.overallScore > previousResult.overallScore ? 'default' : 'destructive'}>
                          较上次 {formatIndustryDelta(result.overallScore, previousResult.overallScore)}
                        </Badge>
                      )}
                    </div>

                    {/* 可视化：七维雷达图 + 维度得分柱状图 */}
                    <ScoreVisualizationBlock score={result} previous={previousResult} />

                    <div className="space-y-3">
                      {DIMENSION_ORDER.map((name) => {
                        const dimension = result.dimensionScores.find((d) => d.name === name)
                        const previousDimension = previousResult?.dimensionScores.find((d) => d.name === name)
                        if (!dimension) return null
                        return (
                          <div key={dimension.name}>
                            <Progress
                              value={dimension.score ?? 0}
                              label={`${dimension.name} ${dimension.score !== null ? dimension.score.toFixed(1) : 'N/A'} ${formatIndustryDelta(dimension.score, previousDimension?.score ?? null)}`}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">{dimension.rationale}</p>
                          </div>
                        )
                      })}
                    </div>

                    <div className="rounded-md bg-muted p-3">
                      <p className="text-sm font-medium">AI 总结</p>
                      <p className="text-sm text-muted-foreground">{result.summary}</p>
                    </div>

                    <ScoreFactorDeltaPanel current={result} previous={previousResult} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedSector && <IndustrySkillSnapshotCard sector={selectedSector} />}

      {history.length > 0 && <IndustryHistoryCard history={history} logs={logs} />}
    </PageContainer>
  )
}
