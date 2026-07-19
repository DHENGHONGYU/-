import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady, ROUTES } from '../utils/helpers'

// 注意：多浏览器支持需要在 config 中配置 projects，此文件测试跨浏览器下的一致性
test.describe('跨浏览器核心渲染', () => {
  test('首页在 Chromium 下正常渲染', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '仅 Chromium 测试')
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
    await expect(page.locator('h1')).toContainText('智能投研')
  })

  test('首页在 Firefox 下正常渲染', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', '仅 Firefox 测试')
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
    await expect(page.locator('h1')).toContainText('智能投研')
  })

  test('首页在 WebKit 下正常渲染', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', '仅 WebKit 测试')
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
    await expect(page.locator('h1')).toContainText('智能投研')
  })
})

test.describe('跨浏览器导航', () => {
  const PAGES = ['输入舱', '分析舱', '交易舱', '输出舱', '总控舱']
  for (const pageName of PAGES) {
    test(`导航到${pageName}正常`, async ({ page }) => {
      // 舱室导航按钮只存在于 PortalShell（cabin 页面），首页没有
      await navigateTo(page, ROUTES.input)
      await waitForAppReady(page)
      const tabText = pageName.replace('舱', '')
      const tab = page.locator('header nav button', { hasText: tabText }).first()
      await tab.click()
      await page.waitForTimeout(500)
      // 验证页面有内容
      const mainContent = page.locator('main').first()
      await expect(mainContent).not.toBeEmpty()
    })
  }
})

test.describe('跨浏览器表单交互', () => {
  test('七维配置模板切换在 Chromium', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '仅 Chromium')
    await navigateTo(page, ROUTES.inputSevenDim)
    await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
    // 点击价值投资策略模板卡片
    await page.getByRole('heading', { name: '价值投资' }).click()
    // 维度区应显示已启用的维度计数
    await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  })
  
  test('七维配置模板切换在 Firefox', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', '仅 Firefox')
    await navigateTo(page, ROUTES.inputSevenDim)
    await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('heading', { name: '价值投资' }).click()
    await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  })
  
  test('七维配置模板切换在 WebKit', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', '仅 WebKit')
    await navigateTo(page, ROUTES.inputSevenDim)
    await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('heading', { name: '价值投资' }).click()
    await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  })
})
