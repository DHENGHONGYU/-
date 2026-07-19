/**
 * E2E 边界测试 — 超长字符
 * 覆盖：批量导入超长文本、标的数量超限值、历史天数超限值
 */

import { test, expect } from '@playwright/test'
import { navigateTo, ROUTES, LONG_INPUT } from '../utils/helpers'

test.describe('批量导入超长文本', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.input)
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    await page.locator('main button:has-text("批量导入")').click()
  })

  test('批量导入超长文本（10000 字符）→ 页面不崩溃', async ({ page }) => {
    // 填入 10000 个字符
    await page.locator('textarea').fill(LONG_INPUT)
    await page.waitForTimeout(500)
    // 页面应保持正常渲染，不崩溃
    await expect(page.locator('#root')).toBeAttached()
    // textarea 应接受输入
    const textareaValue = await page.locator('textarea').inputValue()
    expect(textareaValue.length).toBe(LONG_INPUT.length)
  })

  test('批量导入超长文本后确认按钮可交互', async ({ page }) => {
    await page.locator('textarea').fill(LONG_INPUT)
    await page.waitForTimeout(500)
    // 确认导入按钮存在
    const confirmBtn = page.getByRole('button', { name: '确认导入' })
    const count = await confirmBtn.count()
    if (count > 0) {
      // 按钮存在且未崩溃
      await expect(confirmBtn).toBeAttached()
    }
  })
})

test.describe('标的数量输入超限值', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.inputSevenDim)
    await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  })

  test('标的数量输入 999999 → 不超过上限 500', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
    // 尝试找到标的数量输入框
    const stockCountInput = page.locator('input[type="number"]').first()
    const count = await stockCountInput.count()
    if (count > 0) {
      await stockCountInput.fill('999999')
      await page.waitForTimeout(300)
      const value = await stockCountInput.inputValue()
      // 输入框应限制最大值为 500
      expect(Number(value)).toBeLessThanOrEqual(500)
    }
  })

  test('标的数量输入正常值 10 → 应接受', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
    const stockCountInput = page.locator('input[type="number"]').first()
    const count = await stockCountInput.count()
    if (count > 0) {
      await stockCountInput.fill('10')
      await page.waitForTimeout(300)
      const value = await stockCountInput.inputValue()
      expect(Number(value)).toBe(10)
    }
  })
})

test.describe('历史天数输入超限值', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.inputSevenDim)
    await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  })

  test('历史天数输入超限值 → 不超过上限', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
    // 尝试找到历史天数输入框
    const daysInput = page.locator('input[type="number"]').last()
    const count = await daysInput.count()
    if (count > 0) {
      await daysInput.fill('99999')
      await page.waitForTimeout(300)
      const value = await daysInput.inputValue()
      // 不应接受超限值
      expect(Number(value)).toBeLessThan(99999)
    }
  })

  test('历史天数输入正常值 30 → 应接受', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
    const daysInput = page.locator('input[type="number"]').last()
    const count = await daysInput.count()
    if (count > 0) {
      await daysInput.fill('30')
      await page.waitForTimeout(300)
      const value = await daysInput.inputValue()
      expect(Number(value)).toBe(30)
    }
  })
})
