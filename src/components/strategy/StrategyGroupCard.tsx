import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { StrategyGroupItem } from '@/services/trading/strategySnapshotService'

export interface StrategyGroupCardProps {
  title: string
  items: StrategyGroupItem[]
  color: string
}

export function StrategyGroupCard({ title, items, color }: StrategyGroupCardProps): React.JSX.Element {
  const count = items.length
  const composites = items.map((item) => item.composite)
  const avgComposite = count > 0 ? Math.round((composites.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0
  const maxComposite = count > 0 ? Math.max(...composites) : 0

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-3 w-3 rounded-full', color)} data-testid="group-color-dot" />
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {count} 只
          </Badge>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>均分 {avgComposite.toFixed(2)}</span>
          <span>最高 {maxComposite.toFixed(2)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无标的</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.symbol}
                className="rounded-md border p-2 text-sm"
                title={item.reasons[0] ?? ''}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {item.symbol} {item.name}
                  </span>
                  <span className="text-muted-foreground">{item.composite.toFixed(2)}</span>
                </div>
                {item.reasons[0] && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.reasons[0]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
