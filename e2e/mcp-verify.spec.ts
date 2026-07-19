/**
 * @test_id V9-TEST-E2E-010
 * @covers_docs [V9-DOC-AI-005, V9-DOC-AI-007, V9-DOC-AI-013, V9-DOC-AI-023, V9-DOC-AI-021]
 */
import { test, expect } from '@playwright/test'
import path from 'node:path'

/**
 * MCP 等价功能验证脚本
 *
 * 本脚本使用 Playwright 原生 API 实现与 Playwright MCP Server 等价的功能：
 *   - playwright_navigate  →  page.goto(url)
 *   - playwright_screenshot  →  page.screenshot({ fullPage })
 *
 * 用于在 MCP 配置完成后，通过 `npm run test:e2e` 验证浏览器驱动、
 * baseURL 配置与截图输出路径是否正常工作。
 */

// 截图输出目录（相对 playwright.config.ts 的根目录）
const SCREENSHOT_DIR = 'e2e/screenshots'

// 测试目标路由（对应项目 input 舱）
const TARGET_ROUTE = '/#/input'

test.describe('Playwright MCP 等价功能验证', () => {
  test('playwright_navigate: 应成功导航到输入舱', async ({ page }) => {
    // 等价于 MCP 工具 playwright_navigate({ url: "http://localhost:4173/#/input" })
    await page.goto(TARGET_ROUTE)

    // 验证导航成功：URL 应包含目标路由
    await expect(page).toHaveURL(new RegExp(`${TARGET_ROUTE}$`))

    // 验证页面已渲染（等待关键元素出现）
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  })

  test('playwright_screenshot: 应成功截取整页截图', async ({ page }) => {
    // 先导航到目标页面
    await page.goto(TARGET_ROUTE)
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })

    // 等价于 MCP 工具 playwright_screenshot({ fullPage: true })
    const screenshotPath = path.join(SCREENSHOT_DIR, 'input-cabin-full.png')
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    })

    // 验证截图文件已生成（通过断言不抛异常即可）
    console.info(`[MCP-Verify] 全页截图已保存: ${screenshotPath}`)
  })

  test('playwright_screenshot: 应成功截取视口截图', async ({ page }) => {
    await page.goto(TARGET_ROUTE)
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })

    // 等价于 MCP 工具 playwright_screenshot({ fullPage: false })
    const screenshotPath = path.join(SCREENSHOT_DIR, 'input-cabin-viewport.png')
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    })

    console.info(`[MCP-Verify] 视口截图已保存: ${screenshotPath}`)
  })

  test('playwright_navigate + playwright_screenshot: 导航后立即截图', async ({ page }) => {
    // 组合验证：导航 → 截图，模拟 MCP 工具链式调用
    const routes = [
      { url: '/#/input', name: 'input' },
      { url: '/#/analysis', name: 'analysis' },
      { url: '/#/output', name: 'output' },
    ]

    for (const route of routes) {
      await page.goto(route.url)
      const screenshotPath = path.join(SCREENSHOT_DIR, `${route.name}-cabin.png`)
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      })
      console.info(`[MCP-Verify] ${route.name} 舱截图已保存: ${screenshotPath}`)
    }
  })
})
