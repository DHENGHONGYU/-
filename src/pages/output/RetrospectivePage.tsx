/**
 * @fileoverview 周期复盘页面
 *
 * @module pages/output/RetrospectivePage
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
import { CycleRetrospectivePanel } from '@/components/organisms/output/prediction/CycleRetrospectivePanel'

export default memo(function RetrospectivePage(): React.JSX.Element {
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
              <BreadcrumbPage>周期复盘</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="周期复盘"
          description="月度预测准确率统计、因子 IC/IR 排名与权重校准建议"
        />

        <CycleRetrospectivePanel />
      </PageContainer>
    </ErrorBoundary>
  )
})
