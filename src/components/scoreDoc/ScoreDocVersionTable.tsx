import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import React from 'react'
import { twText } from '@/constants/theme.tokens'
import type { ScoreDocVersion } from '@/data/types'

export interface ScoreDocVersionTableProps {
  versions: ScoreDocVersion[]
}

function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * ScoreDocVersionTable
 */
export default function ScoreDocVersionTable({
  versions,
}: ScoreDocVersionTableProps): React.JSX.Element {
  if (versions.length === 0) {
    return <p className="text-muted-foreground">暂无评分记录</p>
  }

  const latestVersion = versions.reduce((latest, current) =>
    current.version > latest.version ? current : latest,
  )

  const handleDownload = (doc: ScoreDocVersion): void => {
    const filename = `V6评分报告_${doc.symbol}_V${doc.version}_${doc.scoreDate}.md`
    downloadMarkdown(doc.reportMd, filename)
  }

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>版本号</TableHead>
            <TableHead>评分日期</TableHead>
            <TableHead>综合分</TableHead>
            <TableHead>L3V</TableHead>
            <TableHead>与上一版差异</TableHead>
            <TableHead>模型</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((doc) => (
            <TableRow key={doc.docId}>
              <TableCell>V{doc.version}</TableCell>
              <TableCell>{doc.scoreDate}</TableCell>
              <TableCell>{doc.composite.toFixed(2)}</TableCell>
              <TableCell>{doc.l3v.toFixed(2)}</TableCell>
              <TableCell>
                {doc.changeFromPrev ? (
                  <span
                    className={
                      doc.changeFromPrev.compositeDelta > 0
                        ? twText('green', 600)
                        : doc.changeFromPrev.compositeDelta < 0
                          ? twText('red', 600)
                          : 'text-muted-foreground'
                    }
                  >
                    {`${doc.changeFromPrev.compositeDelta > 0 ? '+' : ''}${doc.changeFromPrev.compositeDelta.toFixed(2)}`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{doc.modelUsed}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  aria-label={`下载 Markdown：V6评分报告_${doc.symbol}_V${doc.version}_${doc.scoreDate}.md`}
                >
                  下载 Markdown
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Card>
        <CardHeader>
          <CardTitle>维度变化（最新版 V{latestVersion.version}）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(latestVersion.layers).map(([code, layer]) => (
              <div key={code} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{code}</p>
                <p className="text-lg font-semibold">{layer.score.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">权重 {layer.weight}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
