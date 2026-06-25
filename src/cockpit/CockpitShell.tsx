import React from 'react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Database,
  BarChart3,
  TrendingUp,
  Settings,
  ArrowRight,
  Target,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { Separator } from '@/components/ui/Separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/Breadcrumb'
import { loadSystemStats } from '@/services/system/systemService'

interface ModuleShortcut {
  id: string
  title: string
  description: string
  path: string
  icon: React.ElementType
  badge?: string
}

const MODULE_SHORTCUTS: ModuleShortcut[] = [
  {
    id: 'input',
    title: '数据采集及接口',
    description: '候选池录入、批量导入、热门板块、采集测试',
    path: '/input/hub',
    icon: Database,
  },
  {
    id: 'analysis',
    title: '行业个股分析',
    description: 'V4/V6 评分、行业分析、策略回测',
    path: '/analysis/hub',
    icon: BarChart3,
  },
  {
    id: 'trading',
    title: '交易及持仓',
    description: '交易信号、模拟持仓、订单管理',
    path: '/trading/hub',
    icon: TrendingUp,
  },
  {
    id: 'command',
    title: '总控中心',
    description: '系统监控、配置管理、数据导出',
    path: '/command/hub',
    icon: Settings,
  },
]

const ALLOCATION_DATA = [
  { label: '核心长期', value: 35 },
  { label: '热点短线', value: 35 },
  { label: '推荐个股', value: 15 },
  { label: '现金', value: 15 },
]

export default function CockpitShell(): React.JSX.Element {
  const [stats, setStats] = useState({ stocks: 0, orders: 0, scores: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const result = await loadSystemStats()
      if (result.success && result.data) {
        setStats(result.data)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold">驾驶舱</h1>
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/">返回首页</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">首页</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>驾驶舱</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* 核心指标 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">核心指标</h2>
            <Badge variant="outline" className="gap-1">
              <Activity className="h-3 w-3" />
              系统正常
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              <>
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </>
            ) : (
              <>
                <StatCard title="标的数量" value={stats.stocks} />
                <StatCard title="评分数量" value={stats.scores} />
                <StatCard title="订单数量" value={stats.orders} />
                <StatCard title="系统状态" value="正常" badge />
              </>
            )}
          </div>
        </section>

        <Separator />

        {/* 模块快捷入口 */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">模块快捷入口</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_SHORTCUTS.map((module) => {
              const Icon = module.icon
              return (
                <Card key={module.id} className="transition-shadow hover:shadow-md">
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 资金配置 */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle>资金配置</CardTitle>
                <CardDescription>目标配置比例（参考 V6 Pro 资金配置）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ALLOCATION_DATA.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground">{item.value}%</span>
                    </div>
                    <Progress value={item.value} max={100} showMax={false} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* 快捷操作 */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle>快捷操作</CardTitle>
                <CardDescription>常用工作流入口</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" asChild>
                  <Link to="/input">录入候选股票</Link>
                </Button>
                <Button className="w-full" variant="secondary" asChild>
                  <Link to="/analysis">运行 V6 评分</Link>
                </Button>
                <Button className="w-full" variant="secondary" asChild>
                  <Link to="/trading">查看模拟持仓</Link>
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link to="/output">导出全部数据</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  title,
  value,
  badge,
}: {
  title: string
  value: string | number
  badge?: boolean
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-3xl font-bold">{value}</p>
        {badge ? (
          <Badge variant="default" className="mt-2">
            {title}
          </Badge>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        )}
      </CardContent>
    </Card>
  )
}
