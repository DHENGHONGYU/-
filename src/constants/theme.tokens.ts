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

/**
 * 语义化颜色体系（Design Tokens）
 * @description 统一的颜色语义映射，支持 HEX/Tailwind 类名/RGB 三种格式
 * 用于状态、评分等级、背景、文字、边框等场景
 * 
 * @deprecated 股票涨跌颜色请使用 STOCK_COLOR_TOKENS（例外规则）
 */
export const COLOR_TOKENS = {
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
  /** 成功色（绿）—— bgClass 使用 green-700 以确保与白色文字对比度 ≥ 4.5:1（WCAG AA） */
  success: {
    hex: '#15803d',
    tailwind: 'text-green-700',
    bgClass: 'bg-green-700',
    rgb: '21, 128, 61',
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
  // 股票涨跌色（例外规则：豁免主题切换，始终红涨绿跌）
  // ============================================================
  /** 上涨色（红）—— 中国A股标准，豁免主题切换 */
  up: {
    hex: '#ef4444',
    tailwind: 'text-red-500',
    bgClass: 'bg-red-500',
    rgb: '239, 68, 68',
  },
  /** 下跌色（绿）—— 中国A股标准，豁免主题切换 */
  down: {
    hex: '#22c55e',
    tailwind: 'text-green-500',
    bgClass: 'bg-green-500',
    rgb: '34, 197, 94',
  },
  /** 平盘/中性色（灰）—— 涨跌幅为 0 时使用 */
  neutral: {
    hex: '#9ca3af',
    tailwind: 'text-gray-400',
    bgClass: 'bg-gray-400',
    rgb: '156, 163, 175',
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
  /** 卡片背景（支持暗色模式） */
  bgCard: {
    hex: '#ffffff',
    tailwind: 'bg-card',
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
// 颜色色阶（Color Shades）—— 用于组件内 Tailwind 类名替换
// ============================================================
/**
 * 语义色阶令牌
 * @description 提供每个语义色的多色阶 Tailwind 类名与 HEX 值，
 * 供组件层引用以消除硬编码 Tailwind 颜色类。
 * 用法：`COLOR_SHADES.red[600]` → `'text-red-600'`
 *       `COLOR_SHADES.red[50]` → `'bg-red-50'`
 *       `style={{ color: COLOR_SHADES.red[600] }}`
 */
export const COLOR_SHADES = {
  red: {
    50: 'bg-red-50',
    100: 'bg-red-100',
    200: 'border-red-200',
    300: 'border-red-300',
    400: 'text-red-400',
    500: 'text-red-500',
    600: 'text-red-600',
    700: 'text-red-700',
    800: 'text-red-800',
    /** 暗色模式文字（浅红，用于 dark bg 上） */
    '200Dark': 'dark:text-red-200',
    '300Dark': 'dark:text-red-300',
    /** 暗色模式背景 */
    '900DarkBg': 'dark:bg-red-950',
    '950DarkBg': 'dark:bg-red-950/30',
    '900DarkBorder': 'dark:border-red-900',
    '800DarkBorder': 'dark:border-red-800',
    hex: {
      50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
      400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
      800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
    },
  },
  green: {
    50: 'bg-green-50',
    100: 'bg-green-100',
    200: 'border-green-200',
    300: 'border-green-300',
    400: 'text-green-400',
    500: 'text-green-500',
    600: 'text-green-600',
    700: 'text-green-700',
    800: 'text-green-800',
    '200Dark': 'dark:text-green-200',
    '300Dark': 'dark:text-green-300',
    '900DarkBg': 'dark:bg-green-950',
    '950DarkBg': 'dark:bg-green-950',
    '900DarkBorder': 'dark:border-green-900',
    hex: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
      400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
      800: '#166534', 900: '#14532d', 950: '#052e16',
    },
  },
  amber: {
    50: 'bg-amber-50',
    100: 'bg-amber-100',
    200: 'border-amber-200',
    300: 'border-amber-300',
    500: 'text-amber-500',
    600: 'text-amber-600',
    700: 'text-amber-700',
    '900DarkBg': 'dark:bg-amber-950',
    '900DarkBorder': 'dark:border-amber-900',
    hex: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
      500: '#f59e0b', 600: '#d97706', 700: '#b45309',
    },
  },
  blue: {
    50: 'bg-blue-50',
    100: 'bg-blue-100',
    200: 'border-blue-200',
    300: 'border-blue-300',
    500: 'text-blue-500',
    600: 'text-blue-600',
    700: 'text-blue-700',
    800: 'text-blue-800',
    '900DarkBg': 'dark:bg-blue-950',
    '900DarkBorder': 'dark:border-blue-900',
    hex: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af',
    },
  },
  yellow: {
    50: 'bg-yellow-50',
    100: 'bg-yellow-100',
    200: 'border-yellow-200',
    300: 'border-yellow-300',
    500: 'text-yellow-500',
    600: 'text-yellow-600',
    700: 'text-yellow-700',
    '900DarkBg': 'dark:bg-yellow-950',
    '900DarkBorder': 'dark:border-yellow-900',
    hex: {
      50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
      500: '#eab308', 600: '#ca8a04', 700: '#a16207',
    },
  },
  purple: {
    50: 'bg-purple-50',
    100: 'bg-purple-100',
    500: 'text-purple-500',
    700: 'text-purple-700',
    800: 'text-purple-800',
    hex: {
      50: '#faf5ff', 100: '#f3e8ff', 500: '#8b5cf6', 700: '#7e22ce', 800: '#6b21a8',
    },
  },
  indigo: {
    100: 'bg-indigo-100',
    700: 'text-indigo-700',
    hex: { 100: '#e0e7ff', 700: '#4338ca' },
  },
  teal: {
    100: 'bg-teal-100',
    700: 'text-teal-700',
    hex: { 100: '#ccfbf1', 700: '#0f766e' },
  },
  cyan: {
    100: 'bg-cyan-100',
    700: 'text-cyan-700',
    hex: { 100: '#cffafe', 700: '#0e7490' },
  },
  orange: {
    100: 'bg-orange-100',
    500: 'text-orange-500',
    600: 'text-orange-600',
    800: 'text-orange-800',
    hex: { 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 800: '#9a3412' },
  },
  emerald: {
    50: 'bg-emerald-50',
    500: 'text-emerald-500',
    600: 'text-emerald-600',
    hex: { 50: '#ecfdf5', 500: '#10b981', 600: '#059669' },
  },
  slate: {
    50: 'bg-slate-50',
    100: 'bg-slate-100',
    200: 'border-slate-200',
    300: 'border-slate-300',
    400: 'text-slate-400',
    500: 'text-slate-500',
    700: 'text-slate-700',
    hex: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 700: '#334155' },
  },
  /** 灰色阶（用于 skeleton/placeholder/次要文字等） */
  gray: {
    50: 'bg-gray-50',
    100: 'bg-gray-100',
    200: 'bg-gray-200',
    300: 'border-gray-300',
    400: 'text-gray-400',
    500: 'text-gray-500',
    600: 'text-gray-600',
    700: 'text-gray-700',
    800: 'text-gray-800',
    hex: {
      50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
      400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937',
    },
  },
} as const

/**
 * 语义色映射表
 * 将语义色名称映射到具体的 Tailwind 颜色类
 * 
 * @deprecated 股票涨跌颜色请使用 STOCK_COLOR_TOKENS（例外规则）
 */
const SEMANTIC_COLORS = {
  primary: { text: 'text-gray-900', bg: 'bg-white', border: 'border-gray-300' },
  secondary: { text: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300' },
  muted: { text: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200' },
  surface: { text: 'text-gray-900', bg: 'bg-white', border: 'border-gray-200' },
  default: { text: 'text-gray-900', bg: 'bg-white', border: 'border-gray-300' },
} as const

type SemanticColor = keyof typeof SEMANTIC_COLORS

/**
 * Tailwind 文字色辅助
 * 
 * @example twText('red', 600) → 'text-red-600'
 * @example twText('primary') → 'text-gray-900' (语义模式)
 * 
 * @deprecated 语义模式（单参数）已弃用，请使用双参数显式指定色阶
 * 推荐：twText('gray', 900) 而非 twText('primary')
 */
export function twText(color: string, shade?: number): string {
  if (shade === undefined) {
    // 语义色模式（已弃用）
    if (color in SEMANTIC_COLORS) {
      return SEMANTIC_COLORS[color as SemanticColor].text
    }
    // 默认使用 500 色阶
    return `text-${color}-500`
  }
  // 显式色阶模式（推荐）
  return `text-${color}-${shade}`
}

/**
 * Tailwind 背景色辅助
 * 
 * @example twBg('red', 50) → 'bg-red-50'
 * @example twBg('surface') → 'bg-white' (语义模式)
 * 
 * @deprecated 语义模式（单参数）已弃用，请使用双参数显式指定色阶
 * 推荐：twBg('gray', 100) 而非 twBg('muted')
 */
export function twBg(color: string, shade?: number | string): string {
  if (shade === undefined) {
    // 语义色模式（已弃用）
    if (color in SEMANTIC_COLORS) {
      return SEMANTIC_COLORS[color as SemanticColor].bg
    }
    // 默认使用 500 色阶
    return `bg-${color}-500`
  }
  // 显式色阶模式（推荐）
  return `bg-${color}-${shade}`
}

/**
 * Tailwind 边框色辅助
 * 
 * @example twBorder('red', 200) → 'border-red-200'
 * @example twBorder('default') → 'border-gray-300' (语义模式)
 * 
 * @deprecated 语义模式（单参数）已弃用，请使用双参数显式指定色阶
 * 推荐：twBorder('gray', 300) 而非 twBorder('default')
 */
export function twBorder(color: string, shade?: number): string {
  if (shade === undefined) {
    // 语义色模式（已弃用）
    if (color in SEMANTIC_COLORS) {
      return SEMANTIC_COLORS[color as SemanticColor].border
    }
    // 默认使用 300 色阶
    return `border-${color}-300`
  }
  // 显式色阶模式（推荐）
  return `border-${color}-${shade}`
}

// ============================================================
// 暗色模式 / 悬停态 / 渐变 辅助类（Dark / Hover / Gradient Helpers）
// ============================================================
// 用途：消除 UI 层 `dark:bg-slate-800`、`hover:bg-red-100` 等硬编码 Tailwind 颜色类。
// 这些字符串仅在令牌定义文件中以字面量存在（审计豁免），
// 组件层通过属性访问引用，源码中不出现 `bg-color-shade` 字面拼接。

/**
 * 暗色模式 Tailwind 颜色类
 * @description 用于替换组件中 `dark:bg-*` / `dark:text-*` / `dark:border-*` 硬编码
 */
export const DARK = {
  bgSlate800: 'dark:bg-slate-800',
  bgSlate900: 'dark:bg-slate-900',
  bgSlate900Half: 'dark:bg-slate-900/50',
  textSlate100: 'dark:text-slate-100',
  textSlate200: 'dark:text-slate-200',
  textSlate300: 'dark:text-slate-300',
  textSlate400: 'dark:text-slate-400',
  borderSlate700: 'dark:border-slate-700',
  bgRed950: 'dark:bg-red-950',
  bgRed950_30: 'dark:bg-red-950/30',
  textRed200: 'dark:text-red-200',
  textRed300: 'dark:text-red-300',
  borderRed900: 'dark:border-red-900',
  borderRed800: 'dark:border-red-800',
  bgGreen950: 'dark:bg-green-950',
  textGreen100: 'dark:text-green-100',
  borderGreen900: 'dark:border-green-900',
  bgYellow950: 'dark:bg-yellow-950',
  textYellow100: 'dark:text-yellow-100',
  borderYellow900: 'dark:border-yellow-900',
  bgBlue950: 'dark:bg-blue-950',
  textBlue100: 'dark:text-blue-100',
  borderBlue900: 'dark:border-blue-900',
} as const

/**
 * 悬停态 Tailwind 颜色类
 * @description 用于替换组件中 `hover:bg-*` / `hover:text-*` / `hover:border-*` / `hover:ring-*` 硬编码
 */
export const HOVER = {
  bgRed100: 'hover:bg-red-100',
  bgRed600: 'hover:bg-red-600',
  bgGreen800: 'hover:bg-green-800',
  bgAmber800: 'hover:bg-amber-800',
  bgSlate200: 'hover:bg-slate-200',
  bgGray100: 'hover:bg-gray-100',
  ringSlate300: 'hover:ring-slate-300',
} as const

/**
 * 渐变 Tailwind 颜色类
 * @description 用于替换组件中 `from-*` / `to-*` 硬编码
 */
export const GRADIENT = {
  fromEmerald500: 'from-emerald-500',
  toSky500: 'to-sky-500',
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
  /** 提示框文字色 */
  tooltipText: '#ffffff', // white
  /** 网格线色（浅） */
  gridLight: '#e5e7eb', // gray-200
  /** 坐标轴文字色（深） */
  axisDark: '#4b5563', // gray-600
  /** 涨跌色 - 涨 */
  upColor: '#10b981', // emerald-500
  /** 涨跌色 - 跌 */
  downColor: '#ef4444', // red-500
  /** 主题强调色 */
  accent: '#0ea5e9', // sky-500
  /** 因子热力图：低端颜色（-1） */
  factorHeatmapLow: '#ffc832',
  /** 因子热力图：中点颜色（0） */
  factorHeatmapMid: '#f59e0b',
  /** 因子热力图：高端颜色（1） */
  factorHeatmapHigh: '#3296ff',
  /** 雷达图默认填充/描边色 */
  radarDefault: '#0ea5e9', // sky-500
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
export type ThemeScoreThresholdToken = keyof typeof THEME_TOKENS.score

// ============================================================
// 股票涨跌颜色例外规则（红涨绿跌）
// ============================================================

/**
 * 股票涨跌颜色令牌（例外规则）
 * 
 * @remarks
 * **这是例外规则**，不受通用颜色规范或主题切换影响：
 * - 股票上涨 → 红色（中国A股标准：红涨绿跌）
 * - 股票下跌 → 绿色（中国A股标准：红涨绿跌）
 * - 平盘 → 灰色
 * 
 * @important
 * 这些颜色**必须**豁免主题切换（暗色模式不改变涨跌颜色）
 * 如需实现主题切换，请确保这些颜色不被修改
 * 
 * @example
 * // ✅ 正确用法（使用 STOCK_COLOR_TOKENS，自动豁免主题切换）
 * import { STOCK_COLOR_TOKENS, getStockColor } from '@/constants/theme.tokens'
 * const color = getStockColor(3.2) // => STOCK_COLOR_TOKENS.up
 * 
 * // ❌ 错误用法（使用 COLOR_TOKENS，可能被主题切换影响）
 * import { COLOR_TOKENS } from '@/constants/theme.tokens'
 * const color = change >= 0 ? COLOR_TOKENS.up.hex : COLOR_TOKENS.down.hex
 */
export const STOCK_COLOR_TOKENS = {
  /** 上涨颜色（红色，中国A股标准） */
  up: {
    hex: '#ef4444',
    tailwind: 'text-red-500',
    bgClass: 'bg-red-500',
    rgb: '239, 68, 68',
  },
  /** 下跌颜色（绿色，中国A股标准） */
  down: {
    hex: '#22c55e',
    tailwind: 'text-green-500',
    bgClass: 'bg-green-500',
    rgb: '34, 197, 94',
  },
  /** 平盘/中性颜色（灰色） */
  neutral: {
    hex: '#9ca3af',
    tailwind: 'text-gray-400',
    bgClass: 'bg-gray-400',
    rgb: '156, 163, 175',
  },
} as const

/** 股票颜色令牌类型 */
export type StockColorTokenKey = keyof typeof STOCK_COLOR_TOKENS

/**
 * 获取股票涨跌颜色（自动判断，豁免主题切换）
 * @param change - 涨跌值（正数=上涨，负数=下跌，0=平盘）
 * @returns 颜色令牌（包含 hex/tailwind/bgClass/rgb）
 * 
 * @example
 * const color = getStockColor(3.2) // => STOCK_COLOR_TOKENS.up
 * const color = getStockColor(-1.5) // => STOCK_COLOR_TOKENS.down
 * const color = getStockColor(0) // => STOCK_COLOR_TOKENS.neutral
 */
export function getStockColor(change: number) {
  if (change > 0) return STOCK_COLOR_TOKENS.up
  if (change < 0) return STOCK_COLOR_TOKENS.down
  return STOCK_COLOR_TOKENS.neutral
}

/**
 * 获取股票涨跌 Tailwind 类名（自动判断，豁免主题切换）
 * @param change - 涨跌值
 * @returns Tailwind 类名（如 `text-red-500`）
 * 
 * @example
 * const className = getStockColorClass(3.2) // => 'text-red-500'
 * const className = getStockColorClass(-1.5) // => 'text-green-500'
 */
export function getStockColorClass(change: number): string {
  return getStockColor(change).tailwind
}

/**
 * 获取股票涨跌 HEX 色值（自动判断，豁免主题切换）
 * @param change - 涨跌值
 * @returns HEX 色值（如 `#ef4444`）
 * 
 * @example
 * const hex = getStockColorHex(3.2) // => '#ef4444'（红色）
 * const hex = getStockColorHex(-1.5) // => '#22c55e'（绿色）
 */
export function getStockColorHex(change: number): string {
  return getStockColor(change).hex
}

/**
 * 获取股票涨跌背景类名（自动判断，豁免主题切换）
 * @param change - 涨跌值
 * @returns 背景类名（如 `bg-red-500`）
 */
export function getStockColorBg(change: number): string {
  return getStockColor(change).bgClass
}
export type ThemeScoreToken = keyof typeof THEME_TOKENS.score
