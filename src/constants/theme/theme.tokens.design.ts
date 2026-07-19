/**
 * @fileoverview L6 设计系统（SEMANTIC_COLOR_ROLES + TYPOGRAPHY_SCALE + ELEVATION + LAYOUT_TOKENS）
 *
 * 从 theme.tokens.ts 拆分而来，职责：统一设计系统基座
 *
 * @module constants/theme/design
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
 */

// ============================================================
// 统一设计系统（V9 设计基座）
// ------------------------------------------------------------
// 单一真源：所有语义令牌映射到 index.css 的 HSL CSS 变量（主题感知，
// 自动支持亮/暗色），组件应优先从此处取用，而非裸写 Tailwind 色板类
// （如 text-blue-500）。THEME_TOKENS.color 中的裸类字符串为历史遗留，
// 仅用于无主题概念的图表/内联场景，新代码请勿使用。
// ============================================================

/**
 * 语义色角色（Semantic Color Roles）
 * @description 以"角色"而非"色值"组织颜色，保证全应用视觉一致性。
 *   - text/bg/soft 为 Tailwind 工具类（主题感知）
 *   - raw 为亮色模式代表 HEX（供图表 / canvas 等无法用工具类的场景）
 * 注意：股票涨跌色见 STOCK_COLOR_TOKENS（红涨绿跌例外规则），不在此处。
 */
export const SEMANTIC_COLOR_ROLES = {
  /** 品牌主色：关键操作、强调、选中态 */
  primary: {
    text: 'text-primary',
    bg: 'bg-primary',
    soft: 'bg-primary/10 text-primary',
    fg: 'text-primary-foreground',
    raw: '#0d9165',
  },
  /** 辅助色：次级操作、标签底 */
  secondary: {
    text: 'text-secondary-foreground',
    bg: 'bg-secondary',
    soft: 'bg-secondary text-secondary-foreground',
    raw: '#1e293b',
  },
  /** 中性 / 文字 */
  neutral: {
    text: 'text-foreground',
    bg: 'bg-background',
    soft: 'bg-muted text-muted-foreground',
    raw: '#0f172a',
  },
  /** 表面：卡片 / 面板 / 边框 */
  surface: {
    bg: 'bg-card',
    bgSub: 'bg-surface-2',
    border: 'border-border',
    borderStrong: 'border-divider',
    raw: '#ffffff',
  },
  /** 文字层级 */
  text: {
    primary: 'text-foreground',
    secondary: 'text-muted-foreground',
    tertiary: 'text-tertiary',
  },
  /** 正向 / 成功 */
  success: {
    text: 'text-success',
    bg: 'bg-success',
    soft: 'bg-success/10 text-success',
    fg: 'text-success-foreground',
    raw: '#21c45d',
  },
  /** 警示 / 注意 */
  warning: {
    text: 'text-warning',
    bg: 'bg-warning',
    soft: 'bg-warning/10 text-warning',
    fg: 'text-warning-foreground',
    raw: '#f59f0a',
  },
  /** 危险 / 错误 */
  danger: {
    text: 'text-destructive',
    bg: 'bg-destructive',
    soft: 'bg-destructive/10 text-destructive',
    fg: 'text-destructive-foreground',
    raw: '#ef4444',
  },
  /** 信息 / 链接 */
  info: {
    text: 'text-info',
    bg: 'bg-info',
    soft: 'bg-info/10 text-info',
    fg: 'text-info-foreground',
    raw: '#3c83f6',
  },
} as const

/** 语义色角色类型 */
export type SemanticColorRole = keyof typeof SEMANTIC_COLOR_ROLES

/**
 * 排版阶梯（Typography Scale）
 * @description 明确的字号 / 字重 / 行高 / 字间距规范，建立单一信息层级。
 *   - utility 为 Tailwind 工具类（已在 tailwind.config.js 注册）
 *   - px 为参考字号（设计标注用）
 *   - key 用于图表 / 富文本等需要 JS 取字号值的场景
 */
export const TYPOGRAPHY_SCALE = {
  /** 页面主标题 / 英雄区 */
  display: { utility: 'text-display', px: 28, weight: 700, lineHeight: 1.2, usage: '页面主标题、英雄区大标题' },
  /** 一级标题 */
  h1: { utility: 'text-h1', px: 24, weight: 700, lineHeight: 1.25, usage: '页面标题、区块大标题' },
  /** 二级标题 */
  h2: { utility: 'text-h2', px: 20, weight: 600, lineHeight: 1.3, usage: '卡片标题、子区块标题' },
  /** 三级标题 */
  h3: { utility: 'text-h3', px: 18, weight: 600, lineHeight: 1.4, usage: '分组标题、列表组头' },
  /** 四级标题（16px/600，与 bodyLg 同字号，靠字重 600 vs 400 区分） */
  h4: { utility: 'text-h4', px: 16, weight: 600, lineHeight: 1.4, usage: '小标题、表头、标签组' },
  /** 五级标题（15px/500，h4 与 body 之间的次级小标题） */
  h5: { utility: 'text-h5', px: 15, weight: 500, lineHeight: 1.4, usage: '次级小标题、密集卡片标题' },
  /** 六级标题（13px/600，最小标题层级，与 bodySm 同字号靠字重区分） */
  h6: { utility: 'text-h6', px: 13, weight: 600, lineHeight: 1.4, usage: '最小标题、表单分组标签' },
  /** 正文（大） */
  bodyLg: { utility: 'text-body-lg', px: 16, weight: 400, lineHeight: 1.6, usage: '导语、重要段落' },
  /** 正文（默认） */
  body: { utility: 'text-body', px: 14, weight: 400, lineHeight: 1.6, usage: '默认正文、表单标签' },
  /** 正文（小） */
  bodySm: { utility: 'text-body-sm', px: 13, weight: 400, lineHeight: 1.5, usage: '辅助正文、表格单元格' },
  /** 辅助文字 */
  caption: { utility: 'text-caption', px: 12, weight: 400, lineHeight: 1.4, usage: '说明、提示、时间戳' },
  /** 微型标注 */
  overline: { utility: 'text-overline', px: 11, weight: 600, lineHeight: 1.4, usage: '分组标签、胶囊标注（大写）' },
} as const

/** 排版阶梯类型 */
export type TypographyRole = keyof typeof TYPOGRAPHY_SCALE

/**
 * 层级阴影（Elevation）
 * @description 用阴影表达 z 轴层级，替代随意的边框/背景区分。
 */
export const ELEVATION = {
  /** 静态卡片、输入框 */
  sm: 'shadow-elevation-1',
  /** 悬浮卡片、下拉、弹层 */
  md: 'shadow-elevation-2',
  /** 模态、抽屉、浮层 */
  lg: 'shadow-elevation-3',
} as const

/** 层级阴影类型 */
export type ElevationToken = keyof typeof ELEVATION

/**
 * 布局令牌（Layout）
 * @description 统一的页面容器、内边距、栅格间距，保证多页面结构一致。
 */
export const LAYOUT_TOKENS = {
  /** 页面内容最大宽度 */
  containerMaxWidth: '1200px',
  /** 页面水平内边距 */
  pagePaddingX: '24px',
  /** 页面垂直内边距 */
  pagePaddingY: '24px',
  /** 区块间距 */
  sectionGap: '24px',
  /** 卡片内边距（标准化为 8px 栅格，原 20px 非 8 倍数） */
  cardPadding: '24px',
  /** 顶栏高度 */
  headerHeight: '56px',
} as const

/** 布局令牌类型 */
export type LayoutToken = keyof typeof LAYOUT_TOKENS
