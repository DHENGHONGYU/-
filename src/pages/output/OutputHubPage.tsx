import { memo } from 'react'
import { Link } from 'react-router'
import { FileText, BarChart3, Database, Wand2, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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
]

export default memo(function OutputHubPage(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <div className="space-y-6">
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

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">输出舱</h1>
            <p className="text-muted-foreground">报告导出与数据输出管理</p>
          </div>
          <Badge variant="secondary">V3.0 模块五</Badge>
        </div>

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
      </div>
    </ErrorBoundary>
  )
})
