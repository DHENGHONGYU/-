import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

/**
 * PageSkeleton
 */
export function PageSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-20 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
