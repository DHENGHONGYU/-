/**
 * @fileoverview 因子分析 Hub 页面（预测校验 + 周期复盘 + 因子画板三合一）
 *
 * 合并原 PredictionPage / RetrospectivePage / FactorDashboardPage 三页为多 Tab 仪表盘。
 * 因子归因本是一体决策链：预测 → 校验 → 复盘 → 画板，拆 3 页割裂决策链。
 *
 * 支持通过 URL pathname 初始定位 Tab：
 * - /output/prediction       → prediction tab
 * - /output/retrospective    → retrospective tab
 * - /output/factor-dashboard → dashboard tab
 * - /output/factor-analysis  → prediction tab（默认）
 *
 * @module pages/output/FactorAnalysisHubPage
 * @created 2026-08-13 - 预测三件套合并
 */

import { memo, useMemo } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageContainer, PageHeader } from '@/components/templates'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/molecules'
import { PredictionPanel } from '@/components/organisms/output/prediction/PredictionPanel'
import { CycleRetrospectivePanel } from '@/components/organisms/output/prediction/CycleRetrospectivePanel'
import { FactorDashboardPanel } from '@/components/organisms/output/prediction/FactorDashboardPanel'

/** Tab 值与旧路由的映射，用于初始定位 */
type FactorTab = 'prediction' | 'retrospective' | 'dashboard'

/** 根据 URL pathname 推断初始 Tab（兼容三个旧路由） */
function resolveInitialTab(pathname: string): FactorTab {
  if (pathname.includes('/retrospective')) return 'retrospective'
  if (pathname.includes('/factor-dashboard')) return 'dashboard'
  // /output/prediction 与 /output/factor-analysis 默认 prediction
  return 'prediction'
}

export default memo(function FactorAnalysisHubPage(): React.JSX.Element {
  const location = useLocation()
  const initialTab = useMemo(() => resolveInitialTab(location.pathname), [location.pathname])

  return (
    <ErrorBoundary>
      <PageContainer className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/output">输出舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>因子分析</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="因子分析"
          description="预测校验 · 周期复盘 · 因子画板 —— 因子归因一体化决策链"
        />

        <Tabs defaultValue={initialTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="prediction">预测校验</TabsTrigger>
            <TabsTrigger value="retrospective">周期复盘</TabsTrigger>
            <TabsTrigger value="dashboard">因子画板</TabsTrigger>
          </TabsList>

          <TabsContent value="prediction">
            <PredictionPanel />
          </TabsContent>

          <TabsContent value="retrospective">
            <CycleRetrospectivePanel />
          </TabsContent>

          <TabsContent value="dashboard">
            <FactorDashboardPanel />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </ErrorBoundary>
  )
})
