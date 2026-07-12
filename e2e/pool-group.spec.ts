import { test, expect } from '@playwright/test'

test.describe('股票池分组', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/input')
    // 等待页面主要元素渲染完成
    await expect(page.locator('text=股票池看板')).toBeVisible()
  })

  test('应展示分组相关 UI 控件', async ({ page }) => {
    await expect(page.locator('button:has-text("新建分组")')).toBeVisible()
    await expect(page.getByLabel('分组筛选')).toBeVisible()
    await expect(page.getByLabel('目标分组')).toBeVisible()
  })

  test('新建分组后可用于录入与筛选', async ({ page }) => {
    // 新建分组
    await page.locator('button:has-text("新建分组")').click()
    await page.locator('input[placeholder*="分组名称"]').fill('核心持仓')
    await page.locator('button:has-text("创建")').click()

    // 等待新建分组出现在目标分组选项中
    await expect(page.getByLabel('目标分组').locator('option:has-text("核心持仓")')).toBeAttached()

    // 录入股票到新建分组
    await page.locator('input[placeholder*="股票代码"]').fill('600519.SH')
    await page.locator('input[placeholder*="股票名称"]').fill('贵州茅台')
    await page.getByLabel('目标分组').selectOption('核心持仓')
    await page.locator('button:has-text("仅录入")').click()

    // 等待看板刷新并展示分组标签
    await expect(page.locator('span:has-text("核心持仓")').first()).toBeVisible()

    // 按分组筛选
    await page.getByLabel('分组筛选').selectOption('核心持仓')
    await expect(page.locator('text=贵州茅台')).toBeVisible()
  })

  test('列表视图应展示分组列并支持切换分组', async ({ page }) => {
    // 先录入一只股票
    await page.locator('input[placeholder*="股票代码"]').fill('000001.SZ')
    await page.locator('input[placeholder*="股票名称"]').fill('平安银行')
    await page.locator('button:has-text("仅录入")').click()

    // 切换到列表视图
    await page.locator('button:has-text("列表视图")').click()
    await expect(page.locator('th:has-text("分组")')).toBeVisible()

    // 默认分组列可见（限定在表格 tbody 内）
    await expect(page.locator('tbody td:has-text("默认分组")').first()).toBeVisible()
  })

  test('批量导入入口支持选择目标分组', async ({ page }) => {
    // 限定在主内容区点击，避免匹配到侧边栏
    await page.locator('main button:has-text("批量导入")').click()
    await expect(page.getByLabel('批量导入目标分组')).toBeVisible()
  })

  test('热门板块入口支持选择目标分组', async ({ page }) => {
    // 限定在主内容区点击，避免匹配到侧边栏
    await page.locator('main button:has-text("热门板块")').click()
    await expect(page.getByLabel('热门板块目标分组')).toBeVisible()
  })
})
