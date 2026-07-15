/**
 * @fileoverview 因子画板页面
 *
 * @module pages/output/FactorDashboardPage
 * @created 2026-07-15 - 输出模块补强
 */

import { memo } from 'react'
import { Link } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageContainer, PageHeader } from '@/components/templates'
import { FactorDashboardPanel } from '@/components/organisms/output/prediction/FactorDashboardPanel'

export default memo(function FactorDashboardPage(): React.JSX.Element {
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
              <BreadcrumbPage>因子画板</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="因子画板"
          description="市场周期判定、活跃因子排名、失效预警与高置信度预测"
        />

        <FactorDashboardPanel />
      </PageContainer>
    </ErrorBoundary>
  )
})
