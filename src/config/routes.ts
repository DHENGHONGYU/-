/**
 * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
 */
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
  /** V10: 是否已废弃/合并，标记后侧边栏自动隐藏，面包屑降级提示 */
  deprecated?: boolean
  /** V10: 废弃路由的重定向目标（用于面包屑导航提示） */
  redirectTo?: string
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
 * 5. 新增页面必须同步更新本表与 docs/explanation/06-routing-specs.md。
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
    description: '输入舱 - 批量导入（已整合至录入看板，fallback 到 /input）',
    deprecated: true,
    redirectTo: '/input',
  },
  {
    path: '/input/hot-sectors',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 热门板块（已整合至录入看板，fallback 到 /input）',
    deprecated: true,
    redirectTo: '/input',
  },
  {
    path: '/input/data-test',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 采集测试（已合并至采集监控台）',
    deprecated: true,
    redirectTo: '/input/collection-monitor',
  },
  {
    path: '/input/collection-monitor',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 采集监控台（链路测试 + 任务监控）',
  },
  {
    path: '/input/collection-strategy',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '输入舱 - 采集策略配置（七维策略 + 抓取引擎）',
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
    path: '/analysis/industry-dashboard',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '分析舱 - 行业全景仪表盘',
  },
  {
    path: '/analysis/review-launch',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '分析舱 - 复盘启动分析（RLES 评价体系）',
  },
  {
    path: '/trading/flow',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '交易舱 - 交易流程',
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
    path: '/output/hub',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 模块首页',
  },
  {
    path: '/output/research',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 研究报告',
  },
  {
    path: '/output/review',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 交易复盘',
  },
  {
    path: '/output/export',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 数据导出',
  },
  {
    path: '/output/dashboard',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 仪表盘',
  },
  {
    path: '/output/wizard',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 复盘向导',
  },
  // 预测三件套已合并为 FactorAnalysisHubPage（Tabs 多面板）
  // 主入口 /output/factor-analysis；三个旧路由保留向后兼容，由 OutputApp 内部重定向到 HubPage
  {
    path: '/output/factor-analysis',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 因子分析（预测校验+周期复盘+因子画板三合一）',
  },
  {
    path: '/output/prediction',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 预测校验（已合并到因子分析）',
    deprecated: true,
    redirectTo: '/output/factor-analysis',
  },
  {
    path: '/output/retrospective',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 周期复盘（已合并到因子分析）',
    deprecated: true,
    redirectTo: '/output/factor-analysis',
  },
  {
    path: '/output/factor-dashboard',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 因子画板（已合并到因子分析）',
    deprecated: true,
    redirectTo: '/output/factor-analysis',
  },
  {
    path: '/output/chip-strategy',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'output',
    description: '输出舱 - 筹码与交易策略复盘',
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

  // 智能体子模块（AgentApp 内部分发）
  {
    path: '/command/agents',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '智能体总控台',
  },
  {
    path: '/command/agents/registry',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '智能体注册表',
  },
  {
    path: '/command/agents/registry/:agentId',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '智能体详情',
  },
  // V11: 以下旧智能体路由已合并到面板（task-panel / model-config / optimization-panel），标记废弃
  {
    path: '/command/agents/trigger',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '智能体任务触发（已合并至任务管理面板）',
    deprecated: true,
    redirectTo: '/command/agents/task-panel',
  },
  {
    path: '/command/agents/tasks',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '智能体任务列表（已合并至任务管理面板）',
    deprecated: true,
    redirectTo: '/command/agents/task-panel',
  },
  {
    path: '/command/agents/custom',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '自定义智能体',
  },
  {
    path: '/command/agents/llm',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: 'LLM 管理（已合并至模型配置面板）',
    deprecated: true,
    redirectTo: '/command/agents/model-config',
  },
  {
    path: '/command/agents/capability-graph',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '能力图谱',
  },
  {
    path: '/command/agents/dag-scheduler',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: 'DAG 调度器',
  },
  {
    path: '/command/agents/feedback',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '反馈控制台（已合并至任务管理面板）',
    deprecated: true,
    redirectTo: '/command/agents/task-panel',
  },
  {
    path: '/command/agents/model-upgrade',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '模型升级（已合并至模型配置面板）',
    deprecated: true,
    redirectTo: '/command/agents/model-config',
  },
  {
    path: '/command/agents/data-labels',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '数据标签管理',
  },
  {
    path: '/command/agents/api-config',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: 'API 配置（已合并至模型配置面板）',
    deprecated: true,
    redirectTo: '/command/agents/model-config',
  },
  {
    path: '/command/agents/skill-audit',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: 'Skill 核查（已合并至优化建议面板）',
    deprecated: true,
    redirectTo: '/command/agents/optimization-panel',
  },
  {
    path: '/command/agents/optimization',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '优化建议（已合并至优化建议面板）',
    deprecated: true,
    redirectTo: '/command/agents/optimization-panel',
  },
  {
    path: '/command/agents/changelog',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '更新日志',
  },

  // 合并面板（用户视角重构：多页面 Tab 合并入口）
  {
    path: '/command/system-health',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '系统健康（监控+架构健康度合并）',
  },
  {
    path: '/command/agents/task-panel',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '智能体任务管理（任务列表+触发+反馈合并）',
  },
  {
    path: '/command/agents/model-config',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '模型配置（LLM+API密钥+模型升级合并）',
  },
  {
    path: '/command/agents/optimization-panel',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '优化建议（优化建议+Skill核查合并）',
  },

  // MCP Server 管理
  {
    path: '/command/mcp-servers',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: 'MCP Server 管理',
  },
  {
    path: '/command/showcase',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '组件示例库',
  },
  // V11: /command/health 和 /command/monitor 已合并到 /command/system-health
  {
    path: '/command/health',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '架构健康度仪表盘（已合并至系统健康）',
    deprecated: true,
    redirectTo: '/command/system-health',
  },
  {
    path: '/command/monitor',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '系统监控（已合并至系统健康）',
    deprecated: true,
    redirectTo: '/command/system-health',
  },
  {
    path: '/command/config',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '配置管理',
  },
  {
    path: '/command/test',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'command',
    description: '压力测试',
  },

  // 分析舱子页面（统一通过 PortalShell → AnalysisApp 分发，保持 TopBar + Sidebar 导航）
  // 注：/analysis/sector 已废弃，SectorAnalysisPage 是 IndustryDashboardPage 的功能子集，
  //     旧路由统一由 AnalysisApp 内部重定向到 /analysis/industry-dashboard
  {
    path: '/analysis/sector',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '行业分析（已合并到行业全景仪表盘，自动重定向）',
    deprecated: true,
    redirectTo: '/analysis/industry-dashboard',
  },
  {
    path: '/analysis/backtest',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '策略回测',
  },
  {
    path: '/analysis/industry-score',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: 'V4 行业评分',
  },
  {
    path: '/analysis/stock-score',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: 'V6 个股评分',
  },
  {
    path: '/analysis/intelligent-score',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '个股智能分析',
  },
  {
    path: '/analysis/intelligent-score/:symbol',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '个股智能分析（带代码）',
  },
  {
    path: '/analysis/score-docs',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '评分文档版本库',
  },
  {
    path: '/analysis/news',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '智能资讯',
  },
  {
    path: '/analysis/score-comparison',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '历史评分比对看板',
  },
  {
    path: '/analysis/hot-sector',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '热门板块策略选股（五维评分）',
  },
  {
    path: '/analysis/value-pit',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '价值洼地策略选股（五维评分 + 轮动信号）',
  },
  {
    path: '/analysis/multi-factor',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'analysis',
    description: '多因子筛选（条件组增删 / 因子编辑 / 模板持久化）',
  },
  {
    path: '/trading/strategy-snapshots',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '策略快照',
  },
  {
    path: '/trading/holdings',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '交易持仓管理',
  },
  {
    path: '/trading/execution-plans',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '执行计划管理',
  },
  {
    path: '/trading/execution',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '执行管理（别名 → execution-plans）',
    deprecated: true,
    redirectTo: '/trading/execution-plans',
  },
  {
    path: '/trading/portfolio',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '投资组合管理',
  },
  {
    path: '/trading/risk',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'trading',
    description: '风险控制管理',
  },
  {
    path: '/input/local-knowledge',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '本地知识库',
  },
  {
    path: '/input/seven-dim',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '七维采集策略配置（已合并至采集策略配置）',
    deprecated: true,
    redirectTo: '/input/collection-strategy',
  },
  {
    path: '/input/fetcher-config',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '抓取引擎配置（已合并至采集策略配置）',
    deprecated: true,
    redirectTo: '/input/collection-strategy',
  },
  {
    path: '/input/collect-tasks',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '采集任务监控（已合并至采集监控台）',
    deprecated: true,
    redirectTo: '/input/collection-monitor',
  },
  {
    path: '/input/pool-board',
    component: React.lazy(() => import('@/portal/PortalShell')),
    category: 'input',
    description: '研究候选池总览（基本信息 + 采集进度）',
  },

  // Mock 测试页
  {
    path: '/mock-test',
    component: React.lazy(() => import('@/pages/MockTestPage')),
    category: 'other',
    description: 'V9 模块 Mock 验证页（Slider/Sheet/Toggle/Engine）',
  },
]

/**
 * 路由白名单 —— 从 ROUTE_REGISTRY 自动派生的合法路径前缀集合。
 * 用于 RouteGuard 路径级校验，防止未注册路径绕过舱室入口守卫。
 *
 * 生成规则：提取每个注册路径的首段前缀（如 /analysis/stock-score → analysis）。
 * 新增路由只需在 ROUTE_REGISTRY 注册，白名单自动生效。
 */
export const ROUTE_WHITELIST: ReadonlySet<string> = (() => {
  const prefixes = new Set<string>()
  for (const route of ROUTE_REGISTRY) {
    const segments = route.path.split('/').filter(Boolean)
    if (segments.length > 0 && segments[0]) {
      prefixes.add(segments[0])
    }
  }
  // 根路径 '/' 始终允许
  prefixes.add('/')
  return prefixes
})()

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

// ── V10: 信息架构工具函数 ──

/** 获取所有活跃路由（不含 deprecated） */
export function getActiveRoutes(): RouteConfig[] {
  return ROUTE_REGISTRY.filter((r) => !r.deprecated)
}

/** 获取所有废弃路由 */
export function getDeprecatedRoutes(): RouteConfig[] {
  return ROUTE_REGISTRY.filter((r) => r.deprecated)
}

/**
 * 按路径查找路由（含废弃）
 * 用于面包屑导航：访问废弃路由时仍能识别
 */
export function findRouteByPath(path: string): RouteConfig | undefined {
  // 精确匹配
  const exact = ROUTE_REGISTRY.find((r) => r.path === path)
  if (exact) return exact
  // 前缀匹配（支持参数化路由如 /analysis/intelligent-score/:symbol）
  return ROUTE_REGISTRY.find((r) => {
    const pattern = r.path.replace(/:\w+/g, '[^/]+')
    return new RegExp(`^${pattern}$`).test(path)
  })
}

/**
 * 面包屑路径段
 * 从路径生成层级面包屑，自动匹配路由描述
 */
export interface BreadcrumbSegment {
  label: string
  path: string
  /** 是否为废弃路由目标 */
  deprecated?: boolean
  /** 废弃路由的迁移目标 */
  redirectTo?: string
}

export function getBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ label: '首页', path: '/' }]
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return segments

  let accumulated = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    accumulated += `/${part}`
    const route = findRouteByPath(accumulated)

    if (route) {
      // V11: 参数化路由：检查当前段是否为参数值（路径包含 :param 模式）
      const isParamRoute = route.path.includes(':')
      const label = route.description

      // 如果是参数化路由，且当前段不是路由路径中的字面段，则它是参数值
      if (isParamRoute) {
        const routeParts = route.path.split('/').filter(Boolean)
        const lastRoutePart = routeParts[routeParts.length - 1] ?? ''
        if (lastRoutePart && lastRoutePart.startsWith(':') && lastRoutePart !== part) {
          // 当前段是参数值，追加到标签中
          segments.push({
            label: `${label} · ${part}`,
            path: accumulated,
            deprecated: route.deprecated,
            redirectTo: route.redirectTo,
          })
          continue
        }
      }

      segments.push({
        label,
        path: accumulated,
        deprecated: route.deprecated,
        redirectTo: route.redirectTo,
      })
    } else {
      // 无匹配路由，检查上一段是否为参数化路由
      if (i > 0) {
        const prevAccumulated = accumulated.substring(0, accumulated.lastIndexOf(`/${part}`))
        const prevRoute = findRouteByPath(prevAccumulated)
        if (prevRoute?.path.includes(':')) {
          // 当前段是参数值，跳过（已在上段标签中显示）
          continue
        }
      }
      // 常规 fallback
      segments.push({
        label: (part ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        path: accumulated,
      })
    }
  }
  return segments
}
