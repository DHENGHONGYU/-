/**
 * @fileoverview L6 门户布局令牌（Portal Tokens）
 *
 * 职责：为 PortalShell 提供布局、导航、舱室切换、移动端导航、状态指示等
 * 专用样式令牌，消除 PortalShell.tsx 中的硬编码 Tailwind 颜色类。
 *
 * 这些令牌属于 L6 设计系统层的扩展，所有颜色/尺寸均引用自 theme.tokens 的
 * 下层令牌或 CSS 变量（如 bg-background、text-foreground 等）。
 *
 * @module constants/theme/portal
 * @created 2026-07-15
/** 门户布局容器令牌（V6：宋瓷暖灰激活）  * @doc []
*/
export const PORTAL_LAYOUT_TOKENS = {
  /** 整个 Shell 背景（V6：暖象牙灰，替代 V5 冷蓝灰） */
  shellBg: 'bg-background',
  /** 顶栏背景（带透明毛玻璃，V6：象牙底微暖） */
  headerBg: 'bg-ivory/80 backdrop-blur-xl',
  /** 顶栏下边框 */
  headerBorder: 'border-border/60',
  /** 侧边栏背景（V6：宋瓷暖灰） */
  sidebarBg: 'bg-warm-gray/40 backdrop-blur-sm',
  /** 侧边栏右边框 */
  sidebarBorder: 'border-border/50',
  /** 主内容区背景 */
  mainBg: 'bg-background',
  /** 主内容区内边距 */
  mainPadding: 'p-5 sm:p-6 lg:p-7',
  /** 主内容区最大宽度 */
  mainMaxWidth: 'max-w-[1440px]',
} as const

/** 舱室切换器令牌 */
export const PORTAL_CABIN_TOKENS = {
  /** 舱室切换器容器背景（V6：宋瓷暖灰激活，替代冷 muted） */
  containerBg: 'bg-warm-gray/60 backdrop-blur-sm',
  /** 当前激活舱室 */
  active: 'bg-card text-foreground shadow-sm shadow-primary/5',
  /** 未激活舱室 */
  inactive: 'text-muted-foreground hover:text-foreground hover:bg-warm-gray/40 transition-all duration-300 ease-out',
  /** 驾驶舱入口（独立于五舱） */
  cockpit: 'text-muted-foreground hover:text-foreground hover:bg-warm-gray/40 transition-all duration-300',
} as const

/** 侧边栏导航令牌 */
export const PORTAL_NAV_TOKENS = {
  /** 抽屉/侧边栏头部下边框 */
  drawerHeaderBorder: 'border-border/40',
  /** 侧边栏标题文字 */
  sidebarTitle: 'text-foreground',
  /** 分组标签文字 */
  groupLabel: 'text-muted-foreground/80',
  /** 导航项激活态（Apple：surface-2 底 + 主色文字 + 左侧指示条） */
  active: 'bg-surface-2 text-primary',
  /** 导航项激活态左侧指示条 */
  activeIndicator: 'before:bg-primary before:transition-all before:duration-300',
  /** 导航项未激活态 */
  inactive: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-200 ease-out',
  /** 导航图标激活态 */
  iconActive: 'text-primary',
  /** 导航图标未激活态 */
  iconInactive: 'text-muted-foreground/70 group-hover:text-muted-foreground transition-colors duration-200',
} as const

/** 移动端令牌 */
export const PORTAL_MOBILE_TOKENS = {
  /** 汉堡按钮 */
  hamburger: 'text-muted-foreground hover:bg-muted',
  /** 底部导航背景 */
  bottomNavBg: 'bg-background/95 backdrop-blur-md border-t border-border',
  /** 底部导航项激活态 */
  bottomNavActive: 'text-primary',
  /** 底部导航项未激活态 */
  bottomNavInactive: 'text-muted-foreground',
} as const

/** 状态指示令牌 */
export const PORTAL_STATUS_TOKENS = {
  /** 采集中 / 检查中（语义令牌，主题感知） */
  checking: 'bg-warning/80 ring-1 ring-warning/40 animate-pulse',
  /** 采集正常 / 已连接（语义令牌，主题感知） */
  connected: 'bg-success/80 ring-1 ring-success/40',
  /** 采集断连 / 未连接（语义令牌，主题感知） */
  disconnected: 'bg-destructive/80 ring-1 ring-destructive/40',
} as const

/** 品牌令牌 */
export const PORTAL_BRAND_TOKENS = {
  /** Logo 渐变（V6：汝窑天青替代纯蓝，更温润） */
  logoGradient: 'from-ru-blue to-primary',
  /** Logo 文字色 */
  logoText: 'text-white',
  /** Logo 阴影 */
  logoShadow: 'shadow-ru-blue/20',
} as const

/** 聚合门户令牌（L6 设计系统扩展） */
export const PORTAL_TOKENS = {
  layout: PORTAL_LAYOUT_TOKENS,
  cabin: PORTAL_CABIN_TOKENS,
  nav: PORTAL_NAV_TOKENS,
  mobile: PORTAL_MOBILE_TOKENS,
  status: PORTAL_STATUS_TOKENS,
  brand: PORTAL_BRAND_TOKENS,
} as const

/** 门户令牌键类型 */
export type PortalTokenKey = keyof typeof PORTAL_TOKENS
