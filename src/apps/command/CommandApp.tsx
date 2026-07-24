import React, { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { getLogger } from '@/lib/logger'
import type { WidgetConfig } from '@/types/modules/widget.types'
import EngineStatusWidget from '@/cockpit/widgets/EngineStatusWidget'
import SystemArchitectureWidget from '@/cockpit/widgets/SystemArchitectureWidget'
import AgentPerformanceWidget from '@/cockpit/widgets/AgentPerformanceWidget'
import {
  Activity,
  ArrowRight,
  Bot,
  Server,
  Settings,
  type LucideIcon,
} from 'lucide-react'

const logger = getLogger()

const ConfigApp = React.lazy(() => import('@/apps/command/ConfigApp'))
const SystemMonitorPage = React.lazy(() => import('@/pages/command/SystemMonitorPage'))
const ComponentShowcasePage = React.lazy(() => import('@/pages/command/showcase/ComponentShowcasePage'))
const HealthDashboardPage = React.lazy(() => import('@/pages/command/health/HealthDashboardPage'))
const StressOverviewPage = React.lazy(() => import('@/pages/command/test/StressOverviewPage'))

/**
 * 总控舱子路由分发
 *
 * @description
 * 使用 useLocation + 条件渲染替代嵌套 <Routes>。
 *
 * 根因：React Router v7 在 descendant <Routes> 场景下，绝对路径匹配行为
 * 与 v6 不一致。当 App.tsx 顶层已通过 <Route path="/command"> 匹配并渲染
 * PortalShell → CommandApp 时，CommandApp 内部的 <Routes path="/command/...">
 * 不会再次匹配当前 URL。
 *
 * 修复方案：直接读取 location.pathname 进行条件渲染，绕过 descendant
 * Routes 的路径匹配问题。新增子面板仅需在此处追加 else-if 分支。
 *
 * 路由映射：
 * - /command/config → ConfigApp（懒加载）
 * - /command（默认） → 系统监控面板
 *
 * 注意：/command/agents 由 PortalShell 通过 isAgentPath 单独处理，不在此分发。
 */
const BRANCH_INFO: Record<string, { branch: string; componentName: string }> = {
  '/command/hub': { branch: 'hub', componentName: 'CommandHubPage' },
  '/command/config': { branch: 'config', componentName: 'ConfigApp' },
  '/command/monitor': { branch: 'monitor', componentName: 'SystemMonitorPage' },
  '/command/showcase': { branch: 'showcase', componentName: 'ComponentShowcasePage' },
  '/command/health': { branch: 'health', componentName: 'HealthDashboardPage' },
  '/command/test': { branch: 'stress', componentName: 'StressOverviewPage' },
}

function renderCommandContent(path: string): React.ReactNode {
  switch (path) {
    case '/command/hub':
      return <CommandHubPage />
    case '/command/config':
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载配置面板中...</div>}>
          <ConfigApp />
        </React.Suspense>
      )
    case '/command/monitor':
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载系统监控中...</div>}>
          <SystemMonitorPage />
        </React.Suspense>
      )
    case '/command/showcase':
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载示例库中...</div>}>
          <ComponentShowcasePage />
        </React.Suspense>
      )
    case '/command/health':
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载健康度面板中...</div>}>
          <HealthDashboardPage />
        </React.Suspense>
      )
    case '/command/test':
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载压力测试面板中...</div>}>
          <StressOverviewPage />
        </React.Suspense>
      )
    default:
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载系统监控中...</div>}>
          <SystemMonitorPage />
        </React.Suspense>
      )
  }
}

export default function CommandApp(): React.JSX.Element {
  const location = useLocation()
  const path = location.pathname
  const prevPathRef = useRef<string | null>(null)

  // 路由切换检测：仅在 pathname 变化时记录切换事件与渲染状态
  useEffect(() => {
    const prevPath = prevPathRef.current
    const isRouteChange = prevPath !== null && prevPath !== path

    if (isRouteChange) {
      logger.info('[CommandApp] 路由切换', { from: prevPath, to: path })
    }

    const { branch, componentName } = BRANCH_INFO[path] ?? { branch: 'default', componentName: 'SystemMonitorPage' }

    logger.info('[CommandApp] 渲染总控舱', {
      path,
      branch,
      component: componentName,
      isRouteChange,
    })

    prevPathRef.current = path
  }, [path])

  const content = renderCommandContent(path)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">总控舱</h1>
          <p className="text-sm text-muted-foreground">系统监控 · 配置管理</p>
        </div>
      </div>
      {content}
    </div>
  )
}

/**
 * 总控舱 Hub 首页 — 展示所有子模块的导航卡片
 */
interface HubNavCard {
  title: string
  description: string
  path: string
  icon: LucideIcon
}

const HUB_NAV_CARDS: HubNavCard[] = [
  {
    title: '系统监控',
    description: '查看系统统计、日志流与智能体任务队列',
    path: '/command/monitor',
    icon: Activity,
  },
  {
    title: '配置管理',
    description: '交易/采集/显示/LLM 模型配置',
    path: '/command/config',
    icon: Settings,
  },
  {
    title: '智能体总控台',
    description: '注册、调度、监控所有智能体',
    path: '/command/agents',
    icon: Bot,
  },
  {
    title: 'MCP Server 管理',
    description: '管理 MCP 服务器配置与状态',
    path: '/command/mcp-servers',
    icon: Server,
  },
]

/** 为嵌入 Hub 的 Cockpit 轻量 Widget 构造最小 WidgetConfig（蓝图 Phase 2） */
function summaryWidgetConfig(widgetId: string, title: string): WidgetConfig {
  return {
    instanceId: `hub-${widgetId}`,
    widgetId,
    size: { cols: 4, rows: 2 },
    title,
    settings: {},
    visible: true,
    collapsed: false,
  }
}

function CommandHubPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">总控舱</h1>
        <p className="text-muted-foreground">系统监控 · 配置管理 · 智能体调度 · MCP 服务</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {HUB_NAV_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                </div>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                  <Link to={card.path}>
                    进入
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* 运维摘要：从 Cockpit 移出的轻量版 Widget（蓝图 Phase 2 步骤 2.1） */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">运维摘要</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <EngineStatusWidget config={summaryWidgetConfig('engineStatus', '引擎状态')} />
          <SystemArchitectureWidget config={summaryWidgetConfig('systemArchitecture', '系统架构')} />
          <AgentPerformanceWidget config={summaryWidgetConfig('agentPerformance', 'Agent 性能')} />
        </div>
      </section>
    </div>
  )
}


