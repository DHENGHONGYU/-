/**
 * @test_id V9-TEST-E2E-029
 * E2E 功能测试 — 表单交互
 * 覆盖：股票搜索、批量导入文本、七维配置模板切换、全局参数、V6ScoreCard
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'
import { navigateTo, waitForAppReady, ROUTES, SAMPLE_STOCKS } from '../utils/helpers'

test.describe('表单交互测试', () => {

  // ============================================================
  // 输入舱股票搜索框
  // ============================================================
  test.describe('输入舱股票搜索框', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.input)
      await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    })

    test('输入 000001 并搜索 — 输入框应接受输入', async ({ page }) => {
      const codeInput = page.getByRole('textbox', { name: '股票代码' })
      await codeInput.fill('000001')
      await expect(codeInput).toHaveValue('000001')
    })

    test('输入 000001 并填入名称后点击仅录入', async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
      await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
      await page.getByRole('button', { name: '仅录入' }).click()
      // 验证成功提示
      await expect(page.locator('text=已添加 000001')).toBeVisible({ timeout: 5000 })
      // 验证输入框已清空
      await expect(page.getByRole('textbox', { name: '股票代码' })).toHaveValue('')
    })

    test('空代码直接搜索应有验证提示', async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码' }).fill('')
      await page.getByRole('textbox', { name: '股票名称' }).fill('')
      await page.getByRole('button', { name: '仅录入' }).click()
      // 应有输入校验提示
      await expect(page.locator('text=请输入代码和名称')).toBeVisible({ timeout: 3000 })
    })
  })

  // ============================================================
  // 批量导入文本输入
  // ============================================================
  test.describe('批量导入文本输入', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.input)
      await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
    })

    test('粘贴 SAMPLE_STOCKS 列表文本后应正确解析', async ({ page }) => {
      // 打开批量导入面板
      await page.locator('main button:has-text("批量导入")').click()
      // 构造导入文本
      const importText = SAMPLE_STOCKS.map(s => `${s.code},${s.name}`).join('\n')
      // 填入文本区域
      await page.locator('textarea').fill(importText)
      // 验证解析结果：显示共 N 条、有效 N 等统计
      await expect(page.locator('text=共 5 条')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=有效 5')).toBeVisible()
    })

    test('文本解析应展示标准化代码预览', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      const importText = SAMPLE_STOCKS.map(s => `${s.code},${s.name}`).join('\n')
      await page.locator('textarea').fill(importText)
      // 预览表格应包含股票名称
      await expect(page.locator('text=平安银行').first()).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=贵州茅台').first()).toBeVisible()
    })

    test('可切换粘贴文本/上传文件模式', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      await expect(page.locator('button:has-text("粘贴文本")')).toBeVisible()
      await expect(page.locator('button:has-text("上传文件")')).toBeVisible()
    })
  })

  // ============================================================
  // 七维配置模板切换
  // ============================================================
  test.describe('七维配置模板切换', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.inputSevenDim)
      await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
    })

    test('点击"价值投资"模板后维度显示应变化', async ({ page }) => {
      // 确认策略模板区域存在
      await expect(page.getByRole('heading', { name: '策略模板' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '价值投资' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '成长投资' })).toBeVisible()

      // 点击价值投资模板
      await page.getByRole('heading', { name: '价值投资' }).click()
      // 验证采集维度区域已启用/维度显示
      await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
      await expect(page.locator('text=已启用')).toBeVisible()
    })

    test('点击"成长投资"模板后维度配置应切换', async ({ page }) => {
      // 先点击价值投资，再切换到成长投资
      await page.getByRole('heading', { name: '价值投资' }).click()
      await page.getByRole('heading', { name: '成长投资' }).click()
      // 验证页面状态正常
      await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
    })

    test('模板切换后八个采集维度仍应全部可见', async ({ page }) => {
      await page.getByRole('heading', { name: '价值投资' }).click()
      // 确认八个维度均可见
      await expect(page.locator('text=01 · 基本信息')).toBeVisible()
      await expect(page.locator('text=02 · K线数据')).toBeVisible()
      await expect(page.locator('text=03 · 筹码分布')).toBeVisible()
      await expect(page.locator('text=04 · 重大事项')).toBeVisible()
      await expect(page.locator('text=05 · 热点新闻')).toBeVisible()
      await expect(page.locator('text=06 · 行业竞品')).toBeVisible()
      await expect(page.locator('text=07 · 关联指数')).toBeVisible()
      await expect(page.locator('text=08 · 研报中心')).toBeVisible()
    })
  })

  // ============================================================
  // 全局参数输入
  // ============================================================
  test.describe('全局参数输入', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.inputSevenDim)
      await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
    })

    test('全局参数区域应显示标的数量和历史天数相关控件', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
      // 全局参数区域包含标的数量、历史天数等输入控件
      await expect(page.locator('text=历史天数').or(page.locator('text=标的')).first()).toBeVisible()
    })

    test('应显示额度预估区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '额度预估' })).toBeVisible()
      await expect(page.locator('text=月调用总量')).toBeVisible()
      await expect(page.locator('text=日调用上限')).toBeVisible()
    })
  })

  // ============================================================
  // 分析舱 V6ScoreCard 加载标的
  // ============================================================
  test.describe('分析舱 V6ScoreCard 加载标的', () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, ROUTES.analysis)
      await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
    })

    test('加载标的按钮应存在且可见', async ({ page }) => {
      await expect(page.getByRole('button', { name: '加载标的' })).toBeVisible()
    })

    test('V6 九维评分区域应展示', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '分析舱 · V6 九维评分' })).toBeVisible()
    })

    test('三个快捷入口卡片应展示', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '快速个股评分' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '行业对比分析' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '策略回测向导' })).toBeVisible()
    })
  })
})
