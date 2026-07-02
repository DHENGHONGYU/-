import { test, expect } from '@playwright/test'

test.describe('交易复盘流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/trading/hub')
    await expect(page.locator('text=交易及持仓')).toBeVisible()
  })

  test('交易舱首页应展示核心功能模块', async ({ page }) => {
    await expect(page.locator('text=交易信号')).toBeVisible()
    await expect(page.locator('text=模拟持仓')).toBeVisible()
    await expect(page.locator('text=策略快照')).toBeVisible()
  })

  test('交易舱首页应展示 AI 交易复盘扩展入口', async ({ page }) => {
    await expect(page.locator('text=AI 交易复盘')).toBeVisible()
    await expect(page.locator('text=六维报告、纪律评分、行动计划')).toBeVisible()
  })

  test('点击模拟持仓卡片应进入持仓管理页面', async ({ page }) => {
    await page.locator('text=模拟持仓').click()
    await expect(page.locator('text=交易持仓管理')).toBeVisible()
  })

  test('持仓管理页面应展示筛选区域', async ({ page }) => {
    await page.goto('/#/trading/holdings')
    await expect(page.locator('text=交易持仓管理')).toBeVisible()
  })

  test('持仓管理页面应展示面包屑导航', async ({ page }) => {
    await page.goto('/#/trading/holdings')
    await expect(page.locator('text=首页')).toBeVisible()
    await expect(page.locator('text=交易舱')).toBeVisible()
    await expect(page.locator('text=持仓管理')).toBeVisible()
  })

  test('持仓管理页面应展示持仓记录统计', async ({ page }) => {
    await page.goto('/#/trading/holdings')
    await expect(page.locator('text=条持仓记录')).toBeVisible()
  })

  test('从侧边栏导航可进入持仓页面', async ({ page }) => {
    await page.goto('/#/trading/hub')
    await page.locator('button:has-text("模拟持仓")').click()
    await expect(page.locator('text=交易持仓管理')).toBeVisible()
  })

  test('从侧边栏导航可进入策略快照页面', async ({ page }) => {
    await page.goto('/#/trading/hub')
    await page.locator('button:has-text("策略快照")').click()
    await expect(page.locator('text=策略快照')).toBeVisible()
  })

  test('驾驶舱应展示 AI 交易复盘组件', async ({ page }) => {
    await page.goto('/#/cockpit')
    await expect(page.locator('text=AI 交易复盘')).toBeVisible()
  })

  test('AI 交易复盘组件应展示核心指标', async ({ page }) => {
    await page.goto('/#/cockpit')
    await expect(page.locator('text=总交易数')).toBeVisible()
    await expect(page.locator('text=胜率')).toBeVisible()
    await expect(page.locator('text=盈亏比')).toBeVisible()
    await expect(page.locator('text=纪律评分')).toBeVisible()
  })

  test('AI 交易复盘组件应展示 AI 深度洞察区域', async ({ page }) => {
    await page.goto('/#/cockpit')
    await expect(page.locator('text=AI 深度洞察')).toBeVisible()
  })

  test('AI 交易复盘组件应展示行动建议区域', async ({ page }) => {
    await page.goto('/#/cockpit')
    await expect(page.locator('text=行动建议')).toBeVisible()
  })

  test('交易舱首页面包屑导航正确', async ({ page }) => {
    await expect(page.locator('text=首页')).toBeVisible()
    await expect(page.locator('text=交易舱')).toBeVisible()
  })
})
