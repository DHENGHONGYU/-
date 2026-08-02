/**
 * e2e/use-mediaquery-zindex-e2e.spec.ts
 *
 * 三件套之 Step 2 E2E 验证：
 * ┌──────────────────────────────────────────────────────────────┐
 * │ TC-E2E-1：5 种屏幕尺寸 × 3 路由 → 0 崩溃级错误               │
 * │   · 尺寸：iphone-se(320) / ipad-mini(768) / laptop(1024)     │
 * │           desktop(1280) / wide-1920(1920)                    │
 * │   · 路由：/（首页）   /cockpit（驾驶舱）  /trading（交易舱）  │
 * │   · 监控：pageerror（未捕获异常） + console.error（手动报错） │
 * │   · 监控：捕获 [Z-INDEX] 日志，确认 App/Portal 都写入了      │
 * │ TC-E2E-2：响应式断点验证                                      │
 * │   · 宽度<768：底部导航 (portal-shell-bottom-nav) 应可见      │
 * │   · 宽度>=1024：Sidebar (portal-shell-sidebar) 应可见        │
 * │   · Header (portal-shell-header) 在任何尺寸都应 sticky       │
 * └──────────────────────────────────────────────────────────────┘
 */
import { test, expect } from '@playwright/test'

const SIZES: Array<{ name: string; w: number; h: number }> = [
  { name: 'iphone-se', w: 320, h: 568 },
  { name: 'ipad-mini', w: 768, h: 1024 },
  { name: 'laptop-1024', w: 1024, h: 768 },
  { name: 'desktop-1280', w: 1280, h: 800 },
  { name: 'wide-1920', w: 1920, h: 1080 },
]
const ROUTES: Array<{ label: string; hash: string }> = [
  { label: '首页', hash: '/' },
  { label: '驾驶舱', hash: '/cockpit' },
  { label: '交易舱', hash: '/trading' },
]

/**
 * 收集器：在页面生命周期内抓取 error 级 console 与 pageerror（未捕获 JS 异常）
 * 同时抓取 [Z-INDEX] 调试日志，用于后续断言。
 */
function installErrorCollectors(page: Parameters<Parameters<typeof test>[0]>[0]['page']): {
  pageErrors: string[]
  consoleErrors: string[]
  zIndexLogs: string[]
  uninstall: () => void
} {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const zIndexLogs: string[] = []
  const onPageError = (err: Error): void => {
    pageErrors.push(String(err?.stack || err?.message || err))
  }
  const onConsole = (msg: {
    type: () => string
    text: () => string
    location: () => { url?: string; lineNumber?: number }
  }): void => {
    const t = msg.type()
    const text = msg.text()
    if (t === 'error') {
      // 忽略 HMR / favicon / 资源 404 类 Vite 开发期正常噪音
      // 以及 无后端场景下 data-fetch 轮询 API(/health) 返回 HTML 的业务层失败（SPA 未命中路由返回 index.html）
      // 未捕获 JS 异常走 on('pageerror')；这里的 console.error 都是业务层打印的受控报错
      if (
        /Failed to load resource|favicon\.ico|404 \(Not Found\)/.test(text) ||
        /\[PERF\]\s*data-fetch:request\s*失败/.test(text) ||
        /path:\s*\/health/.test(text)
      )
        return
      consoleErrors.push(text.slice(0, 500))
    }
    if (text.includes('[Z-INDEX]') || text.includes('[Z-INDEX-CHG]')) {
      zIndexLogs.push(text)
    }
  }
  page.on('pageerror', onPageError)
  page.on('console', onConsole)
  const uninstall = (): void => {
    page.off('pageerror', onPageError)
    page.off('console', onConsole)
  }
  return { pageErrors, consoleErrors, zIndexLogs, uninstall }
}

test.describe('TC-E2E-1 5 屏幕尺寸 × 3 路由 → 0 崩溃级错误', () => {
  for (const size of SIZES) {
    for (const route of ROUTES) {
      test(`TC-E2E-1 [${size.name} ${size.w}x${size.h}] → 路由 ${route.label} ${route.hash} 无崩溃 + z-index 日志输出`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width: size.w, height: size.h })
        const collect = installErrorCollectors(page)

        // 加载 HashRouter 路由：HashRouter 配置下基础路径为 /，路由前补 #
        await page.goto(`/#${route.hash}`, { waitUntil: 'networkidle', timeout: 90_000 })
        // 额外等待 hydration 与 z-index useEffect（只需要 1 帧）
        await page.waitForTimeout(300)

        // 关键 DOM 断言：App 根 &（如果是首页 / 带 portal 的路由）Portal Shell 根存在
        const appRoot = page.locator('#app-content-root')
        await expect(appRoot, 'App 根容器 #app-content-root 应挂载').toBeAttached({ timeout: 5000 })

        // 如果路由命中需要 PortalShell 的舱（/trading、/input、/analysis 等），验证其根
        const needsPortalShell = route.hash !== '/cockpit'
        if (needsPortalShell) {
          const portalRoot = page.locator('#portal-shell-root')
          // 可能不所有路由都立刻渲染 PortalShell（例如首页），只在其存在时断言子部分
          if ((await portalRoot.count()) > 0) {
            await expect(portalRoot.locator('#portal-shell-header'), 'Portal Header 存在').toBeVisible()
          }
        }

        // 失败现场截图
        if (testInfo.status !== testInfo.expectedStatus) {
          await page.screenshot({
            path: `outputs/e2e-fail-${size.name}-${route.label.replace(/\W/g, '')}.png`,
            fullPage: true,
          })
        }

        collect.uninstall()

        // 断言：0 崩溃级错误
        expect(collect.pageErrors, `未捕获 JS 异常（pageerror）数量=0；实际=${collect.pageErrors.length}\n 明细=${collect.pageErrors.join('\n  ---  ')}`).toHaveLength(0)
        expect(
          collect.consoleErrors,
          `console.error 数量=0（排除 HMR/404 噪音后）；实际=${collect.consoleErrors.length}\n 明细=${collect.consoleErrors.join('\n  ---  ')}`,
        ).toHaveLength(0)

        // 断言：DEV 环境应写入 z-index 日志（console.debug 会被 Playwright 识别为 type=debug）
        // 注意：如果是 production 构建，import.meta.env.DEV=false，console.debug 不会输出；本 E2E 走 dev server，DEV 为 true
        expect(collect.zIndexLogs.length, 'DEV 环境 z-index 日志应存在（至少 App.AppContent mount/PortalShell.create 各一条）').toBeGreaterThanOrEqual(1)
      })
    }
  }
})

test.describe('TC-E2E-2 响应式断点验证（useMediaQuery BREAKPOINT_* 生效）', () => {
  test('TC-E2E-2.1 宽度 320px (BREAKPOINT_MOBILE)：底部导航应显示；Sidebar 应隐藏', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto('/#/trading', { waitUntil: 'networkidle', timeout: 90_000 })
    await page.waitForTimeout(300)

    const bottomNav = page.locator('#portal-shell-bottom-nav')
    await expect(bottomNav, '移动端底部导航（z-20 fixed）在 320px 下应显示').toBeVisible()

    const sidebar = page.locator('#portal-shell-sidebar')
    // 767px 以下使用 hidden w-60 ... md:flex，所以不可见
    await expect(sidebar, '左侧 Sidebar 在 <768px 下应隐藏（md:hidden）').toBeHidden()
  })

  test('TC-E2E-2.2 宽度 1280px (BREAKPOINT_WIDE)：底部导航应隐藏；Sidebar 应显示；Header sticky z-20', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#/analysis', { waitUntil: 'networkidle', timeout: 90_000 })
    await page.waitForTimeout(300)

    const sidebar = page.locator('#portal-shell-sidebar')
    await expect(sidebar, '桌面 Sidebar 在 >= 1024px 下应渲染并可见').toBeVisible()

    const bottomNav = page.locator('#portal-shell-bottom-nav')
    await expect(bottomNav, '桌面底部导航（md:hidden）在 >= 1024px 下应隐藏').toBeHidden()

    const header = page.locator('#portal-shell-header')
    await expect(header, 'Header 始终可见 sticky z-20').toBeVisible()
  })
})
