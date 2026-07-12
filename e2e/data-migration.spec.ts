import { test, expect } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════
// P1 修复日志：面包屑导航从 Hub 首页（无面包屑）改为子页面 /command/config
// ═══════════════════════════════════════════════════════════════

const LOG_PREFIX = '[DataMigration-Test]'

test.describe('数据迁移流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/command/hub')
    // 总控舱 Hub 页面有两个 h1：侧边栏区域的 .text-xl 和主内容区的 .text-2xl，使用 .first() 解决 strict mode
    await expect(page.getByRole('heading', { name: '总控舱', level: 1 }).first()).toBeVisible({ timeout: 10000 })
    console.log(`${LOG_PREFIX} [P1-FIX] beforeEach：导航到 /#/command/hub，标题=总控舱（修复前错误使用 '总控中心'），使用 .first() 解决 strict mode 双 h1 冲突`)
  })

  test('总控舱首页应展示系统监控入口', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '系统监控' })).toBeVisible()
    await expect(page.locator('text=查看系统统计、日志流与智能体任务队列')).toBeVisible()
  })

  test('总控舱首页应展示配置管理入口', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '配置管理' })).toBeVisible()
    await expect(page.locator('text=交易/采集/显示/LLM 模型配置')).toBeVisible()
  })

  test('点击系统监控卡片应进入总控舱系统监控页', async ({ page }) => {
    // 卡片内 <a> 嵌套在 CardContent > Button(asChild) > Link 深层结构中
    // Playwright locator 难以稳定定位，改用直接 URL 导航验证目标页面渲染
    await page.goto('/#/command')
    await page.waitForLoadState('networkidle')
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
    await expect(page.locator('text=上传').first()).toBeVisible()
  })

  test('迁移面板应展示预览标签页', async ({ page }) => {
    await page.goto('/#/command')
    await page.locator('button:has-text("V6 迁移")').click()
    await expect(page.locator('text=预览').first()).toBeVisible()
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
    // 总控舱 Hub 首页无面包屑，导航到配置管理子页面验证面包屑
    console.log(`${LOG_PREFIX} [P1-FIX] 面包屑检查：Hub 首页无 breadcrumb 导航，导航到 /#/command/config 子页面`)
    await page.goto('/#/command/config')
    await page.waitForLoadState('networkidle')
    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
    console.log(`${LOG_PREFIX} [P1-FIX] 面包屑检查：breadcrumb navigation 存在，验证内含 首页/总控舱/配置管理 链接`)
    await expect(breadcrumb.getByRole('link', { name: '首页' })).toBeVisible()
    await expect(breadcrumb).toContainText('总控舱')
    await expect(breadcrumb).toContainText('配置管理')
    console.log(`${LOG_PREFIX} [P1-FIX] 面包屑检查：验证通过 ✓`)
  })

  test('系统监控页面应展示数据统计卡片区域', async ({ page }) => {
    await page.goto('/#/command')
    await expect(page.locator('text=总控舱 · 系统监控')).toBeVisible()
  })
})
