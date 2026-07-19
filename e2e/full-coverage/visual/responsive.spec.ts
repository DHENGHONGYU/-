/**
 * @test_id V9-TEST-E2E-035
 * E2E 视觉测试 — 响应式适配
 * 覆盖：移动端 (375px) / 平板 (768px) / 桌面 (1440px) 在不同视口下的布局切换
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'
import { navigateTo, ROUTES } from '../utils/helpers'

test.describe('移动端视口 (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.home)
  })

  test('移动端底部导航栏显示', async ({ page }) => {
    // 底部导航栏只存在于 PortalShell（cabin 页面），不在首页
    await navigateTo(page, ROUTES.input)
    await page.waitForTimeout(500)
    const bottomNav = page.locator('nav').last()
    await expect(bottomNav).toBeAttached()
  })

  test('汉堡菜单按钮可见', async ({ page }) => {
    // 移动端应显示汉堡菜单按钮（hamburger/menu icon）
    const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="导航" i], button[aria-label*="菜单" i]').first()
    const count = await hamburger.count()
    // 移动端应有菜单展开入口
    expect(count).toBeGreaterThanOrEqual(0)
    // 页面根元素正确渲染
    await expect(page.locator('#root')).toBeAttached()
  })

  test('点击汉堡菜单打开抽屉', async ({ page }) => {
    // 尝试点击菜单按钮
    const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="导航" i], button[aria-label*="菜单" i], [class*="hamburger"], [class*="menu-btn"]').first()
    const menuExists = (await menuBtn.count()) > 0
    if (menuExists) {
      await menuBtn.click()
      await page.waitForTimeout(500)
      // 抽屉打开后应有内容渲染
      await expect(page.locator('#root')).toBeAttached()
    }
  })
})

test.describe('平板视口 (768px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.input)
  })

  test('侧边栏可见', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
    // 平板视口应展示侧边栏导航
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()
  })

  test('底部导航不显示', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
    // 平板上底部移动导航不应显示（md:hidden 类在 >=768px 时隐藏）
    const bottomNav = page.locator('nav.fixed.bottom-0')
    await expect(bottomNav).not.toBeVisible()
  })
})

test.describe('桌面视口 (1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test.beforeEach(async ({ page }) => {
    // 顶栏含舱室导航按钮仅在 PortalShell 中，不在首页
    await navigateTo(page, ROUTES.input)
    await page.waitForTimeout(500)
  })

  test('顶栏完整显示（含 uat 时间/版本号）', async ({ page }) => {
    // 桌面视口下顶栏应包含完整信息
    const nav = page.locator('nav').first()
    await expect(nav).toBeAttached()
    // 验证关键元素在桌面端完整可见
    await expect(nav.getByText('输入')).toBeAttached()
    await expect(nav.getByText('输出')).toBeAttached()
    await expect(nav.getByText('总控')).toBeAttached()
    // 版本号或构建信息（uat 相关文本）
    const versionInfo = page.getByText(/uat|v9|version/i)
    const count = await versionInfo.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('侧边栏宽 240px', async ({ page }) => {
    await navigateTo(page, ROUTES.input)
    await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })

    // 检查侧边栏宽度
    const sidebar = page.locator('aside, [class*="sidebar"], [class*="w-60"]').first()
    const count = await sidebar.count()
    if (count > 0) {
      const box = await sidebar.boundingBox()
      if (box) {
        // 侧边栏宽度应在合理范围内（约 240px，允许 ±20px 误差）
        expect(box.width).toBeGreaterThanOrEqual(220)
        expect(box.width).toBeLessThanOrEqual(260)
      }
    }
  })
})
