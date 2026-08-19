import React, { useEffect, useRef, useState, Suspense } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/atoms/Button'
import { PageContainer, PageHeader } from '@/components/templates'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { Radar } from 'lucide-react'
import InputDashboard from './InputDashboard'
import LocalKnowledgePage from '@/pages/input/LocalKnowledgePage'
import CollectionMonitorPanel from './CollectionMonitorPanel'
import CollectionStrategyPage from './CollectionStrategyPage'
import HotSectorPage from './HotSectorPage'
import IntentionPoolPage from './IntentionPoolPage'
import InputTestDashboard from './InputTestDashboard'
import { InputFlowErrorBoundary } from '@/components/organisms/input/InputFlowErrorBoundary'
import { getLogger } from '@/lib/logger'

// 子页面懒加载（保留旧路由兼容）
const PoolBoardPage = React.lazy(() => import('@/pages/analysis/PoolBoardPage'))

interface InputRoute {
  path: string
  branch: string
  componentName: string
  exact?: boolean
  component: React.ReactNode
  fallback: string
}

const INPUT_ROUTES: InputRoute[] = [
  // 合并后的新路由
  { path: '/input/system-test', branch: 'system-test', componentName: 'InputTestDashboard', component: <InputTestDashboard />, fallback: '加载测试看板中...' },
  { path: '/input/collection-monitor', branch: 'collection-monitor', componentName: 'CollectionMonitorPanel', component: <CollectionMonitorPanel />, fallback: '加载采集监控台中...' },
  { path: '/input/collection-strategy', branch: 'collection-strategy', componentName: 'CollectionStrategyPage', component: <CollectionStrategyPage />, fallback: '加载采集策略配置中...' },
  // 热门板块独立页（从录入看板 Tab 拆分，筛选代表股纳入意向候选池）
  { path: '/input/hot-sectors', branch: 'hot-sectors', componentName: 'HotSectorPage', component: <HotSectorPage />, fallback: '加载热门板块中...' },
  // 意向输入池独立页（从录入看板底部清单区块拆分，双源注入标的的集中管理）
  { path: '/input/intention-pool', branch: 'intention-pool', componentName: 'IntentionPoolPage', component: <IntentionPoolPage />, fallback: '加载意向输入池中...' },
  // 保留旧路由兼容（重定向到合并组件）
  { path: '/input/data-test', branch: 'data-test', componentName: 'CollectionMonitorPanel', component: <CollectionMonitorPanel />, fallback: '' },
  { path: '/input/collect-tasks', branch: 'collect-tasks', componentName: 'CollectionMonitorPanel', component: <CollectionMonitorPanel />, fallback: '' },
  { path: '/input/seven-dim', branch: 'seven-dim', componentName: 'CollectionStrategyPage', component: <CollectionStrategyPage />, fallback: '加载采集策略配置中...' },
  { path: '/input/fetcher-config', branch: 'fetcher-config', componentName: 'CollectionStrategyPage', component: <CollectionStrategyPage />, fallback: '加载采集策略配置中...' },
  // 其他保留路由
  { path: '/input/local-knowledge', branch: 'local-knowledge', componentName: 'LocalKnowledgePage', component: <LocalKnowledgePage />, fallback: '' },
  { path: '/input/pool-board', branch: 'pool-board', componentName: 'PoolBoardPage', component: <PoolBoardPage />, fallback: '加载股票池看板中...' },
]

function matchInputRoute(path: string): InputRoute {
  for (const route of INPUT_ROUTES) {
    if (route.exact === false) {
      if (path === route.path || path.startsWith(route.path + '/')) return route
    } else if (path === route.path) {
      return route
    }
  }
  return { path: '', branch: 'default', componentName: 'InputDashboard', component: null, fallback: '' }
}

const logger = getLogger()

/**
 * 输入舱子路由分发
 *
 * @description
 * 使用 useLocation + 条件渲染替代嵌套 <Routes>。
 *
 * 根因：React Router v7 在 descendant <Routes> 场景下，绝对路径匹配行为
 * 与 v6 不一致。当 App.tsx 顶层已通过 <Route path="/input"> 匹配并渲染
 * PortalShell → InputApp 时，InputApp 内部的 <Routes path="/input/...">
 * 不会再次匹配当前 URL（证据：main 内容为空，子面板 chunk 未请求）。
 *
 * 修复方案：直接读取 location.pathname 进行条件渲染，绕过 descendant
 * Routes 的路径匹配问题。新增子面板仅需在 INPUT_ROUTES 中追加条目。
 *
 * 路由映射：
 * - /input/data-test       → DataTestPanel
 * - /input/local-knowledge → LocalKnowledgePage
 * - /input/seven-dim       → SevenDimConfigPage（懒加载）
 * - /input/fetcher-config  → FetcherConfigPage（懒加载）
 * - /input/collect-tasks   → CollectTaskPage（懒加载）
 * - /input/pool-board      → PoolBoardPage（懒加载）
 * - /input/hot-sectors     → HotSectorPage（热门板块独立页，从录入看板 Tab 拆分）
 * - /input/intention-pool  → IntentionPoolPage（意向输入池独立页，从录入看板底部清单拆分）
 * - /input/bulk-import     → 已整合至 InputDashboard（fallback 到录入看板）
 * - /input（默认）         → InputDashboard
 */
export default function InputApp(): React.JSX.Element {
  const location = useLocation()
  const path = location.pathname
  const prevPathRef = useRef<string | null>(null)

  // 路由切换检测：仅在 pathname 变化时记录切换事件与渲染状态
  useEffect(() => {
    const prevPath = prevPathRef.current
    const isRouteChange = prevPath !== null && prevPath !== path

    if (isRouteChange) {
      logger.info('[InputApp] 路由切换', { from: prevPath, to: path })
    }

    // 计算命中的分支与组件名（仅在路径变化时记录，避免 PortalShell 重渲染导致日志噪音）
    const { branch, componentName } = matchInputRoute(path)

    logger.info('[InputApp] 渲染输入舱', {
      path,
      branch,
      component: componentName,
      isRouteChange,
    })

    prevPathRef.current = path
  }, [path])

  // 错误边界 reset key：onReset 时自增，强制 InputDashboard 重建实例清空错误态
  const [resetKey, setResetKey] = useState(0)

  const matched = matchInputRoute(path)

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb aria-label="breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">首页</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>输入舱</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title="输入舱"
        description="股票数据录入与采集管理"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="shadow-sm"
            onClick={() => window.location.hash = '#/input/collection-monitor'}
          >
            <Radar className="mr-1.5 h-3.5 w-3.5" />
            采集监控
          </Button>
        }
      />
      <InputFlowErrorBoundary
        label="InputApp"
        onReset={() => setResetKey((k) => k + 1)}
      >
        {matched.component ? (
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{matched.fallback}</div>}>
            {matched.component}
          </Suspense>
        ) : (
          <InputDashboard key={resetKey} />
        )}
      </InputFlowErrorBoundary>
    </PageContainer>
  )
}
