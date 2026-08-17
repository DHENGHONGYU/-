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
} from 'lucide-react'
import { Button } from '@/components/atoms/Button'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PageContainer } from '@/components/templates/PageContainer'
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

const SIGNAL_DIRECTION_COLOR: Record<string, string> = {
  buy: 'hsl(var(--stock-up))',
  sell: 'hsl(var(--stock-down))',
  watch: 'hsl(var(--warning))',
  hold: 'hsl(var(--muted-foreground))',
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
  const isMobile = useMediaQuery('(max-width: 767px)')
  void isMobile
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
    <section className={`grid grid-cols-2 gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
      {statusCards.map((s) => {
        const Icon = s.icon
        return (
          <Link
            key={s.label}
            to={s.to}
            className="flex flex-col gap-2 rounded-lg p-5 bg-card"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${s.bgColor} ${s.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-1 font-bold font-mono text-foreground" style={{ fontSize: 'var(--fs-display)', lineHeight: 'var(--lh-tight)' }}>
              {s.value}
            </p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </Link>
        )
      })}
    </section>
  )
}

/**
 * 组合总览 Hero —— 从 useTradingStore + useOrderStore 读取真实数据
 */
function PortfolioHero(): React.JSX.Element {
  const isMobile = useMediaQuery('(max-width: 767px)')
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
    todayColor,
  } = useMemo(() => {
    const pnl = hasPortfolio ? pnlSummary.totalUnrealizedPnl : 0
    const pnlPct = totalAssets > 0 ? (pnl / totalAssets) * 100 : 0
    const isUp = pnl >= 0
    return {
      todayPnL: pnl,
      todayPnLPercent: pnlPct,
      todayIsUp: isUp,
      todayColor: isUp ? 'hsl(var(--stock-up))' : 'hsl(var(--stock-down))',
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
      <section
        className="mb-6 rounded-lg p-6 bg-card"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <Skeleton variant="text" className="h-4 w-24 mb-4" />
        <Skeleton variant="text" className="h-8 w-48 mb-2" />
        <Skeleton variant="text" className="h-5 w-32" />
      </section>
    )
  }

  if (!hasPortfolio && !hasPositions) {
    return (
      <section
        className="mb-6 rounded-lg p-6 bg-card"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <EmptyState
          title="暂无持仓数据"
          description="请先在交易舱录入持仓"
        />
      </section>
    )
  }

  return (
    <section
      className="mb-6 rounded-lg p-6 bg-card"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-center">
        <div className="md:col-span-1">
          <p className="text-sm text-muted-foreground">组合总资产</p>
          <p
            className="mt-1 font-bold font-mono text-foreground"
            style={{ fontSize: 'var(--fs-display)', lineHeight: 'var(--lh-tight)' }}
          >
            ¥{formatLargeNumber(totalAssets)}
          </p>
          {hasPositions && todayPnL !== 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm" style={{ color: todayColor }}>
              {todayIsUp ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              今日 <Currency value={todayPnL} compact decimals={0} /> (<Percent value={todayPnLPercent} decimals={2} />)
            </p>
          )}
          {hasPositions && todayPnL === 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              今日暂无变动
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <div className={`grid grid-cols-2 gap-6 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
            <div>
              <p className="text-xs text-muted-foreground">今日盈亏</p>
              <p className="mt-1 font-semibold" style={{ color: todayColor }}>
                <Percent value={todayPnLPercent} decimals={2} />
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                <Currency value={todayPnL} compact decimals={0} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">年初至今</p>
              <p className="mt-1 font-semibold" style={{ color: ytdIsUp ? 'hsl(var(--stock-up))' : 'hsl(var(--stock-down))' }}>
                <Percent value={ytdReturnPercent} decimals={2} />
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                <Currency value={ytdReturn} compact decimals={0} />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">夏普比率</p>
              <p className="mt-1 font-mono font-semibold text-foreground">
                {hasPositions ? sharpeRatio.toFixed(2) : '—'}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'hsl(var(--success))' }}>{sharpeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">最大回撤</p>
              <p className="mt-1 font-semibold" style={{ color: 'hsl(var(--stock-down))' }}>
                {hasPositions ? <Percent value={maxDrawdown} decimals={2} /> : '—'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">历史</p>
            </div>
          </div>
        </div>
      </div>
    </section>
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
      <section
        className="mt-6 rounded-lg p-6 bg-card"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground" style={{ fontSize: 'var(--fs-h3)', lineHeight: 'var(--lh-tight)' }}>
            最新交易信号
          </h2>
          <Link to="/trading" className="text-xs text-primary">查看全部</Link>
        </div>
        <EmptyState
          title="暂无交易信号"
          description="请先在交易舱扫描信号"
        />
      </section>
    )
  }

  return (
    <section
      className="mt-6 rounded-lg p-6 bg-card"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground" style={{ fontSize: 'var(--fs-h3)', lineHeight: 'var(--lh-tight)' }}>
          最新交易信号
        </h2>
        <Link to="/trading" className="text-xs text-primary">查看全部</Link>
      </div>
      <div className="mt-3 space-y-0">
        {displaySignals.map((signal: TradingSignal, idx: number) => {
          const dirColor = SIGNAL_DIRECTION_COLOR[signal.direction] ?? 'hsl(var(--muted-foreground))'
          const label = SIGNAL_DIRECTION_LABEL[signal.direction] ?? signal.direction
          return (
            <div
              key={signal.id}
              className="flex items-center gap-3 py-3"
              style={{ borderTop: idx === 0 ? '1px solid hsl(var(--divider))' : '1px solid hsl(var(--divider))' }}
            >
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: `${dirColor} / 0.1`, color: dirColor }}
              >
                {label}
              </span>
              <span className="text-sm font-medium text-foreground">{signal.symbol}</span>
              <span className="flex-1 text-sm text-muted-foreground">{signal.rationale}</span>
              <span className="font-mono text-xs text-muted-foreground">{formatTime(signal.createdAt)}</span>
              <span className="font-mono text-sm" style={{ color: dirColor }}>评分 {(signal.confidence * 10).toFixed(1)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * HomePage - 智能投研复盘系统首页
 *
 * F 型扫描模式布局：
 * Header(h1) → Portfolio Hero KPI → 快速选股 → 系统状态 → 5 舱入口 → 信号列表
 */
export default function HomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const handleQuickSelect = useCallback((stock: { symbol: string }): void => {
    void navigate(`/analysis/intelligent-score?symbol=${stock.symbol}`)
  }, [navigate])

  return (
    <PageContainer>
      {/* 1. Page Header with badge */}
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-primary"
            style={{ background: 'hsl(var(--primary) / 0.1)' }}
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

      {/* 2. Portfolio Overview Hero */}
      <PortfolioHero />

      {/* 3. Quick Stock Analysis */}
      <section
        className="mb-6 rounded-lg p-5 bg-card"
        style={{ boxShadow: 'var(--shadow-sm)' }}
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
      </section>

      {/* 4. System Status Overview */}
      <SystemStatusOverview />

      {/* 5. Feature Cabin Entry Cards (5-column grid) */}
      <section className="mt-6 grid gap-3" style={{ gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)' }}>
        {CABIN_FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <Link
              key={feature.title}
              to={feature.to}
              className="flex flex-col gap-2 rounded-lg p-5 transition-shadow hover:shadow-elevation-2 bg-card"
              style={{ boxShadow: 'var(--shadow-sm)' }}
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

      {/* 6. Latest Signals */}
      <SignalList />
    </PageContainer>
  )
}