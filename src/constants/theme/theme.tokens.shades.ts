/**
 * @fileoverview L3 色阶 + 辅助函数（COLOR_SHADES + twText/twBg/twBorder）
 *
 * 从 theme.tokens.ts 拆分而来，职责：特定色阶 + twText/twBg/twBorder 辅助函数
 *
 * @module constants/theme/shades
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
/**
 * 语义色阶令牌
 * @description 提供每个语义色的多色阶 Tailwind 类名与 HEX 值，
 * 供组件层引用以消除硬编码 Tailwind 颜色类。
 * 用法：`COLOR_SHADES.red[600]` → `'text-red-600'`
 *       `COLOR_SHADES.red[50]` → `'bg-red-50'`
 *       `style={{ color: COLOR_SHADES.red[600] }}`
  * @doc []
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
    800: 'text-amber-800',
    '300DarkText': 'dark:text-amber-300',
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
    100: 'bg-emerald-100',
    200: 'border-emerald-200',
    300: 'border-emerald-300',
    400: 'text-emerald-400',
    500: 'text-emerald-500',
    600: 'text-emerald-600',
    700: 'text-emerald-700',
    800: 'text-emerald-800',
    hex: {
      50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
      400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46',
    },
  },
  slate: {
    50: 'bg-slate-50',
    100: 'bg-slate-100',
    200: 'border-slate-200',
    300: 'border-slate-300',
    400: 'text-slate-400',
    500: 'text-slate-500',
    700: 'text-slate-700',
    hex: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 700: '#334155', 800: '#1e293b' },
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
 * @internal 仅供 twText/twBg/twBorder 内部使用，不对外导出
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
 * @deprecated 此函数已全面弃用（2026-08-13 第四轮技术债务清零）。
 * 所有 UI 组件已迁移至 CSS 变量语义令牌，请改用以下替代方案：
 * - 主文字：`'text-foreground'`
 * - 次要文字：`'text-muted-foreground'`
 * - 辅助文字：`'text-muted-foreground/70'`
 * - 错误/危险：`'text-destructive'`
 * - 警告：`'text-warning'`
 * - 成功：`'text-success'`
 * - 信息：`'text-info'`
 *
 * @migration twText('slate', 900) → 'text-foreground'
 * @migration twText('red', 600) → 'text-destructive'
 * @migration twText('green', 600) → 'text-success'
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
 * @deprecated 此函数已全面弃用（2026-08-13 第四轮技术债务清零）。
 * 所有 UI 组件已迁移至 CSS 变量语义令牌，请改用以下替代方案：
 * - 主背景：`'bg-background'`
 * - 次要背景：`'bg-muted'`
 * - 半透明背景：`'bg-muted/50'`
 * - 错误背景：`'bg-destructive/10'`
 * - 警告背景：`'bg-warning/10'`
 * - 成功背景：`'bg-success/10'`
 * - 信息背景：`'bg-info/10'`
 * - 主色按钮：`'bg-primary'`
 *
 * @migration twBg('stone', 50) → 'bg-muted'
 * @migration twBg('red', 50) → 'bg-destructive/10'
 * @migration twBg('blue', 600) → 'bg-primary'
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
 * @deprecated 此函数已全面弃用（2026-08-13 第四轮技术债务清零）。
 * 所有 UI 组件已迁移至 CSS 变量语义令牌，请改用以下替代方案：
 * - 标准边框：`'border-border'`
 * - 输入框边框：`'border-input'`
 * - 错误边框：`'border-destructive/30'`
 * - 警告边框：`'border-warning/30'`
 * - 成功边框：`'border-success/30'`
 * - 信息边框：`'border-info'`
 *
 * @migration twBorder('stone', 200) → 'border-border'
 * @migration twBorder('red', 200) → 'border-destructive/30'
 * @migration twBorder('emerald', 300) → 'border-success/30'
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
