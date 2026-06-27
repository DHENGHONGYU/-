import React, { type ComponentType, type LazyExoticComponent } from 'react'

export type RouteCategory =
  | 'portal'
  | 'input'
  | 'analysis'
  | 'trading'
  | 'output'
  | 'command'
  | 'system'
  | 'other'

export interface RouteConfig {
  path: string
  component: LazyExoticComponent<ComponentType<unknown>>
  category: RouteCategory
  description: string
}

/**
 * 路由注册表 —— 项目路由唯一真相源
 *
 * 注册规则：
 * 1. 所有业务路由必须在此注册，禁止组件内硬编码路径。
 * 2. 舱室入口路由（/input /analysis /trading /output /command）统一渲染 PortalShell，
 *    由 PortalShell 根据 pathname 激活对应舱室应用。
 * 3. 输入舱子路径（/input/bulk-import 等）由 InputApp 内部 <Routes> 声明式分发，
 *    此处统一指向 PortalShell 即可。
 * 4. 分析舱子页面（/analysis/*）排在舱室入口之后，React Router 按顺序匹配。
 * 5. 新增页面必须同步更新本表与 docs/06-routing-specs.md。
 */
export const ROUTE_REGISTRY: RouteConfig[] = [
  // 门户与驾驶舱
  {
    path: '/',
    component: React.lazy(() => import('@/pages/HomePage')),
    category: 'portal',
    description: '首页',
  },
  {
    path: '/cockpit',
    component: React.lazy(() => import('@/cockpit/CockpitShell')),
    category: 'portal',
    description: '驾驶舱 Dashboard',
  },

  // 五舱入口与 Hub 首页
  {
    path: '/input/hub',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 模块首页',
  },
  {
    path: '/input',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱',
  },
  {
    path: '/input/bulk-import',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 批量导入',
  },
  {
    path: '/input/hot-sectors',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 热门板块',
  },
  {
    path: '/input/data-test',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 采集测试',
  },
  {
    path: '/analysis/hub',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '分析舱 - 模块首页',
  },
  {
    path: '/analysis',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '分析舱',
  },
  {
    path: '/trading/hub',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '交易舱 - 模块首页',
  },
  {
    path: '/trading',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '交易舱',
  },
  {
    path: '/output',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱',
  },
  {
    path: '/command/hub',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '总控舱 - 模块首页',
  },
  {
    path: '/command',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '总控舱',
  },

  // 分析舱子页面
  {
    path: '/analysis/stock-score',
    component: React.lazy(() => import('@/pages/analysis/StockAnalysisPage')),
    category: 'analysis',
    description: '个股九维评分分析',
  },
  {
    path: '/analysis/stock-score/:symbol',
    component: React.lazy(() => import('@/pages/analysis/StockAnalysisPage')),
    category: 'analysis',
    description: '个股九维评分分析（带代码）',
  },
  {
    path: '/analysis/sector',
    component: React.lazy(() => import('@/pages/analysis/SectorAnalysisPage')),
    category: 'analysis',
    description: '行业与板块分析',
  },
  {
    path: '/analysis/backtest',
    component: React.lazy(() => import('@/pages/analysis/BacktestPage')),
    category: 'analysis',
    description: '策略回测',
  },
  {
    path: '/analysis/industry-score',
    component: React.lazy(() => import('@/pages/analysis/IndustryScorePage')),
    category: 'analysis',
    description: 'V4 行业评分',
  },
  {
    path: '/analysis/intelligent-score',
    component: React.lazy(() => import('@/pages/analysis/IntelligentScorePage')),
    category: 'analysis',
    description: 'V6 个股智能评分',
  },
  {
    path: '/analysis/score-docs',
    component: React.lazy(() => import('@/pages/analysis/ScoreDocPage')),
    category: 'analysis',
    description: '评分文档版本库',
  },
  {
    path: '/analysis/news',
    component: React.lazy(() => import('@/pages/analysis/NewsPage')),
    category: 'analysis',
    description: '智能资讯',
  },
  {
    path: '/analysis/news-v6',
    component: React.lazy(() => import('@/pages/news-v6/NewsPage')),
    category: 'analysis',
    description: '智能资讯 (V6 风格迁移版)',
  },
  {
    path: '/trading/strategy-snapshots',
    component: React.lazy(() => import('@/pages/trading/StrategySnapshotPage')),
    category: 'trading',
    description: '策略快照',
  },
  {
    path: '/trading/holdings',
    component: React.lazy(() => import('@/pages/trading/HoldingsPage')),
    category: 'trading',
    description: '交易持仓管理',
  },
  {
    path: '/input/local-knowledge',
    component: React.lazy(() => import('@/pages/input/LocalKnowledgePage')),
    category: 'input',
    description: '本地知识库',
  },

  // Mock 测试页
  {
    path: '/mock-test',
    component: React.lazy(() => import('@/pages/MockTestPage')),
    category: 'other',
    description: 'V9 模块 Mock 验证页（Slider/Sheet/Toggle/Engine）',
  },
]

export function getAllPaths(): string[] {
  return ROUTE_REGISTRY.map((r) => r.path)
}

export function hasRoute(path: string): boolean {
  return ROUTE_REGISTRY.some((r) => r.path === path)
}

export function getRoutesByCategory(category: RouteCategory): RouteConfig[] {
  return ROUTE_REGISTRY.filter((r) => r.category === category)
}

export function getCabinPaths(): Record<'input' | 'analysis' | 'trading' | 'output' | 'command', string> {
  return {
    input: '/input',
    analysis: '/analysis',
    trading: '/trading',
    output: '/output',
    command: '/command',
  }
}
