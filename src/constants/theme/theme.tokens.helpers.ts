/**
 * @fileoverview L3/4 辅助类（DARK + HOVER + GRADIENT + CHART_PALETTE + SPACING_TOKENS）
 *
 * 从 theme.tokens.ts 拆分而来，职责：暗色/悬停/渐变辅助类 + 图表调色板 + 间距令牌
 *
 * @module constants/theme/helpers
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
  * @doc []
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
  // V9 高级灰 / 宋韵暗色主题扩展
  bgNeutral700: 'dark:bg-neutral-700',
  bgNeutral800: 'dark:bg-neutral-800',
  bgNeutral900: 'dark:bg-neutral-900',
  bgNeutral900Half: 'dark:bg-neutral-900/50',
  textNeutral100: 'dark:text-neutral-100',
  textNeutral200: 'dark:text-neutral-200',
  textNeutral300: 'dark:text-neutral-300',
  textNeutral400: 'dark:text-neutral-400',
  textNeutral500: 'dark:text-neutral-500',
  textNeutral600: 'dark:text-neutral-600',
  borderNeutral700: 'dark:border-neutral-700',
  borderNeutral800: 'dark:border-neutral-800',
  divideNeutral800: 'dark:divide-neutral-800',
  placeholderNeutral500: 'dark:placeholder:text-neutral-500',
  hoverBgNeutral900Half: 'dark:hover:bg-neutral-900/50',
  hoverTextNeutral200: 'dark:hover:text-neutral-200',
  // emerald 暗色
  textEmerald300: 'dark:text-emerald-300',
  textEmerald400: 'dark:text-emerald-400',
  borderEmerald500: 'dark:border-emerald-500',
  borderEmerald800: 'dark:border-emerald-800',
  borderEmerald900: 'dark:border-emerald-900',
  bgEmerald950_20: 'dark:bg-emerald-950/20',
  bgEmerald950_30: 'dark:bg-emerald-950/30',
  bgEmerald950_50: 'dark:bg-emerald-950/50',
  // 状态色暗色
  bgRed950: 'dark:bg-red-950',
  bgRed950_20: 'dark:bg-red-950/20',
  bgRed950_30: 'dark:bg-red-950/30',
  bgRed950_50: 'dark:bg-red-950/50',
  textRed200: 'dark:text-red-200',
  textRed300: 'dark:text-red-300',
  textRed400: 'dark:text-red-400',
  borderRed900: 'dark:border-red-900',
  borderRed800: 'dark:border-red-800',
  bgAmber950: 'dark:bg-amber-950',
  bgAmber950_30: 'dark:bg-amber-950/30',
  textAmber200: 'dark:text-amber-200',
  textAmber300: 'dark:text-amber-300',
  borderAmber800: 'dark:border-amber-800',
  bgGreen950: 'dark:bg-green-950',
  textGreen100: 'dark:text-green-100',
  borderGreen900: 'dark:border-green-900',
  bgYellow950: 'dark:bg-yellow-950',
  textYellow100: 'dark:text-yellow-100',
  borderYellow900: 'dark:border-yellow-900',
  bgBlue950: 'dark:bg-blue-950',
  bgBlue950_30: 'dark:bg-blue-950/30',
  textBlue100: 'dark:text-blue-100',
  textBlue400: 'dark:text-blue-400',
  borderBlue700: 'dark:border-blue-700',
  borderBlue900: 'dark:border-blue-900',
  // purple 暗色
  bgPurple950_30: 'dark:bg-purple-950/30',
  textPurple400: 'dark:text-purple-400',
  // neutral 补充
  bgNeutral600: 'dark:bg-neutral-600',
  bgNeutral900_60: 'dark:bg-neutral-900/60',
} as const

/**
 * 悬停态 Tailwind 颜色类
 * @description 用于替换组件中 `hover:bg-*` / `hover:text-*` / `hover:border-*` / `hover:ring-*` 硬编码
 */
export const HOVER = {
  // V9 宋韵/高级灰悬停态扩展
  bgStone50: 'hover:bg-stone-50',
  bgStone50Half: 'hover:bg-stone-50/50',
  bgStone100: 'hover:bg-stone-100',
  textStone700: 'hover:text-stone-700',
  borderEmerald400: 'hover:border-emerald-400',
  // 暗色悬停（补充）
  darkHoverBgNeutral800: 'dark:hover:bg-neutral-800',
  // 历史兼容
  bgRed50: 'hover:bg-red-50',
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
 * 表格分隔线 Tailwind 颜色类
 * @description 用于替换组件中 divide-* 硬编码
 */
export const DIVIDE = {
  stone100: 'divide-stone-100',
  neutral800: 'dark:divide-neutral-800',
} as const

/**
 * Focus 状态 Tailwind 颜色类
 * @description 用于替换表单组件 focus:border-* / focus:ring-* 硬编码
 */
export const FOCUS = {
  borderEmerald400: 'focus:border-emerald-400',
  ringEmerald400_30: 'focus:ring-emerald-400/30',
  darkBorderEmerald500: 'dark:focus:border-emerald-500',
} as const

/**
 * SVG fill 颜色类
 * @description 用于替换 SVG 中 fill-* 硬编码
 */
export const FILL = {
  stone400: 'fill-stone-400',
  stone700: 'fill-stone-700',
  stone800: 'fill-stone-800',
  darkNeutral100: 'dark:fill-neutral-100',
  darkNeutral200: 'dark:fill-neutral-200',
  darkNeutral500: 'dark:fill-neutral-500',
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
  grid: '#e2e8f0',      // slate-200（中性收敛，与 tokens.json 一致）
  /** 坐标轴文字色 */
  axis: '#64748b',      // slate-500（中性收敛，与 tokens.json 一致）
  /** 提示框背景色 */
  tooltipBg: '#1e293b', // slate-800（中性收敛，与 tokens.json 一致）
  /** 提示框文字色 */
  tooltipText: '#ffffff', // white
  /** 网格线色（浅） */
  gridLight: '#e2e8f0', // slate-200（中性收敛，与 tokens.json 一致）
  /** 坐标轴文字色（深） */
  axisDark: '#475569', // slate-600（中性收敛，与 tokens.json 一致）
  /** 涨跌色 - 涨（A股红涨，对齐 STOCK_COLOR_TOKENS.up） */
  upColor: '#ef4444', // red-500
  /** 涨跌色 - 涨 50% 透明（对齐 STOCK_COLOR_TOKENS.up.hexAlpha50） */
  upColor50: '#ef444480',
  /** 涨跌色 - 涨 80% 透明（对齐 STOCK_COLOR_TOKENS.up.hexAlpha80） */
  upColor80: '#ef4444cc',
  /** 涨跌色 - 跌（A股绿跌，对齐 STOCK_COLOR_TOKENS.down） */
  downColor: '#22c55e', // green-500
  /** 涨跌色 - 跌 50% 透明（对齐 STOCK_COLOR_TOKENS.down.hexAlpha50） */
  downColor50: '#22c55e80',
  /** 涨跌色 - 跌 80% 透明（对齐 STOCK_COLOR_TOKENS.down.hexAlpha80） */
  downColor80: '#22c55ecc',
  /** 主题强调色 */
  accent: '#0ea5e9', // sky-500
  /** Gauge 仪表盘轨道 */
  gaugeTrack: '#e2e8f0',
  /** Gauge 仪表盘色阶 */
  gaugeLow: '#cbd5e1',
  gaugeMidLow: '#f59e0b',
  gaugeMid: '#14b8a6',
  gaugeHigh: '#10b981',
  gaugeRiskHigh: '#dc2626',
  /** 因子热力图：低端颜色（-1） */
  factorHeatmapLow: '#ffc832',
  /** 因子热力图：中点颜色（0） */
  factorHeatmapMid: '#f59e0b',
  /** 因子热力图：高端颜色（1） */
  factorHeatmapHigh: '#3296ff',
  /** 行业热力图：红绿配色 */
  heatmapRedGreen: { low: '#ef4444', mid: '#f59e0b', high: '#10b981' },
  /** 行业热力图：蓝黄配色 */
  heatmapBlueYellow: { low: '#3b82f6', mid: '#f59e0b', high: '#84cc16' },
  /** 行业热力图：紫绿配色 */
  heatmapPurpleGreen: { low: '#8b5cf6', mid: '#06b6d4', high: '#10b981' },
  /** 行业热力图：单色蓝配色 */
  heatmapMonoBlue: { low: '#dbeafe', mid: '#3b82f6', high: '#1e3a8a' },
  /** 行业热力图：深色文字（用于浅色背景） */
  heatmapTextDark: '#1f2937',
  /** 行业热力图：浅色文字（用于深色背景） */
  heatmapTextLight: '#ffffff',
  /** 雷达图默认填充/描边色 */
  radarDefault: '#0ea5e9', // sky-500
} as const

// ============================================================
// 专业交易软件图表调色板（对标 TradingView / Wind / 同花顺）
// ============================================================
/**
 * 专业级深色图表调色板
 * @description 对标 TradingView 暗色主题的专业配色，适用于 K 线图和多窗格图表。
 * 设计原则：低噪点网格、高对比度文字、柔和坐标轴、专业均线色。
 */
export const CHART_PALETTE_PRO = {
  // ── 背景 ──
  /** 图表背景 */
  bg: '#131722',
  /** 图表容器背景（略浅） */
  bgLight: '#1a1d2e',

  // ── 网格线 ──
  /** 网格线（水平/垂直） */
  grid: 'rgba(255,255,255,0.06)',
  /** 网格线（浅色，副图用） */
  gridLight: 'rgba(255,255,255,0.04)',

  // ── 坐标轴文字 ──
  /** 坐标轴文字 */
  axis: '#787b86',
  /** 坐标轴文字（深色） */
  axisDark: '#5a5d6a',
  /** 高对比度文字 */
  contrast: '#d1d4dc',

  // ── 浮层 ──
  /** 浮层背景 */
  tooltipBg: '#1e2233',
  /** 浮层文字 */
  tooltipText: '#d1d4dc',

  // ── 涨跌色（A股红涨绿跌） ──
  /** 上涨色 */
  upColor: '#ef5350',
  /** 上涨色 50% 透明 */
  upColor50: '#ef535080',
  /** 上涨色 80% 透明 */
  upColor80: '#ef5350cc',
  /** 下跌色 */
  downColor: '#26a69a',
  /** 下跌色 50% 透明 */
  downColor50: '#26a69a80',
  /** 下跌色 80% 透明 */
  downColor80: '#26a69acc',

  // ── 均线系列色（TradingView 经典色） ──
  /** MA5 / 系列1 - 金色 */
  series1: '#f7b731',
  /** MA10 / 系列2 - 蓝色 */
  series2: '#2d98da',
  /** MA20 / 系列3 - 珊瑚红 */
  series3: '#fc5c65',
  /** MA60 / 系列4 - 翠绿 */
  series4: '#26de81',
  /** 系列5 - 紫色 */
  series5: '#a55eea',
  /** 系列6 - 青色 */
  series6: '#2bcbba',

  // ── 十字光标 ──
  /** 十字光标强调色 */
  accent: 'rgba(255,255,255,0.15)',
  /** 十字光标线 */
  crosshairLine: 'rgba(255,255,255,0.12)',

  // ── 仪表盘 ──
  gaugeTrack: '#2a2e3e',
  gaugeLow: '#4a4e5e',
  gaugeMidLow: '#f7b731',
  gaugeMid: '#2bcbba',
  gaugeHigh: '#26de81',
  gaugeRiskHigh: '#ef5350',

  // ── 热力图 ──
  factorHeatmapLow: '#ffc832',
  factorHeatmapMid: '#f7b731',
  factorHeatmapHigh: '#3296ff',
  heatmapRedGreen: { low: '#ef5350', mid: '#f7b731', high: '#26de81' },
  heatmapBlueYellow: { low: '#2d98da', mid: '#f7b731', high: '#a5d63e' },
  heatmapPurpleGreen: { low: '#a55eea', mid: '#2bcbba', high: '#26de81' },
  heatmapMonoBlue: { low: '#1a2744', mid: '#2d98da', high: '#7fc4fd' },
  heatmapTextDark: '#d1d4dc',
  heatmapTextLight: '#131722',

  // ── 雷达图 ──
  radarDefault: '#2d98da',
} as const

// ============================================================
// 图表语义色（V7：跨页面维度-颜色映射）
// ============================================================
/**
 * 图表语义色 — 业务维度 → 颜色的一一映射
 *
 * 解决第二/三轮评审中"不同页面同一维度的图表配色不一致"问题。
 * 所有图表组件引用此常量，而非各自选择颜色，确保跨页面认知一致性。
 *
 * 设计原则：
 * - 估值 → 蓝（理性、客观）
 * - 质量 → 绿（健康、稳健）
 * - 动量 → 橙（活跃、动能）
 * - 波动 → 紫（不确定、警示）
 * - 成长 → 翠绿（生机、向上）
 * - 情绪 → 金（热度、市场心理）
 * - 风险 → 红（警告、危险）
 * - 技术 → 青（精确、计算）
 * - 基准/对比 → 灰（中性、参考）
 */
export const CHART_SEMANTIC_PALETTE = {
  /** 估值维度 — 蓝色系（理性、客观） */
  valuation: {
    primary: '#3b82f6',      // blue-500
    secondary: '#93c5fd',    // blue-300
    background: '#dbeafe',   // blue-100
    dark: '#1e40af',         // blue-800
  },
  /** 质量维度 — 绿色系（健康、稳健） */
  quality: {
    primary: '#10b981',      // emerald-500
    secondary: '#6ee7b7',    // emerald-300
    background: '#d1fae5',   // emerald-100
    dark: '#065f46',         // emerald-800
  },
  /** 动量维度 — 橙色系（活跃、动能） */
  momentum: {
    primary: '#f59e0b',      // amber-500
    secondary: '#fcd34d',    // amber-300
    background: '#fef3c7',   // amber-100
    dark: '#92400e',         // amber-800
  },
  /** 波动维度 — 紫色系（不确定、警示） */
  volatility: {
    primary: '#8b5cf6',      // violet-500
    secondary: '#c4b5fd',    // violet-300
    background: '#ede9fe',   // violet-100
    dark: '#5b21b6',         // violet-800
  },
  /** 成长维度 — 翠绿色系（生机、向上） */
  growth: {
    primary: '#06b6d4',      // cyan-500
    secondary: '#67e8f9',    // cyan-300
    background: '#cffafe',   // cyan-100
    dark: '#155e75',         // cyan-800
  },
  /** 情绪维度 — 金色系（热度、市场心理） */
  sentiment: {
    primary: '#f7b731',      // gold / TradingView MA5
    secondary: '#fed330',    // gold-light
    background: '#fff9db',   // gold-50
    dark: '#92600a',         // gold-800
  },
  /** 风险维度 — 红色系（警告、危险） */
  risk: {
    primary: '#ef4444',      // red-500
    secondary: '#fca5a5',    // red-300
    background: '#fee2e2',   // red-100
    dark: '#991b1b',         // red-800
  },
  /** 技术维度 — 青色系（精确、计算） */
  technical: {
    primary: '#0ea5e9',      // sky-500
    secondary: '#7dd3fc',    // sky-300
    background: '#e0f2fe',   // sky-100
    dark: '#075985',         // sky-800
  },
  /** 基准/对比 — 灰色系（中性、参考） */
  benchmark: {
    primary: '#64748b',      // slate-500
    secondary: '#94a3b8',    // slate-400
    background: '#f1f5f9',   // slate-100
    dark: '#334155',         // slate-700
  },
} as const

/** 图表语义维度键 */
export type ChartSemanticDimension = keyof typeof CHART_SEMANTIC_PALETTE

// ============================================================
// 图表技术指标颜色（Chart Technical Indicator Colors）
// ============================================================

/**
 * 图表技术指标与绘图工具颜色令牌
 * @description 统一管理 K 线图技术指标线、绘图工具等的颜色，
 * 消除组件中硬编码的 Tailwind HEX 颜色（如 #60a5fa）。
 * 所有颜色均来自 Tailwind CSS 调色板，与 shadcn/ui 主题对齐。
 */
export const CHART_INDICATOR_COLORS = {
  /** 蓝色线 — BOLL 上轨/下轨、EMA12、KDJ-K、MACD-DIF、绘图默认色 */
  blue: '#60a5fa',       // blue-400
  /** 金色线 — BOLL 中轨、EMA26、KDJ-D、MACD-DEA、成交量 POC、绘图选中色 */
  amber: '#fbbf24',      // amber-400
  /** 紫色线 — EMA50、KDJ-J、RSI 线 */
  violet: '#a78bfa',     // violet-400
  /** RSI 超买线 */
  rsiOverbought: '#ef5350', // red-500
  /** RSI 超卖线 */
  rsiOversold: '#26a69a',   // teal-500
  /** 绘图工具 — 红色 */
  drawingRed: '#f87171',    // red-400
  /** 绘图工具 — 绿色 */
  drawingGreen: '#4ade80',  // green-400
  /** 绘图工具 — 橙色 */
  drawingOrange: '#fb923c', // orange-400
  /** 绘图工具 — 品红 */
  drawingMagenta: '#e879f9', // fuchsia-400
  /** 绘图工具 — 青色 */
  drawingTeal: '#2dd4bf',   // teal-400
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
