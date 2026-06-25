import { Link } from 'react-router'
import {
  Activity,
  TrendingUp,
  Wallet,
  FileText,
  Scale,
  Bot,
  ArrowRight,
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

const TRADING_MODULES: HubModule[] = [
  {
    title: '交易信号',
    description: '观察池、信号扫描、买卖下单',
    path: '/trading',
    icon: Activity,
  },
  {
    title: '模拟持仓',
    description: '持仓列表、订单管理',
    path: '/trading',
    icon: Wallet,
  },
  {
    title: '策略快照',
    description: '核心仓/热点短线/价值洼地分类与历史快照',
    path: '/trading/strategy-snapshots',
    icon: Target,
  },
]

const FUTURE_MODULES: HubModule[] = [
  {
    title: '策略管理',
    description: '核心仓/热点短线/价值洼地分类、三源联动、版本快照（参考 V6 Pro）',
    path: '/trading',
    icon: Scale,
    badge: '数据层待建',
    variant: 'muted',
  },
  {
    title: '策略执行',
    description: '标的筛选、分步建仓、动态止盈、T 降成本（参考 V6 Pro）',
    path: '/trading',
    icon: TrendingUp,
    badge: '数据层待建',
    variant: 'muted',
  },
  {
    title: 'AI 交易复盘',
    description: '六维报告、纪律评分、行动计划（参考 V6 Pro）',
    path: '/trading',
    icon: Bot,
    badge: '数据层待建',
    variant: 'muted',
  },
  {
    title: '交易记录',
    description: '交易流水 CRUD、统计卡片、关联股票策略（参考 V6 Pro）',
    path: '/trading',
    icon: FileText,
    badge: '数据层待建',
    variant: 'muted',
  },
]

export default function TradingHubPage(): React.JSX.Element {
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
            <BreadcrumbPage>交易舱</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">交易及持仓</h1>
          <p className="text-muted-foreground">
            交易舱 · 信号扫描 · 模拟持仓 · 策略执行 · 交易复盘
          </p>
        </div>
        <Badge variant="secondary">模块四</Badge>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">核心功能</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADING_MODULES.map((module) => {
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
