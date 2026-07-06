import React, { useEffect, useRef, Suspense } from 'react'
import { useLocation } from 'react-router'
import InputDashboard from './InputDashboard'
import BulkImportPanel from './BulkImportPanel'
import HotSectorPanel from './HotSectorPanel'
import DataTestPanel from './DataTestPanel'
import LocalKnowledgePage from '@/pages/input/LocalKnowledgePage'
import { getLogger } from '@/lib/logger'

// 子页面懒加载（G4 集成：七维采集配置 / 抓取引擎配置 / 采集任务监控）
const SevenDimConfigPage = React.lazy(() => import('@/pages/input/SevenDimConfigPage'))
const FetcherConfigPage = React.lazy(() => import('@/pages/input/FetcherConfigPage'))
const CollectTaskPage = React.lazy(() => import('@/pages/input/CollectTaskPage'))

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
 * Routes 的路径匹配问题。新增子面板仅需在此处追加 else-if 分支。
 *
 * 路由映射：
 * - /input/bulk-import     → BulkImportPanel
 * - /input/hot-sectors     → HotSectorPanel
 * - /input/data-test       → DataTestPanel
 * - /input/local-knowledge → LocalKnowledgePage
 * - /input/seven-dim       → SevenDimConfigPage（懒加载）
 * - /input/fetcher-config  → FetcherConfigPage（懒加载）
 * - /input/collect-tasks   → CollectTaskPage（懒加载）
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
    let branch: string
    let componentName: string
    if (path === '/input/bulk-import') {
      branch = 'bulk-import'
      componentName = 'BulkImportPanel'
    } else if (path === '/input/hot-sectors') {
      branch = 'hot-sectors'
      componentName = 'HotSectorPanel'
    } else if (path === '/input/data-test') {
      branch = 'data-test'
      componentName = 'DataTestPanel'
    } else if (path === '/input/local-knowledge') {
      branch = 'local-knowledge'
      componentName = 'LocalKnowledgePage'
    } else if (path === '/input/seven-dim') {
      branch = 'seven-dim'
      componentName = 'SevenDimConfigPage'
    } else if (path === '/input/fetcher-config') {
      branch = 'fetcher-config'
      componentName = 'FetcherConfigPage'
    } else if (path === '/input/collect-tasks') {
      branch = 'collect-tasks'
      componentName = 'CollectTaskPage'
    } else {
      branch = 'default'
      componentName = 'InputDashboard'
    }

    logger.info('[InputApp] 渲染输入舱', {
      path,
      branch,
      component: componentName,
      isRouteChange,
    })

    prevPathRef.current = path
  }, [path])

  let content: React.ReactNode
  if (path === '/input/bulk-import') {
    content = <BulkImportPanel />
  } else if (path === '/input/hot-sectors') {
    content = <HotSectorPanel />
  } else if (path === '/input/data-test') {
    content = <DataTestPanel />
  } else if (path === '/input/local-knowledge') {
    content = <LocalKnowledgePage />
  } else if (path === '/input/seven-dim') {
    content = (
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载七维采集配置中...</div>}>
        <SevenDimConfigPage />
      </Suspense>
    )
  } else if (path === '/input/fetcher-config') {
    content = (
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载抓取引擎配置中...</div>}>
        <FetcherConfigPage />
      </Suspense>
    )
  } else if (path === '/input/collect-tasks') {
    content = (
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载采集任务监控中...</div>}>
        <CollectTaskPage />
      </Suspense>
    )
  } else {
    // 默认渲染看板，覆盖 /input 等未明确分支
    content = <InputDashboard />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">输入舱</h1>
          <p className="text-sm text-muted-foreground">股票录入 · 批量导入 · 热门板块 · 采集测试</p>
        </div>
      </div>
      {content}
    </div>
  )
}
