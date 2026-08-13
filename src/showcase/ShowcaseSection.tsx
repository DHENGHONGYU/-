import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_TOKENS } from '@/constants/theme.tokens'
import type { ShowcaseGroup } from './types'

interface ShowcaseSectionProps {
  group: ShowcaseGroup
  defaultExpanded?: boolean
}

export function ShowcaseSection({ group, defaultExpanded = true }: ShowcaseSectionProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const Icon = group.icon

  return (
    <section
      className={cn(
        'rounded-xl border',
        'border-border',
        'bg-background',
        'overflow-hidden',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3',
          'bg-muted',
          'hover:bg-stone-100/80 transition-colors',
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', 'text-success')} />
          <h2 className={cn('text-lg font-semibold', 'text-foreground')}>
            {group.title}
          </h2>
        </div>
        {expanded ? (
          <ChevronDown className={cn('h-5 w-5', 'text-muted-foreground/70')} />
        ) : (
          <ChevronRight className={cn('h-5 w-5', 'text-muted-foreground/70')} />
        )}
      </button>

      {expanded && (
        <div className={cn('p-4 grid gap-6', THEME_TOKENS.stackGap.lg)}>
          {group.items.map((item) => (
            <article
              key={item.id}
              className={cn(
                'rounded-lg border p-4',
                'border-border',
                'bg-background',
              )}
            >
              <div className="mb-2">
                <h3 className={cn('text-base font-medium', 'text-foreground')}>
                  {item.title}
                </h3>
                {item.description && (
                  <p className={cn('text-sm mt-1', 'text-muted-foreground')}>
                    {item.description}
                  </p>
                )}
              </div>
              <div className="mt-3">{item.component}</div>
              {item.codeSnippet && (
                <pre
                  className={cn(
                    'mt-4 text-xs overflow-x-auto rounded-md p-3',
                    'bg-muted',
                    'text-foreground',
                  )}
                >
                  <code>{item.codeSnippet}</code>
                </pre>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
