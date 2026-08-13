/**
 * @doc [V9-DOC-FIX-P0-001, V9-DOC-BACK-033]
 * OrchestratorStatusPanel — 编排器健康状态面板
 *
 * 展示 10 个编排器的实时运行状态：running / failed / idle / starting。
 * 每 5 秒自动刷新一次，供用户在设置页 / 开发调试时查看。
 */
import { useEffect, useState } from 'react'
import { getOrchestratorHealth, type OrchestratorHealth } from '@/services/orchestration'
import { cn } from '@/lib/utils'

interface OrchestratorStatusPanelProps {
  className?: string
  refreshIntervalMs?: number
}

export function OrchestratorStatusPanel({
  className,
  refreshIntervalMs = 5000,
}: OrchestratorStatusPanelProps): React.JSX.Element {
  const [health, setHealth] = useState<OrchestratorHealth[]>([])

  useEffect(() => {
    const updateHealth = () => setHealth(getOrchestratorHealth())
    updateHealth()
    const interval = setInterval(updateHealth, refreshIntervalMs)
    return () => clearInterval(interval)
  }, [refreshIntervalMs])

  const runningCount = health.filter((h) => h.status === 'running').length
  const failedCount = health.filter((h) => h.status === 'failed').length
  const totalCount = health.length

  return (
    <div
      className={cn('rounded-lg border p-4', className)}
      data-testid="orchestrator-status-panel"
      aria-label="编排器状态面板"
    >
      <h3 className="mb-3 text-sm font-semibold">编排器状态</h3>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          运行中: {runningCount}/{totalCount}
        </span>
        {failedCount > 0 && (
          <span className={cn('rounded px-2 py-0.5 text-xs', 'bg-destructive/10', 'text-destructive')}>
            {failedCount} 个异常
          </span>
        )}
      </div>
      <div className="space-y-1">
        {health.map((h) => (
          <div key={h.name} className="flex items-center justify-between text-xs">
            <span className="font-mono">{h.name}</span>
            <StatusBadge status={h.status} errorMessage={h.errorMessage} />
          </div>
        ))}
        {health.length === 0 && (
          <p className="text-xs text-muted-foreground">暂无编排器状态数据</p>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status, errorMessage }: { status: string; errorMessage: string | null }) {
  const variants: Record<string, string> = {
    running: 'bg-success/10 text-success',
    failed: 'bg-destructive/10 text-destructive',
    starting: 'bg-warning/10 text-warning',
    idle: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={cn('rounded px-2 py-0.5', variants[status] ?? variants.idle)}
      title={errorMessage ?? ''}
    >
      {status}
    </span>
  )
}