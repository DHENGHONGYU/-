/**
 * @fileoverview L1 基础令牌（THEME_TOKENS）
 *
 * 从 theme.tokens.ts 拆分而来，职责：通用语义色+尺寸+间距+圆角+排版等基础令牌
 *
 * @module constants/theme/base
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
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

  /** 图标尺寸令牌 */
  iconSizes: {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  },

  /** 控件尺寸令牌 */
  controlSizes: {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  },

  /** 间距令牌 */
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

  /** 圆角令牌 */
  radius: {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  },

  /** 间隙令牌（flex/grid gap） */
  gap: {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-6',
  },

  /** 堆叠间隙令牌（垂直方向 space-y） */
  stackGap: {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-3',
    lg: 'space-y-4',
    xl: 'space-y-6',
  },

  /** 评分阈值令牌（0-5 分制） */
  score: {
    /** 优秀阈值 */
    excellent: 4,
    /** 良好阈值 */
    good: 3,
    /** 一般/可接受阈值 */
    ok: 2,
  },

  /** 焦点可见样式令牌（Focus Visible） */
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

  /**
   * 排版令牌（Typography）
   * @description 字体大小、字重、行高、字间距等排版相关令牌
   */
  typography: {
    /** 字体大小 */
    fontSize: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
    },
    /** 字重 */
    fontWeight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
    /** 行高 */
    lineHeight: {
      none: 'leading-none',
      tight: 'leading-tight',
      snug: 'leading-snug',
      normal: 'leading-normal',
      relaxed: 'leading-relaxed',
      loose: 'leading-loose',
    },
    /** 字间距 */
    letterSpacing: {
      tighter: 'tracking-tighter',
      tight: 'tracking-tight',
      normal: 'tracking-normal',
      wide: 'tracking-wide',
      wider: 'tracking-wider',
      widest: 'tracking-widest',
    },
  },
} as const

/** 颜色令牌类型 */
export type ThemeColorToken = keyof typeof THEME_TOKENS.color

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
export type ThemeScoreThresholdToken = keyof typeof THEME_TOKENS.score

/** 评分令牌类型（别名） */
export type ThemeScoreToken = keyof typeof THEME_TOKENS.score
