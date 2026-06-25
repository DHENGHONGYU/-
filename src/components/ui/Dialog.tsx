import { type ButtonHTMLAttributes, type DialogHTMLAttributes, forwardRef, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export interface DialogProps extends DialogHTMLAttributes<HTMLDialogElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  ({ className, open, onOpenChange, children, ...props }, ref) => {
    const internalRef = useRef<HTMLDialogElement>(null)
    const dialogRef = (ref as React.RefObject<HTMLDialogElement>) || internalRef

    useEffect(() => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (open && !dialog.open) {
        dialog.showModal()
      } else if (!open && dialog.open) {
        dialog.close()
      }
    }, [open, dialogRef])

    useEffect(() => {
      const dialog = dialogRef.current
      if (!dialog) return
      const handleClose = () => onOpenChange?.(false)
      dialog.addEventListener('close', handleClose)
      return () => dialog.removeEventListener('close', handleClose)
    }, [onOpenChange, dialogRef])

    return (
      <dialog
        ref={dialogRef}
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'm-0 max-h-[85vh] w-full max-w-lg rounded-lg border bg-background p-0 shadow-lg backdrop:bg-black/50',
          'open:animate-in open:fade-in-0 open:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
      </dialog>
    )
  },
)
Dialog.displayName = 'Dialog'

export const DialogContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }>(
  ({ className, children, showCloseButton = true, ...props }, ref) => (
    <div ref={ref} className={cn('relative flex flex-col gap-4 p-6', className)} {...props}>
      {children}
      {showCloseButton && (
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      )}
    </div>
  ),
)
DialogContent.displayName = 'DialogContent'

export const DialogHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
  ),
)
DialogHeader.displayName = 'DialogHeader'

export const DialogFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
  ),
)
DialogFooter.displayName = 'DialogFooter'

export const DialogTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
  ),
)
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
)
DialogDescription.displayName = 'DialogDescription'

export const DialogClose = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'h-8 w-8 p-0',
        className,
      )}
      {...props}
    />
  ),
)
DialogClose.displayName = 'DialogClose'
