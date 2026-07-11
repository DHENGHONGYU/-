import React, { Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageSkeleton } from '@/components/PageSkeleton'
import { ToastProvider, useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/atoms/Toast'
import { ROUTE_REGISTRY } from '@/config/routes'
import { RouteGuard } from '@/core/routeGuard'
import { initializeApp } from '@/services/system/bootstrapService'
import { getLogger } from '@/lib/logger'
import { ThemeProvider } from '@/core/ThemeProvider'
import { useRuntimeTradingConfigStore } from '@/store/runtimeTradingConfigStore'
// 显式 import 智能体系统入口，触发 initAgentSystem() 自动初始化
// （src/agents/index.ts 在模块加载时通过 setTimeout 延迟 100ms 调用 initAgentSystem）
import '@/agents'
// 显式 import MCP Server 注册入口，触发 registerAllServers() 同步全量注册
// （src/mcp/register.ts 在模块加载时通过 import.meta.glob eager 加载并注册所有 MCP Server）
import '@/mcp/register'

if (import.meta.env.DEV) {
  import('@/devtools/testDataFlow')
}

const logger = getLogger()

function AppContent(): React.JSX.Element {
  const { toast } = useToast()

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
    // 阶段 A-1：从 ConfigApp 写入的 localStorage 还原交易配置覆盖
    useRuntimeTradingConfigStore.getState().hydrateFromConfigApp()
  }, [toast])

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
  // P1 暗色优先：交易/投研类数据产品默认暗色更护眼、对比更佳；
  // 用户若曾切换并持久化（localStorage v9-theme），则尊重其选择。
  return (
    <ThemeProvider defaultMode="dark">
      <HashRouter>
        <ErrorBoundary>
          <ToastProvider>
            <AppContent />
            <Toaster />
          </ToastProvider>
        </ErrorBoundary>
      </HashRouter>
    </ThemeProvider>
  )
}
