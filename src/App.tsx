import React, { Suspense, useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'
import { MemoryModeBanner } from '@/components/organisms/shared/MemoryModeBanner'
import { OrchestratorStatusPanel } from '@/components/organisms/system/OrchestratorStatusPanel'
import { ToastProvider, useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/atoms/Toast'
import { ROUTE_REGISTRY } from '@/config/routes'
import { RouteGuard } from '@/core/routeGuard'
import { initializeApp } from '@/services/system/bootstrapService'
import { checkIDBCapability } from '@/core/idbPreflight'
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

const logger = getLogger()

function AppContent(): React.JSX.Element {
  const { toast } = useToast()
  const { markHydrated } = useThemeStore()
  const [isMemoryMode, setIsMemoryMode] = useState(false)
  const [preflightError, setPreflightError] = useState<string | null>(null)

  useEffect(() => {
    const initWithPreflight = async () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
      const forceMemory = params.get('forceMemory') === '1'
      const capability = forceMemory
        ? { supported: false, estimatedQuota: null, estimatedUsage: null, available: false, reason: '测试模式：强制内存降级' }
        : await checkIDBCapability()

      if (!capability.available) {
        setPreflightError(capability.reason)
        toast({
          title: '本地存储不可用',
          description: `${capability.reason}。系统将以内存模式运行，数据不会持久化。`,
          variant: 'warning',
          duration: 0,
        })

        try {
          await initializeApp({
            useMemoryFallback: true,
            hooks: {
              onSeedFailure: (error, retries) => {
                toast({
                  title: '默认股票加载失败',
                  description: `系统尝试 ${retries} 次加载默认股票均失败：${error}。您可以手动添加股票或刷新页面重试。`,
                  variant: 'warning',
                  duration: 10000,
                })
              },
              onOrchestrationFailure: (error) => {
                toast({
                  title: '部分服务启动异常',
                  description: `编排器服务启动失败：${error}。部分分析功能可能不可用，请刷新页面重试。`,
                  variant: 'error',
                  duration: 0,
                })
              },
            },
          })
          setIsMemoryMode(true)
          logger.warn('[App] 以内存降级模式启动', { reason: capability.reason })
        } catch (memErr) {
          const memMessage = memErr instanceof Error ? memErr.message : String(memErr)
          logger.error('[App] 内存降级模式也失败', { error: memMessage })
          toast({
            title: '应用无法启动',
            description: `本地存储和内存模式均失败：${memMessage}。请刷新页面或联系技术支持。`,
            variant: 'error',
            duration: 0,
          })
        }
        return
      }

      try {
        await initializeApp({
          hooks: {
            onSeedFailure: (error, retries) => {
              toast({
                title: '默认股票加载失败',
                description: `系统尝试 ${retries} 次加载默认股票均失败：${error}。您可以手动添加股票或刷新页面重试。`,
                variant: 'warning',
                duration: 10000,
              })
            },
            onOrchestrationFailure: (error) => {
              toast({
                title: '部分服务启动异常',
                description: `编排器服务启动失败：${error}。部分分析功能可能不可用，请刷新页面重试。`,
                variant: 'error',
                duration: 0,
              })
            },
            onDataBridgeInitFailure: (error) => {
              toast({
                title: '本地数据库初始化失败',
                description: `${error}，请检查浏览器存储权限或刷新页面重试。`,
                variant: 'error',
                duration: 0,
              })
            },
          },
        })
        logger.info('[App] 应用正常启动')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('IndexedDB init failed', { error: err })
        toast({
          title: '本地数据库初始化失败',
          description: `${message}，请检查浏览器存储权限或刷新页面重试。`,
          variant: 'error',
          duration: 0,
        })
      }
    }

    void initWithPreflight()

    initAllGlobalSubscriptions()

    setTimeout(() => {
      try {
        widgetEngine.preloadComponents([...PRELOAD_WIDGETS], 2)
      } catch (err) {
        logger.warn('[App] Widget preload failed', { error: err })
      }
    }, 500)

    useRuntimeTradingConfigStore.getState().hydrateFromConfigApp()

    const unsubscribeTheme = initSystemThemeListener()
    markHydrated()
    return () => {
      unsubscribeTheme()
    }
  }, [toast, markHydrated])

  if (preflightError && !isMemoryMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl" aria-hidden="true">⚠️</div>
          <h1 className="mb-4 text-xl font-bold">本地存储不可用</h1>
          <p className="mb-6 text-muted-foreground">{preflightError}</p>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">请尝试以下操作：</p>
            <ul className="text-left text-sm text-muted-foreground">
              <li>• 检查浏览器是否禁用了 Cookie 和站点数据</li>
              <li>• 清除浏览器缓存后重试</li>
              <li>• 使用 Chrome / Edge / Firefox 最新版</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded bg-primary px-6 py-2 text-primary-foreground"
          >
            刷新页面
          </button>
        </div>
      </div>
    )
  }

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
      {isMemoryMode && <MemoryModeBanner />}
      {import.meta.env.DEV && (
        <div className="fixed right-4 top-4 z-40">
          <OrchestratorStatusPanel />
        </div>
      )}
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
