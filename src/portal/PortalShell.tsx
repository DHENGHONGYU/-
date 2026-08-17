import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Menu, Target, Sun, Moon, Monitor, Search, type LucideIcon } from 'lucide-react'
import { CABINS, PANEL_ITEMS } from '@/config/sidebarConfig'
import { cn } from '@/lib/utils'
import { PORTAL_TOKENS } from '@/constants/theme.tokens'
import { useThemeStore, type ThemeMode } from '@/store/themeStore'
import { PageSkeleton } from '@/components/organisms/shared/PageSkeleton'
import { SignalSpectrum } from '@/components/cockpit/SignalSpectrum'
import { Sheet, SheetContent, SheetClose } from '@/components/atoms/Sheet'
import { AutoBreadcrumb } from '@/components/atoms/Breadcrumb'
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

  /** V10: 侧边栏搜索过滤 */
  const [sidebarSearch, setSidebarSearch] = useState('')
  /** V11: 搜索框 ref（用于 Ctrl+K 快捷键聚焦） */
  const sidebarSearchRef = useRef<HTMLInputElement>(null)

  /** V11: Ctrl+K / Cmd+K 快捷键唤起侧边栏搜索 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        sidebarSearchRef.current?.focus()
        sidebarSearchRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const filteredGroups = useMemo(() => {
    if (!sidebarSearch.trim()) return activeGroups
    const q = sidebarSearch.toLowerCase()
    return activeGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.path.toLowerCase().includes(q) ||
            group.group.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [activeGroups, sidebarSearch])

  const fetcherStatusDot = cn(
    'h-2 w-2 rounded-full',
    fetcherOk === null ? status.checking : fetcherOk ? status.connected : status.disconnected,
  )

  const ThemeIcon = THEME_ICONS[mode]

  const renderSidebarNav = (onNavigate?: () => void): React.ReactNode => {
    const activeCabinDef = CABINS.find((c) => c.id === activeCabin)
    const HeaderIcon = activeCabinDef?.icon
    return (
    <>
      <div className={cn('flex items-center gap-2 border-b px-4 py-3', nav.drawerHeaderBorder)}>
        {HeaderIcon ? <HeaderIcon className="h-5 w-5 shrink-0 text-primary" /> : null}
        <span className={cn('text-sm font-semibold', nav.sidebarTitle)}>
          {activeCabinDef?.label}
        </span>
      </div>

      {/* V10: 侧边栏搜索 */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            ref={sidebarSearchRef}
            placeholder="搜索页面… (Ctrl+K)"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {sidebarSearch && (
            <button
              type="button"
              onClick={() => setSidebarSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {filteredGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            未找到匹配的页面
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.group} className="mb-2">
              <div className={cn('px-4 py-1.5 text-[11px] font-medium tracking-wider', nav.groupLabel)}>
                {group.group}
              </div>
              <ul className="space-y-0.5 px-2" role="navigation" aria-label={`${activeCabinDef?.label} 导航`}>
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
                        aria-current={active ? 'page' : undefined}
                        aria-label={item.label}
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
          ))
        )}
        <div className="h-6" />
      </div>
    </>
    )
  }

  return (
    <div className={cn('flex min-h-screen flex-col', layout.shellBg)} data-testid="portal-shell">
      {/* V12: Skip-to-content — 键盘用户跳过导航直达主内容 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-lg focus:outline-none"
      >
        跳到主内容
      </a>
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
            const Icon = c.icon
            const active = activeCabin === c.id
            return (
              <button
                key={c.id}
                onClick={() => handleCabinSwitch(c.id, c.path)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300 ease-out',
                  active ? cabin.active : cabin.inactive,
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 transition-colors duration-200" />
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            )
          })}
          <span className={cn('mx-1 h-4 w-px', layout.headerBorder)} />
          <button
            onClick={() => void navigate('/cockpit')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300',
              cabin.cockpit,
            )}
          >
            <Target className="h-3.5 w-3.5 shrink-0 transition-colors duration-200" />
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

          <span className="hidden h-3.5 w-px bg-border lg:block" />

          <span className="hidden w-40 items-center gap-2 lg:flex">
            <SignalSpectrum size="sm" value={systemSignal} label={systemSignalLabel} showValue={false} />
          </span>
        </div>
      </header>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn('hidden w-60 shrink-0 flex-col border-r md:flex', layout.sidebarBg, layout.sidebarBorder)}
        >
          {renderSidebarNav()}
        </aside>

        <main id="main-content" className={cn('min-w-0 flex-1 overflow-auto', layout.mainBg)}>
          {/* V12: aria-live 区域 — 屏幕阅读器动态内容通知 */}
          <div aria-live="polite" aria-atomic="true" className="sr-only" role="status" />
          <div className={cn('mx-auto flex min-h-full flex-col', layout.mainMaxWidth, layout.mainPadding)}>
            {/* V10: 自动面包屑导航 */}
            <AutoBreadcrumb className="px-0 py-2 border-b border-border/30" />
            <div className="my-auto">
              <React.Suspense fallback={<PageSkeleton />}>
                <ActiveApp />
              </React.Suspense>
            </div>
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
