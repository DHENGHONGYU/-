// ============================================================
// V6 风格资讯卡片 — 迁移至 V9
// 保持 V6 UI 风格，适配 V9 数据类型
// ============================================================

import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Minus,
  Clock,
  ExternalLink,
  Bookmark,
  Share2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { V6NewsArticle } from '../types'
import { SentimentBadge, CategoryBadge } from './newsCardUtils'
import { newsColors } from '@/pages/news-v6/styles/newsColorTokens'
import { formatRelativeTime, formatSource } from './newsCardFormatters'

export interface NewsCardProps {
  article: V6NewsArticle
  onBookmark?: (id: string) => void
  onShare?: (article: V6NewsArticle) => void
  onClick?: (article: V6NewsArticle) => void
  isBookmarked?: boolean
  compact?: boolean
}

export default function NewsCard({ article, onBookmark, onShare, onClick, isBookmarked = false, compact = false }: NewsCardProps) {
  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    onBookmark?.(article.id)
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    onShare?.(article)
  }

  const sentiment = article.sentiment || 0
  const confidence = article.sentimentConfidence || 0
  const isPositive = sentiment > 0.3
  const isNegative = sentiment < -0.3

  // 紧凑模式 - 用于侧边栏/列表
  if (compact) {
    return (
      <div
        onClick={() => onClick?.(article)}
        className={`p-3 border-b ${newsColors.surface.borderLight} ${newsColors.surface.hoverSoft} cursor-pointer transition-colors`}
      >
        <div className="flex items-start gap-2">
          {isPositive && <ThumbsUp className={`w-4 h-4 ${newsColors.positive.icon} mt-0.5 flex-shrink-0`} />}
          {isNegative && <ThumbsDown className={`w-4 h-4 ${newsColors.negative.icon} mt-0.5 flex-shrink-0`} />}
          {!isPositive && !isNegative && <Minus className={`w-4 h-4 ${newsColors.neutral.icon} mt-0.5 flex-shrink-0`} />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${newsColors.text.primary} truncate`}>{article.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs ${newsColors.text.placeholder}`}>{formatSource(article.source)}</span>
              <span className={`text-xs ${newsColors.text.placeholder}`}>{formatRelativeTime(article.publishTime)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 完整卡片模式（V6 风格）
  return (
    <Card
      className={`hover:shadow-md transition-shadow cursor-pointer ${newsColors.surface.border}`}
      onClick={() => onClick?.(article)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <CategoryBadge category={article.category || '宏观'} />
              <SentimentBadge sentiment={sentiment} confidence={confidence} />
              {article.relatedStocks && article.relatedStocks.length > 0 && (
                <div className="flex gap-1">
                  {article.relatedStocks.slice(0, 3).map((code) => (
                    <Badge key={code} variant="outline" className={`text-xs ${newsColors.surface.bgSoft}`}>
                      {code}
                    </Badge>
                  ))}
                  {article.relatedStocks.length > 3 && (
                    <Badge variant="outline" className={`text-xs ${newsColors.surface.bgSoft}`}>
                      +{article.relatedStocks.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <h3 className={`text-base font-semibold ${newsColors.text.primary} leading-snug ${newsColors.positive.hoverText} transition-colors`}>
              {article.title}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {article.content && (
          <p className={`text-sm ${newsColors.text.secondary} line-clamp-2 mb-3`}>{article.content}</p>
        )}

        {article.keywords && article.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {article.keywords.map((kw) => (
              <span key={kw} className={`text-xs px-2 py-0.5 ${newsColors.neutral.bgSoft} ${newsColors.neutral.textSoft} rounded-full`}>
                {kw}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-3 text-xs ${newsColors.text.placeholder}`}>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatRelativeTime(article.publishTime)}
            </span>
            <span>{formatSource(article.source)}</span>
            {article.fetchTime && (
              <span className="hidden sm:inline">抓取: {formatRelativeTime(article.fetchTime)}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 ${isBookmarked ? newsColors.accent.amber : newsColors.neutral.icon}`}
              onClick={handleBookmark}
              title="收藏"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 ${newsColors.neutral.icon}`}
              onClick={handleShare}
              title="分享"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            {article.url && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${newsColors.neutral.icon}`}
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(article.url, '_blank')
                }}
                title="原文"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

