import { getSafeString, fallback } from '@/lib/safeCoerce'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Badge } from '@/components/atoms/Badge'
import type { LocalDoc } from '@/data/types'

export interface LocalDocCardProps {
  doc: LocalDoc
}

/**
 * LocalDocCard
 */
export function LocalDocCard({ doc }: LocalDocCardProps): React.JSX.Element {
  const summary = doc.content.slice(0, 150)

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-bold">{doc.name}</CardTitle>
          <div className="flex shrink-0 gap-1.5">
            <Badge variant="secondary">{doc.symbol}</Badge>
            <Badge variant="outline">{doc.category}</Badge>
            {doc.authorizationStatus && (
              <Badge variant={doc.authorizationStatus === 'authorized' || doc.authorizationStatus === 'public_domain' ? 'default' : 'destructive'} className="text-[10px]">
                {doc.authorizationStatus === 'authorized' ? '已授权' :
                 doc.authorizationStatus === 'unauthorized' ? '未授权' :
                 doc.authorizationStatus === 'pending' ? '待确认' : '公开'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {doc.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {getSafeString(summary) || fallback.noContent}
        </p>
        {doc.source && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">来源:</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{doc.source}</Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground truncate" title={doc.sourcePath}>
          {doc.sourcePath}
        </p>
      </CardContent>
    </Card>
  )
}
