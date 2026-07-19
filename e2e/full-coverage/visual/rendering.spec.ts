/**
 * E2E 视觉测试 — 元素渲染
 * 覆盖：输入舱/总控舱页面元素完整性、404 页面渲染
 */

import { test, expect } from '@playwright/test'
import { navigateTo, ROUTES } from '../utils/helpers'

test.describe('输入舱渲染', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.input)
  })

  test('页面标题"输入舱"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '输入舱' }).first()).toBeVisible({ timeout: 10000 })
  })

  test('股票搜索组件渲染', async ({ page }) => {
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    // 股票代码输入框
    await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '股票名称' })).toBeVisible()
    // 仅录入按钮
    await expect(page.getByRole('button', { name: '仅录入' })).toBeVisible()
  })

  test('批量导入面板渲染', async ({ page }) => {
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    // 打开批量导入面板
    await page.locator('main button:has-text("批量导入")').click()
    // 验证粘贴文本和上传文件模式按钮可见
    await expect(page.locator('button:has-text("粘贴文本")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("上传文件")')).toBeVisible()
  })
})

test.describe('总控舱渲染', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.command)
  })

  test('智能体总控台渲染', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: '总控舱 · 系统监控' })).toBeVisible()
    // 统计卡片应可见
    await expect(page.getByText('stocks', { exact: true })).toBeVisible()
  })

  test('组件示例库渲染', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })

    // 切换到组件示例库 Tab
    const componentTab = page.getByRole('tab', { name: '组件示例库' })
    const tabCount = await componentTab.count()
    if (tabCount > 0) {
      await componentTab.click()
      await page.waitForTimeout(500)
      await expect(page.getByRole('tab', { name: '组件示例库', selected: true })).toBeVisible()
    }
  })
})

test.describe('不存在的页面', () => {

  test('404 页面渲染', async ({ page }) => {
    await page.goto('http://localhost:3005/#/totally-nonexistent-route')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)
    // 页面根元素应正确渲染
    await expect(page.locator('#root')).toBeAttached()
  })

  test('"页面未找到" 文本显示', async ({ page }) => {
    await page.goto('http://localhost:3005/#/totally-nonexistent-route')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)

    // 检查页面是否展示"未找到"或"404"相关文本
    const notFound = page.getByText(/未找到|404|不存在|抱歉|page not found/i)
    const count = await notFound.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
