import React, { Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageSkeleton } from '@/components/PageSkeleton'
import { ToastProvider, useToast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/Toast'
import { ROUTE_REGISTRY } from '@/config/routes'
import { initializeApp } from '@/services/system/bootstrapService'
import { getLogger } from '@/lib/logger'

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
  }, [toast])

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {ROUTE_REGISTRY.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<route.component />}
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
