/**
 * @module ScoreHistoryPanel
 * @description 评分历史版本面板（占位实现，满足页面集成与基础测试）。
 * 通过 scoreDocStore 获取数据，禁止直接调用 scoreDocService。
 */

import { useEffect } from 'react'
import { twText } from '@/constants/theme.tokens'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { useScoreDocStore } from '@/store/scoreDocStore'

interface ScoreHistoryPanelProps {
  symbol?: string
}

/**
 * ScoreHistoryPanel
 */
export function ScoreHistoryPanel({ symbol }: ScoreHistoryPanelProps) {
  const historyDocs = useScoreDocStore((s) => s.historyDocs)
  const historyDiff = useScoreDocStore((s) => s.historyDiff)
  const historyLoading = useScoreDocStore((s) => s.historyLoading)
  const historyError = useScoreDocStore((s) => s.historyError)
  const loadHistoryDocs = useScoreDocStore((s) => s.loadHistoryDocs)

  useEffect(() => {
    if (!symbol) return
    void loadHistoryDocs(symbol)
  }, [symbol, loadHistoryDocs])

  if (historyLoading) {
    return <LoadingState message="加载中..." />
  }

  if (historyError) {
    return <ErrorState error={historyError} title="加载历史评分失败" variant="card" />
  }

  if (historyDocs.length < 2) {
    return <EmptyState title="历史版本不足" description="至少需要两条评分记录才能对比" />
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="font-medium">评分历史</div>
      <div className="flex gap-2">
        {historyDocs.map((doc) => (
          <div key={doc.docId} className="rounded border px-3 py-2">
            V{doc.version}
          </div>
        ))}
      </div>
      {historyDiff && (
        <div className="rounded border p-3">
          <div className="font-medium">综合分变化</div>
          <div className={historyDiff.compositeDelta >= 0 ? twText('green', 600) : twText('red', 600)}>
            {historyDiff.compositeDelta >= 0 ? '+' : ''}
            {historyDiff.compositeDelta.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}

export default ScoreHistoryPanel
