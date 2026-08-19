import React, { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { PageContainer, PageHeader } from '@/components/templates'
import { Button } from '@/components/atoms/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
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
  Target,
  Home,
  Gauge,
  type LucideIcon,
} from 'lucide-react'

const logger = getLogger()

const ConfigApp = React.lazy(() => import('@/apps/command/ConfigApp'))
const SystemMonitorPage = React.lazy(() => import('@/pages/command/SystemMonitorPage'))
const ComponentShowcasePage = React.lazy(() => import('@/pages/command/showcase/ComponentShowcasePage'))
const HealthDashboardPage = React.lazy(() => import('@/pages/command/health/HealthDashboardPage'))
const StressOverviewPage = React.lazy(() => import('@/pages/command/test/StressOverviewPage'))
const SystemHealthPanel = React.lazy(() => import('@/pages/command/SystemHealthPanel'))
const MCPServerDashboardPage = React.lazy(() => import('@/pages/command/MCPServerDashboardPage'))

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
 * - /command/agents → 由 PortalShell 通过 isAgentPath 单独处理，此处 fallback 到 Hub 首页
 * - /command（默认） → 总控舱 Hub 首页
 */
const BRANCH_INFO: Record<string, { branch: string; componentName: string }> = {
  '/command/hub': { branch: 'hub', componentName: 'CommandHubPage' },
  '/command/config': { branch: 'config', componentName: 'ConfigApp' },
  '/command/system-health': { branch: 'system-health', componentName: 'SystemHealthPanel' },
  '/command/monitor': { branch: 'monitor', componentName: 'SystemMonitorPage' },
  '/command/showcase': { branch: 'showcase', componentName: 'ComponentShowcasePage' },
  '/command/health': { branch: 'health', componentName: 'HealthDashboardPage' },
  '/command/test': { branch: 'stress', componentName: 'StressOverviewPage' },
  '/command/agents': { branch: 'agents', componentName: 'CommandHubPage' },
  '/command/mcp-servers': { branch: 'mcp-servers', componentName: 'MCPServerDashboardPage' },
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
    case '/command/system-health':
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载系统健康面板中...</div>}>
          <SystemHealthPanel />
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
    case '/command/agents':
      // /command/agents 由 PortalShell 通过 isAgentPath 单独处理，此处作为 fallback
      return <CommandHubPage />
    case '/command/mcp-servers':
      return (
        <React.Suspense fallback={<div className="p-4 text-muted-foreground">加载 MCP 服务面板中...</div>}>
          <MCPServerDashboardPage />
        </React.Suspense>
      )
    default:
      return <CommandHubPage />
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

    const { branch, componentName } = BRANCH_INFO[path] ?? { branch: 'default', componentName: 'CommandHubPage' }

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
    <PageContainer className="space-y-6">
      <Breadcrumb aria-label="breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>总控舱</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title="总控舱"
        description="系统监控 · 配置管理 · 智能体调度 · MCP 服务"
        actions={
          <>
            <Button variant="ghost" size="sm" className="shadow-sm" asChild>
              <Link to="/cockpit">
                <Gauge className="mr-1.5 h-3.5 w-3.5" />
                驾驶舱
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="shadow-sm" asChild>
              <Link to="/">
                <Home className="mr-1.5 h-3.5 w-3.5" />
                返回首页
              </Link>
            </Button>
          </>
        }
      />
      <main>{content}</main>
    </PageContainer>
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
    title: '系统健康',
    description: '系统监控与架构健康度一览',
    path: '/command/system-health',
    icon: Activity,
  },
  {
    title: '配置管理',
    description: '交易 / 采集 / 显示 / 模型配置',
    path: '/command/config',
    icon: Settings,
  },
  {
    title: '智能体总控',
    description: '注册、调度、监控所有智能体',
    path: '/command/agents',
    icon: Bot,
  },
  {
    title: 'MCP 服务',
    description: '管理 MCP 服务器配置与连接状态',
    path: '/command/mcp-servers',
    icon: Server,
  },
  {
    title: '驾驶舱',
    description: '投资总览 · 策略与时机 · 智能研判',
    path: '/cockpit',
    icon: Target,
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
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {HUB_NAV_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="shadow-sm border-border/40 transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <CardTitle className="text-base font-semibold">{card.title}</CardTitle>
                </div>
                <CardDescription className="text-xs leading-relaxed mt-1">{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="outline" size="sm" className="w-full justify-between shadow-sm" asChild>
                  <Link to={card.path}>
                    进入
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* 运维摘要：从 Cockpit 移出的轻量版 Widget（蓝图 Phase 2 步骤 2.1） */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">运维摘要</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <EngineStatusWidget config={summaryWidgetConfig('engineStatus', '引擎状态')} />
          <SystemArchitectureWidget config={summaryWidgetConfig('systemArchitecture', '系统架构')} />
          <AgentPerformanceWidget config={summaryWidgetConfig('agentPerformance', 'Agent 性能')} />
        </div>
      </section>
    </div>
  )
}


