/**
 * @fileoverview L2 语义色（COLOR_TOKENS）
 *
 * 从 theme.tokens.ts 拆分而来，职责：业务语义色（涨跌/评分/信号/背景/文字/边框）
 * 包含 COLOR_TOKENS 常量 + ColorTokenKey 类型 + getColorHex/Tailwind/BgClass 辅助函数
 *
 * @module constants/theme/color
 * @created 2026-07-07 - 从 theme.tokens.ts 拆分
/**
 * 语义化颜色体系（Design Tokens）
 * @description 统一的颜色语义映射，支持 HEX/Tailwind 类名/RGB 三种格式
 * 用于状态、评分等级、背景、文字、边框等场景
 *
 * @deprecated 股票涨跌颜色请使用 STOCK_COLOR_TOKENS（例外规则）
  * @doc []
*/
export const COLOR_TOKENS = {
  // ============================================================
  // 状态色
  // ============================================================
  /** 信息提示色（Apple Blue #007AFF） */
  info: { hex: '#007aff', tailwind: 'text-blue-500', bgClass: 'bg-blue-500', rgb: '0, 122, 255' },
  /** 成功色（绿）—— 与语义令牌 text-success / #21C45D 对齐；bgClass 保留 green-700 确保白字徽章对比度 ≥ 4.5:1（WCAG AA） */
  success: { hex: '#21c45d', tailwind: 'text-success', bgClass: 'bg-green-700', rgb: '33, 196, 93' },
  /** 警告色（琥珀） */
  warning: { hex: '#f59e0b', tailwind: 'text-amber-500', bgClass: 'bg-amber-500', rgb: '245, 158, 11' },
  /** 危险色（红） */
  danger: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500', rgb: '239, 68, 68' },
  /** 橙色（降仓警告） */
  orange: { hex: '#f97316', tailwind: 'text-orange-500', bgClass: 'bg-orange-500', rgb: '249, 115, 22' },
  /** 紫色 */
  purple: { hex: '#8b5cf6', tailwind: 'text-purple-500', bgClass: 'bg-purple-500', rgb: '139, 92, 246' },
  /** 青色 */
  cyan: { hex: '#06b6d4', tailwind: 'text-cyan-500', bgClass: 'bg-cyan-500', rgb: '6, 182, 212' },
  /** 粉色 */
  pink: { hex: '#ec4899', tailwind: 'text-pink-500', bgClass: 'bg-pink-500', rgb: '236, 72, 153' },
  /** 青绿 */
  teal: { hex: '#14b8a6', tailwind: 'text-teal-500', bgClass: 'bg-teal-500', rgb: '20, 184, 166' },
  /** 靛蓝 */
  indigo: { hex: '#6366f1', tailwind: 'text-indigo-500', bgClass: 'bg-indigo-500', rgb: '99, 102, 241' },
  /** 翠绿（特殊场景） */
  emerald: { hex: '#10b981', tailwind: 'text-emerald-500', bgClass: 'bg-emerald-500', rgb: '16, 185, 129' },

  // ============================================================
  // 评分等级色
  // ============================================================
  /** 优秀/高分区 */
  scoreHigh: { hex: '#22c55e', tailwind: 'text-green-500', bgClass: 'bg-green-500', rgb: '34, 197, 94' },
  /** 良好/中分区 */
  scoreMid: { hex: '#f59e0b', tailwind: 'text-amber-500', bgClass: 'bg-amber-500', rgb: '245, 158, 11' },
  /** 较差/低分区 */
  scoreLow: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500', rgb: '239, 68, 68' },

  // ============================================================
  // 股票涨跌色（例外规则：豁免主题切换，始终红涨绿跌）
  // ============================================================
  /** 上涨色（红）—— 中国A股标准，豁免主题切换 */
  up: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500', rgb: '239, 68, 68' },
  /** 下跌色（绿）—— 中国A股标准，豁免主题切换 */
  down: { hex: '#22c55e', tailwind: 'text-green-500', bgClass: 'bg-green-500', rgb: '34, 197, 94' },
  /** 平盘/中性色（灰）—— 涨跌幅为 0 时使用 */
  neutral: { hex: '#9ca3af', tailwind: 'text-gray-400', bgClass: 'bg-gray-400', rgb: '156, 163, 175' },

  // ============================================================
  // 轮动因子色
  // ============================================================
  /** 景气因子色（红 - 唯一趋势主导） */
  factorJingqi: { hex: '#ef4444', tailwind: 'text-red-500', bgClass: 'bg-red-500', rgb: '239, 68, 68' },
  /** 资金因子色（琥珀） */
  factorZijin: { hex: '#f59e0b', tailwind: 'text-amber-500', bgClass: 'bg-amber-500', rgb: '245, 158, 11' },
  /** 估值因子色（Apple Blue） */
  factorGuzhi: { hex: '#007aff', tailwind: 'text-blue-500', bgClass: 'bg-blue-500', rgb: '0, 122, 255' },
  /** β因子色（紫） */
  factorBeta: { hex: '#8b5cf6', tailwind: 'text-purple-500', bgClass: 'bg-purple-500', rgb: '139, 92, 246' },
  /** 量能因子色（青） */
  factorNengliang: { hex: '#06b6d4', tailwind: 'text-cyan-500', bgClass: 'bg-cyan-500', rgb: '6, 182, 212' },

  // ============================================================
  // 市场风格色
  // ============================================================
  /** 成长主导期（Apple Blue） */
  styleGrowth: { hex: '#007aff', tailwind: 'text-blue-500', bgClass: 'bg-blue-500', rgb: '0, 122, 255' },
  /** 价值修复期（翠绿） */
  styleValue: { hex: '#10b981', tailwind: 'text-emerald-500', bgClass: 'bg-emerald-500', rgb: '16, 185, 129' },
  /** 均衡震荡期（紫） */
  styleBalanced: { hex: '#8b5cf6', tailwind: 'text-purple-500', bgClass: 'bg-purple-500', rgb: '139, 92, 246' },

  // ============================================================
  // 信号分级色
  // ============================================================
  /** 强信号（翠绿） */
  signalStrong: { hex: '#10b981', tailwind: 'text-emerald-500', bgClass: 'bg-emerald-500', rgb: '16, 185, 129' },
  /** 中强信号（绿） */
  signalMediumStrong: { hex: '#22c55e', tailwind: 'text-green-500', bgClass: 'bg-green-500', rgb: '34, 197, 94' },
  /** 中信号（Apple Blue） */
  signalMedium: { hex: '#007aff', tailwind: 'text-blue-500', bgClass: 'bg-blue-500', rgb: '0, 122, 255' },
  /** 弱信号（琥珀） */
  signalWeak: { hex: '#f59e0b', tailwind: 'text-amber-500', bgClass: 'bg-amber-500', rgb: '245, 158, 11' },
  /** 无信号（灰） */
  signalNone: { hex: '#9ca3af', tailwind: 'text-gray-400', bgClass: 'bg-gray-400', rgb: '156, 163, 175' },

  // ============================================================
  // 背景色（高级灰色系 · Apple 卡片白）
  // ============================================================
  /** 卡片背景（Apple 设计令牌：纯白 #FFFFFF，配合阴影悬浮） */
  bgCard: { hex: '#ffffff', tailwind: 'bg-card', rgb: '255, 255, 255' },
  /** 悬停背景 */
  bgHover: { hex: '#f5f5f5', tailwind: 'bg-muted', rgb: '245, 245, 245' },
  /** 次要背景 */
  bgMuted: { hex: '#e5e5e5', tailwind: 'bg-muted', rgb: '229, 229, 229' },
  /** 浅色信号背景（保留语义色，但调整为更中性的灰度） */
  bgEmerald50: { hex: '#f0fdf4', tailwind: 'bg-emerald-50', rgb: '240, 253, 244' },
  /** 浅色绿背景 */
  bgGreen50: { hex: '#f0fdf4', tailwind: 'bg-green-50', rgb: '240, 253, 244' },
  /** 浅色蓝背景 */
  bgBlue50: { hex: '#eff6ff', tailwind: 'bg-blue-50', rgb: '239, 246, 255' },
  /** 浅色琥珀背景 */
  bgAmber50: { hex: '#fffbeb', tailwind: 'bg-amber-50', rgb: '255, 251, 235' },
  /** 浅色灰背景 */
  bgSlate50: { hex: '#f5f5f5', tailwind: 'bg-neutral-100', rgb: '245, 245, 245' },

  // ============================================================
  // 文字色
  // ============================================================
  /** 主要文字 */
  textPrimary: { hex: '#1e293b', tailwind: 'text-slate-800', rgb: '30, 41, 59' },
  /** 次要文字 */
  textSecondary: { hex: '#64748b', tailwind: 'text-slate-500', rgb: '100, 116, 139' },
  /** 弱化文字 */
  textMuted: { hex: '#94a3b8', tailwind: 'text-slate-400', rgb: '148, 163, 184' },

  // ============================================================
  // 边框色
  // ============================================================
  /** 默认边框 */
  border: { hex: '#e2e8f0', tailwind: 'border-slate-200', rgb: '226, 232, 240' },
  /** 悬停边框 */
  borderHover: { hex: '#cbd5e1', tailwind: 'border-slate-300', rgb: '203, 213, 225' },

  // ============================================================
  // 焦点可见样式（Focus Visible）
  // ============================================================
  /** 焦点环颜色（Apple Blue，用于 focus-visible 状态） */
  focusRing: { hex: '#007aff', tailwind: 'ring-blue-500', bgClass: 'bg-blue-500', rgb: '0, 122, 255' },

  // ============================================================
  // 徽章/标签色（Badge & Tag）
  // ============================================================
  /** 警告徽章背景（Bootstrap warning badge） */
  badgeWarningBg: { hex: '#FFF3CD', tailwind: 'bg-yellow-100', bgClass: 'bg-yellow-100', rgb: '255, 243, 205' },
  /** 警告徽章文字（Bootstrap warning badge） */
  badgeWarningText: { hex: '#856404', tailwind: 'text-yellow-700', bgClass: 'bg-yellow-700', rgb: '133, 100, 4' },
  /** 警告徽章边框（Bootstrap warning badge） */
  badgeWarningBorder: { hex: '#FFEEBA', tailwind: 'border-yellow-200', bgClass: 'border-yellow-200', rgb: '255, 238, 186' },

  // ============================================================
  // 灰色阶（用于文字/边框/背景的灰度语义）
  // ============================================================
  /** 灰 500 - 中等灰度文字/占位 */
  gray500: { hex: '#6b7280', tailwind: 'text-gray-500', bgClass: 'bg-gray-500', rgb: '107, 114, 128' },
} as const

/** 语义化颜色 token 类型 */
export type ColorTokenKey = keyof typeof COLOR_TOKENS

/** 获取颜色 token 的 HEX 值 */
export function getColorHex(key: ColorTokenKey): string {
  const token = COLOR_TOKENS[key]
  if ('hex' in token) return token.hex
  return '#9ca3af'
}

/** 获取颜色 token 的 Tailwind 类名 */
export function getColorTailwind(key: ColorTokenKey): string {
  const token = COLOR_TOKENS[key]
  if ('tailwind' in token) return token.tailwind
  return 'text-gray-400'
}

/** 获取颜色 token 的背景类名 */
export function getColorBgClass(key: ColorTokenKey): string {
  const token = COLOR_TOKENS[key]
  // 如果有 bgClass 属性则返回，否则返回 tailwind 值（某些 token 的 tailwind 本身就是背景类）
  if ('bgClass' in token) return token.bgClass
  if ('tailwind' in token) return token.tailwind
  return 'bg-gray-400'
}
