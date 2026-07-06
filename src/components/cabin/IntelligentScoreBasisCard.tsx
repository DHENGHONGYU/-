import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { IntelligentScore, ResearchLog } from '@/data/types'

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

export function IntelligentScoreBasisCard({ result, history, logs }: Props): React.JSX.Element {
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
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
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
                  return (
                    <tr key={record.id ?? record.scoredAt} className="border-t">
                      <td className="px-3 py-2">{new Date(record.scoredAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{record.overallScore?.toFixed(2) ?? 'N/A'}</td>
                      <td className="px-3 py-2">
                        {overallDelta !== null ? `${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(2)}` : '—'}
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
