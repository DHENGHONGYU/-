/**
 * @module LiveLogStream
 * @description 实时采集日志流组件（v2）。
 *
 * 按时间倒序展示采集生命周期事件日志，支持：
 * - 按级别过滤（全部/信息/警告/错误/成功）
 * - 按维度过滤（全部/01-08）
 * - 按股票代码搜索
 * - 日志计数摘要
 * - 长消息展开/折叠
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import { Button } from '@/components/atoms/Button'
import { Select, SelectItem } from '@/components/atoms/Select'
import { Input } from '@/components/atoms/Input'
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

/** 维度选项 */
const DIM_OPTIONS = [
  { value: 'all', label: '全部维度' },
  { value: '01', label: '01 基本信息' },
  { value: '02', label: '02 K线数据' },
  { value: '03', label: '03 筹码分布' },
  { value: '04', label: '04 重大事项' },
  { value: '05', label: '05 热点新闻' },
  { value: '06', label: '06 行业竞品' },
  { value: '07', label: '07 关联指数' },
  { value: '08', label: '08 研报中心' },
] as const

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

/** 截断阈值：超过此长度的消息可展开/折叠 */
const MESSAGE_TRUNCATE_LENGTH = 120

/**
 * LiveLogStream
 */
export default function LiveLogStream({
  logs,
  onClear,
  maxHeight = '240px',
}: LiveLogStreamProps): React.JSX.Element {
  const [levelFilter, setLevelFilter] = useState<CollectionLog['level'] | 'all'>('all')
  const [dimFilter, setDimFilter] = useState<string>('all')
  const [symbolSearch, setSymbolSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false
      if (dimFilter !== 'all' && log.dimensionCode !== dimFilter) return false
      if (symbolSearch.trim()) {
        const q = symbolSearch.trim().toUpperCase()
        if (!log.message.toUpperCase().includes(q) && !log.symbol?.toUpperCase().includes(q)) return false
      }
      return true
    })
  }, [logs, levelFilter, dimFilter, symbolSearch])

  const toggleExpand = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 级别统计
  const levelCounts = useMemo(() => {
    const counts = { info: 0, warn: 0, error: 0, success: 0 }
    logs.forEach((log) => { counts[log.level]++ })
    return counts
  }, [logs])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">实时日志流</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {filteredLogs.length} / {logs.length}
            </Badge>
            {levelCounts.error > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {levelCounts.error} 错误
              </Badge>
            )}
            {levelCounts.warn > 0 && (
              <Badge className="text-[10px]" style={{ backgroundColor: COLOR_TOKENS.warning.hex, color: 'white' }}>
                {levelCounts.warn} 警告
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-7 w-32 text-xs"
              placeholder="搜索股票/消息..."
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value)}
            />
            <Select
              value={dimFilter}
              onValueChange={setDimFilter}
              className="h-7 w-32 text-xs"
            >
              {DIM_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </Select>
            <Select
              value={levelFilter}
              onValueChange={(value) => setLevelFilter(value as CollectionLog['level'] | 'all')}
              className="h-7 w-24 text-xs"
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
          <p className="text-center text-sm text-muted-foreground">
            {logs.length === 0 ? '暂无日志' : '无匹配日志（调整筛选条件）'}
          </p>
        ) : (
          <div
            className="space-y-1 overflow-auto rounded-md border p-2"
            style={{ maxHeight }}
          >
            {filteredLogs.map((log) => {
              const color = levelColor(log.level)
              const isLong = log.message.length > MESSAGE_TRUNCATE_LENGTH
              const isExpanded = expandedIds.has(log.id)
              const displayMessage = isLong && !isExpanded
                ? log.message.slice(0, MESSAGE_TRUNCATE_LENGTH) + '...'
                : log.message
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
                  {log.symbol && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {log.symbol}
                    </Badge>
                  )}
                  {log.sourceId && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {log.sourceId}
                    </Badge>
                  )}
                  <span className="flex-1 break-all">{displayMessage}</span>
                  {isLong && (
                    <button
                      className="shrink-0 text-[10px] text-primary hover:underline"
                      onClick={() => toggleExpand(log.id)}
                    >
                      {isExpanded ? '收起' : '展开'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
