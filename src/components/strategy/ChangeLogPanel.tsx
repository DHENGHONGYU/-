import { twText } from '@/constants/theme.tokens'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { StrategySnapshot } from '@/data/types'

export interface ChangeLogPanelProps {
  snapshot: StrategySnapshot
}

/**
 * ChangeLogPanel
 */
export function ChangeLogPanel({ snapshot }: ChangeLogPanelProps): React.JSX.Element {
  const changeLog = snapshot.changeFromPrev

  if (!changeLog) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">变更记录</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">无变更记录</p>
        </CardContent>
      </Card>
    )
  }

  const renderSymbolList = (title: string, symbols: string[], variant: 'default' | 'secondary' | 'outline' | 'destructive') => (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      {symbols.length === 0 ? (
        <p className="text-xs text-muted-foreground">无</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {symbols.map((symbol) => (
            <Badge key={symbol} variant={variant} className="text-xs">
              {symbol}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">变更记录</CardTitle>
          <Badge variant="outline">总计 {changeLog.totalChange > 0 ? `+${changeLog.totalChange}` : changeLog.totalChange}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderSymbolList('核心稀缺 - 新增', changeLog.coreChange.added, 'default')}
        {renderSymbolList('核心稀缺 - 移除', changeLog.coreChange.removed, 'destructive')}
        {renderSymbolList('热点动量 - 新增', changeLog.hotChange.added, 'default')}
        {renderSymbolList('热点动量 - 移除', changeLog.hotChange.removed, 'destructive')}
        {renderSymbolList('价值洼地 - 新增', changeLog.valueChange.added, 'default')}
        {renderSymbolList('价值洼地 - 移除', changeLog.valueChange.removed, 'destructive')}

        <div className="space-y-1">
          <h4 className="text-sm font-medium">评分变化</h4>
          {(changeLog.scoreChanges?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">无显著变化</p>
          ) : (
            <ul className="space-y-1">
              {changeLog.scoreChanges?.map((change) => (
                <li key={change.symbol} className="flex items-center justify-between text-sm">
                  <span>
                    {change.symbol} {change.name}
                  </span>
                  <span className={change.delta >= 0 ? twText('emerald', 600) : twText('red', 600)}>
                    {change.delta >= 0 ? '+' : ''}
                    {change.delta.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
