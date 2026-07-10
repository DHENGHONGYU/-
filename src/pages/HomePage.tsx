import React from 'react'
import { Link } from 'react-router'
import {
  Database,
  BarChart3,
  TrendingUp,
  FileText,
  Settings,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

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
    to: '/input',
  },
  {
    icon: BarChart3,
    title: '分析舱',
    desc: 'V4/V6 评分，行业分析，策略回测',
    to: '/analysis',
  },
  {
    icon: TrendingUp,
    title: '交易舱',
    desc: '交易信号，模拟盘执行，持仓管理',
    to: '/trading',
  },
  {
    icon: FileText,
    title: '输出舱',
    desc: '研究报告，数据导出',
    to: '/output',
  },
]

/**
 * HomePage
 */
export default function HomePage(): React.JSX.Element {
  return (
    <PageContainer>
      <PageHeader
        title="智能投研复盘系统 V9"
        description="面向中国 A 股个人投资者的研究决策工具"
        actions={
          <Button asChild size="lg">
            <Link to="/cockpit">打开驾驶舱</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.title}
              to={feature.to}
              className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-elevation-1 transition-all hover:border-divider hover:shadow-elevation-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-h3 text-foreground">{feature.title}</h3>
                <p className="text-body-sm text-muted-foreground">{feature.desc}</p>
              </div>
              <div className="mt-auto flex items-center gap-1 pt-2 text-body-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                进入
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          )
        })}
      </section>

      <section className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button asChild size="lg">
          <Link to="/input">进入输入舱</Link>
        </Button>
        <Button variant="secondary" asChild size="lg">
          <Link to="/command">总控中心</Link>
        </Button>
      </section>

      <div className="mt-6">
        <Badge variant="outline" className="gap-1">
          <Settings className="h-3 w-3" />
          UI 组件已升级 · 模块首页已上线
        </Badge>
      </div>
    </PageContainer>
  )
}
