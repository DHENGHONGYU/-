import { Link } from 'react-router'
import {
  LayoutDashboard,
  Upload,
  Flame,
  Wifi,
  Database,
  FileJson,
  ArrowRight,
  BookOpen,
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
}

const INPUT_MODULES: HubModule[] = [
  {
    title: '录入看板',
    description: '股票搜索、候选池录入、看板/列表视图、状态流转',
    path: '/input',
    icon: LayoutDashboard,
  },
  {
    title: '批量导入',
    description: '粘贴 CSV/文本批量解析导入候选池',
    path: '/input/bulk-import',
    icon: Upload,
  },
  {
    title: '热门板块',
    description: '热门板块推荐，快速加入候选池',
    path: '/input/hot-sectors',
    icon: Flame,
  },
  {
    title: '采集测试',
    description: '数据源健康检查、单接口/批量采集测试',
    path: '/input/data-test',
    icon: Wifi,
  },
  {
    title: '本地知识库',
    description: '本地研报/财报/笔记导入、浏览、搜索与统计',
    path: '/input/local-knowledge',
    icon: BookOpen,
  },
]

const DATA_MODULES: HubModule[] = [
  {
    title: '股票池管理',
    description: '自选股分组、导入导出、策略模板（参考 V6 Pro）',
    path: '/input',
    icon: Database,
    badge: '待增强',
  },
  {
    title: '七维采集',
    description: '7 维度开关 + 5 方向策略模板配置（参考 V6 Pro）',
    path: '/input/data-test',
    icon: FileJson,
    badge: '数据层待建',
  },
]

export default function InputHubPage(): React.JSX.Element {
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
            <BreadcrumbPage>输入舱</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据采集及接口</h1>
          <p className="text-muted-foreground">
            输入舱 · 候选池录入 · 批量导入 · 热门板块 · 采集测试
          </p>
        </div>
        <Badge variant="secondary">V3.0 模块一</Badge>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">核心功能</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INPUT_MODULES.map((module) => {
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
        <div className="grid gap-4 sm:grid-cols-2">
          {DATA_MODULES.map((module) => {
            const Icon = module.icon
            return (
              <Card key={module.title} className="border-dashed bg-muted/30">
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
                    <Link to={module.path}>查看现有入口</Link>
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
