/**
 * @module ScoreHistoryPanel
 * @description 评分历史版本面板（占位实现，满足页面集成与基础测试）。
 */

import { useEffect, useState } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { listScoreDocsBySymbol, buildScoreDocDiff } from '@/services/analysis/scoreDocService'
import type { ScoreDocVersion } from '@/data/types'
import type { ScoreDocDiff } from '@/services/analysis/scoreDocService'

interface ScoreHistoryPanelProps {
  symbol?: string
}

export function ScoreHistoryPanel({ symbol }: ScoreHistoryPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docs, setDocs] = useState<ScoreDocVersion[]>([])
  const [diff, setDiff] = useState<ScoreDocDiff | null>(null)

  useEffect(() => {
    if (!symbol) return

    let cancelled = false
    setLoading(true)
    setError(null)

    void listScoreDocsBySymbol(symbol).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.success) {
        const list = result.data ?? []
        setDocs(list)
        if (list.length >= 2) {
          const latest = list[0]
          const previous = list[1]
          if (latest && previous) {
            setDiff(buildScoreDocDiff(latest, previous))
          }
        }
      } else {
        setError(result.error ?? '加载失败')
      }
    })

    return () => {
      cancelled = true
    }
  }, [symbol])

  if (loading) {
    return <LoadingState message="加载中..." />
  }

  if (error) {
    return <ErrorState error={error} title="加载历史评分失败" variant="card" />
  }

  if (docs.length < 2) {
    return <EmptyState title="历史版本不足" description="至少需要两条评分记录才能对比" />
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="font-medium">评分历史</div>
      <div className="flex gap-2">
        {docs.map((doc) => (
          <div key={doc.docId} className="rounded border px-3 py-2">
            V{doc.version}
          </div>
        ))}
      </div>
      {diff && (
        <div className="rounded border p-3">
          <div className="font-medium">综合分变化</div>
          <div className={diff.compositeDelta >= 0 ? 'text-green-600' : 'text-red-600'}>
            {diff.compositeDelta >= 0 ? '+' : ''}
            {diff.compositeDelta.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}

export default ScoreHistoryPanel