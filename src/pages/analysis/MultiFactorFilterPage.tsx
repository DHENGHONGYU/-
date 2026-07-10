/**
 * @module MultiFactorFilterPage
 * @description 多因子筛选页面（DA-007 四步集成合约：第 4 步 UI）。
 * 仅负责挂载已实现的 MultiFactorFilterPanel 并接入 multiFactorScreeningStore，
 * 业务行为与筛选逻辑全部由组件与 Store 承载，本文件不做额外逻辑。
 *
 * 阶段 D-4 增强：补 PageContainer + PageHeader + 面包屑，让页面具备完整结构
 * （原 14 行只挂载组件，视觉上像"组件裸露"）。
 *
 * 关联：componentRegistry.ts 中 MultiFactorFilterPanel 的 suggestedTarget 指向本页。
 */

import { Link } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MultiFactorFilterPanel } from '@/components/analysis/screening/MultiFactorFilterPanel'

export default function MultiFactorFilterPage(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <PageContainer>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/analysis">分析舱</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>多因子筛选</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="多因子筛选"
          description="按条件组增删 / 因子编辑 / 模板持久化"
        />

        <MultiFactorFilterPanel />
      </PageContainer>
    </ErrorBoundary>
  )
}
