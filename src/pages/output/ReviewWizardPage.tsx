/**
 * @fileoverview P5 复盘向导页（页面层）
 *
 * 作为 /output/wizard 的入口，挂载 ReviewWizard 组件。
 * 页面层只负责面包屑与容器，数据交互下沉至组件（符合 AGENTS 分层）。
 *
 * @module pages/output/ReviewWizardPage
 */
import { memo } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { Button } from '@/components/atoms/Button'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import ReviewWizard from '@/components/organisms/output/ReviewWizard'
import { PageContainer, PageHeader } from '@/components/templates'

export default memo(function ReviewWizardPage(): React.JSX.Element {
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
              <BreadcrumbPage>复盘向导</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="复盘向导"
          description="四步渐进式复盘，逐维揭示，一键导出成品卡"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/output">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Link>
            </Button>
          }
        />

        <ReviewWizard />
      </PageContainer>
    </ErrorBoundary>
  )
})
