/**
 * @fileoverview 股票池状态颜色令牌
 *
 * 将 PoolBoardPage 中研究池状态徽章的 Tailwind 颜色类集中管理，
 * 避免在组件源码中硬编码颜色类。仅服务于研究池状态的视觉风格，
 * 不强制要求其他模块复用。
 *
 * @module constants/poolStatusColors
 * @created 2026-08-07
 * @doc []
 */

/** 研究状态颜色配置 */
export const POOL_STATUS_COLORS = {
  candidate: 'bg-stone-100 text-stone-700 dark:bg-neutral-800 dark:text-neutral-300',
  screened: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  deepDive: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  watching: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  archived: 'bg-stone-200 text-stone-500 dark:bg-neutral-800 dark:text-neutral-500',
} as const

export type PoolStatusKey = keyof typeof POOL_STATUS_COLORS
