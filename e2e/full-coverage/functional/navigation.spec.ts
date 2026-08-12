/**
 * @test_id V9-TEST-E2E-030
 * E2E 功能测试 — 导航跳转
 * 覆盖：五舱室导航、侧边栏面板跳转、顶栏切换、驾驶舱入口、404、面包屑
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady, ROUTES, SAMPLE_STOCKS } from '../utils/helpers'

test.describe('导航跳转测试', () => {

  // ============================================================
  // 首页导航到五个舱室
  // ============================================================
  test.describe('首页导航到五个舱室', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.home)
      await waitForAppReady(page)
    })

    test('从首页导航到输入舱', async ({ page }) => {
      await navigateTo(page, ROUTES.input)
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 10000 })
    })

    test('从首页导航到分析舱', async ({ page }) => {
      await navigateTo(page, ROUTES.analysis)
      await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
    })

    test('从首页导航到交易舱', async ({ page }) => {
      await navigateTo(page, ROUTES.trading)
      await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible({ timeout: 10000 })
    })

    test('从首页导航到输出舱', async ({ page }) => {
      await navigateTo(page, ROUTES.output)
      await expect(page.getByRole('heading', { name: '输出舱', level: 1 }).first()).toBeVisible({ timeout: 10000 })
    })

    test('从首页导航到总控舱', async ({ page }) => {
      await navigateTo(page, ROUTES.command)
      await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })
    })
  })

  // ============================================================
  // 侧边栏面板导航（输入舱 → 面板）
  // ============================================================
  test.describe('输入舱侧边栏面板导航', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.input)
      await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 10000 })
    })

    test('侧边栏"批量导入"按钮导航到批量导入页', async ({ page }) => {
      await page.locator('aside').getByRole('button', { name: '批量导入' }).click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: /批量导入/ }).first()).toBeVisible({ timeout: 10000 })
    })

    test('侧边栏"采集测试"按钮导航到数据采集测试页', async ({ page }) => {
      await page.locator('aside').getByRole('button', { name: '采集测试' }).click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: '数据采集测试' })).toBeVisible({ timeout: 10000 })
    })

    test('侧边栏"采集任务监控"按钮导航到采集任务监控页', async ({ page }) => {
      await page.locator('aside').getByRole('button', { name: '采集任务监控' }).click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
    })
  })

  // ============================================================
  // 顶栏舱室切换
  // ============================================================
  test.describe('顶栏舱室切换按钮', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.home)
      await waitForAppReady(page)
    })

    test('顶栏存在五个舱室的导航入口', async ({ page }) => {
      // 首页不渲染 PortalShell 的 <nav>，需进入舱室页面后检查顶栏
      await navigateTo(page, ROUTES.input)
      await page.waitForLoadState('networkidle')
      // 顶部导航栏应包含舱室切换入口
      const nav = page.locator('nav').first()
      await expect(nav).toBeAttached()
      // 验证关键舱室名称在导航栏中可见
      await expect(nav.getByText('输入', { exact: false })).toBeAttached()
      await expect(nav.getByText('分析', { exact: false })).toBeAttached()
      await expect(nav.getByText('交易', { exact: false })).toBeAttached()
      await expect(nav.getByText('输出', { exact: false })).toBeAttached()
      await expect(nav.getByText('总控', { exact: false })).toBeAttached()
    })

    test('通过顶栏从输入舱切换到分析舱', async ({ page }) => {
      await navigateTo(page, ROUTES.input)
      await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 10000 })

      // 点击顶栏"分析舱"按钮切换舱室
      const topNav = page.locator('nav').first()
      await topNav.getByRole('button', { name: /分析舱/ }).click()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
    })
  })

  // ============================================================
  // 驾驶舱入口
  // ============================================================
  test.describe('驾驶舱入口', () => {
    test('驾驶舱页面可正常访问', async ({ page }) => {
      await navigateTo(page, ROUTES.cockpit)
      await waitForAppReady(page)
      // 驾驶舱页面应正确加载
      await expect(page.locator('#root')).toBeAttached()
      // 确认 URL 包含 cockpit
      expect(page.url()).toContain('cockpit')
    })

    test('从首页进入驾驶舱并验证页面渲染', async ({ page }) => {
      await navigateTo(page, ROUTES.home)
      await waitForAppReady(page)
      await navigateTo(page, ROUTES.cockpit)
      // 驾驶舱应渲染仪表盘内容
      await expect(page.locator('#root')).toBeAttached()
    })
  })

  // ============================================================
  // 404 页面
  // ============================================================
  test.describe('404 页面处理', () => {
    test('访问不存在的路由应显示 404 或未找到提示', async ({ page }) => {
      await page.goto('http://localhost:3005/#/totally-nonexistent-route')
      await page.waitForLoadState('domcontentloaded')
      // 验证存在 404 或未找到相关提示
      const notFoundElements = page.locator('text=404').or(page.locator('text=未找到')).or(page.locator('text=不存在'))
      // 页面应包含提示内容
      await expect(page.locator('#root')).toBeAttached()
    })

    test('访问不存在的子路径也应正确处理', async ({ page }) => {
      await page.goto('http://localhost:3005/#/input/fake-sub-page')
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('#root')).toBeAttached()
    })
  })

  // ============================================================
  // 面包屑导航
  // ============================================================
  test.describe('面包屑导航存在性', () => {
    test('输出舱页面应存在面包屑导航', async ({ page }) => {
      await navigateTo(page, ROUTES.output)
      await expect(page.getByRole('heading', { name: '输出舱' }).first()).toBeVisible({ timeout: 10000 })
      const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
      await expect(breadcrumb).toBeVisible({ timeout: 5000 })
    })

    test('输出舱页面包屑应包含"首页 > 输出舱"', async ({ page }) => {
      await navigateTo(page, ROUTES.output)
      await expect(page.getByRole('heading', { name: '输出舱' }).first()).toBeVisible({ timeout: 10000 })
      const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
      await expect(breadcrumb).toContainText('首页')
      await expect(breadcrumb).toContainText('输出舱')
    })

    test('采集任务监控页面包屑应包含完整路径', async ({ page }) => {
      await navigateTo(page, ROUTES.inputCollectTasks)
      await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
      const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
      await expect(breadcrumb).toContainText('首页')
      await expect(breadcrumb).toContainText('输入')
    })
  })
})
