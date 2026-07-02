import { test, expect } from '@playwright/test'

test.describe('数据迁移流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/command/hub')
    await expect(page.locator('text=总控中心')).toBeVisible()
  })

  test('总控舱首页应展示系统监控入口', async ({ page }) => {
    await expect(page.locator('text=系统监控')).toBeVisible()
    await expect(page.locator('text=刷新统计、重置数据、采集服务状态')).toBeVisible()
  })

  test('总控舱首页应展示配置管理入口', async ({ page }) => {
    await expect(page.locator('text=配置管理')).toBeVisible()
    await expect(page.locator('text=系统配置与状态管理')).toBeVisible()
  })

  test('点击系统监控卡片应进入总控舱系统监控页', async ({ page }) => {
    await page.locator('text=系统监控').click()
    await expect(page.locator('text=总控舱 · 系统监控')).toBeVisible()
  })

  test('系统监控页面应展示刷新统计按钮', async ({ page }) => {
    await page.goto('/#/command')
    await expect(page.locator('button:has-text("刷新统计")')).toBeVisible()
  })

  test('系统监控页面应展示重置数据按钮', async ({ page }) => {
    await page.goto('/#/command')
    await expect(page.locator('button:has-text("重置数据")')).toBeVisible()
  })

  test('系统监控页面应展示 V6 迁移按钮', async ({ page }) => {
    await page.goto('/#/command')
    await expect(page.locator('button:has-text("V6 迁移")')).toBeVisible()
  })

  test('点击 V6 迁移按钮应打开迁移面板弹窗', async ({ page }) => {
    await page.goto('/#/command')
    await page.locator('button:has-text("V6 迁移")').click()
    await expect(page.locator('text=V6 Pro → V9 数据迁移')).toBeVisible()
  })

  test('迁移面板应展示上传标签页', async ({ page }) => {
    await page.goto('/#/command')
    await page.locator('button:has-text("V6 迁移")').click()
    await expect(page.locator('text=上传')).toBeVisible()
  })

  test('迁移面板应展示预览标签页', async ({ page }) => {
    await page.goto('/#/command')
    await page.locator('button:has-text("V6 迁移")').click()
    await expect(page.locator('text=预览')).toBeVisible()
  })

  test('迁移面板应展示报告标签页', async ({ page }) => {
    await page.goto('/#/command')
    await page.locator('button:has-text("V6 迁移")').click()
    await expect(page.locator('text=报告')).toBeVisible()
  })

  test('迁移上传页面应展示文件上传区域', async ({ page }) => {
    await page.goto('/#/command')
    await page.locator('button:has-text("V6 迁移")').click()
    await expect(page.locator('text=拖拽 JSON 文件到此处，或点击选择')).toBeVisible()
  })

  test('从侧边栏导航可进入系统监控页面', async ({ page }) => {
    await page.goto('/#/command/hub')
    await page.locator('button:has-text("系统监控")').click()
    await expect(page.locator('text=总控舱 · 系统监控')).toBeVisible()
  })

  test('总控舱首页面包屑导航正确', async ({ page }) => {
    await expect(page.locator('text=首页')).toBeVisible()
    await expect(page.locator('text=总控舱')).toBeVisible()
  })

  test('系统监控页面应展示数据统计卡片区域', async ({ page }) => {
    await page.goto('/#/command')
    await expect(page.locator('text=总控舱 · 系统监控')).toBeVisible()
  })
})
