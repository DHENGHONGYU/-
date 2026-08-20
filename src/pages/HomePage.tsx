import React, { useEffect, useMemo, useCallback } from 'react'
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
  ArrowDown,
  Search,
  Gauge,
} from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { Badge } from '@/components/atoms/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/Card'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from '@/components/atoms/Breadcrumb'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PageContainer, PageHeader } from '@/components/templates'
import { EmptyState } from '@/components/molecules/EmptyState'
import { Skeleton } from '@/components/molecules'
import { StockSelector } from '@/components/organisms/input/StockSelector'
import { useIntentionPoolStore } from '@/store/intentionPoolStore'
import { useTradingStore } from '@/store/tradingStore'
import { useOrderStore } from '@/store/orderStore'
import { useCollectionRuntimeStore } from '@/store/collectionRuntimeStore'
import { Currency } from '@/components/atoms/Currency'
import { Percent } from '@/components/atoms/Percent'
import { formatLargeNumber } from '@/lib/precision'
import { mcpBridge } from '@/mcp'
import { cn } from '@/lib/utils'
import type { TradingSignal } from '@/services/trading/signalGenerator'

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

// ============================================================
// 信号方向 → 中文标签 & 颜色映射
// ============================================================

const SIGNAL_DIRECTION_LABEL: Record<string, string> = {
  buy: '买入信号',
  sell: '卖出信号',
  watch: '观望信号',
  hold: '持有信号',
}

const SIGNAL_DIRECTION_CLS: Record<string, string> = {
  buy: 'text-success bg-success/10 border-success/30',
  sell: 'text-danger bg-danger/10 border-danger/30',
  watch: 'text-warning bg-warning/10 border-warning/30',
  hold: 'text-muted-foreground bg-muted border-border/50',
}

// ============================================================
// 辅助函数
// ============================================================

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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

  const statusCards = useMemo(() => [
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
  ], [poolItems.length, signals.length, taskCount, completedTasks, fetcherOk])

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {statusCards.map((s) => {
        const Icon = s.icon
        return (
          <Link
            key={s.label}
            to={s.to}
            className="group flex flex-col gap-2.5 rounded-xl border border-border/40 bg-card p-5 shadow-sm transition-colors hover:bg-muted/30 hover:border-primary/30"
          >
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', s.bgColor, s.color)}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <p className="mt-1 font-mono text-3xl font-bold text-foreground tracking-tight">
              {s.value}
            </p>
            <p className="text-[13px] font-medium text-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </Link>
        )
      })}
    </div>
  )
}

/**
 * 组合总览 Hero —— 从 useTradingStore + useOrderStore 读取真实数据
 */
function PortfolioHero(): React.JSX.Element {
  const portfolio = useTradingStore((s) => s.portfolio)
  const portfolioLoading = useTradingStore((s) => s.portfolioLoading)
  const riskMetrics = useOrderStore((s) => s.riskMetrics)
  const pnlSummary = useOrderStore((s) => s.pnlSummary)
  const positions = useOrderStore((s) => s.positions)

  const hasPortfolio = portfolio != null
  const hasPositions = positions.length > 0

  const totalAssets = useMemo(() => portfolio?.totalValue ?? 0, [portfolio])

  const {
    todayPnL,
    todayPnLPercent,
    todayIsUp,
    todayCls,
  } = useMemo(() => {
    const pnl = hasPortfolio ? pnlSummary.totalUnrealizedPnl : 0
    const pnlPct = totalAssets > 0 ? (pnl / totalAssets) * 100 : 0
    const isUp = pnl >= 0
    return {
      todayPnL: pnl,
      todayPnLPercent: pnlPct,
      todayIsUp: isUp,
      todayCls: isUp ? 'text-stock-up' : 'text-stock-down',
    }
  }, [hasPortfolio, pnlSummary.totalUnrealizedPnl, totalAssets])

  const {
    ytdReturn,
    ytdReturnPercent,
    ytdIsUp,
  } = useMemo(() => {
    const ytd = pnlSummary.totalRealizedPnl
    const ytdPct = totalAssets > 0 ? (ytd / totalAssets) * 100 : 0
    return {
      ytdReturn: ytd,
      ytdReturnPercent: ytdPct,
      ytdIsUp: ytd >= 0,
    }
  }, [pnlSummary.totalRealizedPnl, totalAssets])

  const {
    sharpeRatio,
    maxDrawdown,
    sharpeLabel,
  } = useMemo(() => {
    const sharpe = hasPositions ? riskMetrics.sharpeRatio : 0
    const drawdown = hasPositions ? riskMetrics.maxDrawdown : 0
    const label = sharpe >= 2 ? '优秀' : sharpe >= 1 ? '良好' : sharpe > 0 ? '一般' : '待评估'
    return {
      sharpeRatio: sharpe,
      maxDrawdown: drawdown,
      sharpeLabel: label,
    }
  }, [hasPositions, riskMetrics.sharpeRatio, riskMetrics.maxDrawdown])

  if (portfolioLoading) {
    return (
      <Card className="shadow-sm border-border/40">
        <CardContent className="pt-6 space-y-4">
          <Skeleton variant="text" className="h-4 w-24" />
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="text" className="h-5 w-32" />
        </CardContent>
      </Card>
    )
  }

  if (!hasPortfolio && !hasPositions) {
    return (
      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gauge className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">组合总览</CardTitle>
              <p className="text-xs text-muted-foreground">实时持仓与风险指标</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-5">
          <EmptyState
            title="暂无持仓数据"
            description="请先在交易舱录入持仓"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gauge className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">组合总览</CardTitle>
              <p className="text-xs text-muted-foreground">实时持仓与风险指标</p>
            </div>
          </div>
          <Badge variant="outline" className="border-border/50 text-[11px]">
            数据同步 · 实时
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-5">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:items-center">
          <div className="md:col-span-1">
            <p className="text-[13px] text-muted-foreground">组合总资产</p>
            <p className="mt-1.5 font-mono text-4xl font-bold text-foreground tracking-tight">
              ¥{formatLargeNumber(totalAssets)}
            </p>
            {hasPositions && todayPnL !== 0 && (
              <p className={cn('mt-2 flex items-center gap-1.5 text-[13px] font-medium', todayCls)}>
                {todayIsUp ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                今日 <Currency value={todayPnL} compact decimals={0} /> (<Percent value={todayPnLPercent} decimals={2} />)
              </p>
            )}
            {hasPositions && todayPnL === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                今日暂无变动
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <p className="text-[12px] text-muted-foreground">今日盈亏</p>
                <p className={cn('mt-1.5 text-lg font-semibold', todayCls)}>
                  <Percent value={todayPnLPercent} decimals={2} />
                </p>
                <p className="mt-0.5 text-[13px] text-foreground">
                  <Currency value={todayPnL} compact decimals={0} />
                </p>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">年初至今</p>
                <p className={cn('mt-1.5 text-lg font-semibold', ytdIsUp ? 'text-stock-up' : 'text-stock-down')}>
                  <Percent value={ytdReturnPercent} decimals={2} />
                </p>
                <p className="mt-0.5 text-[13px] text-foreground">
                  <Currency value={ytdReturn} compact decimals={0} />
                </p>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">夏普比率</p>
                <p className="mt-1.5 font-mono text-lg font-semibold text-foreground">
                  {hasPositions ? sharpeRatio.toFixed(2) : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-success">{sharpeLabel}</p>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">最大回撤</p>
                <p className="mt-1.5 text-lg font-semibold text-stock-down">
                  {hasPositions ? <Percent value={maxDrawdown} decimals={2} /> : '—'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">历史</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 最新交易信号列表 —— 从 useTradingStore 读取真实 signals
 */
function SignalList(): React.JSX.Element {
  const signals = useTradingStore((s) => s.signals)
  const displaySignals = useMemo(() => signals.slice(0, 10), [signals])

  if (signals.length === 0) {
    return (
      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <Zap className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">最新交易信号</CardTitle>
                <p className="text-xs text-muted-foreground">{signals.length} 条信号待处理</p>
              </div>
            </div>
            <Link to="/trading" className="text-xs font-medium text-primary hover:underline">
              查看全部 →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-5">
          <EmptyState
            title="暂无交易信号"
            description="请先在交易舱扫描信号"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">最新交易信号</CardTitle>
              <p className="text-xs text-muted-foreground">{signals.length} 条信号待处理</p>
            </div>
          </div>
          <Link to="/trading" className="text-xs font-medium text-primary hover:underline">
            查看全部 →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-5">
        <div className="divide-y divide-border/40 border-t border-border/40 -mx-6 px-6">
          {displaySignals.map((signal: TradingSignal) => {
            const dirCls = SIGNAL_DIRECTION_CLS[signal.direction] ?? SIGNAL_DIRECTION_CLS.hold
            const label = SIGNAL_DIRECTION_LABEL[signal.direction] ?? signal.direction
            const scoreColor = signal.direction === 'buy' ? 'text-success' : signal.direction === 'sell' ? 'text-danger' : 'text-muted-foreground'
            return (
              <div
                key={signal.id}
                className="flex items-center gap-4 py-3 transition-colors hover:bg-muted/20"
              >
                <Badge variant="outline" className={cn('border text-[11px]', dirCls)}>
                  {label}
                </Badge>
                <span className="min-w-[72px] text-[13px] font-semibold text-foreground">{signal.symbol}</span>
                <span className="flex-1 truncate text-[13px] text-muted-foreground">{signal.rationale}</span>
                <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">{formatTime(signal.createdAt)}</span>
                <span className={cn('font-mono text-[13px] font-semibold', scoreColor)}>
                  评分 {(signal.confidence * 10).toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * HomePage - 智能投研复盘系统首页
 *
 * F 型扫描模式布局：
 * 面包屑 → PageHeader → Portfolio Hero KPI → 快速选股 → 系统状态 → 5 舱入口 → 信号列表
 */
export default function HomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const handleQuickSelect = useCallback((stock: { symbol: string }): void => {
    void navigate(`/analysis/intelligent-score?symbol=${stock.symbol}`)
  }, [navigate])

  return (
    <PageContainer className="space-y-6">
      {/* 0. Breadcrumb（顶层锚） */}
      <Breadcrumb aria-label="breadcrumb">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>首页</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="智能投研复盘系统 V9"
          description="多维度投研分析 · 实时行情 · 策略回测 · 风险管控"
          eyebrow={
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              <Gauge className="mr-1.5 h-3 w-3" />
              投资组合总览
            </Badge>
          }
        />
        <Button asChild size="lg" className="shadow-sm shrink-0">
          <Link to="/cockpit">
            <BarChart3 className="mr-2 h-4 w-4" />
            打开驾驶舱
          </Link>
        </Button>
      </div>

      {/* 2. Portfolio Overview Hero */}
      <PortfolioHero />

      {/* 3. Quick Stock Analysis */}
      <Card className="shadow-sm border-border/40">
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">快速选股分析</h2>
                <p className="text-xs text-muted-foreground">搜索股票名称或代码，一键跳转智能评分</p>
              </div>
            </div>
            <div className={isMobile ? 'w-full' : 'w-80'}>
              <StockSelector
                value=""
                onChange={handleQuickSelect}
                placeholder="搜索股票名称或代码..."
                showIcon={false}
                maxDisplayCount={10}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. System Status Overview */}
      <SystemStatusOverview />

      {/* 5. Feature Cabin Entry Cards (5-column grid) */}
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {CABIN_FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.title}
              to={feature.to}
              className="group flex flex-col gap-2.5 rounded-xl border border-border/40 bg-card p-5 shadow-sm transition-colors hover:bg-muted/30 hover:border-primary/30"
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', feature.bgColor, feature.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-1 text-[14px] font-semibold text-foreground">{feature.title}</p>
              <p className="text-xs text-muted-foreground">{feature.desc}</p>
              <span className="mt-auto pt-2 text-xs font-medium text-primary/80 transition-colors group-hover:text-primary">
                进入 →
              </span>
            </Link>
          )
        })}
      </div>

      {/* 6. Latest Signals */}
      <SignalList />
    </PageContainer>
  )
}