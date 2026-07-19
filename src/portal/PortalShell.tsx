import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Menu,
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
  Bot,
  Camera,
  Zap,
  List,
  ListTodo,
  Sparkles,
  GitBranch,
  GitCompare,
  Workflow,
  MessageSquare,
  Server,
  Tags,
  Code,
  CheckCircle,
  Lightbulb,
  History,
  HeartPulse,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  SlidersHorizontal,
  Gem,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PORTAL_TOKENS } from '@/constants/theme.tokens'
import { useThemeStore, type ThemeMode } from '@/store/themeStore'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'
import { SignalSpectrum } from '@/components/cockpit/SignalSpectrum'
import { Sheet, SheetContent, SheetClose } from '@/components/atoms/Sheet'
import { useWorkflowStore, type CabinType } from '@/store/workflowStore'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import { getLogger } from '@/lib/logger'
import { getActiveApp, preloadCabinApps } from '@/apps/cabinDispatcher'

const logger = getLogger()

const { layout, cabin, nav, mobile, status, brand } = PORTAL_TOKENS

const CABINS: { id: CabinType; label: string; emoji: string; path: string; icon: LucideIcon }[] = [
  { id: 'input', label: '输入舱', emoji: '📦', path: '/input', icon: Upload },
  { id: 'analysis', label: '分析舱', emoji: '🔬', path: '/analysis', icon: BarChart3 },
  { id: 'trading', label: '交易舱', emoji: '💹', path: '/trading', icon: TrendingUp },
  { id: 'output', label: '输出舱', emoji: '📊', path: '/output', icon: FileText },
  { id: 'command', label: '总控舱', emoji: '🎛️', path: '/command', icon: Settings },
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
      group: '意向候选池',
      items: [
        { key: 'dashboard', label: '录入看板', path: '/input', icon: LayoutDashboard },
        { key: 'pool-board', label: '股票池看板', path: '/input/pool-board', icon: Database },
        { key: 'bulk-import', label: '批量导入', path: '/input/bulk-import', icon: Upload },
        { key: 'hot-sectors', label: '热门板块', path: '/input/hot-sectors', icon: Flame },
        { key: 'local-knowledge', label: '本地知识库', path: '/input/local-knowledge', icon: BookOpen },
      ],
    },
    {
      group: '数据采集',
      items: [
        { key: 'data-test', label: '采集测试', path: '/input/data-test', icon: Wifi },
        { key: 'collect-tasks', label: '采集任务监控', path: '/input/collect-tasks', icon: Activity },
        { key: 'seven-dim', label: '七维采集配置', path: '/input/seven-dim', icon: SlidersHorizontal },
        { key: 'fetcher-config', label: '抓取引擎配置', path: '/input/fetcher-config', icon: Settings },
      ],
    },
  ],
  analysis: [
    {
      group: '评分与筛选',
      items: [
        { key: 'industry-score', label: 'V4 行业评分', path: '/analysis/industry-score', icon: BarChart3 },
        { key: 'stock-score', label: 'V6 个股评分', path: '/analysis/stock-score', icon: Activity },
        { key: 'intelligent-score', label: 'V6 智能评分', path: '/analysis/intelligent-score', icon: Activity },
        { key: 'sector', label: '行业分析', path: '/analysis/sector', icon: Database },
        { key: 'backtest', label: '策略回测', path: '/analysis/backtest', icon: TrendingUp },
        { key: 'score-docs', label: '评分文档', path: '/analysis/score-docs', icon: FileText },
        { key: 'score-comparison', label: '评分比对看板', path: '/analysis/score-comparison', icon: GitCompare },
        { key: 'news', label: '智能资讯', path: '/analysis/news', icon: Newspaper },
      ],
    },
    {
      group: '策略选股',
      items: [
        { key: 'hot-sector', label: '热门板块', path: '/analysis/hot-sector', icon: Flame },
        { key: 'value-pit', label: '价值洼地', path: '/analysis/value-pit', icon: Gem },
        { key: 'multi-factor', label: '多因子筛选', path: '/analysis/multi-factor', icon: SlidersHorizontal },
      ],
    },
  ],
  trading: [
    {
      group: '交易',
      items: [
        { key: 'portfolio', label: '投资组合', path: '/trading/portfolio', icon: TrendingUp },
        { key: 'holdings', label: '持仓管理', path: '/trading/holdings', icon: Wallet },
        { key: 'execution', label: '执行管理', path: '/trading/execution', icon: ListTodo },
        { key: 'execution-plans', label: '执行计划', path: '/trading/execution-plans', icon: List },
        { key: 'risk', label: '风险控制', path: '/trading/risk', icon: Scale },
        { key: 'strategy-snapshots', label: '策略快照', path: '/trading/strategy-snapshots', icon: Camera },
        { key: 'flow', label: '交易流程', path: '/trading/flow', icon: Workflow },
      ],
    },
  ],
  output: [
    {
      group: '输出',
      items: [
        { key: 'reports', label: '研报复盘', path: '/output/research', icon: FileText },
        { key: 'dashboard', label: '仪表盘', path: '/output/dashboard', icon: LayoutDashboard },
        { key: 'export', label: '数据导出', path: '/output/export', icon: Database },
        { key: 'review', label: '交易复盘', path: '/output/review', icon: BarChart3 },
        { key: 'wizard', label: '复盘向导', path: '/output/wizard', icon: Sparkles },
        { key: 'prediction', label: '预测校验', path: '/output/prediction', icon: TrendingUp },
        { key: 'retrospective', label: '周期复盘', path: '/output/retrospective', icon: RefreshCw },
        { key: 'factor', label: '因子画板', path: '/output/factor-dashboard', icon: TrendingUp },
      ],
    },
  ],
  command: [
    {
      group: '系统',
      items: [
        { key: 'command-hub', label: '总控台', path: '/command', icon: LayoutDashboard },
        { key: 'showcase', label: '组件示例库', path: '/command/showcase', icon: BookOpen },
        { key: 'health', label: '架构健康度', path: '/command/health', icon: HeartPulse },
        { key: 'monitor', label: '系统监控', path: '/command/monitor', icon: Activity },
        { key: 'settings', label: '配置管理', path: '/command/config', icon: Settings },
        { key: 'stress-test', label: '压力测试', path: '/command/test', icon: Zap },
      ],
    },
    {
      group: '智能体',
      items: [
        { key: 'agent-hub', label: '智能体总控台', path: '/command/agents', icon: Bot },
        { key: 'agent-registry', label: '智能体注册表', path: '/command/agents/registry', icon: Bot },
        { key: 'agent-trigger', label: '任务触发', path: '/command/agents/trigger', icon: Zap },
        { key: 'agent-tasks', label: '任务列表', path: '/command/agents/tasks', icon: List },
        { key: 'agent-custom', label: '自定义智能体', path: '/command/agents/custom', icon: Bot },
        { key: 'agent-llm', label: 'LLM 管理', path: '/command/agents/llm', icon: Sparkles },
        { key: 'agent-capability-graph', label: '能力图谱', path: '/command/agents/capability-graph', icon: GitBranch },
        { key: 'agent-dag-scheduler', label: 'DAG 调度器', path: '/command/agents/dag-scheduler', icon: Workflow },
        { key: 'agent-feedback', label: '反馈控制台', path: '/command/agents/feedback', icon: MessageSquare },
        { key: 'agent-model-upgrade', label: '模型升级', path: '/command/agents/model-upgrade', icon: TrendingUp },
        { key: 'agent-data-labels', label: '数据标签', path: '/command/agents/data-labels', icon: Tags },
        { key: 'agent-api-config', label: 'API 配置', path: '/command/agents/api-config', icon: Code },
        { key: 'agent-skill-audit', label: 'Skill 核查', path: '/command/agents/skill-audit', icon: CheckCircle },
        { key: 'agent-optimization', label: '优化建议', path: '/command/agents/optimization', icon: Lightbulb },
        { key: 'agent-changelog', label: '更新日志', path: '/command/agents/changelog', icon: History },
      ],
    },
    {
      group: 'MCP 服务',
      items: [
        { key: 'mcp-servers', label: 'MCP Server 管理', path: '/command/mcp-servers', icon: Server },
      ],
    },
  ],
}

const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

/** 判断路径是否为活跃状态 */
function isActivePath(pathname: string, path: string): boolean {
  if (pathname === path) return true
  if (path === '/command') return false
  return pathname.startsWith(`${path}/`)
}

export default function PortalShell(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const { setActiveCabin } = useWorkflowStore()
  const { mode, cycleMode } = useThemeStore()
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [uptime, setUptime] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const systemSignal = fetcherOk === null ? 48 : fetcherOk ? 92 : 12
  const systemSignalLabel = fetcherOk === null ? '信号检查中' : fetcherOk ? '信号强' : '信号弱'

  const activeCabin = useMemo((): CabinType => {
    const matched = CABINS.find(
      (c) => location.pathname === c.path || location.pathname.startsWith(`${c.path}/`),
    )
    return matched?.id ?? 'input'
  }, [location.pathname])

  useEffect(() => {
    setActiveCabin(activeCabin)
  }, [activeCabin, setActiveCabin])

  useEffect(() => {
    const matched = CABINS.find(
      (c) => location.pathname === c.path || location.pathname.startsWith(`${c.path}/`),
    )
    if (matched) {
      logger.info('[PortalShell] 路径匹配', { pathname: location.pathname, cabin: matched.id })
    } else {
      logger.warn('[PortalShell] 路径未匹配', { pathname: location.pathname })
    }
  }, [location.pathname])

  useEffect(() => {
    let mounted = true
    setFetcherOk(null)
    checkFetcherHealth()
      .then((result) => {
        if (mounted) setFetcherOk(result.ok)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [activeCabin])

  useEffect(() => {
    const timer = setInterval(() => setUptime((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    preloadCabinApps(activeCabin)
  }, [activeCabin])

  const handleCabinSwitch = (cabin: CabinType, path: string): void => {
    logger.info('[PortalShell] 切换舱室', { from: activeCabin, to: cabin, path })
    setActiveCabin(cabin)
    void navigate(path)
  }

  useEffect(() => {
    if (location.pathname.endsWith('/hub') && activeCabin !== 'command') {
      const targetPath = `/${activeCabin}`
      logger.info('[PortalShell] Hub页面重定向', {
        from: location.pathname,
        to: targetPath,
        cabin: activeCabin,
        reason: '非总控舱的 /hub 路径自动重定向到舱室首页',
      })
      void navigate(targetPath, { replace: true })
    }
  }, [location.pathname, activeCabin, navigate])

  const isAgentPath = location.pathname.startsWith('/command/agents')
  const isMCPPath = location.pathname.startsWith('/command/mcp-servers')
  const ActiveApp = useMemo(
    () => getActiveApp(activeCabin, isAgentPath, isMCPPath),
    [activeCabin, isAgentPath, isMCPPath],
  )

  useEffect(() => {
    const appName =
      activeCabin === 'command' && isAgentPath
        ? 'AgentApp'
        : activeCabin === 'command' && isMCPPath
          ? 'MCPServerDashboardPage'
          : `${activeCabin}App`
    logger.info('[PortalShell] ActiveApp分发', {
      pathname: location.pathname,
      cabin: activeCabin,
      isAgentPath,
      isMCPPath,
      app: appName,
    })
  }, [location.pathname, activeCabin, isAgentPath, isMCPPath])

  const activeGroups = PANEL_ITEMS[activeCabin]

  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const fetcherStatusDot = cn(
    'h-2 w-2 rounded-full',
    fetcherOk === null ? status.checking : fetcherOk ? status.connected : status.disconnected,
  )

  const ThemeIcon = THEME_ICONS[mode]

  const renderSidebarNav = (onNavigate?: () => void): React.ReactNode => (
    <>
      <div className={cn('flex items-center gap-2 border-b px-4 py-3', nav.drawerHeaderBorder)}>
        <span className="text-lg">{CABINS.find((c) => c.id === activeCabin)?.emoji}</span>
        <span className={cn('text-sm font-semibold', nav.sidebarTitle)}>
          {CABINS.find((c) => c.id === activeCabin)?.label}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {activeGroups.map((group) => (
          <div key={group.group} className="mb-1">
            <div className={cn('px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider', nav.groupLabel)}>
              {group.group}
            </div>
            <ul className="space-y-px px-2">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActivePath(location.pathname, item.path)
                return (
                  <li key={item.key}>
                    <button
                      onClick={() => {
                        logger.info('[PortalShell] 侧边栏导航', {
                          cabin: activeCabin,
                          item: item.key,
                          label: item.label,
                          path: item.path,
                          currentPath: location.pathname,
                        })
                        void navigate(item.path)
                        onNavigate?.()
                      }}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200',
                        active
                          ? cn(
                              'relative font-medium',
                              nav.active,
                              'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full',
                              nav.activeIndicator,
                            )
                          : nav.inactive,
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? nav.iconActive : nav.iconInactive)} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <div className="h-8" />
      </div>
    </>
  )

  return (
    <div className={cn('flex min-h-screen flex-col', layout.shellBg)} data-testid="portal-shell">
      {/* 顶栏 */}
      <header
        className={cn(
          'sticky top-0 z-20 flex h-14 items-center gap-4 border-b px-4',
          layout.headerBg,
          layout.headerBorder,
        )}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors md:hidden', mobile.hamburger)}
          aria-label="打开导航菜单"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br text-xs font-bold shadow-sm',
              brand.logoGradient,
              brand.logoText,
              brand.logoShadow,
            )}
          >
            V9
          </div>
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
            智能投研复盘系统
          </span>
        </Link>

        <nav className={cn('flex items-center gap-1 rounded-lg p-0.5', cabin.containerBg)}>
          {CABINS.map((c) => {
            const active = activeCabin === c.id
            return (
              <button
                key={c.id}
                onClick={() => handleCabinSwitch(c.id, c.path)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200',
                  active ? cabin.active : cabin.inactive,
                )}
              >
                <span className="mr-1 text-[11px]">{c.emoji}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            )
          })}
          <button
            onClick={() => navigate('/cockpit')}
            className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200', cabin.cockpit)}
          >
            <Target className="mr-1 inline h-3.5 w-3.5" />
            <span className="hidden sm:inline">驾驶舱</span>
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={cycleMode}
            className={cn('flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-muted')}
            aria-label={`当前主题模式: ${mode === 'light' ? '亮色' : mode === 'dark' ? '暗色' : '跟随系统'}，点击切换`}
            data-testid="theme-toggle"
          >
            <ThemeIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline capitalize">{mode}</span>
          </button>

          <span className="hidden h-3.5 w-px bg-border md:block" />

          <span className="flex items-center gap-1.5">
            <span className={fetcherStatusDot} />
            <span className="hidden sm:inline">
              {fetcherOk === null ? '检查中' : fetcherOk ? '采集正常' : '采集断连'}
            </span>
          </span>

          <span className="hidden h-3.5 w-px bg-border md:block" />

          <span className="hidden w-40 items-center gap-2 lg:flex">
            <SignalSpectrum size="sm" value={systemSignal} label={systemSignalLabel} showValue={false} />
          </span>

          <span className="hidden h-3.5 w-px bg-border lg:block" />
          <span className="hidden font-mono md:inline">{formatUptime(uptime)}</span>
          <span className="hidden h-3.5 w-px bg-border lg:block" />
          <span className="hidden font-mono lg:inline">v1.2.0</span>
        </div>
      </header>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn('hidden w-60 shrink-0 flex-col border-r md:flex', layout.sidebarBg, layout.sidebarBorder)}
        >
          {renderSidebarNav()}
        </aside>

        <main className={cn('min-w-0 flex-1 overflow-auto', layout.mainBg)}>
          <div className={cn('mx-auto', layout.mainMaxWidth, layout.mainPadding)}>
            <React.Suspense fallback={<PageSkeleton />}>
              <ActiveApp />
            </React.Suspense>
          </div>
        </main>
      </div>

      {/* 移动端底部导航 */}
      <nav className={cn('fixed bottom-0 left-0 right-0 z-20 flex md:hidden', mobile.bottomNavBg)}>
        {CABINS.map((c) => {
          const Icon = c.icon
          const active = activeCabin === c.id
          return (
            <button
              key={c.id}
              onClick={() => handleCabinSwitch(c.id, c.path)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? mobile.bottomNavActive : mobile.bottomNavInactive,
              )}
              aria-label={c.label}
            >
              <Icon className="h-5 w-5" />
              <span>{c.label.slice(0, 2)}</span>
            </button>
          )
        })}
      </nav>

      {/* 移动端抽屉导航 */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} side="left" className="p-0">
        <SheetContent className="flex h-full flex-col gap-0 p-0">
          <div className={cn('flex h-full flex-col', layout.sidebarBg, layout.sidebarBorder)}>
            <div className={cn('flex items-center justify-between border-b px-4 py-3', nav.drawerHeaderBorder)}>
              <span className={cn('text-sm font-semibold', nav.sidebarTitle)}>导航</span>
              <SheetClose />
            </div>
            <div className="flex-1 overflow-y-auto py-2">{renderSidebarNav(() => setMobileNavOpen(false))}</div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
