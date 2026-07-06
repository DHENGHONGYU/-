import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { Textarea } from '@/components/ui/Textarea'
import { Tooltip } from '@/components/ui/Tooltip'
import { ScoreFactorDeltaPanel } from '@/components/ScoreFactorDeltaPanel'
import { ScoreUpdateAlert } from '@/components/ScoreUpdateAlert'
import { MultiPeriodTrendChart } from '@/components/analysis/score/MultiPeriodTrendChart'
import { IntelligentScoreExplanation } from '@/components/analysis/score/IntelligentScoreExplanation'
import type { ScoreTrendPeriod } from '@/types/modules/score.types'
import { IntelligentScoreBasisCard } from '@/components/cabin/IntelligentScoreBasisCard'
import {
  useIntelligentScoreStore,
  selectConfigReady,
  STEP_LABELS,
  STEP_ORDER,
  DIMENSION_ORDER,
  formatIntelligentDelta,
} from '@/store/intelligentScoreStore'
import { DEFAULT_LLM_BASE_URL, type LlmConfig } from '@/config/llmConfig'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export default function IntelligentScorePage(): React.JSX.Element {
  // 从 Store 获取状态
  const symbol = useIntelligentScoreStore((s) => s.symbol)
  const stocks = useIntelligentScoreStore((s) => s.stocks)
  const files = useIntelligentScoreStore((s) => s.files)
  const reportText = useIntelligentScoreStore((s) => s.reportText)
  const llmConfig = useIntelligentScoreStore((s) => s.llmConfig)
  const showConfig = useIntelligentScoreStore((s) => s.showConfig)
  const configReady = useIntelligentScoreStore(selectConfigReady)
  const progress = useIntelligentScoreStore((s) => s.progress)
  const progressMessage = useIntelligentScoreStore((s) => s.progressMessage)
  const result = useIntelligentScoreStore((s) => s.result)
  const previousResult = useIntelligentScoreStore((s) => s.previousResult)
  const history = useIntelligentScoreStore((s) => s.history)
  const logs = useIntelligentScoreStore((s) => s.logs)
  const error = useIntelligentScoreStore((s) => s.error)
  const loading = useIntelligentScoreStore((s) => s.loading)
  const trendData = useIntelligentScoreStore((s) => s.trendData)
  const trendLoading = useIntelligentScoreStore((s) => s.trendLoading)
  const trendError = useIntelligentScoreStore((s) => s.trendError)

  // 从 Store 获取 actions
  const setSymbol = useIntelligentScoreStore((s) => s.setSymbol)
  const setFiles = useIntelligentScoreStore((s) => s.setFiles)
  const setReportText = useIntelligentScoreStore((s) => s.setReportText)
  const setLlmConfig = useIntelligentScoreStore((s) => s.setLlmConfig)
  const setShowConfig = useIntelligentScoreStore((s) => s.setShowConfig)
  const loadStocks = useIntelligentScoreStore((s) => s.loadStocks)
  const loadHistory = useIntelligentScoreStore((s) => s.loadHistory)
  const loadLogs = useIntelligentScoreStore((s) => s.loadLogs)
  const runScore = useIntelligentScoreStore((s) => s.runScore)
  const loadScoreTrend = useIntelligentScoreStore((s) => s.loadScoreTrend)

  // 初始化加载股票列表
  useEffect(() => {
    logger.info('[IntelligentScorePage] 初始化，加载股票列表')
    void loadStocks()
  }, [loadStocks])

  // symbol 变化时加载历史和日志
  useEffect(() => {
    if (!symbol) {
      logger.info('[IntelligentScorePage] symbol 为空，清空历史和日志')
      return
    }
    logger.info('[IntelligentScorePage] symbol 变化，加载历史和日志', { symbol })
    void loadHistory(symbol)
    void loadLogs(symbol)
  }, [symbol, loadHistory, loadLogs])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selected = event.target.files
    if (!selected) return
    logger.info('[IntelligentScorePage] 文件上传', { count: selected.length })
    setFiles(Array.from(selected))
  }

  const handleStart = async (): Promise<void> => {
    logger.info('[IntelligentScorePage] 开始运行智能评分', { symbol })
    await runScore()
  }

  // 多周期趋势数据（通过 Store 管理）
  const [trendPeriod, setTrendPeriod] = useState<ScoreTrendPeriod>('month')

  useEffect(() => {
    if (!symbol) return
    logger.info('[IntelligentScorePage] 加载评分趋势', { symbol, trendPeriod })
    void loadScoreTrend(symbol, trendPeriod)
  }, [symbol, trendPeriod, loadScoreTrend])

  const runTooltip = loading
    ? '评分运行中，请稍候...'
    : !configReady
      ? 'LLM 未配置：请填写 baseURL、API Key 与模型名称后再运行评分'
      : undefined

  const runButton = (
    <Button onClick={() => void handleStart()} disabled={loading || !configReady} className="w-full">
      {loading ? '评分中...' : '开始智能评分'}
    </Button>
  )

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>V6 个股智能评分 · 多源资料综合评估</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScoreUpdateAlert
            lastScoredAt={previousResult?.scoredAt}
            onRefresh={() => void handleStart()}
            loading={loading}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择标的</label>
                <select
                  aria-label="选择标的股票"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                >
                  <option value="">请输入或选择股票代码</option>
                  {stocks.map((stock) => (
                    <option key={stock.symbol} value={stock.symbol}>
                      {stock.symbol} · {stock.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="或直接输入代码，如 600519.SH"
                  aria-label="手动输入股票代码"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                />
              </div>

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
                      placeholder={`Base URL，如 ${DEFAULT_LLM_BASE_URL}/v1`}
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
                      placeholder="Model，如 deepseek-chat / deepseek-reasoner"
                      aria-label="大模型 Model"
                      value={llmConfig.model}
                      onChange={(e) => setLlmConfig((prev: LlmConfig) => ({ ...prev, model: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      支持 OpenAI 兼容接口，推荐 DeepSeek / Kimi / 硅基流动等国内模型。
                    </p>
                  </div>
                )}
                {!configReady && (
                  <p className="text-xs text-destructive">LLM 未配置，无法开始评分</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">补充资料上传</label>
                <Input
                  type="file"
                  multiple
                  accept=".txt,.md,.json"
                  aria-label="补充资料上传"
                  onChange={handleFileChange}
                />
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
                  placeholder="在此粘贴行业分析报告、研报摘要、关键事件等文本..."
                  aria-label="分析报告文本"
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
                  {progressMessage && (
                    <p className="text-xs text-muted-foreground">{progressMessage}</p>
                  )}
                </CardContent>
              </Card>

              {result && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      评分结果 · {result.symbol}
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
                          较上次 {formatIntelligentDelta(result.overallScore, previousResult.overallScore)}
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
                              label={`${dimension.name} ${dimension.score !== null ? dimension.score.toFixed(1) : 'N/A'} ${formatIntelligentDelta(dimension.score, previousDimension?.score ?? null)}`}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              {dimension.rationale}
                            </p>
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

      {/* 多周期趋势图表 + 智能评分解释 */}
      {symbol && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MultiPeriodTrendChart
            data={trendData}
            period={trendPeriod}
            onPeriodChange={setTrendPeriod}
            loading={trendLoading}
            error={trendError}
          />
          {result && <IntelligentScoreExplanation result={result} />}
        </div>
      )}

      {result && <IntelligentScoreBasisCard result={result} history={history} logs={logs} />}
    </div>
  )
}
