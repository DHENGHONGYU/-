import { Badge } from '@/components/ui/Badge'
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
    className = 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
  } else if (sentiment < -0.3) {
    icon = TrendingDown
    label = '看空'
    variant = 'destructive'
    className = 'bg-red-100 text-red-700 hover:bg-red-200'
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
  const colors: Record<string, string> = {
    '个股': 'bg-blue-100 text-blue-700',
    '行业': 'bg-purple-100 text-purple-700',
    '宏观': 'bg-amber-100 text-amber-700',
    '政策': 'bg-rose-100 text-rose-700',
    '公告': 'bg-cyan-100 text-cyan-700',
  }
  return (
    <Badge variant="outline" className={`text-xs ${colors[category] || 'bg-slate-100 text-slate-600'}`}>
      {category}
    </Badge>
  )
}
