import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady, ROUTES, simulateOffline, restoreNetwork } from '../utils/helpers'

test.describe('网络中断处理', () => {
  test('断网后导航不崩溃', async ({ page }) => {
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)

    await simulateOffline(page)
    
    // 尝试导航
    try {
      await navigateTo(page, ROUTES.input)
    } catch {
      // 预期可能失败
    }
    
    // 页面不应崩溃
    const root = page.locator('#root')
    await expect(root).toBeAttached()
    
    await restoreNetwork(page)
  })

  test('恢复网络后页面可交互', async ({ page }) => {
    await simulateOffline(page)
    
    try { await navigateTo(page, ROUTES.home) } catch {}
    
    await restoreNetwork(page)
    await navigateTo(page, ROUTES.home)
    await waitForAppReady(page)
    
    await expect(page.locator('h1')).toContainText('智能投研')
  })
})

test.describe('异常处理', () => {
  test('导航到不存在页面显示 404', async ({ page }) => {
    await navigateTo(page, '/nonexistent-page-xyz')
    await page.waitForTimeout(1000)
    
    // 应显示 404 或保持在首页
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/页面未找到|V9|404/)
  })

  test('Hash 冲突不崩溃', async ({ page }) => {
    await navigateTo(page, ROUTES.home)
    await page.evaluate(() => { window.location.hash = '#/invalid/###' })
    await page.waitForTimeout(1000)
    
    const root = page.locator('#root')
    await expect(root).toBeAttached()
  })

  test('快速连续导航不崩溃', async ({ page }) => {
    await navigateTo(page, ROUTES.home)
    
    // 快速切换 5 次
    for (let i = 0; i < 5; i++) {
      await navigateTo(page, ROUTES.input)
      await navigateTo(page, ROUTES.analysis)
    }
    
    const root = page.locator('#root')
    await expect(root).toBeAttached()
  })
})
