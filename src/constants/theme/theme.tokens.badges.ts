/**
 * @fileoverview 徽章/状态色令牌
 *
 * 聚合预测、搜索、告警等组件中高频使用的组合式 Tailwind 颜色类，
 * 供组件层直接引用，避免在组件源码中硬编码颜色类。
 *
 * @module constants/theme/badges
 * @created 2026-07-15
 */

export const BADGE_COLORS = {
  /** 市场周期徽章 */
  cycle: {
    'left-bottom': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'right-up': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    top: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'left-down': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  /** 告警等级徽章 */
  alert: {
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    warning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
    critical: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  },
  /** 预测方向文字色 */
  direction: {
    bullish: 'text-red-600 dark:text-red-400',
    bearish: 'text-green-600 dark:text-green-400',
    neutral: 'text-slate-500',
  },
  /** 预测校验状态徽章 */
  predictionStatus: {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    verified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    expired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
    unknown: 'bg-gray-100 text-gray-500',
  },
  /** 情绪主导徽章 */
  sentimentDominant: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  /** 命中标记 */
  hit: 'text-blue-500',
  /** 图标色 */
  icon: {
    danger: 'text-red-500',
    warning: 'text-yellow-500',
  },
  /** 分组视图左边框 */
  groupBorder: {
    'collection-history': 'border-blue-300 dark:border-blue-700',
    'local-doc': 'border-purple-300 dark:border-purple-700',
    'code-file': 'border-green-300 dark:border-green-700',
    'script-file': 'border-green-300 dark:border-green-700',
    'auto-collect': 'border-blue-300 dark:border-blue-700',
    'file-import': 'border-orange-300 dark:border-orange-700',
    'manual-trigger': 'border-gray-300 dark:border-gray-700',
    success: 'border-green-300 dark:border-green-700',
    partial: 'border-yellow-300 dark:border-yellow-700',
    failed: 'border-red-300 dark:border-red-700',
    unknown: 'border-gray-300 dark:border-gray-700',
  },
  /** 时间线状态徽章 */
  statusBadge: {
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
} as const

export type BadgeColorKey = keyof typeof BADGE_COLORS
