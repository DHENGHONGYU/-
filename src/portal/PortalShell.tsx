import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Database,
  Upload,
  Flame,
  Wifi,
  Activity,
  BarChart3,
  TrendingUp,
  FileText,
  Settings,
  Target,
  Newspaper,
  BookOpen,
  Scale,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { PageSkeleton } from '@/components/PageSkeleton'
import { useWorkflowStore, type CabinType } from '@/store/workflowStore'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'

const InputApp = React.lazy(() => import('@/apps/input/InputApp'))
const AnalysisApp = React.lazy(() => import('@/apps/analysis/AnalysisApp'))
const TradingApp = React.lazy(() => import('@/apps/trading/TradingApp'))
const OutputApp = React.lazy(() => import('@/apps/output/OutputApp'))
const CommandApp = React.lazy(() => import('@/apps/command/CommandApp'))

const InputHubPage = React.lazy(() => import('@/pages/input/InputHubPage'))
const AnalysisHubPage = React.lazy(() => import('@/pages/analysis/AnalysisHubPage'))
const TradingHubPage = React.lazy(() => import('@/pages/trading/TradingHubPage'))
const CommandHubPage = React.lazy(() => import('@/pages/command/CommandHubPage'))

const CABIN_APPS: Record<CabinType, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  input: InputApp,
  analysis: AnalysisApp,
  trading: TradingApp,
  output: OutputApp,
  command: CommandApp,
}

const HUB_APPS: Record<CabinType, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  input: InputHubPage,
  analysis: AnalysisHubPage,
  trading: TradingHubPage,
  output: OutputApp,
  command: CommandHubPage,
}

const CABINS: { id: CabinType; label: string; emoji: string; path: string }[] = [
  { id: 'input', label: '输入舱', emoji: '📦', path: '/input' },
  { id: 'analysis', label: '分析舱', emoji: '🔬', path: '/analysis' },
  { id: 'trading', label: '交易舱', emoji: '💹', path: '/trading' },
  { id: 'output', label: '输出舱', emoji: '📊', path: '/output' },
  { id: 'command', label: '总控舱', emoji: '🎛️', path: '/command' },
]

interface PanelItem {
  key: string
  label: string
  path: string
  icon: LucideIcon
}

interface PanelGroup {
  group: string
  items: PanelItem[]
}

const PANEL_ITEMS: Record<CabinType, PanelGroup[]> = {
  input: [
    {
      group: '模块',
      items: [
        { key: 'input-hub', label: '输入舱首页', path: '/input/hub', icon: LayoutDashboard },
      ],
    },
    {
      group: '候选池',
      items: [
        { key: 'dashboard', label: '录入看板', path: '/input', icon: LayoutDashboard },
        { key: 'bulk-import', label: '批量导入', path: '/input/bulk-import', icon: Upload },
        { key: 'hot-sectors', label: '热门板块', path: '/input/hot-sectors', icon: Flame },
        { key: 'local-knowledge', label: '本地知识库', path: '/input/local-knowledge', icon: BookOpen },
      ],
    },
    {
      group: '数据采集',
      items: [{ key: 'data-test', label: '采集测试', path: '/input/data-test', icon: Wifi }],
    },
  ],
  analysis: [
    {
      group: '模块',
      items: [
        { key: 'analysis-hub', label: '分析舱首页', path: '/analysis/hub', icon: BarChart3 },
      ],
    },
    {
      group: '分析',
      items: [
        { key: 'industry-score', label: 'V4 行业评分', path: '/analysis/industry-score', icon: BarChart3 },
        { key: 'stock-score', label: 'V6 个股评分', path: '/analysis/stock-score', icon: Activity },
        { key: 'intelligent-score', label: 'V6 个股智能评分', path: '/analysis/intelligent-score', icon: Activity },
        { key: 'sector', label: '行业分析', path: '/analysis/sector', icon: Database },
        { key: 'backtest', label: '策略回测', path: '/analysis/backtest', icon: TrendingUp },
        { key: 'score-docs', label: '评分文档', path: '/analysis/score-docs', icon: FileText },
        { key: 'news', label: '智能资讯', path: '/analysis/news', icon: Newspaper },
      ],
    },
  ],
  trading: [
    {
      group: '模块',
      items: [
        { key: 'trading-hub', label: '交易舱首页', path: '/trading/hub', icon: TrendingUp },
      ],
    },
    {
      group: '交易',
      items: [
        { key: 'signals', label: '交易信号', path: '/trading', icon: Activity },
        { key: 'holdings', label: '模拟持仓', path: '/trading', icon: TrendingUp },
        { key: 'strategy-snapshots', label: '策略快照', path: '/trading/strategy-snapshots', icon: Scale },
      ],
    },
  ],
  output: [
    {
      group: '输出',
      items: [
        { key: 'reports', label: '研究报告', path: '/output', icon: FileText },
        { key: 'reviews', label: '交易复盘', path: '/output', icon: TrendingUp },
      ],
    },
  ],
  command: [
    {
      group: '模块',
      items: [
        { key: 'command-hub', label: '总控舱首页', path: '/command/hub', icon: Settings },
      ],
    },
    {
      group: '总控',
      items: [
        { key: 'monitor', label: '系统监控', path: '/command', icon: Activity },
        { key: 'settings', label: '配置管理', path: '/command', icon: Settings },
      ],
    },
  ],
}

function isActivePath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export default function PortalShell(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeCabin, setActiveCabin } = useWorkflowStore()
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [uptime, setUptime] = useState(0)

  useEffect(() => {
    const matched = CABINS.find(
      (c) => location.pathname === c.path || location.pathname.startsWith(`${c.path}/`),
    )
    if (matched) {
      setActiveCabin(matched.id)
    }
  }, [location.pathname, setActiveCabin])

  useEffect(() => {
    let mounted = true
    checkFetcherHealth().then((result) => {
      if (mounted) setFetcherOk(result.ok)
    })
    return () => {
      mounted = false
    }
  }, [activeCabin])

  useEffect(() => {
    const timer = setInterval(() => setUptime((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleCabinSwitch = (cabin: CabinType, path: string): void => {
    setActiveCabin(cabin)
    navigate(path)
  }

  const isHubView = location.pathname.endsWith('/hub')
  const ActiveApp = isHubView ? HUB_APPS[activeCabin] : CABIN_APPS[activeCabin]
  const activeGroups = PANEL_ITEMS[activeCabin]

  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="dark flex min-h-screen flex-col" data-testid="portal-shell">
      {/* TopBar */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-card px-5">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 text-sm font-bold text-white">
              V9
            </div>
            <span className="hidden text-base font-bold text-foreground sm:inline">
              智能投研复盘系统
            </span>
          </Link>
        </div>

        <nav className="ml-8 flex items-center gap-1">
          {CABINS.map((cabin) => (
            <Button
              key={cabin.id}
              variant={activeCabin === cabin.id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleCabinSwitch(cabin.id, cabin.path)}
            >
              <span className="mr-1.5">{cabin.emoji}</span>
              <span className="hidden sm:inline">{cabin.label}</span>
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => navigate('/cockpit')}>
            <Target className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">驾驶舱</span>
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                fetcherOk === null
                  ? 'bg-yellow-400'
                  : fetcherOk
                    ? 'bg-emerald-400'
                    : 'bg-red-400',
              )}
            />
            {fetcherOk === null ? '采集服务检查中' : fetcherOk ? '采集服务正常' : '采集服务未连接'}
          </span>
          <span className="hidden md:inline">运行 {formatUptime(uptime)}</span>
          <span className="hidden lg:inline">v0.9.0</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-64 flex-col border-r bg-card md:flex">
          <div className="flex-1 overflow-y-auto p-3">
            {activeGroups.map((group) => (
              <div key={group.group} className="mb-5">
                <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.group}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = isActivePath(location.pathname, item.path)
                    return (
                      <li key={item.key}>
                        <button
                          onClick={() => navigate(item.path)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                            active
                              ? 'bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto bg-background p-5">
          <React.Suspense fallback={<PageSkeleton />}>
            <ActiveApp />
          </React.Suspense>
        </main>
      </div>
    </div>
  )
}
