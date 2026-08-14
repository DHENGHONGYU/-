import React, { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Database,
  BarChart3,
  TrendingUp,
  FileText,
  Activity,
  Wifi,
  Zap,
  Settings,
  ArrowUp,
  Search,
} from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { PageContainer } from '@/components/templates/PageContainer'
import { StockSelector } from '@/components/organisms/input/StockSelector'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { useTradingStore } from '@/store/tradingStore'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { mcpBridge } from '@/mcp'

interface FeatureCardProps {
  icon: React.ElementType
  title: string
  desc: string
  to: string
  color: string
  bgColor: string
}

const CABIN_FEATURES: FeatureCardProps[] = [
  {
    icon: Database,
    title: '输入舱',
    desc: '双源输入 · 数据采集',
    to: '/input',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: BarChart3,
    title: '分析舱',
    desc: '多因子模型 · 深度研究',
    to: '/analysis',
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    icon: TrendingUp,
    title: '交易舱',
    desc: '持仓管理 · 交易复盘',
    to: '/trading',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    icon: FileText,
    title: '输出舱',
    desc: '报告生成 · 策略回测',
    to: '/output',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    icon: Settings,
    title: '总控舱',
    desc: '系统监控 · 运维管理',
    to: '/command',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
]

/**
 * 系统状态总览卡片
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
      bgColor: 'bg-primary/10',
    },
    {
      icon: Zap,
      label: '交易信号',
      value: signals.length,
      hint: signals.length > 0 ? `${signals.length} 条待处理` : '暂无信号',
      to: '/trading',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      icon: Activity,
      label: '采集任务',
      value: taskCount,
      hint: taskCount > 0 ? `${completedTasks}/${taskCount} 已完成` : '未启动采集',
      to: '/input/collect-tasks',
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      icon: Wifi,
      label: '采集服务',
      value: fetcherOk === null ? '…' : fetcherOk ? '正常' : '断连',
      hint: fetcherOk ? '信号正常' : fetcherOk === false ? '请检查服务' : '检查中',
      to: '/input/data-test',
      color: fetcherOk === null ? 'text-muted-foreground' : fetcherOk ? 'text-success' : 'text-destructive',
      bgColor: fetcherOk === null ? 'bg-muted' : fetcherOk ? 'bg-success/10' : 'bg-destructive/10',
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {statusCards.map((s) => {
        const Icon = s.icon
        return (
          <Link
            key={s.label}
            to={s.to}
            className="flex flex-col gap-2 rounded-lg p-5"
            style={{ background: 'hsl(var(--card))', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${s.bgColor} ${s.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-1 font-bold font-mono" style={{ fontSize: 'var(--fs-display)', lineHeight: 'var(--lh-tight)', color: 'hsl(var(--foreground))' }}>
              {s.value}
            </p>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.label}</p>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.hint}</p>
          </Link>
        )
      })}
    </section>
  )
}

/**
 * HomePage - 智能投研复盘系统首页
 */
export default function HomePage(): React.JSX.Element {
  const navigate = useNavigate()

  const handleQuickSelect = (stock: { symbol: string }): void => {
    void navigate(`/analysis/intelligent-score?symbol=${stock.symbol}`)
  }

  return (
    <PageContainer>
      {/* Quick Stock Analysis */}
      <section
        className="mb-6 rounded-lg p-5"
        style={{ background: 'hsl(var(--card))', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">快速选股分析</h2>
              <p className="text-xs text-muted-foreground">搜索股票名称或代码，一键跳转智能评分</p>
            </div>
          </div>
          <div className="w-full sm:w-80">
            <StockSelector
              value=""
              onChange={handleQuickSelect}
              placeholder="搜索股票名称或代码..."
              showIcon={false}
              maxDisplayCount={10}
            />
          </div>
        </div>
      </section>

      {/* Page Header with badge */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
          >
            投资组合总览
          </span>
          <h1 className="mt-2 font-semibold text-foreground" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-tight)' }}>
            智能投研复盘系统 V9
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            多维度投研分析 · 实时行情 · 策略回测 · 风险管控
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/cockpit">打开驾驶舱</Link>
        </Button>
      </header>

      {/* Portfolio Overview Hero */}
      <section
        className="rounded-lg p-6"
        style={{ background: 'hsl(var(--card))', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-1">
            <p className="text-sm text-muted-foreground">组合总资产</p>
            <p
              className="mt-1 font-bold font-mono text-foreground"
              style={{ fontSize: 'var(--fs-display)', lineHeight: 'var(--lh-tight)' }}
            >
              ¥482,350
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm" style={{ color: 'hsl(var(--stock-up))' }}>
              <ArrowUp className="h-4 w-4" />
              今日 +¥8,250 (+1.74%)
            </p>
          </div>
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">今日盈亏</p>
                <p className="mt-1 font-semibold" style={{ color: 'hsl(var(--stock-up))' }}>+1.74%</p>
                <p className="mt-0.5 text-sm text-foreground">¥8,250</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">年初至今</p>
                <p className="mt-1 font-semibold" style={{ color: 'hsl(var(--stock-up))' }}>+12.3%</p>
                <p className="mt-0.5 text-sm text-foreground">¥52,800</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">夏普比率</p>
                <p className="mt-1 font-mono font-semibold text-foreground">2.15</p>
                <p className="mt-0.5 text-xs" style={{ color: 'hsl(var(--success))' }}>优秀</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">最大回撤</p>
                <p className="mt-1 font-semibold" style={{ color: 'hsl(var(--stock-down))' }}>-3.2%</p>
                <p className="mt-0.5 text-xs text-muted-foreground">近30天</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SystemStatusOverview />

      {/* Feature Cabin Entry Cards (5-column grid) */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CABIN_FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.title}
              to={feature.to}
              className="flex flex-col gap-2 rounded-lg p-5 transition-shadow hover:shadow-elevation-2"
              style={{ background: 'hsl(var(--card))', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-md ${feature.bgColor} ${feature.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">{feature.title}</p>
              <p className="text-xs text-muted-foreground">{feature.desc}</p>
              <span className="mt-auto pt-2 text-xs text-primary">进入 →</span>
            </Link>
          )
        })}
      </section>

      {/* Latest Signals + System Status */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div
          className="rounded-lg p-6 lg:col-span-2"
          style={{ background: 'hsl(var(--card))', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground" style={{ fontSize: 'var(--fs-h3)', lineHeight: 'var(--lh-tight)' }}>
              最新交易信号
            </h2>
            <Link to="/trading" className="text-xs" style={{ color: 'hsl(var(--primary))' }}>查看全部</Link>
          </div>
          <div className="mt-3 space-y-0">
            <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid hsl(var(--divider))' }}>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'hsl(var(--stock-up) / 0.1)', color: 'hsl(var(--stock-up))' }}
              >
                买入信号
              </span>
              <span className="text-sm font-medium text-foreground">贵州茅台 600519.SH</span>
              <span className="flex-1 text-sm text-muted-foreground">突破前期高点</span>
              <span className="font-mono text-xs text-muted-foreground">10:32</span>
              <span className="font-mono text-sm" style={{ color: 'hsl(var(--stock-up))' }}>评分 8.5</span>
            </div>
            <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid hsl(var(--divider))' }}>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'hsl(var(--warning) / 0.1)', color: 'hsl(var(--warning))' }}
              >
                观望信号
              </span>
              <span className="text-sm font-medium text-foreground">宁德时代 300750.SZ</span>
              <span className="flex-1 text-sm text-muted-foreground">量能不足</span>
              <span className="font-mono text-xs text-muted-foreground">09:45</span>
              <span className="font-mono text-sm" style={{ color: 'hsl(var(--warning))' }}>评分 6.5</span>
            </div>
            <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid hsl(var(--divider))' }}>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: 'hsl(var(--stock-down) / 0.1)', color: 'hsl(var(--stock-down))' }}
              >
                减仓信号
              </span>
              <span className="text-sm font-medium text-foreground">古井贡酒 000596.SZ</span>
              <span className="flex-1 text-sm text-muted-foreground">技术面走弱</span>
              <span className="font-mono text-xs text-muted-foreground">14:20</span>
              <span className="font-mono text-sm" style={{ color: 'hsl(var(--stock-down))' }}>评分 5.0</span>
            </div>
          </div>
        </div>

        <div
          className="rounded-lg p-6"
          style={{ background: 'hsl(var(--card))', boxShadow: 'var(--shadow-sm)' }}
        >
          <h2 className="font-semibold text-foreground" style={{ fontSize: 'var(--fs-h3)', lineHeight: 'var(--lh-tight)' }}>
            系统状态
          </h2>
          <div className="mt-3 space-y-0">
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid hsl(var(--divider))' }}>
              <span className="text-sm text-muted-foreground">采集服务</span>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'hsl(var(--success))' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--success))' }}></span>
                运行中
              </span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid hsl(var(--divider))' }}>
              <span className="text-sm text-muted-foreground">LLM引擎</span>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'hsl(var(--success))' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--success))' }}></span>
                运行中
              </span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid hsl(var(--divider))' }}>
              <span className="text-sm text-muted-foreground">数据库</span>
              <span className="flex items-center gap-1.5 text-sm" style={{ color: 'hsl(var(--success))' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: 'hsl(var(--success))' }}></span>
                正常
              </span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid hsl(var(--divider))' }}>
              <span className="text-sm text-muted-foreground">最后同步</span>
              <span className="font-mono text-sm text-muted-foreground">19:35:22</span>
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  )
}