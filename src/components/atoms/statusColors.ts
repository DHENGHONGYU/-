/**
 * statusColors — 状态徽章颜色映射常量
 *
 * 用于 OptimizationSuggestionsPage / ChangelogPage 等的状态徽章配色。
 * BadgeStyle.badge 为 CSS 类名字符串，BadgeStyle.label 为显示文本。
 */

export interface BadgeStyle {
  /** CSS 类名（用于 Badge className） */
  badge: string
  /** 显示文本 */
  label: string
}

/** 默认徽章样式（兜底） */
export const DEFAULT_BADGE: BadgeStyle = {
  badge: 'bg-secondary text-secondary-foreground',
  label: '默认',
}

/** 优先级徽章映射 */
export const PRIORITY_BADGE: Record<string, BadgeStyle> = {
  high: { badge: 'bg-destructive text-destructive-foreground', label: '高' },
  medium: { badge: 'bg-warning text-warning-foreground', label: '中' },
  low: { badge: 'bg-secondary text-secondary-foreground', label: '低' },
}

/** 建议状态徽章映射 */
export const SUGGESTION_STATUS_BADGE: Record<string, BadgeStyle> = {
  pending: { badge: 'bg-secondary text-secondary-foreground', label: '待处理' },
  in_progress: { badge: 'bg-warning text-warning-foreground', label: '进行中' },
  done: { badge: 'bg-success text-success-foreground', label: '已完成' },
  rejected: { badge: 'bg-muted text-muted-foreground', label: '已拒绝' },
}

/** 分类图标颜色映射 */
export const CATEGORY_ICON_COLOR: Record<string, string> = {
  performance: 'text-warning',
  security: 'text-destructive',
  architecture: 'text-primary',
  testing: 'text-success',
  docs: 'text-muted-foreground',
  refactor: 'text-secondary-foreground',
}

/** 变更日志类型徽章映射 */
export const CHANGELOG_TYPE_BADGE: Record<string, BadgeStyle> = {
  feature: { badge: 'bg-success text-success-foreground', label: '新功能' },
  fix: { badge: 'bg-warning text-warning-foreground', label: '修复' },
  breaking: { badge: 'bg-destructive text-destructive-foreground', label: '破坏性变更' },
  refactor: { badge: 'bg-secondary text-secondary-foreground', label: '重构' },
  docs: { badge: 'bg-muted text-muted-foreground', label: '文档' },
  chore: { badge: 'bg-muted text-muted-foreground', label: '杂项' },
}
