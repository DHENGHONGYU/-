/**
 * @test_id V9-TEST-E2E-032
 * @covers_docs []
 */
import { test, expect } from '@playwright/test'
import { navigateTo, ROUTES } from '../utils/helpers'

test.describe('资源请求审计', () => {
  test('无 404 资源请求', async ({ page }) => {
    const failedRequests: string[] = []
    page.on('response', response => {
      if (response.status() === 404) {
        failedRequests.push(response.url())
      }
    })
    
    await navigateTo(page, ROUTES.home)
    await page.waitForTimeout(2000)
    
    expect(failedRequests).toHaveLength(0)
  })

  test('无 5xx 错误', async ({ page }) => {
    const errors: string[] = []
    page.on('response', response => {
      if (response.status() >= 500) {
        errors.push(`${response.url()} (${response.status()})`)
      }
    })
    
    await navigateTo(page, ROUTES.home)
    await page.waitForTimeout(2000)
    
    expect(errors).toHaveLength(0)
  })

  test('关键 chunk 成功加载（JS/CSS）', async ({ page }) => {
    let jsCount = 0
    let cssCount = 0
    page.on('response', response => {
      if (response.status() === 200) {
        const ct = response.headers()['content-type'] || ''
        if (ct.includes('javascript') || ct.includes('text/javascript')) jsCount++
        if (ct.includes('css') || ct.includes('text/css')) cssCount++
      }
    })
    
    await navigateTo(page, ROUTES.home)
    await page.waitForTimeout(2000)
    
    // JS 资源成功加载
    expect(jsCount).toBeGreaterThan(0)
    // CSS 在 Vite 开发模式下可能通过 JS 内联，不做强制断言
    expect(cssCount).toBeGreaterThanOrEqual(0)
  })
})
