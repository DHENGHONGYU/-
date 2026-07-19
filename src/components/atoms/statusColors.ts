/**
 * 状态 / 优先级 / 类型 → 语义色徽章类
 * @description
 * 统一全站「状态色」表达，消除各页面重复的硬编码映射
 * （如 text-red-400 bg-red-900/30）。全部基于统一设计系统的语义令牌，
 * 主题自适应（亮 / 暗模式均可用）。
 *
 * 用法：
 *   const { badge, label } = PRIORITY_BADGE[priority] ?? FALLBACK
 *   <span className={`rounded px-2 py-1 text-xs font-medium ${badge}`}>{label}</span>
  * @doc [V9-DOC-FRONT-046]
*/
export interface BadgeStyle {
  /** Tailwind 徽章容器类（背景 + 文字色） */
  badge: string
  /** 中文标签 */
  label: string
}

/** 未知键兜底（避免 noUncheckedIndexedAccess 下的 undefined） */
export const DEFAULT_BADGE: BadgeStyle = { badge: 'bg-muted text-tertiary', label: '—' }

/** 优化建议优先级 */
export const PRIORITY_BADGE: Record<string, BadgeStyle> = {
  high: { badge: 'bg-destructive/15 text-destructive', label: '高' },
  medium: { badge: 'bg-warning/15 text-warning', label: '中' },
  low: { badge: 'bg-info/15 text-info', label: '低' },
}

/** 优化建议处理状态 */
export const SUGGESTION_STATUS_BADGE: Record<string, BadgeStyle> = {
  open: { badge: 'bg-info/15 text-info', label: '待处理' },
  'in-progress': { badge: 'bg-warning/15 text-warning', label: '进行中' },
  completed: { badge: 'bg-success/15 text-success', label: '已完成' },
  dismissed: { badge: 'bg-muted text-tertiary', label: '已忽略' },
}

/** 优化建议分类 → 图标语义色 */
export const CATEGORY_ICON_COLOR: Record<string, string> = {
  performance: 'text-warning',
  quality: 'text-info',
  security: 'text-destructive',
  architecture: 'text-success',
}

/** 更新日志版本类型 */
export const CHANGELOG_TYPE_BADGE: Record<string, BadgeStyle> = {
  major: { badge: 'bg-destructive/15 text-destructive', label: '重大更新' },
  minor: { badge: 'bg-info/15 text-info', label: '功能更新' },
  patch: { badge: 'bg-success/15 text-success', label: '问题修复' },
}
