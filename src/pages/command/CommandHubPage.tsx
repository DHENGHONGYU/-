import { Link } from 'react-router'
import {
  Activity,
  Settings,
  Brain,
  Shield,
  FileOutput,
  RotateCcw,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/Breadcrumb'

interface HubModule {
  title: string
  description: string
  path: string
  icon: React.ElementType
  badge?: string
  variant?: 'default' | 'muted'
}

const COMMAND_MODULES: HubModule[] = [
  {
    title: '系统监控',
    description: '刷新统计、重置数据、采集服务状态',
    path: '/command/monitor',
    icon: Activity,
  },
  {
    title: '配置管理',
    description: '系统配置与状态管理',
    path: '/command/config',
    icon: Settings,
  },
]

const FUTURE_MODULES: HubModule[] = [
  {
    title: 'AI 体中心',
    description: 'Agent 注册、生命周期、健康、协调、任务调度（参考 V6 Pro）',
    path: '/command',
    icon: Brain,
    badge: '数据层待建',
    variant: 'muted',
  },
  {
    title: '风控网关',
    description: '回路状态、裁决记录、风控三态展示（参考 V6 Pro）',
    path: '/command',
    icon: Shield,
    badge: '数据层待建',
    variant: 'muted',
  },
  {
    title: '报告导出',
    description: 'Markdown/PDF 报告生成（参考 V6 Pro）',
    path: '/output',
    icon: FileOutput,
    badge: '数据层待建',
    variant: 'muted',
  },
  {
    title: '信号质量复盘',
    description: '准确率、择时得分、最大回撤、Sharpe（参考 V6 Pro）',
    path: '/command',
    icon: RotateCcw,
    badge: '数据层待建',
    variant: 'muted',
  },
]

export default function CommandHubPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">首页</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>总控舱</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">总控中心</h1>
          <p className="text-muted-foreground">
            总控舱 · 系统监控 · AI 体调度 · 风控网关 · 复盘导出
          </p>
        </div>
        <Badge variant="secondary">系统</Badge>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">核心功能</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMMAND_MODULES.map((module) => {
            const Icon = module.icon
            return (
              <Card key={module.title} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{module.title}</CardTitle>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">可扩展能力（参考 V6 Pro）</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FUTURE_MODULES.map((module) => {
            const Icon = module.icon
            return (
              <Card
                key={module.title}
                className={module.variant === 'muted' ? 'border-dashed bg-muted/30' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base">{module.title}</CardTitle>
                    </div>
                    {module.badge && <Badge variant="outline">{module.badge}</Badge>}
                  </div>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link to={module.path}>查看相关入口</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
