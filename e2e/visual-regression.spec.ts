/**
 * @module e2e/visual-regression
 * @description 视觉回归测试：为各舱核心页面建立截图基线并做 diff。
 *
 * @workflow
 * 1. 首次运行生成基线：`npm run test:e2e -- e2e/visual-regression.spec.ts --update-snapshots`
 * 2. 日常回归比对：`npm run test:e2e -- e2e/visual-regression.spec.ts`
 * 3. 基线存储路径：`e2e/__snapshots__/visual-regression.spec.ts-snapshots/`
 *
 * @tips
 * - 仅使用 chromium 项目（playwright.config.ts 已限定），避免跨浏览器字体渲染差异。
 * - 截图前等待网络空闲与关键元素可见，降低动画/数据加载导致的抖动。
 * - 若界面有意的 redesign 导致 diff，使用 --update-snapshots 重新冻结基线。
 */

import { test, expect } from '@playwright/test'

/** 等待页面稳定：网络空闲 + 关键标题可见（取第一个匹配） */
async function waitForPageStable(page: import('@playwright/test').Page, headingPattern: RegExp): Promise<void> {
  await page.waitForLoadState('networkidle')
  const heading = page.getByRole('heading', { name: headingPattern }).first()
  await expect(heading).toBeVisible()
  // 给骨架屏/微动画留出最后渲染时间
  await page.waitForTimeout(300)
}

test.describe('视觉回归 - 核心舱页面', () => {
  test('输入舱页面', async ({ page }) => {
    await page.goto('/input')
    await waitForPageStable(page, /输入舱/i)
    await expect(page).toHaveScreenshot('input-cabin.png', { fullPage: true })
  })

  test('分析舱页面', async ({ page }) => {
    await page.goto('/analysis')
    await waitForPageStable(page, /分析舱/i)
    await expect(page).toHaveScreenshot('analysis-cabin.png', { fullPage: true })
  })

  test('交易舱页面', async ({ page }) => {
    await page.goto('/trading')
    await waitForPageStable(page, /交易舱/i)
    await expect(page).toHaveScreenshot('trading-cabin.png', { fullPage: true })
  })

  test('输出舱页面', async ({ page }) => {
    await page.goto('/output')
    await waitForPageStable(page, /输出舱/i)
    await expect(page).toHaveScreenshot('output-cabin.png', { fullPage: true })
  })

  test('总控舱页面', async ({ page }) => {
    await page.goto('/command')
    await waitForPageStable(page, /总控舱/i)
    await expect(page).toHaveScreenshot('command-cabin.png', { fullPage: true })
  })

  test('架构健康度仪表盘', async ({ page }) => {
    await page.goto('/command/health')
    await waitForPageStable(page, /架构健康度/i)
    await expect(page).toHaveScreenshot('command-health.png', { fullPage: true })
  })
})
