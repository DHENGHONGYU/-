import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Menu, Target, Sun, Moon, Monitor, type LucideIcon } from 'lucide-react'
import { CABINS, PANEL_ITEMS } from '@/config/sidebarConfig'
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

const THEME_ICONS: Record<ThemeMode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

/** 判断路径是否为活跃状态 */
function isActivePath(pathname: string, path: string): boolean {
  if (pathname === path) return true
  // 父级 hub 路径不通过前缀匹配子路径，避免父子双高亮
  if (path === '/command' || path === '/command/agents') return false
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
      <div className="flex-1 overflow-y-auto py-3">
        {activeGroups.map((group) => (
          <div key={group.group} className="mb-2">
            <div className={cn('px-4 py-1.5 text-[11px] font-medium tracking-wider', nav.groupLabel)}>
              {group.group}
            </div>
            <ul className="space-y-0.5 px-2">
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
                        'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-out',
                        active
                          ? cn(
                              'relative font-medium',
                              nav.active,
                              'before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full',
                              nav.activeIndicator,
                            )
                          : nav.inactive,
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0 transition-colors duration-200', active ? nav.iconActive : nav.iconInactive)} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <div className="h-6" />
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

        <nav className={cn('flex items-center gap-0.5 rounded-xl p-1', cabin.containerBg)}>
          {CABINS.map((c) => {
            const active = activeCabin === c.id
            return (
              <button
                key={c.id}
                onClick={() => handleCabinSwitch(c.id, c.path)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300 ease-out',
                  active ? cabin.active : cabin.inactive,
                )}
              >
                <span className="mr-1 text-[11px]">{c.emoji}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            )
          })}
          <span className={cn('mx-1 h-4 w-px', layout.headerBorder)} />
          <button
            onClick={() => navigate('/cockpit')}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300', cabin.cockpit)}
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
          className={cn('hidden w-64 shrink-0 flex-col border-r md:flex', layout.sidebarBg, layout.sidebarBorder)}
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
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-all duration-300',
                active ? mobile.bottomNavActive : mobile.bottomNavInactive,
              )}
              aria-label={c.label}
            >
              <Icon className={cn('h-5 w-5 transition-transform duration-300', active && 'scale-110')} />
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
