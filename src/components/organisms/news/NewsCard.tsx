import type { NewsArticle } from '@/data/types'
import { Badge } from '@/components/atoms/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import { THEME_TOKENS } from '@/constants/theme/theme.tokens.base'

export interface NewsCardProps {
  article: NewsArticle
  onClick?: () => void
}

const SENTIMENT_CONFIG: Record<
  NewsArticle['sentiment'],
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  positive: { label: '正面', variant: 'default', className: 'bg-success text-white hover:bg-success/80' },
  negative: { label: '负面', variant: 'destructive', className: '' },
  neutral: { label: '中性', variant: 'secondary', className: 'bg-muted-foreground text-white hover:bg-muted-foreground/80' },
}

/**
 * NewsCard — 资讯卡片
 *
 * @param props 组件 props
 * @param props.article 资讯数据
 * @param props.onClick 点击或键盘激活时的回调（Enter/Space）
 */
export function NewsCard({ article, onClick }: NewsCardProps): React.JSX.Element {
  const sentiment = SENTIMENT_CONFIG[article.sentiment]
  const summary = article.content.length > 120 ? `${article.content.slice(0, 120)}...` : article.content

  return (
    <Card
      className={
        onClick
          ? `cursor-pointer transition-shadow hover:shadow-elevation-2 focus-visible:outline-none focus-visible:${THEME_TOKENS.focusVisible.ringWidth} focus-visible:${THEME_TOKENS.focusVisible.ringColor} focus-visible:${THEME_TOKENS.focusVisible.ringOffset}`
          : 'cursor-pointer transition-shadow hover:shadow-elevation-2'
      }
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
        {/* 修复 B-bubbled：移除 CardTitle 的 onClick，避免点击标题冒泡到 Card 触发双 onClick */}
        <CardTitle className="text-base leading-snug hover:text-primary">
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
