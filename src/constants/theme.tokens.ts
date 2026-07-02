/**
 * @module theme.tokens
 * @description 设计令牌系统（Design Tokens）。
 * 所有值均映射为 Tailwind 类名字符串，便于组件直接展开使用，
 * 统一颜色、尺寸、间距、圆角、间距与评分阈值等视觉决策。
 */

export const THEME_TOKENS = {
  /**
   * 颜色令牌
   * @remarks 同时提供文本色（text-*）、背景色（bg-*）与原色值（raw）变体，
   * 方便组件直接展开或用于 style 属性
   */
  color: {
    /** 信息提示文本色 */
    info: 'text-blue-500',
    /** 信息提示背景色 */
    infoBg: 'bg-blue-500',
    /** 信息色原始值（用于 style/图表） */
    infoRaw: '#3b82f6',
    /** 警告提示文本色 */
    warning: 'text-amber-500',
    /** 警告提示背景色 */
    warningBg: 'bg-amber-500',
    /** 警告色原始值（用于 style/图表） */
    warningRaw: '#f59e0b',
    /** 成功/正向文本色 */
    success: 'text-green-500',
    /** 成功/正向背景色 */
    successBg: 'bg-green-500',
    /** 成功色原始值（用于 style/图表） */
    successRaw: '#22c55e',
    /** 危险/错误文本色 */
    destructive: 'text-red-500',
    /** 危险/错误背景色 */
    destructiveBg: 'bg-red-500',
    /** 危险色原始值（用于 style/图表） */
    destructiveRaw: '#ef4444',
    /** 弱化/次要文本色 */
    muted: 'text-gray-500',
    /** 弱化前景色（更淡的次要文本） */
    mutedForeground: 'text-gray-400',
    /** 弱化文本原始值 */
    mutedRaw: '#9ca3af',
    /** 弱化背景色 */
    mutedBackground: 'bg-gray-100',
    /** 边框色 */
    border: 'border-gray-200',
    /** 边框原始值 */
    borderRaw: '#e5e7eb',
  },

  /**
   * 图标尺寸令牌
   */
  iconSizes: {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  },

  /**
   * 控件尺寸令牌
   */
  controlSizes: {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  },

  /**
   * 间距令牌
   */
  spacing: {
    xs: 'p-1',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
    pxSm: 'px-2',
    pxMd: 'px-3',
    pxLg: 'px-4',
    pySm: 'py-1',
    pyMd: 'py-2',
    pyLg: 'py-3',
  },

  /**
   * 圆角令牌
   */
  radius: {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  },

  /**
   * 间隙令牌（flex/grid gap）
   */
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
  },

  /**
   * 堆叠间隙令牌（垂直方向 space-y）
   */
  stackGap: {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-3',
    lg: 'space-y-4',
    xl: 'space-y-6',
  },

  /**
   * 评分阈值令牌（0-5 分制）
   */
  score: {
    /** 优秀阈值 */
    excellent: 4,
    /** 良好阈值 */
    good: 3,
    /** 一般/可接受阈值 */
    ok: 2,
  },

  /**
   * 焦点可见样式令牌（Focus Visible）
   */
  focusVisible: {
    /** 焦点环宽度 */
    ringWidth: 'ring-2',
    /** 焦点环颜色 */
    ringColor: 'ring-blue-500',
    /** 焦点环偏移量 */
    ringOffset: 'ring-offset-2',
    /** 焦点环偏移背景色 */
    ringOffsetColor: 'ring-offset-background',
  },
} as const

/** 颜色令牌类型 */
export type ThemeColorToken = keyof typeof THEME_TOKENS.color

/**
 * 语义化颜色体系（Design Tokens）
 * @description 统一的颜色语义映射，支持 HEX/Tailwind 类名/RGB 三种格式
 * 用于股票涨跌、状态、评分等级、背景、文字、边框等场景
 */
export const COLOR_TOKENS = {
  // ============================================================
  // 股票涨跌色（A 股标准：红涨绿跌）
  // ============================================================
  /** 上涨颜色 */
  up: {
    hex: '#ef4444',
    tailwind: 'text-red-500',
    bgClass: 'bg-red-500',
    rgb: '239, 68, 68',
  },
  /** 下跌颜色 */
  down: {
    hex: '#22c55e',
    tailwind: 'text-green-500',
    bgClass: 'bg-green-500',
    rgb: '34, 197, 94',
  },
  /** 平盘/中性颜色 */
  neutral: {
    hex: '#9ca3af',
    tailwind: 'text-gray-400',
    bgClass: 'bg-gray-400',
    rgb: '156, 163, 175',
  },

  // ============================================================
  // 状态色
  // ============================================================
  /** 信息提示色（蓝） */
  info: {
    hex: '#3b82f6',
    tailwind: 'text-blue-500',
    bgClass: 'bg-blue-500',
    rgb: '59, 130, 246',
  },
  /** 成功色（绿） */
  success: {
    hex: '#22c55e',
    tailwind: 'text-green-500',
    bgClass: 'bg-green-500',
    rgb: '34, 197, 94',
  },
  /** 警告色（琥珀） */
  warning: {
    hex: '#f59e0b',
    tailwind: 'text-amber-500',
    bgClass: 'bg-amber-500',
    rgb: '245, 158, 11',
  },
  /** 危险色（红） */
  danger: {
    hex: '#ef4444',
    tailwind: 'text-red-500',
    bgClass: 'bg-red-500',
    rgb: '239, 68, 68',
  },
  /** 橙色（降仓警告） */
  orange: {
    hex: '#f97316',
    tailwind: 'text-orange-500',
    bgClass: 'bg-orange-500',
    rgb: '249, 115, 22',
  },
  /** 紫色 */
  purple: {
    hex: '#8b5cf6',
    tailwind: 'text-purple-500',
    bgClass: 'bg-purple-500',
    rgb: '139, 92, 246',
  },
  /** 青色 */
  cyan: {
    hex: '#06b6d4',
    tailwind: 'text-cyan-500',
    bgClass: 'bg-cyan-500',
    rgb: '6, 182, 212',
  },
  /** 粉色 */
  pink: {
    hex: '#ec4899',
    tailwind: 'text-pink-500',
    bgClass: 'bg-pink-500',
    rgb: '236, 72, 153',
  },
  /** 青绿 */
  teal: {
    hex: '#14b8a6',
    tailwind: 'text-teal-500',
    bgClass: 'bg-teal-500',
    rgb: '20, 184, 166',
  },
  /** 靛蓝 */
  indigo: {
    hex: '#6366f1',
    tailwind: 'text-indigo-500',
    bgClass: 'bg-indigo-500',
    rgb: '99, 102, 241',
  },
  /** 翠绿（特殊场景） */
  emerald: {
    hex: '#10b981',
    tailwind: 'text-emerald-500',
    bgClass: 'bg-emerald-500',
    rgb: '16, 185, 129',
  },

  // ============================================================
  // 评分等级色
  // ============================================================
  /** 优秀/高分区 */
  scoreHigh: {
    hex: '#22c55e',
    tailwind: 'text-green-500',
    bgClass: 'bg-green-500',
    rgb: '34, 197, 94',
  },
  /** 良好/中分区 */
  scoreMid: {
    hex: '#f59e0b',
    tailwind: 'text-amber-500',
    bgClass: 'bg-amber-500',
    rgb: '245, 158, 11',
  },
  /** 较差/低分区 */
  scoreLow: {
    hex: '#ef4444',
    tailwind: 'text-red-500',
    bgClass: 'bg-red-500',
    rgb: '239, 68, 68',
  },

  // ============================================================
  // 轮动因子色
  // ============================================================
  /** 景气因子色（红 - 唯一趋势主导） */
  factorJingqi: {
    hex: '#ef4444',
    tailwind: 'text-red-500',
    bgClass: 'bg-red-500',
    rgb: '239, 68, 68',
  },
  /** 资金因子色（琥珀） */
  factorZijin: {
    hex: '#f59e0b',
    tailwind: 'text-amber-500',
    bgClass: 'bg-amber-500',
    rgb: '245, 158, 11',
  },
  /** 估值因子色（蓝） */
  factorGuzhi: {
    hex: '#3b82f6',
    tailwind: 'text-blue-500',
    bgClass: 'bg-blue-500',
    rgb: '59, 130, 246',
  },
  /** β因子色（紫） */
  factorBeta: {
    hex: '#8b5cf6',
    tailwind: 'text-purple-500',
    bgClass: 'bg-purple-500',
    rgb: '139, 92, 246',
  },
  /** 量能因子色（青） */
  factorNengliang: {
    hex: '#06b6d4',
    tailwind: 'text-cyan-500',
    bgClass: 'bg-cyan-500',
    rgb: '6, 182, 212',
  },

  // ============================================================
  // 市场风格色
  // ============================================================
  /** 成长主导期（蓝） */
  styleGrowth: {
    hex: '#3b82f6',
    tailwind: 'text-blue-500',
    bgClass: 'bg-blue-500',
    rgb: '59, 130, 246',
  },
  /** 价值修复期（翠绿） */
  styleValue: {
    hex: '#10b981',
    tailwind: 'text-emerald-500',
    bgClass: 'bg-emerald-500',
    rgb: '16, 185, 129',
  },
  /** 均衡震荡期（紫） */
  styleBalanced: {
    hex: '#8b5cf6',
    tailwind: 'text-purple-500',
    bgClass: 'bg-purple-500',
    rgb: '139, 92, 246',
  },

  // ============================================================
  // 信号分级色
  // ============================================================
  /** 强信号（翠绿） */
  signalStrong: {
    hex: '#10b981',
    tailwind: 'text-emerald-500',
    bgClass: 'bg-emerald-500',
    rgb: '16, 185, 129',
  },
  /** 中强信号（绿） */
  signalMediumStrong: {
    hex: '#22c55e',
    tailwind: 'text-green-500',
    bgClass: 'bg-green-500',
    rgb: '34, 197, 94',
  },
  /** 中信号（蓝） */
  signalMedium: {
    hex: '#3b82f6',
    tailwind: 'text-blue-500',
    bgClass: 'bg-blue-500',
    rgb: '59, 130, 246',
  },
  /** 弱信号（琥珀） */
  signalWeak: {
    hex: '#f59e0b',
    tailwind: 'text-amber-500',
    bgClass: 'bg-amber-500',
    rgb: '245, 158, 11',
  },
  /** 无信号（灰） */
  signalNone: {
    hex: '#9ca3af',
    tailwind: 'text-gray-400',
    bgClass: 'bg-gray-400',
    rgb: '156, 163, 175',
  },

  // ============================================================
  // 背景色
  // ============================================================
  /** 卡片背景 */
  bgCard: {
    hex: '#ffffff',
    tailwind: 'bg-white',
    rgb: '255, 255, 255',
  },
  /** 悬停背景 */
  bgHover: {
    hex: '#f8fafc',
    tailwind: 'bg-slate-50',
    rgb: '248, 250, 252',
  },
  /** 次要背景 */
  bgMuted: {
    hex: '#f1f5f9',
    tailwind: 'bg-slate-100',
    rgb: '241, 245, 249',
  },
  /** 浅色信号背景 */
  bgEmerald50: {
    hex: '#ecfdf5',
    tailwind: 'bg-emerald-50',
    rgb: '236, 253, 245',
  },
  /** 浅色绿背景 */
  bgGreen50: {
    hex: '#f0fdf4',
    tailwind: 'bg-green-50',
    rgb: '240, 253, 244',
  },
  /** 浅色蓝背景 */
  bgBlue50: {
    hex: '#eff6ff',
    tailwind: 'bg-blue-50',
    rgb: '239, 246, 255',
  },
  /** 浅色琥珀背景 */
  bgAmber50: {
    hex: '#fffbeb',
    tailwind: 'bg-amber-50',
    rgb: '255, 251, 235',
  },
  /** 浅色灰背景 */
  bgSlate50: {
    hex: '#f8fafc',
    tailwind: 'bg-slate-50',
    rgb: '248, 250, 252',
  },

  // ============================================================
  // 文字色
  // ============================================================
  /** 主要文字 */
  textPrimary: {
    hex: '#1e293b',
    tailwind: 'text-slate-800',
    rgb: '30, 41, 59',
  },
  /** 次要文字 */
  textSecondary: {
    hex: '#64748b',
    tailwind: 'text-slate-500',
    rgb: '100, 116, 139',
  },
  /** 弱化文字 */
  textMuted: {
    hex: '#94a3b8',
    tailwind: 'text-slate-400',
    rgb: '148, 163, 184',
  },

  // ============================================================
  // 边框色
  // ============================================================
  /** 默认边框 */
  border: {
    hex: '#e2e8f0',
    tailwind: 'border-slate-200',
    rgb: '226, 232, 240',
  },
  /** 悬停边框 */
  borderHover: {
    hex: '#cbd5e1',
    tailwind: 'border-slate-300',
    rgb: '203, 213, 225',
  },

  // ============================================================
  // 焦点可见样式（Focus Visible）
  // ============================================================
  /** 焦点环颜色（用于 focus-visible 状态） */
  focusRing: {
    hex: '#3b82f6',
    tailwind: 'ring-blue-500',
    bgClass: 'bg-blue-500',
    rgb: '59, 130, 246',
  },

  // ============================================================
  // 灰色阶（用于文字/边框/背景的灰度语义）
  // ============================================================
  /** 灰 500 - 中等灰度文字/占位 */
  gray500: {
    hex: '#6b7280',
    tailwind: 'text-gray-500',
    bgClass: 'bg-gray-500',
    rgb: '107, 114, 128',
  },
} as const

// ============================================================
// 图表调色板（Chart Palette）
// ============================================================
/**
 * 图表专用调色板
 * @description 提供多系列图表的颜色序列与辅助元素色，
 * 结构与 COLOR_TOKENS 不同（扁平的色值集合），独立导出以避免类型污染。
 */
export const CHART_PALETTE = {
  /** 系列色 1 - 蓝 */
  series1: '#3b82f6',   // blue-500
  /** 系列色 2 - 翠绿 */
  series2: '#10b981',   // emerald-500
  /** 系列色 3 - 琥珀 */
  series3: '#f59e0b',   // amber-500
  /** 系列色 4 - 红 */
  series4: '#ef4444',   // red-500
  /** 系列色 5 - 紫 */
  series5: '#8b5cf6',   // violet-500
  /** 系列色 6 - 青 */
  series6: '#06b6d4',   // cyan-500
  /** 网格线色 */
  grid: '#e5e7eb',      // gray-200
  /** 坐标轴文字色 */
  axis: '#6b7280',      // gray-500
  /** 提示框背景色 */
  tooltipBg: '#1f2937', // gray-800
} as const

// ============================================================
// 间距令牌（Spacing Tokens）
// ============================================================

/**
 * 间距令牌系统
 * v0.9.14 P5-SPACE
 * 基于 4px 栅格系统，所有间距均为 4px 的倍数
 * @description 语义化间距常量，用于 style 内联样式中的 padding/margin/gap
 * 优先使用语义化 token（cardPadding、sectionGap 等），
 * 基础 token（xs/sm/md/lg）仅用于特殊场景
 */
export const SPACING_TOKENS = {
  // 基础间距（4px 栅格）
  xs: '4px',      // 0.25rem - 极小间距
  sm: '8px',      // 0.5rem - 小间距
  md: '12px',     // 0.75rem - 中间距
  lg: '16px',     // 1rem - 大间距
  xl: '24px',     // 1.5rem - 超大间距
  xxl: '32px',    // 2rem - 极大间距
  xxxl: '48px',   // 3rem - 巨间距

  // 语义化间距
  sectionGap: '24px',       // 区块间距
  cardPadding: '16px',      // 卡片内边距
  componentGap: '12px',     // 组件间距
  textGap: '8px',           // 文本间距
  iconGap: '8px',           // 图标间距
  inputPadding: '8px 12px', // 输入框内边距

  // 布局间距
  pagePadding: '24px',      // 页面内边距
  widgetGap: '16px',        // Widget 间距
  tableCellPadding: '8px 12px', // 表格单元格内边距
} as const

/** 间距 token 类型 */
export type SpacingKey = keyof typeof SPACING_TOKENS

/** 语义化颜色 token 类型 */
export type ColorTokenKey = keyof typeof COLOR_TOKENS

/** 获取颜色 token 的 HEX 值 */
export function getColorHex(key: ColorTokenKey): string {
  const token = COLOR_TOKENS[key]
  if (token && 'hex' in token) return token.hex
  return '#9ca3af'
}

/** 获取颜色 token 的 Tailwind 类名 */
export function getColorTailwind(key: ColorTokenKey): string {
  const token = COLOR_TOKENS[key]
  if (token && 'tailwind' in token) return token.tailwind
  return 'text-gray-400'
}

/** 获取颜色 token 的背景类名 */
export function getColorBgClass(key: ColorTokenKey): string {
  const token = COLOR_TOKENS[key]
  if (!token) return 'bg-gray-400'
  // 如果有 bgClass 属性则返回，否则返回 tailwind 值（某些 token 的 tailwind 本身就是背景类）
  if ('bgClass' in token) return token.bgClass
  if ('tailwind' in token) return token.tailwind
  return 'bg-gray-400'
}

/** 图标尺寸令牌类型 */
export type ThemeIconSizeToken = keyof typeof THEME_TOKENS.iconSizes

/** 控件尺寸令牌类型 */
export type ThemeControlSizeToken = keyof typeof THEME_TOKENS.controlSizes

/** 间距令牌类型 */
export type ThemeSpacingToken = keyof typeof THEME_TOKENS.spacing

/** 圆角令牌类型 */
export type ThemeRadiusToken = keyof typeof THEME_TOKENS.radius

/** 间隙令牌类型 */
export type ThemeGapToken = keyof typeof THEME_TOKENS.gap

/** 堆叠间隙令牌类型 */
export type ThemeStackGapToken = keyof typeof THEME_TOKENS.stackGap

/** 评分阈值令牌类型 */
export type ThemeScoreToken = keyof typeof THEME_TOKENS.score
