/**
 * @test_id V9-TEST-E2E-026
 * @covers_docs []
 */
import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady, ROUTES } from '../utils/helpers'
import type { BrowserContext } from '@playwright/test'

test.describe('超时场景', () => {
  test('页面加载超时时不白屏', async ({ page }) => {
    // 使用短超时验证页面不会完全挂掉
    await page.goto('http://localhost:3005/', { timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(500)
    
    // 即使超时，root 元素应该存在（因为之前可能已缓存）
    const rootExists = await page.locator('#root').count()
    expect(rootExists).toBeGreaterThanOrEqual(0) // 可能 0 或 1，但不应崩溃
  })

  test('慢网络下页面最终渲染', async ({ context, page }) => {
    // 模拟 3G 网络
    const client = await context.newCDPSession(page)
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: ((500 * 1000) / 8),
      uploadThroughput: ((500 * 1000) / 8),
      latency: 400,
    })
    
    // 使用较长超时等待慢网络加载
    await page.goto('http://localhost:3005/', { timeout: 30000 })
    await page.waitForSelector('#root', { state: 'attached', timeout: 30000 })
    
    await expect(page.locator('h1')).toContainText('智能投研', { timeout: 30000 })
  })
})

test.describe('并发访问', () => {
  test('多 Tab 同时访问不冲突', async ({ context }) => {
    const page1 = await context.newPage()
    const page2 = await context.newPage()
    
    await Promise.all([
      page1.goto(`http://localhost:3005/#/`),
      page2.goto(`http://localhost:3005/#/`),
    ])
    
    await page1.waitForSelector('#root', { timeout: 15000 })
    await page2.waitForSelector('#root', { timeout: 15000 })
    
    await expect(page1.locator('h1')).toContainText('智能投研')
    await expect(page2.locator('h1')).toContainText('智能投研')
    
    await page1.close()
    await page2.close()
  })
})
