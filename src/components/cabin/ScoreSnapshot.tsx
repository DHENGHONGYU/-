/**
 * 评分数据快照组件
 * v0.9.11 P2-CMP-004
 * 显示股票基础数据快照
 */
import { memo } from 'react'
import type { IntelligentScore } from '@/data/types'
import { formatFieldValue } from '@/lib/format'

interface ScoreSnapshotProps {
  /** 评分结果数据 */
  result: IntelligentScore
}

/**
 * 股票数据快照卡片
 * 显示股票代码、名称、价格、PE、PB、ROE、市值
 */
export const ScoreSnapshot = memo(function ScoreSnapshot({ result }: ScoreSnapshotProps): React.JSX.Element {
  const { stock } = result.sourceSnapshot

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">基础数据快照</p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        <li>代码: {stock?.symbol ?? '—'}</li>
        <li>名称: {stock?.name ?? '—'}</li>
        <li>价格: {formatFieldValue(stock?.price)}</li>
        <li>PE: {formatFieldValue(stock?.pe)}</li>
        <li>PB: {formatFieldValue(stock?.pb)}</li>
        <li>ROE: {formatFieldValue(stock?.roe)}</li>
        <li>市值: {formatFieldValue(stock?.marketCap)}</li>
      </ul>
    </div>
  )
})
