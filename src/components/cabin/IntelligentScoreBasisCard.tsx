import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import type { IntelligentScore, ResearchLog } from '@/data/types'
import { COLOR_TOKENS } from '@/constants/theme.tokens'

interface Props {
  result: IntelligentScore
  history: IntelligentScore[]
  logs: ResearchLog[]
}

function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null) return '数据缺失'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/**
 * IntelligentScoreBasisCard
 * @param history
 * @param logs }
 */
export function IntelligentScoreBasisCard({ result, history, logs }: Props): React.JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleToggleSelect = (recordId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) {
        next.delete(recordId)
      } else {
        next.add(recordId)
      }
      return next
    })
  }

  const handleClearSelection = (): void => {
    setSelectedIds(new Set())
  }

  const selectedRecords = history.filter((r) => {
    const id = String(r.id ?? r.scoredAt)
    return selectedIds.has(id)
  })

  const getRecordId = (record: IntelligentScore): string => String(record.id ?? record.scoredAt)

  return (
    <Card>
      <CardHeader>
        <CardTitle>评分依据补充说明</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">基础数据快照</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>代码: {result.sourceSnapshot.stock?.symbol ?? '—'}</li>
              <li>名称: {result.sourceSnapshot.stock?.name ?? '—'}</li>
              <li>价格: {formatFieldValue(result.sourceSnapshot.stock?.price)}</li>
              <li>PE: {formatFieldValue(result.sourceSnapshot.stock?.pe)}</li>
              <li>PB: {formatFieldValue(result.sourceSnapshot.stock?.pb)}</li>
              <li>ROE: {formatFieldValue(result.sourceSnapshot.stock?.roe)}</li>
              <li>市值: {formatFieldValue(result.sourceSnapshot.stock?.marketCap)}</li>
            </ul>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">补充资料</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>上传文件: {result.sourceSnapshot.fileNames.join(', ') || '无'}</li>
              <li>报告字数: {result.sourceSnapshot.reportLength}</li>
              <li>使用模型: {result.configSnapshot.model || '—'}</li>
            </ul>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">缺失数据</p>
            {result.missingFields.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-destructive">
                {result.missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">无缺失字段</p>
            )}
          </div>
        </div>

        <div className="rounded-md bg-muted p-3">
          <p className="text-sm font-medium">评分结论依据</p>
          <p className="text-sm text-muted-foreground">{result.basis}</p>
        </div>

        {history.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">评分历史记录</p>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">已选择 {selectedIds.size} 条</Badge>
                  <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                    清除选择
                  </Button>
                </div>
              )}
            </div>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        aria-label="全选"
                        checked={selectedIds.size === history.length && history.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(history.map(getRecordId)))
                          } else {
                            setSelectedIds(new Set())
                          }
                        }}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">时间</th>
                    <th className="px-3 py-2 text-left">综合分</th>
                    <th className="px-3 py-2 text-left">综合分Δ</th>
                    <th className="px-3 py-2 text-left">最大变化因子</th>
                    <th className="px-3 py-2 text-left">模型</th>
                    <th className="px-3 py-2 text-left">缺失字段</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record, index) => {
                    const recordId = getRecordId(record)
                    const prev = history[index + 1]
                    const overallDelta = record.overallScore !== null && prev?.overallScore !== null && prev?.overallScore !== undefined
                      ? record.overallScore - prev.overallScore
                      : null
                    const deltas = record.dimensionScores
                      .map((d) => {
                        const pd = prev?.dimensionScores.find((p) => p.name === d.name)
                        if (d.score === null || pd?.score === null || pd?.score === undefined) return null
                        return { name: d.name, delta: d.score - pd.score }
                      })
                      .filter((item): item is { name: string; delta: number } => item !== null)
                    const maxDelta = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
                    const isSelected = selectedIds.has(recordId)
                    return (
                      <tr key={recordId} className={`border-t ${isSelected ? 'bg-primary/5' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`选择 ${new Date(record.scoredAt).toLocaleString()}`}
                            checked={isSelected}
                            onChange={() => handleToggleSelect(recordId)}
                          />
                        </td>
                        <td className="px-3 py-2">{new Date(record.scoredAt).toLocaleString()}</td>
                        <td className="px-3 py-2">{record.overallScore?.toFixed(2) ?? 'N/A'}</td>
                        <td className="px-3 py-2">
                          {overallDelta !== null ? (
                            <span className={overallDelta > 0 ? COLOR_TOKENS.up.tailwind : overallDelta < 0 ? COLOR_TOKENS.down.tailwind : ''}>
                              {overallDelta > 0 ? '+' : ''}{overallDelta.toFixed(2)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {maxDelta ? `${maxDelta.name} ${maxDelta.delta > 0 ? '+' : ''}${maxDelta.delta.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-2">{record.configSnapshot.model}</td>
                        <td className="px-3 py-2">{record.missingFields.join(', ') || '无'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {selectedRecords.length >= 2 && (
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">维度对比（已选 {selectedRecords.length} 条记录）</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">维度</th>
                        {selectedRecords.map((record) => (
                          <th key={getRecordId(record)} className="px-3 py-2 text-left">
                            {new Date(record.scoredAt).toLocaleDateString()}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-left">变化范围</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecords[0]?.dimensionScores.map((dimension) => {
                        const dimensionName = dimension.name
                        const scores = selectedRecords.map((record) => {
                          const dim = record.dimensionScores.find((d) => d.name === dimensionName)
                          return dim?.score ?? null
                        })
                        const validScores = scores.filter((s): s is number => s !== null)
                        const minScore = validScores.length > 0 ? Math.min(...validScores) : null
                        const maxScore = validScores.length > 0 ? Math.max(...validScores) : null
                        const range = minScore !== null && maxScore !== null ? maxScore - minScore : null

                        return (
                          <tr key={dimensionName} className="border-t">
                            <td className="px-3 py-2 font-medium">{dimensionName}</td>
                            {scores.map((score, idx) => (
                              <td key={idx} className="px-3 py-2">
                                {score !== null ? score.toFixed(2) : 'N/A'}
                              </td>
                            ))}
                            <td className="px-3 py-2">
                              {range !== null ? (
                                <Badge variant="secondary">
                                  {range.toFixed(2)}
                                </Badge>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="border-t bg-muted/50">
                        <td className="px-3 py-2 font-medium">综合分</td>
                        {selectedRecords.map((record) => (
                          <td key={getRecordId(record)} className="px-3 py-2 font-medium">
                            {record.overallScore?.toFixed(2) ?? 'N/A'}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {(() => {
                            const overallScores = selectedRecords
                              .map((r) => r.overallScore)
                              .filter((s): s is number => s !== null)
                            if (overallScores.length === 0) return '—'
                            const range = Math.max(...overallScores) - Math.min(...overallScores)
                            return <Badge variant="secondary">{range.toFixed(2)}</Badge>
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedIds.size > 0 && selectedIds.size < 2 && (
              <p className="text-xs text-muted-foreground">
                请至少选择 2 条记录以进行维度对比
              </p>
            )}
          </div>
        )}

        {logs.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">操作日志</p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-muted-foreground">
              {logs.slice(-10).map((log) => (
                <li key={log.id ?? log.timestamp}>
                  {new Date(log.timestamp).toLocaleString()} · {log.action} · {log.actor}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p className="font-medium">补充界面说明</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>综合分仅由“已取到有效数据”的维度等权平均计算；若某维度数据缺失，该维度显示为 N/A 且不计入综合分。</li>
            <li>上传本地文件或填写行业报告后，大模型会结合三源资料重新评分，未取到的字段不会使用默认值。</li>
            <li>评分依据中的证据链来自模型对输入资料的引用，缺失数据会在“缺失数据”区域标红展示。</li>
            <li>如需使用 DeepSeek 等国内模型，请在 LLM 配置中填写对应的 OpenAI 兼容接口地址和模型名。</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
