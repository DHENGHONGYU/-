import React from 'react'
import { Link } from 'react-router'
import {
  Database,
  BarChart3,
  TrendingUp,
  FileText,
  Settings,
  Target,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { GRADIENT } from '@/constants/theme.tokens'

interface FeatureCardProps {
  icon: React.ElementType
  title: string
  desc: string
  to: string
  badge?: string
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: Database,
    title: '输入舱',
    desc: '录入候选股票，管理股票池，批量导入，热门板块',
    to: '/input/hub',
  },
  {
    icon: BarChart3,
    title: '分析舱',
    desc: 'V4/V6 评分，行业分析，策略回测',
    to: '/analysis/hub',
  },
  {
    icon: TrendingUp,
    title: '交易舱',
    desc: '交易信号，模拟盘执行，持仓管理',
    to: '/trading/hub',
  },
  {
    icon: FileText,
    title: '输出舱',
    desc: '研究报告，数据导出',
    to: '/output',
  },
]

export default function HomePage(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${GRADIENT.fromEmerald500} ${GRADIENT.toSky500} text-white`}>
              <Target className="h-5 w-5" />
            </div>
            <CardTitle className="text-3xl">智能投研复盘系统 V9</CardTitle>
          </div>
          <CardDescription className="text-base">
            面向中国 A 股个人投资者的研究决策工具
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <Link
                  key={feature.title}
                  to={feature.to}
                  className="group rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </Link>
              )
            })}
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link to="/input/hub">进入输入舱</Link>
            </Button>
            <Button variant="secondary" asChild size="lg">
              <Link to="/cockpit">打开驾驶舱</Link>
            </Button>
            <Button variant="outline" asChild size="lg">
              <Link to="/command/hub">总控中心</Link>
            </Button>
          </div>

          <div className="flex justify-center">
            <Badge variant="outline" className="gap-1">
              <Settings className="h-3 w-3" />
              UI 组件已升级 · 模块首页已上线
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
