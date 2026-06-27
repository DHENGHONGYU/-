import { Link } from 'react-router'
import {
  BarChart3,
  Activity,
  Brain,
  TrendingUp,
  Database,
  RotateCcw,
  ArrowRight,
  FileText,
  Newspaper,
  Flame,
  Target,
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

const ANALYSIS_MODULES: HubModule[] = [
  {
    title: 'V4 行业评分',
    description: '赛道选择、LLM 配置、报告上传、行业智能评分',
    path: '/analysis/industry-score',
    icon: BarChart3,
  },
  {
    title: 'V6 个股评分',
    description: '个股九维评分批量运行与结果查看',
    path: '/analysis/stock-score',
    icon: Activity,
  },
  {
    title: 'V6 个股智能评分',
    description: '标的选择、报告输入、纵向比对',
    path: '/analysis/intelligent-score',
    icon: Brain,
  },
  {
    title: '行业分析',
    description: '行业与板块分析入口',
    path: '/analysis/sector',
    icon: Database,
  },
  {
    title: '策略回测',
    description: '策略回测占位页',
    path: '/analysis/backtest',
    icon: TrendingUp,
  },
  {
    title: '评分文档',
    description: '个股评分历史版本库、版本对比与 Markdown 导出',
    path: '/analysis/score-docs',
    icon: FileText,
  },
  {
    title: '智能资讯',
    description: '多源资讯聚合、情感分析、股票关联与筛选',
    path: '/analysis/news',
    icon: Newspaper,
  },
  {
    title: '热门板块策略',
    description: '热门板块五维评分引擎 · 动量·情绪·技术·估值·环境',
    path: '/analysis/hot-sector',
    icon: Flame,
  },
  {
    title: '价值洼地策略',
    description: '价值洼地五维评分引擎 · 催化·安全垫·筹码·轮动·流动性',
    path: '/analysis/value-pit',
    icon: Target,
  },
]

const FUTURE_MODULES: HubModule[] = [
  {
    title: '板块轮动',
    description: '五大因子 16 子指标 AI 评分、信号分级、CSV 导出（参考 V6 Pro）',
    path: '/analysis/sector',
    icon: RotateCcw,
    badge: '数据层待建',
    variant: 'muted',
  },
]

export default function AnalysisHubPage(): React.JSX.Element {
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
            <BreadcrumbPage>分析舱</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">行业个股分析</h1>
          <p className="text-muted-foreground">
            分析舱 · 行业评分 · 个股评分 · 智能评分 · 策略回测
          </p>
        </div>
        <Badge variant="secondary">Phase 3</Badge>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">核心功能</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ANALYSIS_MODULES.map((module) => {
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
