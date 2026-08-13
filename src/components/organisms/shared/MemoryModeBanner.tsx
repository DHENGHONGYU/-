/**
 * @doc [V9-DOC-FIX-P0-001, V9-DOC-BACK-033]
 * MemoryModeBanner — 内存降级模式提示横幅
 *
 * 当 IndexedDB 不可用时，系统以内存模式运行，
 * 此横幅提醒用户数据不会持久化，并提供刷新重试入口。
 */
import { cn } from '@/lib/utils'

interface MemoryModeBannerProps {
  className?: string
  onRetry?: () => void
}

export function MemoryModeBanner({ className, onRetry }: MemoryModeBannerProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 rounded-lg border p-4 shadow-lg',
        'border-warning',
        'bg-warning/10',
        className,
      )}
      role="alert"
      aria-live="polite"
      data-testid="memory-mode-banner"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">💾</span>
        <div className="flex-1">
          <h4 className={cn('text-sm font-semibold', 'text-warning')}>内存模式运行中</h4>
          <p className={cn('mt-1 text-xs', 'text-warning')}>
            检测到本地存储不可用，系统以内存模式运行。
            所有数据仅在当前会话有效，刷新页面后将丢失。
          </p>
          <button
            onClick={onRetry ?? (() => window.location.reload())}
            className={cn('mt-2 text-xs underline', 'text-warning')}
          >
            尝试切换到本地存储模式
          </button>
        </div>
      </div>
    </div>
  )
}