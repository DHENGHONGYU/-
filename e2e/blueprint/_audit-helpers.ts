/**
 * 蓝图验收测试公共工具
 * - auditRoute: 单路由渲染审计（HTTP 状态 / #root 渲染 / 控制台错误 / 页面异常 / 截图）
 * - runRouteAudits: 按舱室批量执行并将结果写入 outputs/blueprint-audit/results/<category>.json
 *
 * 注意：项目使用 HashRouter（ADR-004），所有路由以 `/#<path>` 形式访问。
 */
import { test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export interface RouteDef {
  path: string
  description: string
  category: string
  /** 蓝图 §6.1 中明确列出的路由 */
  inBlueprint: boolean
}

export interface RouteAuditResult {
  path: string
  description: string
  category: string
  inBlueprint: boolean
  status: 'pass' | 'warn' | 'fail'
  rendered: boolean
  rootChildren: number
  textLength: number
  pageErrors: string[]
  consoleErrors: string[]
  loadMs: number
  screenshot: string
}

export const OUT_DIR = path.resolve('outputs/blueprint-audit')

/** 控制台噪音过滤：数据接口不可达、第三方资源失败等不构成页面缺陷 */
const CONSOLE_NOISE = [
  /favicon/i,
  /net::ERR_/i,
  /Failed to load resource/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /WebSocket/i,
  /tushare|akshare|api\./i,
]

function isNoise(text: string): boolean {
  return CONSOLE_NOISE.some((re) => re.test(text))
}

export async function auditRoute(page: Page, route: RouteDef): Promise<RouteAuditResult> {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      const t = msg.text().slice(0, 300)
      if (!isNoise(t)) consoleErrors.push(t)
    }
  }
  const onPageError = (err: Error) => pageErrors.push(String(err).slice(0, 300))
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  const start = Date.now()
  let rendered = false
  let rootChildren = 0
  let textLength = 0
  try {
    await page.goto(`/#${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root')
        return !!root && root.childElementCount > 0 && (root.textContent ?? '').trim().length > 0
      },
      { timeout: 60_000 },
    )
    rendered = true
    // 给懒加载 chunk 与异步数据一点稳定时间
    await page.waitForTimeout(800)
    const metrics = await page.evaluate(() => {
      const root = document.getElementById('root')
      return {
        rootChildren: root ? root.childElementCount : 0,
        textLength: root ? (root.textContent ?? '').trim().length : 0,
      }
    })
    rootChildren = metrics.rootChildren
    textLength = metrics.textLength
  } catch (e) {
    pageErrors.push(`NAV_OR_RENDER: ${String(e).slice(0, 250)}`)
  }

  const shotName = route.path === '/' ? 'home' : route.path.replace(/^\//, '').replace(/[/:]/g, '_')
  const screenshot = `screenshots/${shotName}.png`
  try {
    fs.mkdirSync(path.join(OUT_DIR, 'screenshots'), { recursive: true })
    await page.screenshot({ path: path.join(OUT_DIR, screenshot) })
  } catch {
    /* 截图失败不阻断 */
  }

  page.off('console', onConsole)
  page.off('pageerror', onPageError)

  const status: RouteAuditResult['status'] =
    !rendered || pageErrors.length > 0 ? 'fail' : consoleErrors.length > 0 ? 'warn' : 'pass'

  return {
    ...route,
    status,
    rendered,
    rootChildren,
    textLength,
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 5),
    loadMs: Date.now() - start,
    screenshot,
  }
}

export function runRouteAudits(category: string, routes: RouteDef[]): void {
  test.describe.configure({ mode: 'serial' })
  const results: RouteAuditResult[] = []
  for (const route of routes) {
    test(`${route.path} — ${route.description}`, async ({ page }) => {
      results.push(await auditRoute(page, route))
    })
  }
  test.afterAll(() => {
    fs.mkdirSync(path.join(OUT_DIR, 'results'), { recursive: true })
    fs.writeFileSync(
      path.join(OUT_DIR, 'results', `${category}.json`),
      JSON.stringify(results, null, 2),
      'utf-8',
    )
  })
}
