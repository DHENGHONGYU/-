/**
 * @doc [V9-DOC-FIX-P0-001, V9-DOC-BACK-033]
 * MemoryModeBanner — 内存降级模式提示横幅
 *
 * 当 IndexedDB 不可用时，系统以内存模式运行，
 * 此横幅提醒用户数据不会持久化，并提供刷新重试入口。
 */
import { twBg, twBorder, twText } from '@/constants/theme.tokens'
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
        twBorder('yellow', 500),
        twBg('yellow', 50),
        className,
      )}
      role="alert"
      aria-live="polite"
      data-testid="memory-mode-banner"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">💾</span>
        <div className="flex-1">
          <h4 className={cn('text-sm font-semibold', twText('amber', 800))}>内存模式运行中</h4>
          <p className={cn('mt-1 text-xs', twText('yellow', 700))}>
            检测到本地存储不可用，系统以内存模式运行。
            所有数据仅在当前会话有效，刷新页面后将丢失。
          </p>
          <button
            onClick={onRetry ?? (() => window.location.reload())}
            className={cn('mt-2 text-xs underline', twText('amber', 800))}
          >
            尝试切换到本地存储模式
          </button>
        </div>
      </div>
    </div>
  )
}