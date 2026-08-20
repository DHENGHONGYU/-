import { createContext, useContext, useState, type HTMLAttributes, forwardRef, useMemo } from 'react'
import { cn } from '@/lib/utils'

type TabsVariant = 'pills' | 'underline'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  variant: TabsVariant
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>')
  return ctx
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  variant?: TabsVariant
}

/**
 * Tabs
 */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultValue = '', value, onValueChange, variant = 'pills', className, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue)
    const isControlled = value !== undefined
    const activeValue = isControlled ? value : internalValue

    const context = useMemo(
      () => ({
        value: activeValue,
        onValueChange: (v: string) => {
          onValueChange?.(v)
          if (!isControlled) setInternalValue(v)
        },
        variant,
      }),
      [activeValue, onValueChange, isControlled, variant],
    )

    return (
      <TabsContext.Provider value={context}>
        <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  },
)
Tabs.displayName = 'Tabs'

/**
 * TabsList
 */
export const TabsList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { variant } = useTabs()

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center text-muted-foreground',
          variant === 'pills' && 'h-10 rounded-md bg-muted p-1',
          variant === 'underline' && 'border-b border-border',
          className,
        )}
        {...props}
      />
    )
  },
)
TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string
  disabled?: boolean
}

/**
 * TabsTrigger
 */
export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, ...props }, ref) => {
    const { value: activeValue, onValueChange, variant } = useTabs()
    const isActive = activeValue === value

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        disabled={disabled}
        onClick={() => onValueChange(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variant === 'pills' && [
            'rounded-sm px-3 py-1.5',
            isActive && 'bg-background text-foreground shadow-sm',
          ],
          variant === 'underline' && [
            'px-1 py-2.5 border-b-2 border-transparent hover:text-foreground',
            isActive && 'border-primary text-foreground',
          ],
          className,
        )}
        {...props}
      />
    )
  },
)
TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
}

/**
 * TabsContent
 */
export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: activeValue } = useTabs()
    if (activeValue !== value) return <></>

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          'mt-2 ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
        {...props}
      />
    )
  },
)
TabsContent.displayName = 'TabsContent'
