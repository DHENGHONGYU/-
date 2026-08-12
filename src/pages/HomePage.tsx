import React, { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import {
  Database,
  BarChart3,
  TrendingUp,
  FileText,
  ArrowRight,
  Activity,
  Wifi,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { PageContainer } from '@/components/templates/PageContainer'
import { PageHeader } from '@/components/templates/PageHeader'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { useTradingStore } from '@/store/tradingStore'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { mcpBridge } from '@/mcp'

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
 * 系统状态总览卡片
 *
 * 消费者首屏即可感知当前系统状态：股票池计数、信号数、采集健康度。
 */
function SystemStatusOverview(): React.JSX.Element {
  const poolItems = useIntentionPoolStore((s) => s.items)
  const signals = useTradingStore((s) => s.signals)
  const taskStatuses = useCollectionRuntimeStore((s) => s.taskStatuses)
  const [fetcherOk, setFetcherOk] = React.useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    mcpBridge.callTool('fetcher', 'check_health', {})
      .then((r) => { if (mounted) setFetcherOk(!r.isError) })
      .catch(() => { if (mounted) setFetcherOk(false) })
    return () => { mounted = false }
  }, [])

  const taskCount = useMemo(() => Object.keys(taskStatuses).length, [taskStatuses])
  const completedTasks = useMemo(
    () => Object.values(taskStatuses).filter((t) => t.status === 'completed').length,
    [taskStatuses],
  )

  const statusCards = [
    {
      icon: Database,
      label: '股票池',
      value: poolItems.length,
      hint: poolItems.length > 0 ? `${poolItems.length} 只候选` : '尚无标的',
      to: '/input',
      color: 'text-primary',
    },
    {
      icon: Zap,
      label: '交易信号',
      value: signals.length,
      hint: signals.length > 0 ? `${signals.length} 条待处理` : '暂无信号',
      to: '/trading',
      color: 'text-warning',
    },
    {
      icon: Activity,
      label: '采集任务',
      value: taskCount,
      hint: taskCount > 0 ? `${completedTasks}/${taskCount} 已完成` : '未启动采集',
      to: '/input/collect-tasks',
      color: 'text-success',
    },
    {
      icon: Wifi,
      label: '采集服务',
      value: fetcherOk === null ? '…' : fetcherOk ? '正常' : '断连',
      hint: fetcherOk ? '信号正常' : fetcherOk === false ? '请检查服务' : '检查中',
      to: '/input/data-test',
      color: fetcherOk === null ? 'text-muted-foreground' : fetcherOk ? 'text-success' : 'text-destructive',
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statusCards.map((s) => {
        const Icon = s.icon
        return (
          <Link
            key={s.label}
            to={s.to}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-elevation-1 transition-all hover:border-divider hover:shadow-elevation-2"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted ${s.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="truncate text-lg font-bold text-foreground">{s.value}</p>
              <p className="truncate text-[11px] text-muted-foreground">{s.hint}</p>
            </div>
          </Link>
        )
      })}
    </section>
  )
}

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

      <SystemStatusOverview />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </PageContainer>
  )
}
