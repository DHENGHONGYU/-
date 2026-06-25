import type { V6NewsArticle } from '../types'
import type { NewsFilter } from './FilterPanel'

export const DEFAULT_FILTER: NewsFilter = {
  category: 'all',
  sentiment: 'all',
  source: 'all',
  stockCode: '',
  dateRange: 'all',
  searchQuery: '',
  sortBy: 'time',
}

export function matchesFilter(article: V6NewsArticle, filter: NewsFilter): boolean {
  if (filter.category !== 'all' && article.category !== filter.category) return false
  if (filter.sentiment !== 'all') {
    const isPositive = article.sentiment > 0.3
    const isNegative = article.sentiment < -0.3
    if (filter.sentiment === 'positive' && !isPositive) return false
    if (filter.sentiment === 'negative' && !isNegative) return false
    if (filter.sentiment === 'neutral' && (isPositive || isNegative)) return false
  }
  if (filter.source !== 'all' && article.source !== filter.source) return false
  if (filter.stockCode && !article.relatedStocks?.some((s) => s.includes(filter.stockCode))) return false
  if (filter.dateRange !== 'all' && article.publishTime) {
    const now = new Date()
    const articleDate = new Date(article.publishTime)
    const diffDays = (now.getTime() - articleDate.getTime()) / 86400000
    if (filter.dateRange === 'today' && diffDays > 1) return false
    if (filter.dateRange === 'week' && diffDays > 7) return false
    if (filter.dateRange === 'month' && diffDays > 30) return false
  }
  if (filter.searchQuery) {
    const q = filter.searchQuery.toLowerCase()
    const matchTitle = article.title?.toLowerCase().includes(q)
    const matchContent = article.content?.toLowerCase().includes(q)
    const matchStock = article.relatedStocks?.some((s) => s.toLowerCase().includes(q))
    if (!matchTitle && !matchContent && !matchStock) return false
  }
  return true
}

export function sortArticles(articles: V6NewsArticle[], sortBy: NewsFilter['sortBy']): V6NewsArticle[] {
  const sorted = [...articles]
  switch (sortBy) {
    case 'time':
      sorted.sort((a, b) => (b.publishTime || '').localeCompare(a.publishTime || ''))
      break
    case 'sentiment':
      sorted.sort((a, b) => Math.abs(b.sentiment || 0) - Math.abs(a.sentiment || 0))
      break
    case 'source':
      sorted.sort((a, b) => (a.source || '').localeCompare(b.source || ''))
      break
    case 'relevance':
      sorted.sort((a, b) => (b.sentimentConfidence || 0) - (a.sentimentConfidence || 0))
      break
  }
  return sorted
}
