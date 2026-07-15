import { memo } from 'react'
import { Link } from 'react-router'
import { FileText, BarChart3, Database, Wand2, ArrowRight, TrendingUp, RefreshCw, LayoutDashboard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/Card'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { ErrorBoundary } from '@/components/organisms/shared/ErrorBoundary'
import { PageContainer, PageHeader } from '@/components/templates'

interface HubModule {
  title: string
  description: string
  path: string
  icon: React.ElementType
  badge?: string
}

const OUTPUT_MODULES: HubModule[] = [
  {
    title: '研究报告',
    description: '生成和导出研究报告',
    path: '/output/research',
    icon: FileText,
  },
  {
    title: '交易复盘',
    description: '交易记录回顾与复盘报告',
    path: '/output/review',
    icon: BarChart3,
  },
  {
    title: '数据导出',
    description: '全量数据 JSON/CSV 导出',
    path: '/output/export',
    icon: Database,
  },
  {
    title: '复盘向导',
    description: '四步渐进式复盘并导出成品卡',
    path: '/output/wizard',
    icon: Wand2,
  },
  {
    title: '预测校验',
    description: '因子预测记录与准确性校验',
    path: '/output/prediction',
    icon: TrendingUp,
    badge: '新增',
  },
  {
    title: '周期复盘',
    description: '月度周期复盘与因子权重校准',
    path: '/output/retrospective',
    icon: RefreshCw,
    badge: '新增',
  },
  {
    title: '因子画板',
    description: '因子监控画板与失效预警',
    path: '/output/factor-dashboard',
    icon: LayoutDashboard,
    badge: '新增',
  },
]

export default memo(function OutputHubPage(): React.JSX.Element {
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
              <BreadcrumbPage>输出舱</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageHeader
          title="输出舱"
          description="报告导出与数据输出管理"
          actions={<Badge variant="secondary">V3.0 模块五</Badge>}
        />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">功能模块</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {OUTPUT_MODULES.map((module) => {
              const Icon = module.icon
              const isPlaceholder = !!module.badge
              return (
                <Card
                  key={module.title}
                  className={isPlaceholder ? 'border-dashed bg-muted/30' : 'transition-shadow hover:shadow-md'}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-md ${
                            isPlaceholder ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base">{module.title}</CardTitle>
                      </div>
                      {module.badge && <Badge variant="outline">{module.badge}</Badge>}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                      <Link to={module.path}>
                        进入
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
      </section>
    </PageContainer>
  </ErrorBoundary>
  )
})
