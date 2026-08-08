/**
 * @fileoverview 个股采集进度颜色令牌
 *
 * 将 CollectionProgress 组件中高频出现的 Tailwind 颜色类集中管理，
 * 避免在组件源码中硬编码颜色类。仅服务于采集进度模块的视觉风格，
 * 不强制要求其他模块复用。
 *
 * @module constants/collectionColors
 * @created 2026-08-07
 * @doc []
 */

/** 采集状态颜色映射（对应 DimStatus） */
export const COLLECTION_STATUS_COLORS = {
  success: {
    text: 'text-emerald-600',
    darkText: 'dark:text-emerald-400',
    bg: 'bg-emerald-500',
  },
  partial: {
    text: 'text-amber-600',
    darkText: 'dark:text-amber-300',
    bg: 'bg-amber-500',
  },
  fail: {
    text: 'text-red-600',
    darkText: 'dark:text-red-400',
    bg: 'bg-red-500',
  },
  none: {
    text: 'text-stone-400',
    darkText: 'dark:text-neutral-500',
    bg: 'bg-stone-300',
  },
} as const

/** 评级颜色映射（对应 QualityRating） */
export const RATING_COLORS = {
  excellent: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    darkBg: 'dark:bg-emerald-950/30',
    dot: 'bg-emerald-500',
  },
  good: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    darkBg: 'dark:bg-blue-950/30',
    dot: 'bg-blue-500',
  },
  fair: {
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    darkBg: 'dark:bg-amber-950/30',
    dot: 'bg-amber-500',
  },
  poor: {
    text: 'text-red-700',
    bg: 'bg-red-50',
    darkBg: 'dark:bg-red-950/30',
    dot: 'bg-red-400',
  },
} as const
