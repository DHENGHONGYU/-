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
} from '@/components/ui/Breadcrumb'
import { Button } from '@/components/ui/Button'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import ReviewWizard from '@/components/output/ReviewWizard'

export default memo(function ReviewWizardPage(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <div className="space-y-6 p-4">
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

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">复盘向导</h1>
            <p className="text-muted-foreground">四步渐进式复盘，逐维揭示，一键导出成品卡</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/output">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Link>
          </Button>
        </div>

        <ReviewWizard />
      </div>
    </ErrorBoundary>
  )
})
