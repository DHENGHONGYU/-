import React, { useEffect, useState } from 'react'
import { Badge } from '@/components/atoms/Badge'
import { Brain, Download } from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Input } from '@/components/atoms/Input'
import { Progress } from '@/components/atoms/Progress'
import { Textarea } from '@/components/atoms/Textarea'
import { Tooltip } from '@/components/atoms/Tooltip'
import { ScoreFactorDeltaPanel } from '@/components/organisms/shared/ScoreFactorDeltaPanel'
import { ScoreUpdateAlert } from '@/components/organisms/shared/ScoreUpdateAlert'
import { PageContainer, PageHeader } from '@/components/templates'
import { MultiPeriodTrendChart } from '@/components/organisms/analysis/score/MultiPeriodTrendChart'
import { IntelligentScoreExplanation } from '@/components/organisms/analysis/score/IntelligentScoreExplanation'
import type { ScoreTrendPeriod } from '@/types/modules/score.types'
import { IntelligentScoreBasisCard } from '@/components/cabin/IntelligentScoreBasisCard'
import { ComplianceDisclaimer } from '@/components/atoms/ComplianceDisclaimer'
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
import type { IntelligentScore } from '@/data/types'
import { COLOR_SHADES } from '@/constants/theme.tokens'

const logger = getLogger()

// 导出工具函数
function exportToJSON(score: IntelligentScore): void {
  const data = {
    symbol: score.symbol,
    name: score.sourceSnapshot.stock?.name,
    overallScore: score.overallScore,
    scoredAt: score.scoredAt,
    dimensions: score.dimensionScores,
    summary: score.summary,
    basis: score.basis,
    missingFields: score.missingFields,
    model: score.configSnapshot.model,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${score.symbol}-score-${new Date(score.scoredAt).toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  logger.info('[IntelligentScorePage] 导出 JSON', { symbol: score.symbol })
}

function exportToMarkdown(score: IntelligentScore): void {
  const date = new Date(score.scoredAt).toLocaleString('zh-CN')
  const stockName = score.sourceSnapshot.stock?.name ?? ''
  const md = `# ${score.symbol} ${stockName} 智能评分报告

**评分时间**: ${date}  
**综合评分**: ${score.overallScore?.toFixed(2) ?? 'N/A'} / 5.0  
**使用模型**: ${score.configSnapshot.model}

## 维度评分

${score.dimensionScores.map(d => `- **${d.name}**: ${d.score?.toFixed(1) ?? 'N/A'}${(d.usedLlm ?? false) ? ' (LLM增强)' : ''}`).join('\n')}

## 评分依据

${score.basis}

## AI 总结

${score.summary}

## 缺失数据

${score.missingFields.length > 0 ? score.missingFields.map(f => `- ${f}`).join('\n') : '无缺失字段'}

---
*由 V9 智能投研复盘系统生成*
`
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${score.symbol}-score-${new Date(score.scoredAt).toISOString().split('T')[0]}.md`
  a.click()
  URL.revokeObjectURL(url)
  logger.info('[IntelligentScorePage] 导出 Markdown', { symbol: score.symbol })
}

function exportToPDF(score: IntelligentScore): void {
  // 创建打印友好的 HTML 内容
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const date = new Date(score.scoredAt).toLocaleString('zh-CN')
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${score.symbol} 智能评分报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: ${COLOR_SHADES.gray.hex[800]}; }
    h1 { color: ${COLOR_SHADES.emerald.hex[500]}; border-bottom: 2px solid ${COLOR_SHADES.emerald.hex[500]}; padding-bottom: 10px; }
    h2 { color: ${COLOR_SHADES.emerald.hex[600]}; margin-top: 30px; }
    .score { font-size: 48px; font-weight: bold; color: ${COLOR_SHADES.emerald.hex[500]}; }
    .meta { color: ${COLOR_SHADES.gray.hex[500]}; margin: 20px 0; }
    .dimension { margin: 15px 0; padding: 15px; background: ${COLOR_SHADES.gray.hex[100]}; border-radius: 8px; }
    .dimension-name { font-weight: bold; color: ${COLOR_SHADES.emerald.hex[600]}; }
    .dimension-score { float: right; font-size: 18px; font-weight: bold; }
    .llm-badge { background: ${COLOR_SHADES.blue.hex[100]}; color: ${COLOR_SHADES.blue.hex[700]}; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; }
    .basis { background: ${COLOR_SHADES.amber.hex[100]}; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .summary { background: ${COLOR_SHADES.emerald.hex[50]}; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .missing { color: ${COLOR_SHADES.red.hex[600]}; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid ${COLOR_SHADES.gray.hex[300]}; color: ${COLOR_SHADES.gray.hex[400]}; font-size: 12px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${score.symbol} ${score.sourceSnapshot.stock?.name ?? ''} 智能评分报告</h1>
  <div class="meta">
    <p><strong>评分时间</strong>: ${date}</p>
    <p><strong>使用模型</strong>: ${score.configSnapshot.model}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <div class="score">${score.overallScore?.toFixed(2) ?? 'N/A'}</div>
    <div style="color: ${COLOR_SHADES.gray.hex[500]};">综合评分 / 5.0</div>
  </div>

  <h2>维度评分</h2>
  ${score.dimensionScores.map(d => `
    <div class="dimension">
      <span class="dimension-name">${d.name}</span>
      <span class="dimension-score">${d.score?.toFixed(1) ?? 'N/A'}</span>
      ${(d.usedLlm ?? false) ? '<span class="llm-badge">LLM增强</span>' : ''}
      <div style="margin-top: 10px; color: ${COLOR_SHADES.gray.hex[500]}; font-size: 14px;">${d.rationale}</div>
    </div>
  `).join('')}

  <h2>评分依据</h2>
  <div class="basis">${score.basis}</div>

  <h2>AI 总结</h2>
  <div class="summary">${score.summary}</div>

  <h2>缺失数据</h2>
  <div class="missing">
    ${score.missingFields.length > 0 ? score.missingFields.map(f => `<p>• ${f}</p>`).join('') : '<p>无缺失字段</p>'}
  </div>

  <div class="footer">
    <p>由 V9 智能投研复盘系统生成 | ${date}</p>
  </div>

  <script>
    window.onload = function() {
      window.print();
    }
  </script>
</body>
</html>
`
  printWindow.document.write(html)
  printWindow.document.close()
  logger.info('[IntelligentScorePage] 导出 PDF', { symbol: score.symbol })
}

/**
 * IntelligentScorePage
 */
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
    if (symbol) {
      logger.info('[IntelligentScorePage] 加载评分趋势', { symbol, trendPeriod })
      void loadScoreTrend(symbol, trendPeriod)
    }
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
    <PageContainer className="space-y-4">
      <PageHeader title="V6 个股智能评分" description="多源资料综合评估" />

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
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        评分结果 · {result.symbol}
                        {(result.configSnapshot.v6EngineVersion ?? '') !== '' && (
                          <Badge variant="secondary" className="ml-2 text-xs" title={`v6 引擎版本 ${result.configSnapshot.v6EngineVersion}`}>
                            V6 实时因子
                          </Badge>
                        )}
                        {(result.configSnapshot.v6EngineVersion ?? '') === '' && !result.dimensionScores.some((d) => (d.usedLlm ?? false)) && (
                          <Badge variant="outline" className="ml-2 text-xs" title="当前为合成示例数据，非真实引擎信号">
                            示例 · LLM 合成
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Tooltip content="导出 JSON">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportToJSON(result)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="导出 Markdown">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportToMarkdown(result)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="导出 PDF">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportToPDF(result)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="text-4xl font-bold text-primary">
                        {result.overallScore !== null ? result.overallScore.toFixed(2) : '—'}
                      </div>
                      <div className="text-sm text-muted-foreground">综合分 / 5.0</div>
                      {previousResult && previousResult.scoredAt !== result.scoredAt && (
                        <Badge variant={(result.overallScore ?? 0) > 0 && (previousResult.overallScore ?? 0) > 0 && (result.overallScore ?? 0) > (previousResult.overallScore ?? 0) ? 'default' : 'destructive'}>
                          较上次 {formatIntelligentDelta(result.overallScore, previousResult.overallScore)}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-4">
                      {DIMENSION_ORDER.map((name) => {
                        const dimension = result.dimensionScores.find((d) => d.name === name)
                        const previousDimension = previousResult?.dimensionScores.find((d) => d.name === name)
                        if (!dimension) return null
                        return (
                          <div key={dimension.name} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={dimension.score ?? 0}
                                label={`${dimension.name} ${dimension.score !== null ? dimension.score.toFixed(1) : 'N/A'} ${formatIntelligentDelta(dimension.score, previousDimension?.score ?? null)}`}
                              />
                              {(dimension.usedLlm ?? false) && (
                                <Badge variant="secondary" className="text-xs" title="该因子使用了 LLM 增强分析">
                                  <Brain className="mr-1 h-3 w-3" />
                                  LLM
                                </Badge>
                              )}
                            </div>
                            <div className="rounded-md bg-muted/50 p-3 space-y-2">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">评分依据</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {dimension.rationale}
                                </p>
                              </div>
                              {dimension.evidence !== null && dimension.evidence !== undefined && dimension.evidence.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">支撑证据</p>
                                  <ul className="mt-1 space-y-1">
                                    {dimension.evidence.map((item, idx) => (
                                      <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                        <span className="text-primary mt-0.5">•</span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
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

      {/* 合规层 — 免责声明 */}
      <ComplianceDisclaimer variant="compact" />
    </PageContainer>
  )
}
