import { Badge } from '@/components/ui/Badge'
import { newsColors } from '@/pages/news-v6/styles/newsColorTokens'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/** 情感标签组件（V6 风格） */
export function SentimentBadge({ sentiment, confidence }: { sentiment: number; confidence: number }) {
  let icon = Minus
  let label = '中性'
  let variant: 'default' | 'destructive' | 'secondary' | 'outline' = 'secondary'
  let className = ''

  if (sentiment > 0.3) {
    icon = TrendingUp
    label = '看多'
    variant = 'default'
    className = `${newsColors.positive.bgSoft} ${newsColors.positive.textSoft} ${newsColors.positive.hoverSoft}`
  } else if (sentiment < -0.3) {
    icon = TrendingDown
    label = '看空'
    variant = 'destructive'
    className = `${newsColors.negative.bgSoft} ${newsColors.negative.textSoft} ${newsColors.negative.hoverSoft}`
  }

  const Icon = icon
  const confPct = Math.round(confidence * 100)

  return (
    <Badge variant={variant} className={`gap-1 ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
      <span className="opacity-60">({confPct}%)</span>
    </Badge>
  )
}

/** 分类标签（V6 风格） */
export function CategoryBadge({ category }: { category: string }) {
  const categoryStyle = (newsColors.category as Record<string, string>)[category] ?? newsColors.category.default
  return (
    <Badge variant="outline" className={`text-xs ${categoryStyle}`}>
      {category}
    </Badge>
  )
}
