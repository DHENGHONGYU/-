import React, { useState } from 'react'
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Badge } from '@/components/ui/Badge'
import { mockImportRows, mockTasks, type MockImportRow, type MockTask } from './mockData'

function RowStatus({ row }: { row: MockImportRow }): React.JSX.Element {
  if (row.status === 'valid')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> 有效
      </span>
    )
  if (row.status === 'duplicate')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
        <AlertCircle className="h-3.5 w-3.5" /> 重复
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-400">
      <XCircle className="h-3.5 w-3.5" /> {row.error}
    </span>
  )
}

function TaskStatus({ task }: { task: MockTask }): React.JSX.Element {
  const icons = {
    pending: <span className="h-3.5 w-3.5 rounded-full bg-muted" />,
    running: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {icons[task.status]}
      {task.message}
    </span>
  )
}

export default function BulkImportProto(): React.JSX.Element {
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showResult, setShowResult] = useState(false)

  const validCount = mockImportRows.filter((r) => r.status === 'valid').length
  const duplicateCount = mockImportRows.filter((r) => r.status === 'duplicate').length
  const invalidCount = mockImportRows.filter((r) => r.status === 'invalid').length

  const handleImport = (): void => {
    setImporting(true)
    setShowResult(true)
    setProgress(0)
    let p = 0
    const timer = setInterval(() => {
      p += 25
      setProgress(p)
      if (p >= 100) {
        clearInterval(timer)
        setImporting(false)
      }
    }, 400)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>批量导入（原型）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            支持 代码,名称 / 代码 名称 / 代码.SH 多种格式，上限 40 只
          </p>
          <textarea
            className="min-h-[120px] w-full rounded-md border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
            defaultValue={`600519,贵州茅台\n000001,平安银行\n300750,宁德时代\n999999,不存在`}
          />

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge className="bg-emerald-500/20 text-emerald-400">有效 {validCount}</Badge>
            <Badge className="bg-yellow-500/20 text-yellow-400">重复 {duplicateCount}</Badge>
            <Badge variant="destructive">无效 {invalidCount}</Badge>
            <span className="text-muted-foreground">共 {mockImportRows.length} 行</span>
          </div>

          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left">状态</th>
                  <th className="px-3 py-2 text-left">代码</th>
                  <th className="px-3 py-2 text-left">名称</th>
                  <th className="px-3 py-2 text-left">标准化代码</th>
                  <th className="px-3 py-2 text-left">说明</th>
                </tr>
              </thead>
              <tbody>
                {mockImportRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`border-t ${
                      row.status === 'invalid' ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <RowStatus row={row} />
                    </td>
                    <td className="px-3 py-2">{row.code || '-'}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 font-mono">{row.symbol || '-'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.status === 'duplicate' ? '已存在于候选池' : row.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary">清空</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? '导入中...' : `确认导入 (${validCount})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showResult && (
        <Card>
          <CardHeader>
            <CardTitle>导入进度与结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} max={100} showMax={false} label="总体进度" />
            <div className="space-y-2">
              {mockTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span className="font-mono">{task.symbol}</span>
                  <TaskStatus task={task} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
