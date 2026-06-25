import { useContext } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { ToastContext, type Toast, type ToastVariant } from '@/hooks/useToast'

export type { Toast, ToastVariant }

export function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variantClasses: Record<ToastVariant, string> = {
    default: 'border bg-background text-foreground',
    success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100',
    error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100',
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100',
  }

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm items-start justify-between gap-3 rounded-lg border p-4 shadow-lg',
        'animate-in fade-in slide-in-from-bottom-5',
        variantClasses[toast.variant ?? 'default'],
      )}
    >
      <div className="flex-1 space-y-1">
        {toast.title && <div className="text-sm font-semibold">{toast.title}</div>}
        {toast.description && <div className="text-sm opacity-90">{toast.description}</div>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster({ className }: { className?: string }) {
  const ctx = useContext(ToastContext)
  if (!ctx) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex flex-col gap-2',
        className,
      )}
    >
      {ctx.toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={ctx.dismiss} />
      ))}
    </div>
  )
}
