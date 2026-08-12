/**
 * E2E 全维度测试 — 共享工具函数
 */

import { Page, BrowserContext, expect } from '@playwright/test'

// ── 常量 ──

export const BASE_URL = 'http://localhost:3005'
export const HASH_PREFIX = '#/'

/** 关键页面路径映射 */
export const ROUTES = {
  home: '/',
  cockpit: '/cockpit',
  input: '/input',
  inputCollectTasks: '/input/collect-tasks',
  inputSevenDim: '/input/seven-dim',
  inputDataTest: '/input/data-test',
  analysis: '/analysis',
  analysisPoolBoard: '/analysis/pool-board',
  analysisStockScore: '/analysis/stock-score',
  analysisIndustryScore: '/analysis/industry-score',
  trading: '/trading',
  tradingHoldings: '/trading/holdings',
  tradingPortfolio: '/trading/portfolio',
  output: '/output',
  outputResearch: '/output/research',
  outputWizard: '/output/wizard',
  command: '/command',
  commandAgents: '/command/agents',
  commandSystemHealth: '/command/system-health',
  commandAgentTaskPanel: '/command/agents/task-panel',
  commandAgentModelConfig: '/command/agents/model-config',
  commandAgentOptimizationPanel: '/command/agents/optimization-panel',
  commandHealth: '/command/health',
} as const

/** 导航到指定页面（HashRouter） */
export async function navigateTo(page: Page, route: string) {
  // 去掉 route 的前导斜杠避免 HASH_PREFIX 拼接出 "#//input" 这种双斜杠路径
  const normalized = route.startsWith('/') ? route : `/${route}`
  await page.goto(`${BASE_URL}${HASH_PREFIX}${normalized.slice(1)}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
}

/** 等待加载完成 */
export async function waitForAppReady(page: Page) {
  await page.waitForSelector('#root', { state: 'attached', timeout: 15000 })
  await page.waitForTimeout(1000)
}

/** 检查页面是否有错误 Toast */
export async function hasErrorToast(page: Page): Promise<boolean> {
  return page.locator('[role="alert"]').count().then(c => c > 0)
}

/** 截图对比辅助 */
export async function takeScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true })
}

/** 获取性能指标 */
export async function getPerformanceMetrics(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    const resources = performance.getEntriesByType('resource')
    return {
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      loadComplete: nav.loadEventEnd - nav.startTime,
      firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime ?? 0,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
      resourceCount: resources.length,
      totalResourceSize: resources.reduce((sum, r) => sum + (r as PerformanceResourceTiming).transferSize, 0),
      dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
      tcpTime: nav.connectEnd - nav.connectStart,
      ttfb: nav.responseStart - nav.requestStart,
    }
  })
}

/** 模拟网络中断 */
export async function simulateOffline(page: Page) {
  await page.route('**/*', route => route.abort())
}

/** 恢复网络 */
export async function restoreNetwork(page: Page) {
  await page.unroute('**/*')
}

/** 模拟慢网络（3G） */
export async function simulateSlow3G(context: BrowserContext) {
  const client = await context.newCDPSession(context.pages()[0])
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: ((500 * 1000) / 8),
    uploadThroughput: ((500 * 1000) / 8),
    latency: 400,
  })
}

/** 页面覆盖度统计 */
export interface PageCoverage {
  page: string
  tested: boolean
  dimensions: string[]
}

/** 生成覆盖率报告 */
export function reportCoverage(results: PageCoverage[]): string {
  const total = results.length
  const tested = results.filter(r => r.tested).length
  const dims = new Set(results.flatMap(r => r.dimensions))
  return [
    `总页面: ${total}`,
    `已测试: ${tested} (${((tested / total) * 100).toFixed(1)}%)`,
    `覆盖维度: ${[...dims].join(', ')}`,
    `维度数: ${dims.size}`,
  ].join('\n')
}

/** 测试数据工厂 */
export const SAMPLE_STOCKS = [
  { code: '000001', name: '平安银行' },
  { code: '600519', name: '贵州茅台' },
  { code: '000858', name: '五粮液' },
  { code: '300750', name: '宁德时代' },
  { code: '002594', name: '比亚迪' },
]

export const LONG_INPUT = 'A'.repeat(10000)
export const INVALID_INPUTS = ['!@#$%', '   ', '\n\n\n', '<script>alert("xss")</script>']
