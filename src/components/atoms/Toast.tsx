import { useContext } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { ToastContext, type Toast, type ToastVariant } from '@/hooks/useToast'
import { twText, twBg, twBorder, DARK } from '@/constants/theme.tokens'

export type { Toast, ToastVariant }

/**
 * ToastItem
 * @param onDismiss }
 */
export function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variantClasses: Record<ToastVariant, string> = {
    default: 'border bg-background text-foreground',
    success: `${twBorder('green', 200)} ${twBg('green', 50)} ${twText('green', 900)} ${DARK.borderGreen900} ${DARK.bgGreen950} ${DARK.textGreen100}`,
    error: `${twBorder('red', 200)} ${twBg('red', 50)} ${twText('red', 900)} ${DARK.borderRed900} ${DARK.bgRed950} ${DARK.textRed200}`,
    warning: `${twBorder('yellow', 200)} ${twBg('yellow', 50)} ${twText('yellow', 900)} ${DARK.borderYellow900} ${DARK.bgYellow950} ${DARK.textYellow100}`,
    info: `${twBorder('blue', 200)} ${twBg('blue', 50)} ${twText('blue', 900)} ${DARK.borderBlue900} ${DARK.bgBlue950} ${DARK.textBlue100}`,
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

/**
 * Toaster
 */
export function Toaster({ className }: { className?: string }) {
  const ctx = useContext(ToastContext)
  if (!ctx) return <></>

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
