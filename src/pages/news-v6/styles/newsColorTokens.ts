/**
 * news-v6 语义化颜色令牌
 *
 * 将新闻模块中高频出现的 Tailwind 颜色类集中管理，避免在组件中散落硬编码。
 * 这些令牌仅服务于 news-v6 模块的 V6 视觉风格，不强制要求其他模块复用。
 */

export const newsColors = {
  // 情感 / 涨跌
  positive: {
    text: 'text-emerald-600',
    hoverText: 'hover:text-emerald-600',
    bg: 'bg-emerald-500',
    bgSoft: 'bg-emerald-100',
    textSoft: 'text-emerald-700',
    hoverSoft: 'hover:bg-emerald-200',
    borderSoft: 'border-emerald-200',
    bgTint: 'bg-emerald-50',
    icon: 'text-emerald-500',
  },
  negative: {
    text: 'text-red-600',
    bg: 'bg-red-500',
    bgSoft: 'bg-red-100',
    textSoft: 'text-red-700',
    hoverSoft: 'hover:bg-red-200',
    borderSoft: 'border-red-200',
    bgTint: 'bg-red-50',
    icon: 'text-red-500',
  },
  neutral: {
    text: 'text-slate-600',
    bg: 'bg-slate-400',
    bgSoft: 'bg-slate-100',
    textSoft: 'text-slate-600',
    hoverSoft: 'hover:bg-slate-200',
    borderSoft: 'border-slate-200',
    bgTint: 'bg-slate-50',
    icon: 'text-slate-400',
    hoverBg: 'hover:bg-slate-50',
  },

  // 文本层级
  text: {
    primary: 'text-slate-800',
    secondary: 'text-slate-600',
    muted: 'text-slate-500',
    placeholder: 'text-slate-400',
  },

  // 边框 / 表面
  surface: {
    border: 'border-slate-200',
    borderLight: 'border-slate-100',
    bg: 'bg-white',
    bgSoft: 'bg-slate-50',
    hoverSoft: 'hover:bg-slate-50',
  },

  // 分类标签（V6 风格）
  category: {
    '个股': 'bg-blue-100 text-blue-700',
    '行业': 'bg-purple-100 text-purple-700',
    '宏观': 'bg-amber-100 text-amber-700',
    '政策': 'bg-rose-100 text-rose-700',
    '公告': 'bg-cyan-100 text-cyan-700',
    default: 'bg-slate-100 text-slate-600',
  },

  // 特殊
  accent: {
    amber: 'text-amber-500',
    blue: 'bg-blue-100 text-blue-700',
  },
} as const

export type NewsCategory = keyof typeof newsColors.category
