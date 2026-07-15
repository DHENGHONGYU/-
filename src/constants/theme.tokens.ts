/**
 * @fileoverview 主题令牌（barrel re-export）
 *
 * 原单文件 theme.tokens.ts（1275 行），现拆分为 6 个子模块，本文件作为统一入口。
 * 所有 API 保持完全兼容，外部引用方无需修改任何 import 语句。
 *
 * 拆分结构（2026-07-07）：
 * - theme/theme.tokens.base.ts: L1 基础令牌（THEME_TOKENS + 相关类型）
 * - theme/theme.tokens.color.ts: L2 语义色（COLOR_TOKENS + getColorHex/Tailwind/BgClass）
 * - theme/theme.tokens.shades.ts: L3 色阶（COLOR_SHADES + twText/twBg/twBorder）
 * - theme/theme.tokens.helpers.ts: L3/4 辅助类（DARK/HOVER/GRADIENT + CHART_PALETTE + SPACING_TOKENS）
 * - theme/theme.tokens.stock.ts: L5 股票颜色（STOCK_COLOR_TOKENS + getStockColor*，红涨绿跌例外）
 * - theme/theme.tokens.design.ts: L6 设计系统（SEMANTIC_COLOR_ROLES + TYPOGRAPHY_SCALE + ELEVATION + LAYOUT_TOKENS）
 * - theme.tokens.ts（本文件）: barrel re-export，保持原 API 兼容
 *
 * 令牌层次结构：
 * - L1 基础令牌（THEME_TOKENS）→ 通用语义色/尺寸/间距/圆角/排版
 * - L2 语义色（COLOR_TOKENS）→ 业务语义色（涨跌/评分/信号/背景/文字/边框）
 * - L3 色阶（COLOR_SHADES + twText/twBg/twBorder）→ 特定色阶 + 辅助函数
 * - L4 图表（CHART_PALETTE）→ 图表专用调色板
 * - L5 股票颜色（STOCK_COLOR_TOKENS）→ 红涨绿跌例外规则，豁免主题切换
 * - L6 设计系统（SEMANTIC_COLOR_ROLES + TYPOGRAPHY_SCALE + ELEVATION + LAYOUT_TOKENS）→ 统一设计基座
 *
 * @module constants/theme.tokens
 * @updated 2026-07-07 - 拆分为多模块，保持原 API 兼容
 */

// ============================================================
// L1 基础令牌
// ============================================================
export { THEME_TOKENS } from './theme/theme.tokens.base'

// L1 基础令牌类型
export type {
  ThemeColorToken,
  ThemeIconSizeToken,
  ThemeControlSizeToken,
  ThemeSpacingToken,
  ThemeRadiusToken,
  ThemeGapToken,
  ThemeStackGapToken,
  ThemeScoreThresholdToken,
  ThemeScoreToken,
} from './theme/theme.tokens.base'

// ============================================================
// L2 语义色
// ============================================================
export { COLOR_TOKENS, getColorHex, getColorTailwind, getColorBgClass } from './theme/theme.tokens.color'
export type { ColorTokenKey } from './theme/theme.tokens.color'

// ============================================================
// L3 色阶 + 辅助函数
// ============================================================
export { COLOR_SHADES, twText, twBg, twBorder } from './theme/theme.tokens.shades'

// L3/4 辅助类（暗色/悬停/渐变 + 图表调色板 + 间距令牌 + 徽章状态色）
// ============================================================
export { DARK, HOVER, FOCUS, FILL, GRADIENT, DIVIDE, CHART_PALETTE, SPACING_TOKENS } from './theme/theme.tokens.helpers'
export type { SpacingKey } from './theme/theme.tokens.helpers'
export { BADGE_COLORS } from './theme/theme.tokens.badges'
export type { BadgeColorKey } from './theme/theme.tokens.badges'

// ============================================================
// L5 股票颜色（红涨绿跌例外规则，豁免主题切换）
// ============================================================
export {
  STOCK_COLOR_TOKENS,
  getStockColor,
  getStockColorClass,
  getStockColorHex,
  getStockColorBg,
} from './theme/theme.tokens.stock'
export type { StockColorTokenKey } from './theme/theme.tokens.stock'

// ============================================================
// L6 设计系统
// ============================================================
export {
  SEMANTIC_COLOR_ROLES,
  TYPOGRAPHY_SCALE,
  ELEVATION,
  LAYOUT_TOKENS,
} from './theme/theme.tokens.design'
export type {
  SemanticColorRole,
  TypographyRole,
  ElevationToken,
  LayoutToken,
} from './theme/theme.tokens.design'
