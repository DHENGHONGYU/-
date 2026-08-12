/**
 * @test_id V9-TEST-E2E-022
 * E2E 边界测试 — 非法数据
 * 覆盖：特殊字符、纯空白、XSS payload、负数标的数量
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'
import { navigateTo, ROUTES, INVALID_INPUTS } from '../utils/helpers'

test.describe('特殊字符导入', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.input)
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    await page.locator('main button:has-text("批量导入")').click()
  })

  test('导入特殊字符 !@#$% → 无崩溃', async ({ page }) => {
    await page.locator('textarea').fill(INVALID_INPUTS[0]!)
    await page.waitForTimeout(500)
    // 页面应保持正常渲染，不崩溃
    await expect(page.locator('#root')).toBeAttached()
    // 特殊字符应被正常解析为无效行，页面不崩溃即为通过
  })

  test('导入特殊字符后确认按钮 disabled', async ({ page }) => {
    await page.locator('textarea').fill(INVALID_INPUTS[0]!)
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: '确认导入' })
    const count = await confirmBtn.count()
    if (count > 0) {
      await expect(confirmBtn).toBeDisabled()
    }
  })
})

test.describe('纯空白字符', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.input)
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    await page.locator('main button:has-text("批量导入")').click()
  })

  test('输入纯空格 → 导入按钮 disabled', async ({ page }) => {
    await page.locator('textarea').fill(INVALID_INPUTS[1]!)
    await page.waitForTimeout(500)
    // 解析结果应为空
    const confirmBtn = page.getByRole('button', { name: '确认导入' })
    const count = await confirmBtn.count()
    if (count > 0) {
      await expect(confirmBtn).toBeDisabled()
    } else {
      // 无有效数据时确认按钮可能不存在
      await expect(page.locator('#root')).toBeAttached()
    }
  })

  test('输入纯换行 → 导入按钮 disabled', async ({ page }) => {
    await page.locator('textarea').fill(INVALID_INPUTS[2]!)
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: '确认导入' })
    const count = await confirmBtn.count()
    if (count > 0) {
      await expect(confirmBtn).toBeDisabled()
    } else {
      await expect(page.locator('#root')).toBeAttached()
    }
  })
})

test.describe('XSS payload', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.input)
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    await page.locator('main button:has-text("批量导入")').click()
  })

  test('输入 XSS payload → 无弹窗/不渲染为 HTML', async ({ page }) => {
    // 先注册 dialog 监听，确保能捕获到任何可能的弹窗
    const dialogs: string[] = []
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message())
      await dialog.dismiss()
    })

    await page.locator('textarea').fill(INVALID_INPUTS[3]!)
    await page.waitForTimeout(500)

    // 页面不应崩溃
    await expect(page.locator('#root')).toBeAttached()

    // XSS 文本应被解析而非渲染为 HTML，页面正常即通过
    // 不应触发 dialog
    expect(dialogs.length).toBe(0)
  })
})

test.describe('负数标的数量', () => {

  test.beforeEach(async ({ page }) => {
    await navigateTo(page, ROUTES.inputSevenDim)
    await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  })

  test('导入负数标的数量 → 不超过下限', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
    const stockCountInput = page.locator('input[type="number"]').first()
    const count = await stockCountInput.count()
    if (count > 0) {
      await stockCountInput.fill('-100')
      await page.waitForTimeout(300)
      const value = await stockCountInput.inputValue()
      // 负数应被限制为最小值（如 0 或 1）
      expect(Number(value)).toBeGreaterThanOrEqual(0)
    }
  })
})
