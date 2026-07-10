import type { NewsArticle } from '@/data/types'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { twBg } from '@/constants/theme.tokens'

export interface NewsCardProps {
  article: NewsArticle
  onClick?: () => void
}

const SENTIMENT_CONFIG: Record<
  NewsArticle['sentiment'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  positive: { label: '正面', variant: 'default', className: `${twBg('emerald', 500)} text-white hover:${twBg('emerald', 500)}/80` },
  negative: { label: '负面', variant: 'destructive', className: '' },
  neutral: { label: '中性', variant: 'secondary', className: `${twBg('slate', 500)} text-white hover:${twBg('slate', 500)}/80` },
}

/**
 * NewsCard
 * @param onClick }
 */
export function NewsCard({ article, onClick }: NewsCardProps): React.JSX.Element {
  const sentiment = SENTIMENT_CONFIG[article.sentiment]
  const summary = article.content.length > 120 ? `${article.content.slice(0, 120)}...` : article.content

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{article.category}</Badge>
          <Badge variant={sentiment.variant} className={sentiment.className}>
            {sentiment.label}
          </Badge>
        </div>
        <CardTitle className="text-base leading-snug hover:text-primary" onClick={onClick}>
          {article.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>{summary}</p>
        {article.relatedStocks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.relatedStocks.map((symbol) => (
              <Badge key={symbol} variant="secondary" className="text-xs">
                {symbol}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{article.source}</span>
          <span>{new Date(article.publishTime).toLocaleString('zh-CN')}</span>
        </div>
      </CardContent>
    </Card>
  )
}
