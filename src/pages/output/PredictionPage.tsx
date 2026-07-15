/**
 * @fileoverview 预测校验页面
 *
 * @module pages/output/PredictionPage
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
import { PredictionPanel } from '@/components/organisms/output/prediction/PredictionPanel'

export default memo(function PredictionPage(): React.JSX.Element {
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
              <BreadcrumbPage>预测校验</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="预测校验"
          description="因子预测记录、方向/幅度准确性校验与因子归因分析"
        />

        <PredictionPanel />
      </PageContainer>
    </ErrorBoundary>
  )
})
