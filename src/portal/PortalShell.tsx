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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { twText, twBg, DARK, HOVER } from '@/constants/theme.tokens'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'
import { SignalSpectrum } from '@/components/cockpit/SignalSpectrum'
import { Sheet, SheetContent, SheetClose } from '@/components/atoms/Sheet'
import { useWorkflowStore, type CabinType } from '@/store/workflowStore'
import { checkFetcherHealth } from '@/services/fetcher/fetcherService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

const InputApp = React.lazy(() => import('@/apps/input/InputApp'))
const AnalysisApp = React.lazy(() => import('@/apps/analysis/AnalysisApp'))
const TradingApp = React.lazy(() => import('@/apps/trading/TradingApp'))
const OutputApp = React.lazy(() => import('@/apps/output/OutputApp'))
const CommandApp = React.lazy(() => import('@/apps/command/CommandApp'))
const AgentApp = React.lazy(() => import('@/apps/command/AgentApp'))

const MCPServerDashboardPage = React.lazy(() => import('@/pages/command/MCPServerDashboardPage'))

const CABIN_APPS: Record<CabinType, React.LazyExoticComponent<React.ComponentType<unknown>>> = {
  input: InputApp,
  analysis: AnalysisApp,
  trading: TradingApp,
  output: OutputApp,
  command: CommandApp,
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
      group: '意向候选池',
      items: [
        { key: 'dashboard', label: '录入看板', path: '/input', icon: LayoutDashboard },
        { key: 'pool-board', label: '股票池看板（已迁分析舱）', path: '/analysis/pool-board', icon: Database },
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
      ],
    },
  ],
  analysis: [
    {
      group: '股票池',
      items: [
        { key: 'pool-board', label: '股票池看板', path: '/analysis/pool-board', icon: Database },
      ],
    },
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
  ],
  trading: [
    {
      group: '交易',
      items: [
        { key: 'portfolio', label: '投资组合', path: '/trading/portfolio', icon: TrendingUp },
        { key: 'execution', label: '执行管理', path: '/trading/execution', icon: ListTodo },
        { key: 'risk', label: '风险控制', path: '/trading/risk', icon: Scale },
        { key: 'strategy-snapshots', label: '策略快照', path: '/trading/strategy-snapshots', icon: Camera },
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

// ── 宋韵状态色常量 ——
const STATUS_CHECKING = 'bg-amber-200/80 ring-1 ring-amber-300/40 animate-pulse'
const STATUS_CONNECTED = 'bg-emerald-300/80 ring-1 ring-emerald-400/40'
const STATUS_DISCONNECTED = 'bg-rose-300/80 ring-1 ring-rose-400/40'

// ── 宋韵主题色 ——
// 天青(Celadon): emerald-500 → emerald-400 / 青瓷: emerald-600
// 宣纸(RicePaper): stone-50 / 赭石(Ochre): amber-700
// 墨色(Ink): stone-800 / 月白(Moonlight): stone-100
const SONG_SHELL_BG    = 'bg-stone-50 dark:bg-neutral-900'
const SONG_HEADER_BG   = 'bg-stone-50/90 dark:bg-neutral-900/90'
const SONG_HEADER_BD   = 'border-stone-200/60 dark:border-neutral-800/60'
const SONG_SIDEBAR_BG  = 'bg-stone-100/70 dark:bg-neutral-900/60'
const SONG_SIDEBAR_BD  = 'border-stone-200/50 dark:border-neutral-800/50'
const SONG_CABIN_BG    = 'bg-stone-100 dark:bg-neutral-800'
const SONG_CABIN_ACTIVE = 'bg-white text-stone-800 dark:bg-neutral-700 dark:text-neutral-100'
const SONG_CABIN_INACTIVE = 'text-stone-500 hover:text-stone-700 dark:text-neutral-400'
const SONG_ACTIVE_NAV  = 'bg-white/90 text-stone-800 dark:bg-neutral-800/60 dark:text-neutral-100'
const SONG_INACTIVE_NAV = 'text-stone-600 hover:bg-white/60 hover:text-stone-800 dark:text-neutral-400 dark:hover:bg-neutral-800/40'
const SONG_NAV_ICON_ACTIVE = 'text-emerald-600 dark:text-emerald-400'
const SONG_NAV_ICON_INACTIVE = 'text-stone-400 dark:text-neutral-500'
const SONG_LOGO_GRADIENT = 'from-emerald-500 to-teal-600'
// ── P6 移动抽屉导航专用宋韵令牌（避免新增硬编码色类）──
const SONG_HAMBURGER = 'text-stone-600 hover:bg-stone-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800/40'
const SONG_DRAWER_HEADER_BD = 'border-stone-200/40 dark:border-neutral-800/40'
const SONG_SIDEBAR_TITLE = 'text-stone-700 dark:text-neutral-200'
const SONG_GROUP_LABEL = 'text-stone-400 dark:text-neutral-500'
// ── 高级灰暗色主内容区（P0 调整：暗色主色统一为中性灰 hue 0）──
const SONG_MAIN_BG = 'bg-white dark:bg-neutral-900'

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
  const [fetcherOk, setFetcherOk] = useState<boolean | null>(null)
  const [uptime, setUptime] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // P2 签名视觉锚点：将采集健康度映射为「系统信号强度」(0-100)，驱动 SignalSpectrum 母题
  const systemSignal = fetcherOk === null ? 48 : fetcherOk ? 92 : 12
  const systemSignalLabel = fetcherOk === null ? '信号检查中' : fetcherOk ? '信号强' : '信号弱'

  // 同步派生当前舱室
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
    logger.info('[PortalShell] 切换舱室', { from: activeCabin, to: cabin, path })
    setActiveCabin(cabin)
    navigate(path)
  }

  // P1-FIX: Hub 页面重定向逻辑 —— 当访问 /xxx/hub 时自动重定向到 /xxx
  // 注意：总控舱 /command/hub 不重定向（因其 Hub 页面有独立内容）
  useEffect(() => {
    if (location.pathname.endsWith('/hub') && activeCabin !== 'command') {
      const targetPath = `/${activeCabin}`
      logger.info('[PortalShell] Hub页面重定向', {
        from: location.pathname,
        to: targetPath,
        cabin: activeCabin,
        reason: '非总控舱的 /hub 路径自动重定向到舱室首页',
      })
      navigate(targetPath, { replace: true })
    }
  }, [location.pathname, activeCabin, navigate])

  const isAgentPath = location.pathname.startsWith('/command/agents')
  const isMCPPath = location.pathname.startsWith('/command/mcp-servers')
  const ActiveApp =
    activeCabin === 'command' && isAgentPath
      ? AgentApp
      : activeCabin === 'command' && isMCPPath
        ? MCPServerDashboardPage
        : CABIN_APPS[activeCabin]

  // P1-FIX: 记录 ActiveApp 分发决策，用于排查路由分发异常
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

  // ── 宋韵采集状态指示 ──
  const fetcherStatusDot = cn(
    'h-2 w-2 rounded-full',
    fetcherOk === null ? STATUS_CHECKING : fetcherOk ? STATUS_CONNECTED : STATUS_DISCONNECTED,
  )

  // ── 侧栏导航（桌面侧栏与移动抽屉共用同一渲染）──
  const renderSidebarNav = (onNavigate?: () => void): React.ReactNode => (
    <>
      <div className={cn('flex items-center gap-2 border-b px-4 py-3', SONG_DRAWER_HEADER_BD)}>
        <span className="text-lg">{CABINS.find((c) => c.id === activeCabin)?.emoji}</span>
        <span className={cn('text-sm font-semibold', SONG_SIDEBAR_TITLE)}>
          {CABINS.find((c) => c.id === activeCabin)?.label}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {activeGroups.map((group) => (
          <div key={group.group} className="mb-1">
            <div className={cn('px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider', SONG_GROUP_LABEL)}>
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
                        navigate(item.path)
                        onNavigate?.()
                      }}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-200',
                        active
                          ? cn(
                              'relative font-medium',
                              SONG_ACTIVE_NAV,
                              'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-emerald-500 dark:before:bg-emerald-400',
                              'shadow-sm shadow-stone-200/30 dark:shadow-neutral-900/30',
                            )
                          : SONG_INACTIVE_NAV,
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? SONG_NAV_ICON_ACTIVE : SONG_NAV_ICON_INACTIVE)} />
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
    <div className={cn('flex min-h-screen flex-col', SONG_SHELL_BG)} data-testid="portal-shell">
      {/* ── 顶栏 — 宣纸色玻璃态 ── */}
      <header className={cn('sticky top-0 z-20 flex h-14 items-center gap-4 border-b px-4 backdrop-blur-md', SONG_HEADER_BG, SONG_HEADER_BD)}>
        {/* 移动端汉堡按钮 —— md 以下侧栏隐藏，以此抽屉兜底导航 */}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors md:hidden', SONG_HAMBURGER)}
          aria-label="打开导航菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br text-xs font-bold text-white shadow-sm shadow-emerald-500/20', SONG_LOGO_GRADIENT)}>
            V9
          </div>
          <span className={cn('hidden text-sm font-semibold tracking-tight sm:inline', twText('stone', 800), DARK.textNeutral100)}>
            智能投研复盘系统
          </span>
        </Link>

        {/* 舱室切换 — 宋韵赭石底胶囊 */}
        <nav className={cn('flex items-center gap-1 rounded-lg p-0.5', SONG_CABIN_BG)}>
          {CABINS.map((cabin) => {
            const active = activeCabin === cabin.id
            return (
              <button
                key={cabin.id}
                onClick={() => handleCabinSwitch(cabin.id, cabin.path)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200',
                  active ? SONG_CABIN_ACTIVE + ' shadow-sm' : SONG_CABIN_INACTIVE,
                )}
              >
                <span className="mr-1 text-[11px]">{cabin.emoji}</span>
                <span className="hidden sm:inline">{cabin.label}</span>
              </button>
            )
          })}
          <button
            onClick={() => navigate('/cockpit')}
            className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200', twText('stone', 500), HOVER.textStone700, DARK.textNeutral400, DARK.hoverTextNeutral200)}
          >
            <Target className="mr-1 inline h-3.5 w-3.5" />
            <span className="hidden sm:inline">驾驶舱</span>
          </button>
        </nav>

        {/* 右侧状态区 */}
        <div className={cn('ml-auto flex items-center gap-3 text-xs', twText('stone', 500), DARK.textNeutral400)}>
          <span className="flex items-center gap-1.5">
            <span className={fetcherStatusDot} />
            <span className="hidden sm:inline">
              {fetcherOk === null ? '检查中' : fetcherOk ? '采集正常' : '采集断连'}
            </span>
          </span>
          <span className={cn('hidden h-3.5 w-px md:block', twBg('stone', 200), DARK.bgNeutral700)} />
          {/* P2 签名母题：全站统一「信号强度谱」锚点，由采集健康度驱动 */}
          <span className="hidden lg:flex items-center gap-2 w-40">
            <SignalSpectrum size="sm" value={systemSignal} label={systemSignalLabel} showValue={false} />
          </span>
          <span className={cn('hidden h-3.5 w-px md:block', twBg('stone', 200), DARK.bgNeutral700)} />
          <span className="hidden md:inline font-mono">{formatUptime(uptime)}</span>
          <span className={cn('hidden h-3.5 w-px lg:block', twBg('stone', 200), DARK.bgNeutral700)} />
          <span className="hidden lg:inline font-mono">v1.2.0</span>
        </div>
      </header>

      {/* ── 主体 — 侧栏 + 内容区 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 — 柔和底色，无硬边框（md 及以上显示）*/}
        <aside className={cn('hidden w-60 shrink-0 flex-col border-r md:flex', SONG_SIDEBAR_BG, SONG_SIDEBAR_BD)}>
          {renderSidebarNav()}
        </aside>

        {/* 主内容 — 高级灰暗色画布（亮色仍为宣纸白底） */}
        <main className={cn('min-w-0 flex-1 overflow-auto', SONG_MAIN_BG)}>
          <div className="mx-auto max-w-[1400px] p-4 sm:p-5 lg:p-6">
            <React.Suspense fallback={<PageSkeleton />}>
              <ActiveApp />
            </React.Suspense>
          </div>
        </main>
      </div>

      {/* ── 移动端抽屉导航（md 以下侧栏隐藏后的导航兜底）── */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} side="left" className="p-0">
        <SheetContent className="flex h-full flex-col gap-0 p-0">
          <div className={cn('flex h-full flex-col', SONG_SIDEBAR_BG, SONG_SIDEBAR_BD)}>
            <div className={cn('flex items-center justify-between border-b px-4 py-3', SONG_DRAWER_HEADER_BD)}>
              <span className={cn('text-sm font-semibold', SONG_SIDEBAR_TITLE)}>导航</span>
              <SheetClose />
            </div>
            <div className="flex-1 overflow-y-auto py-2">{renderSidebarNav(() => setMobileNavOpen(false))}</div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
