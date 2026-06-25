import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { Textarea } from '@/components/ui/Textarea'
import { Tooltip } from '@/components/ui/Tooltip'
import { ScoreFactorDeltaPanel } from '@/components/ScoreFactorDeltaPanel'
import { ScoreUpdateAlert } from '@/components/ScoreUpdateAlert'
import { IndustrySkillSnapshotCard } from '@/components/cabin/IndustrySkillSnapshotCard'
import { IndustryHistoryCard } from '@/components/cabin/IndustryHistoryCard'
import { HOT_TRACKS } from '@/data/sectorSkillData'
import {
  useIndustryScorePage,
  STEP_LABELS,
  STEP_ORDER,
  DIMENSION_ORDER,
  formatIndustryDelta,
} from '@/hooks/cabin/useIndustryScorePage'

export default function IndustryScorePage(): React.JSX.Element {
  const {
    selectedCode,
    setSelectedCode,
    sectors,
    selectedSector,
    files,
    reportText,
    setReportText,
    llmConfig,
    setLlmConfig,
    showConfig,
    setShowConfig,
    configReady,
    progress,
    progressMessage,
    result,
    previousResult,
    history,
    logs,
    error,
    loading,
    handleFileChange,
    handleStart,
  } = useIndustryScorePage()

  const runTooltip = loading
    ? '评分运行中，请稍候...'
    : !configReady
      ? 'LLM 未配置：请填写 baseURL、API Key 与模型名称后再运行评分'
      : undefined

  const runButton = (
    <Button onClick={handleStart} disabled={loading || !configReady} className="w-full">
      {loading ? '评分中...' : '运行行业智能评分'}
    </Button>
  )

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>V4 行业评分 · 第四次工业革命稀缺核心资源</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreUpdateAlert
            lastScoredAt={previousResult?.scoredAt}
            onRefresh={handleStart}
            loading={loading}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择行业/赛道</label>
                <select
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
                    onClick={() => setShowConfig((prev) => !prev)}
                  >
                    {showConfig ? '收起' : '展开'}
                  </Button>
                </div>
                {showConfig && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Input
                      placeholder="Base URL"
                      value={llmConfig.baseURL}
                      onChange={(e) => setLlmConfig((prev) => ({ ...prev, baseURL: e.target.value }))}
                    />
                    <Input
                      type="password"
                      placeholder="API Key"
                      value={llmConfig.apiKey}
                      onChange={(e) => setLlmConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    />
                    <Input
                      placeholder="Model"
                      value={llmConfig.model}
                      onChange={(e) => setLlmConfig((prev) => ({ ...prev, model: e.target.value }))}
                    />
                  </div>
                )}
                {!configReady && (
                  <p className="text-xs text-destructive">LLM 未配置，无法开始评分</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">补充资料上传</label>
                <Input type="file" multiple accept=".txt,.md,.json" onChange={handleFileChange} />
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
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl font-bold text-primary">
                        {result.overallScore !== null ? result.overallScore.toFixed(2) : '—'}
                      </div>
                      <div className="text-sm text-muted-foreground">综合分 / 5.0</div>
                      {previousResult && previousResult.scoredAt !== result.scoredAt && (
                        <Badge variant={result.overallScore && previousResult.overallScore && result.overallScore > previousResult.overallScore ? 'default' : 'destructive'}>
                          较上次 {formatIndustryDelta(result.overallScore, previousResult.overallScore)}
                        </Badge>
                      )}
                    </div>

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
    </div>
  )
}
