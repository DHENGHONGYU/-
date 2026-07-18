import React, { Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'
import { ToastProvider, useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/atoms/Toast'
import { ROUTE_REGISTRY } from '@/config/routes'
import { RouteGuard } from '@/core/routeGuard'
import { initializeApp } from '@/services/system/bootstrapService'
import { getLogger } from '@/lib/logger'
import { useThemeStore, initSystemThemeListener } from '@/store/themeStore'
import { initAllGlobalSubscriptions } from '@/store/initGlobalSubscriptions'
import { widgetEngine } from '@/cockpit/core/widgetEngine'
import { PRELOAD_WIDGETS } from '@/constants/cockpit.constants'
import { useRuntimeTradingConfigStore } from '@/store/runtimeTradingConfigStore'
// 显式 import 智能体系统入口，触发 initAgentSystem() 自动初始化
// （src/agents/index.ts 在模块加载时通过 setTimeout 延迟 100ms 调用 initAgentSystem）
import '@/agents'
// 显式 import MCP Server 注册入口，触发 registerAllServers() 同步全量注册
// （src/mcp/register.ts 在模块加载时通过 import.meta.glob eager 加载并注册所有 MCP Server）
import '@/mcp/register'

if (import.meta.env.DEV) {
  void import('@/devtools/testDataFlow')
}

const logger = getLogger()

function AppContent(): React.JSX.Element {
  const { toast } = useToast()
  const { markHydrated } = useThemeStore()

  useEffect(() => {
    initializeApp().catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('IndexedDB init failed', { error: err })
      toast({
        title: '本地数据库初始化失败',
        description: `${message}，请检查浏览器存储权限或刷新页面重试。`,
        variant: 'error',
        duration: 0,
      })
    })
    // 全局Store订阅初始化（在widget懒加载前就绪，确保所有数据稳定）
    // 统一初始化：信号、市场数据、双策略、风控等核心Store
    initAllGlobalSubscriptions()

    // 核心Widget预加载（渐进式加载，避免阻塞主线程）
    // 在全局数据订阅就绪后，预加载常用widget组件，提升驾驶舱首屏加载速度
    setTimeout(() => {
      widgetEngine.preloadComponents([...PRELOAD_WIDGETS], 2)
    }, 500)

    // 阶段 A-1：从 ConfigApp 写入的 localStorage 还原交易配置覆盖
    useRuntimeTradingConfigStore.getState().hydrateFromConfigApp()

    // 主题系统初始化：监听系统主题变化并标记 hydrate 完成
    const unsubscribeTheme = initSystemThemeListener()
    markHydrated()
    return () => {
      unsubscribeTheme()
    }
  }, [toast, markHydrated])

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {ROUTE_REGISTRY.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <RouteGuard module={route.category}>
                <route.component />
              </RouteGuard>
            }
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

function NotFoundPage(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground">页面未找到</p>
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  // 主题状态由 themeStore 统一管理（light/dark/system + localStorage 持久化）。
  // ThemeProvider 已退役，避免与 themeStore 重复操作 DOM/CSS 变量。
  return (
    <HashRouter>
      <ErrorBoundary>
        <ToastProvider>
          <AppContent />
          <Toaster />
        </ToastProvider>
      </ErrorBoundary>
    </HashRouter>
  )
}
