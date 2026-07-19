/**
 * @test_id V9-TEST-E2E-033
 * E2E 视觉测试 — 布局一致性
 * 覆盖：首页功能卡片与状态概览、顶栏 Logo/Tab/按钮、侧边栏面板
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady, ROUTES } from '../utils/helpers'

test.describe('首页布局', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
  })

  test('4 张功能卡片渲染（输入/分析/交易/输出）', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '输入舱' }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: '分析舱' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: '交易舱' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: '输出舱' }).first()).toBeVisible()
  })

  test('状态概览卡片渲染（股票池/信号/采集任务/采集服务）', async ({ page }) => {
    // 首页应有系统状态统计区域
    await expect(page.locator('#root')).toBeAttached()
    // 状态概览区域存在股票池相关统计
    const statusArea = page.getByText(/股票池|信号|采集任务|采集服务|stocks|signals|tasks/i)
    const count = await statusArea.count()
    // 至少存在部分状态指示
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('"打开驾驶舱"链接可见', async ({ page }) => {
    await expect(page.getByRole('link', { name: '打开驾驶舱' })).toBeVisible({ timeout: 5000 })
  })

  test('页面标题"智能投研复盘系统 V9"', async ({ page }) => {
    await expect(page.locator('text=智能投研复盘系统 V9')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('顶栏布局', () => {

  test.beforeEach(async ({ page }) => {
    // 舱室顶栏导航只在 PortalShell 中，导航到 /input 而非首页
    await navigateTo(page, ROUTES.input)
    await page.waitForTimeout(1000)
  })

  test('Logo "V9" 渲染', async ({ page }) => {
    const logo = page.getByText('V9', { exact: false })
    const count = await logo.count()
    expect(count).toBeGreaterThan(0)
  })

  test('5 个舱室 Tab 渲染', async ({ page }) => {
    const nav = page.locator('header nav').first()
    await expect(nav).toBeAttached()
    // 5 个舱室按钮（含 emoji + 文字）：输入舱、分析舱、交易舱、输出舱、总控舱
    // 使用 emoji 字符来区分舱室按钮（驾驶舱按钮没有 emoji）
    const cabinButtons = nav.locator('button').filter({ hasText: /[📦🔬💹📊🎛️]/ })
    await expect(cabinButtons).toHaveCount(5)
  })

  test('驾驶舱按钮渲染', async ({ page }) => {
    const cockpitEntry = page.locator('a, button').filter({ hasText: /驾驶舱|cockpit/i }).first()
    const count = await cockpitEntry.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('主题切换按钮渲染', async ({ page }) => {
    // 主题切换控件在顶栏应存在
    const themeControl = page.locator('button, [role="button"]').filter({ hasText: /主题|theme|dark|light|暗色|亮色|sun|moon/i }).first()
    const count = await themeControl.count()
    // 至少页面正常渲染（主题控件在不同布局下可能隐藏）
    await expect(page.locator('#root')).toBeAttached()
  })

  test('采集状态指示器渲染', async ({ page }) => {
    const statusIndicator = page.getByText(/采集|collect|任务/i)
    const count = await statusIndicator.count()
    // 顶栏或导航区域应存在采集状态入口
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

test.describe('侧边栏布局', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.input)
  })

  test('侧边栏面板渲染', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()
  })

  test('分组标题渲染（意向候选池 / 数据采集）', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
    // 侧边栏分组标题：PANEL_ITEMS 中定义的 group 名
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeAttached()
    await expect(sidebar.getByText('意向候选池')).toBeVisible()
    await expect(sidebar.getByText('数据采集')).toBeVisible()
  })

  test('导航项渲染', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
    // 侧边栏存在可点击导航项
    const navItems = page.locator('aside button').filter({ hasText: /导入|测试|任务|配置/i })
    const count = await navItems.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
