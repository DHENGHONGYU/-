import { test, expect } from '@playwright/test'

test.describe('个股评分流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/analysis/hub')
    await expect(page.locator('text=行业个股分析')).toBeVisible()
  })

  test('进入分析舱首页应展示 V6 个股评分入口', async ({ page }) => {
    await expect(page.locator('text=V6 个股评分')).toBeVisible()
    await expect(page.locator('text=个股九维评分批量运行与结果查看')).toBeVisible()
  })

  test('点击 V6 个股评分卡片应进入个股评分页面', async ({ page }) => {
    await page.locator('text=V6 个股评分').click()
    await expect(page.locator('text=个股分析')).toBeVisible()
  })

  test('未指定股票代码时应显示提示信息', async ({ page }) => {
    await page.goto('/#/analysis/stock-score')
    await expect(page.locator('text=请指定股票代码')).toBeVisible()
  })

  test('带股票代码参数访问应加载股票信息', async ({ page }) => {
    await page.goto('/#/analysis/stock-score/600519.SH')
    await expect(page.locator('text=600519.SH')).toBeVisible()
  })

  test('股票信息卡片应展示关键指标', async ({ page }) => {
    await page.goto('/#/analysis/stock-score/600519.SH')
    await expect(page.locator('text=最新价')).toBeVisible()
    await expect(page.locator('text=PE')).toBeVisible()
    await expect(page.locator('text=PB')).toBeVisible()
    await expect(page.locator('text=K线数据')).toBeVisible()
  })

  test('应展示运行 V6 评分按钮', async ({ page }) => {
    await page.goto('/#/analysis/stock-score/600519.SH')
    await expect(page.locator('button:has-text("运行 V6 评分")')).toBeVisible()
  })

  test('智能评分页面应展示标的选择下拉框', async ({ page }) => {
    await page.goto('/#/analysis/intelligent-score')
    await expect(page.locator('text=V6 个股智能评分')).toBeVisible()
    await expect(page.locator('text=选择标的')).toBeVisible()
  })

  test('智能评分页面应展示 LLM 配置区域', async ({ page }) => {
    await page.goto('/#/analysis/intelligent-score')
    await expect(page.locator('text=AI 调用透明度面板')).toBeVisible()
  })

  test('智能评分页面应展示补充资料上传区域', async ({ page }) => {
    await page.goto('/#/analysis/intelligent-score')
    await expect(page.locator('text=补充资料上传')).toBeVisible()
  })

  test('智能评分页面应展示评分进度区域', async ({ page }) => {
    await page.goto('/#/analysis/intelligent-score')
    await expect(page.locator('text=评分进度')).toBeVisible()
  })

  test('从侧边栏导航可进入个股评分页面', async ({ page }) => {
    await page.goto('/#/analysis/hub')
    await page.locator('button:has-text("V6 个股评分")').click()
    await expect(page.locator('text=个股分析')).toBeVisible()
  })

  test('从侧边栏导航可进入智能评分页面', async ({ page }) => {
    await page.goto('/#/analysis/hub')
    await page.locator('button:has-text("V6 个股智能评分")').click()
    await expect(page.locator('text=V6 个股智能评分')).toBeVisible()
  })
})
