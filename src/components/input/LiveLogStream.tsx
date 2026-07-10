/**
 * @module LiveLogStream
 * @description 实时采集日志流组件。
 *
 * 按时间倒序展示采集生命周期事件日志，支持按级别过滤与一键清除。
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select, SelectItem } from '@/components/ui/Select'
import { COLOR_TOKENS } from '@/constants/theme.tokens'
import type { CollectionLog } from '@/types/modules/collection.types'

interface LiveLogStreamProps {
  logs: CollectionLog[]
  onClear?: () => void
  maxHeight?: string
}

const LEVEL_LABELS: Record<CollectionLog['level'], string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  success: '成功',
}

function levelColor(level: CollectionLog['level']) {
  switch (level) {
    case 'success':
      return COLOR_TOKENS.success
    case 'warn':
      return COLOR_TOKENS.warning
    case 'error':
      return COLOR_TOKENS.danger
    default:
      return COLOR_TOKENS.info
  }
}

export default function LiveLogStream({
  logs,
  onClear,
  maxHeight = '240px',
}: LiveLogStreamProps): React.JSX.Element {
  const [levelFilter, setLevelFilter] = useState<CollectionLog['level'] | 'all'>('all')

  const filteredLogs = useMemo(() => {
    if (levelFilter === 'all') return logs
    return logs.filter((log) => log.level === levelFilter)
  }, [logs, levelFilter])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">实时日志流</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={levelFilter}
              onValueChange={(value) => setLevelFilter(value as CollectionLog['level'] | 'all')}
              className="h-7 w-28 text-xs"
            >
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="info">信息</SelectItem>
              <SelectItem value="warn">警告</SelectItem>
              <SelectItem value="error">错误</SelectItem>
              <SelectItem value="success">成功</SelectItem>
            </Select>
            {onClear && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                清除
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLogs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">暂无日志</p>
        ) : (
          <div
            className="space-y-1 overflow-auto rounded-md border p-2"
            style={{ maxHeight }}
          >
            {filteredLogs.map((log) => {
              const color = levelColor(log.level)
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 border-b py-1 text-xs last:border-b-0"
                >
                  <span className="shrink-0 text-muted-foreground">{log.time}</span>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px]"
                    style={{ color: color.hex, borderColor: color.hex }}
                  >
                    {LEVEL_LABELS[log.level]}
                  </Badge>
                  {log.dimensionCode && (
                    <span className="shrink-0 text-muted-foreground">[{log.dimensionCode}]</span>
                  )}
                  {log.sourceId && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {log.sourceId}
                    </Badge>
                  )}
                  <span className="flex-1 break-all">{log.message}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
