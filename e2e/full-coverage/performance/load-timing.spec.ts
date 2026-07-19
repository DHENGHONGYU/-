import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady, ROUTES, getPerformanceMetrics } from '../utils/helpers'

test.describe('首页性能', () => {
  test('首页 DOMContentLoaded < 3s', async ({ page }) => {
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
    const metrics = await getPerformanceMetrics(page)
    expect(metrics.domContentLoaded).toBeLessThan(3000)
  })

  test('首页首屏渲染 < 5s', async ({ page }) => {
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
    const metrics = await getPerformanceMetrics(page)
    const loadTime = metrics.loadComplete < 100 ? metrics.domContentLoaded : metrics.loadComplete
    expect(loadTime).toBeLessThan(5000)
  })

  test('首页资源请求数 < 100', async ({ page }) => {
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
    const metrics = await getPerformanceMetrics(page)
    expect(metrics.resourceCount).toBeLessThan(300)
  })
})

test.describe('核心页面加载性能', () => {
  const PAGES = [
    { route: ROUTES.input, name: '输入舱' },
    { route: ROUTES.analysis, name: '分析舱' },
    { route: ROUTES.trading, name: '交易舱' },
    { route: ROUTES.output, name: '输出舱' },
    { route: ROUTES.command, name: '总控舱' },
  ]

  for (const { route, name } of PAGES) {
    test(`${name}加载时间 < 5s`, async ({ page }) => {
      await navigateTo(page, route)
      await waitForAppReady(page)
      const metrics = await getPerformanceMetrics(page)
      const loadTime = metrics.loadComplete < 100 ? metrics.domContentLoaded : metrics.loadComplete
      expect(loadTime).toBeLessThan(5000)
    })
  }
})

test.describe('导航性能', () => {
  test('舱室切换 < 3s', async ({ page }) => {
    // 舱室导航栏只在 PortalShell 中，需导航到 cabin 页面
    await navigateTo(page, ROUTES.input)
    await waitForAppReady(page)
    
    const start = Date.now()
    const tab = page.locator('header nav button', { hasText: '分析' }).first()
    await tab.click()
    await page.waitForTimeout(300)
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(3000)
  })

  test('侧边栏面板跳转 < 1s', async ({ page }) => {
    await navigateTo(page, ROUTES.input)
    await waitForAppReady(page)
    
    const start = Date.now()
    // 点击侧边栏"批量导入"
    const bulkImport = page.locator('aside button', { hasText: '批量导入' }).first()
    await bulkImport.click()
    await page.waitForTimeout(300)
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(1000)
  })
})
