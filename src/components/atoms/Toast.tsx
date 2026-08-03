import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import type { Toast as ToastType, ToastVariant } from '@/hooks/useToast'

export type Toast = ToastType

const variantStyles: Record<ToastVariant, string> = {
  default: 'bg-background border-border text-foreground',
  success: 'bg-success/10 border-success/30 text-success-foreground',
  error: 'bg-destructive/10 border-destructive/30 text-destructive-foreground',
  warning: 'bg-warning/10 border-warning/30 text-warning-foreground',
  info: 'bg-primary/10 border-primary/30 text-primary-foreground',
}

const variantIcon: Record<ToastVariant, string> = {
  default: '',
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u24D8',
}

export interface ToasterProps {
  className?: string
}

/**
 * Toaster - 渲染所有活跃的 Toast 通知
 *
 * 配合 ToastProvider + useToast 使用，固定定位在视口右下角。
 */
export function Toaster({ className }: ToasterProps): ReactNode {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2',
        className,
      )}
      role="region"
      aria-label="通知"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all',
            'min-w-[320px] max-w-[480px] animate-in slide-in-from-right',
            variantStyles[t.variant ?? 'default'],
          )}
          role="alert"
        >
          {variantIcon[t.variant ?? 'default'] && (
            <span className="text-lg leading-none" aria-hidden="true">
              {variantIcon[t.variant ?? 'default']}
            </span>
          )}
          <div className="flex-1">
            {!!t.title && <p className="font-medium text-sm">{t.title}</p>}
            {!!t.description && (
              <p className="mt-1 text-sm opacity-90">{t.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-current opacity-60 transition-opacity hover:opacity-100"
            aria-label="关闭通知"
          >
            {'\u2715'}
          </button>
        </div>
      ))}
    </div>
  )
}
