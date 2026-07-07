/**
 * @fileoverview L3/4 辅助类（DARK + HOVER + GRADIENT + CHART_PALETTE + SPACING_TOKENS）
 *
 * 从 theme.tokens.ts 拆分而来，职责：暗色/悬停/渐变辅助类 + 图表调色板 + 间距令牌
 *
 * @module constants/theme/helpers
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
 */

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
  bgGreen700: 'hover:bg-green-700',
  bgGreen800: 'hover:bg-green-800',
  bgBlue700: 'hover:bg-blue-700',
  bgAmber700: 'hover:bg-amber-700',
  bgAmber800: 'hover:bg-amber-800',
  bgYellow700: 'hover:bg-yellow-700',
  bgGray700: 'hover:bg-gray-700',
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
