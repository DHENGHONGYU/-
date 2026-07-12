import {
  CORE_RESOURCE_DEFAULT_CORE_SYMBOLS,
  CORE_RESOURCE_SYMBOL_WHITELIST,
} from '@/config/symbols'

/**
 * 主题注册表
 *
 * 定义系统中可跟踪的投资主题，以及股票与主题的映射规则。
 * 主题映射是投资组合构建（portfolioBuilder）的输入之一。
 *
 * 规则优先级：
 * 1. 若股票已显式标注 theme 数组，直接匹配 theme.id。
 * 2. 否则按 industryCode / sector 关键字匹配。
 * 3. 否则按股票名称/代码白名单匹配（用于跨市场标的，如港股）。
 */

export interface ThemeConfig {
  id: string
  name: string
  description: string
  /** 主题总仓位上限（占总资产净值百分比） */
  totalAllocationPct: number
  /** 单只标的占总资产净值的最大百分比 */
  singleMaxPct: number
  /** 单只标的占总资产净值的最小百分比 */
  singleMinPct: number
  /** 入选该主题的最低综合评分 */
  minCompositeScore: number
  /** 行业代码匹配列表（部分匹配） */
  industryCodePatterns: string[]
  /** Sector / 板块名称关键字（部分匹配，不区分大小写） */
  sectorKeywords: string[]
  /** 主题标签关键字（匹配 Stock.theme 数组） */
  themeTags: string[]
  /** 股票代码白名单（精确匹配，支持跨市场） */
  symbolWhitelist: string[]
  /** 默认核心标的（示例/初始池） */
  defaultCoreSymbols: string[]
  /** 再平衡阈值：当前权重与目标权重偏离超过该值时触发再平衡 */
  rebalanceThreshold: number
  /** 现金储备比例（该主题内未投资的现金） */
  cashReservePct: number
}

/**
 * 第四次工业革命稀缺核心资源主题。
 *
 * 参考 `D:/v6-pro-cockpit` 中同主题策略，聚焦 AI 算力、半导体、
 * 数据资产、通信网络、机器视觉等第四次工业革命关键稀缺资源。
 */
export const CORE_RESOURCE_THEME: ThemeConfig = {
  id: 'fourth-industrial-revolution-core-resource',
  name: '第四次工业革命稀缺核心资源',
  description:
    '聚焦定义第四次工业革命的核心底座：AI 算力、半导体设备/代工、数据资产、通信网络、机器视觉等稀缺资源龙头。',
  totalAllocationPct: 40,
  singleMaxPct: 8,
  singleMinPct: 4,
  minCompositeScore: 4.0,
  industryCodePatterns: [
    '半导体',
    '芯片',
    '集成电路',
    '电子',
    '通信',
    '电信',
    '计算机',
    '软件',
    '互联网',
    '传媒',
    '机械设备',
    '自动化设备',
    '电力设备',
    '稀土',
    '有色金属',
  ],
  sectorKeywords: [
    '半导体',
    '芯片',
    'AI',
    '算力',
    '服务器',
    '光模块',
    '通信',
    '5G',
    '数据',
    '云计算',
    '互联网',
    '软件',
    '机器人',
    '机器视觉',
    '稀土',
    '锂',
    '钴',
    '镍',
  ],
  themeTags: [
    '第四次工业革命稀缺核心资源',
    'AI算力',
    '半导体设备',
    '半导体代工',
    '数据资产',
    '通信网络',
    'AI算法',
    '机器视觉',
  ],
  symbolWhitelist: CORE_RESOURCE_SYMBOL_WHITELIST,
  defaultCoreSymbols: CORE_RESOURCE_DEFAULT_CORE_SYMBOLS,
  rebalanceThreshold: 0.05,
  cashReservePct: 10,
} as const

/**
 * 全量主题注册表。
 */
export const THEME_REGISTRY: Record<string, ThemeConfig> = {
  [CORE_RESOURCE_THEME.id]: CORE_RESOURCE_THEME,
}

/**
 * 获取指定主题配置。
 */
export function getThemeConfig(themeId: string): ThemeConfig | undefined {
  return THEME_REGISTRY[themeId]
}

/**
 * 判断一只股票是否属于某个主题。
 */
export function matchesTheme(stock: {
  symbol: string
  name?: string
  industryCode?: string
  sector?: string
  theme?: string[]
}, theme: ThemeConfig): boolean {
  // 1. 显式 theme 标签匹配
  if (stock.theme?.includes(theme.id) || stock.theme?.some((t) => theme.themeTags.includes(t))) {
    return true
  }

  // 2. 代码白名单匹配
  if (theme.symbolWhitelist.includes(stock.symbol)) {
    return true
  }

  // 3. 行业代码匹配
  if (
    stock.industryCode &&
    theme.industryCodePatterns.some((pattern) => stock.industryCode?.includes(pattern))
  ) {
    return true
  }

  // 4. Sector 关键字匹配
  if (
    stock.sector &&
    theme.sectorKeywords.some((keyword) => stock.sector?.toLowerCase().includes(keyword.toLowerCase()))
  ) {
    return true
  }

  return false
}

/**
 * 返回一只股票匹配的所有主题 ID。
 */
export function getThemesForStock(stock: {
  symbol: string
  name?: string
  industryCode?: string
  sector?: string
  theme?: string[]
}): string[] {
  return Object.values(THEME_REGISTRY)
    .filter((theme) => matchesTheme(stock, theme))
    .map((theme) => theme.id)
}
