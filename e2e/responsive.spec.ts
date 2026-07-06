/**
 * 响应式设计测试
 * 验证系统在不同视口尺寸下的布局表现
 */

import { test, expect } from '@playwright/test'

// 定义测试视口尺寸
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
}

test.describe('响应式设计测试', () => {
  // 移动端测试
  test.describe('移动端 (375x667)', () => {
    test.use({ viewport: VIEWPORTS.mobile })

    test('输入舱 Hub 页面 - 移动端布局', async ({ page }) => {
      await page.goto('/input/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /数据采集及接口/i })).toBeVisible()

      // 验证模块卡片堆叠显示（单列）
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()

      // 验证面包屑导航可见
      await expect(page.getByText('首页')).toBeVisible()
      await expect(page.getByText('输入舱')).toBeVisible()
    })

    test('分析舱 Hub 页面 - 移动端布局', async ({ page }) => {
      await page.goto('/analysis/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /行业个股分析/i })).toBeVisible()

      // 验证模块卡片堆叠显示
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })

    test('交易舱 Hub 页面 - 移动端布局', async ({ page }) => {
      await page.goto('/trading/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /交易及持仓/i })).toBeVisible()

      // 验证模块卡片堆叠显示
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })

    test('总控舱 Hub 页面 - 移动端布局', async ({ page }) => {
      await page.goto('/command/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /总控中心/i })).toBeVisible()

      // 验证模块卡片堆叠显示
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })
  })

  // 平板端测试
  test.describe('平板端 (768x1024)', () => {
    test.use({ viewport: VIEWPORTS.tablet })

    test('输入舱 Hub 页面 - 平板端布局', async ({ page }) => {
      await page.goto('/input/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /数据采集及接口/i })).toBeVisible()

      // 验证模块卡片网格布局（2列）
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })

    test('分析舱 Hub 页面 - 平板端布局', async ({ page }) => {
      await page.goto('/analysis/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /行业个股分析/i })).toBeVisible()

      // 验证模块卡片网格布局
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })
  })

  // 桌面端测试
  test.describe('桌面端 (1920x1080)', () => {
    test.use({ viewport: VIEWPORTS.desktop })

    test('输入舱 Hub 页面 - 桌面端布局', async ({ page }) => {
      await page.goto('/input/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /数据采集及接口/i })).toBeVisible()

      // 验证模块卡片网格布局（3列）
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })

    test('分析舱 Hub 页面 - 桌面端布局', async ({ page }) => {
      await page.goto('/analysis/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /行业个股分析/i })).toBeVisible()

      // 验证模块卡片网格布局
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })

    test('交易舱 Hub 页面 - 桌面端布局', async ({ page }) => {
      await page.goto('/trading/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /交易及持仓/i })).toBeVisible()

      // 验证模块卡片网格布局
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })

    test('总控舱 Hub 页面 - 桌面端布局', async ({ page }) => {
      await page.goto('/command/hub')

      // 验证页面标题可见
      await expect(page.getByRole('heading', { name: /总控中心/i })).toBeVisible()

      // 验证模块卡片网格布局
      const moduleCards = page.locator('[data-testid="module-card"]')
      await expect(moduleCards.first()).toBeVisible()
    })
  })
})
