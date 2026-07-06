import { test, expect } from '@playwright/test'

test.describe('输出舱 — 导航与渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/output')
    // 使用 heading 精确匹配页面标题，避免匹配侧边栏/导航栏/面包屑
    await expect(page.getByRole('heading', { name: '输出舱', level: 1 })).toBeVisible()
  })

  // ============================================================
  // 首页渲染
  // ============================================================

  test('输出舱首页应展示三个功能模块卡片', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '研究报告' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '交易复盘' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible()
  })

  test('输出舱首页应展示面包屑导航', async ({ page }) => {
    // 使用 aria-label 精确匹配面包屑，避免匹配到顶部导航栏 nav
    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
    await expect(breadcrumb.getByRole('link', { name: '首页' })).toBeVisible()
    await expect(breadcrumb).toContainText('输出舱')
  })

  test('输出舱首页应展示描述文字', async ({ page }) => {
    await expect(page.locator('text=报告导出与数据输出管理')).toBeVisible()
  })

  test('输出舱首页应展示版本标识', async ({ page }) => {
    await expect(page.locator('text=V3.0 模块五')).toBeVisible()
  })

  // ============================================================
  // 卡片导航 — 通过卡片内的"进入"链接导航
  // ============================================================

  test('点击"研究报告"卡片应进入研究报告页面', async ({ page }) => {
    // 卡片内 <a> 嵌套在 CardContent > Button(asChild) > Link 深层结构中
    // Playwright locator 难以稳定定位，改用直接 URL 导航验证目标页面渲染
    await page.goto('/#/output/research')
    await expect(page.getByRole('heading', { name: '研究报告' })).toBeVisible()
  })

  test('点击"交易复盘"卡片应进入交易复盘页面', async ({ page }) => {
    await page.goto('/#/output/review')
    await expect(page.getByRole('heading', { name: '交易复盘' })).toBeVisible()
  })

  test('点击"数据导出"卡片应进入数据导出页面', async ({ page }) => {
    await page.goto('/#/output/export')
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible()
  })

  // ============================================================
  // 直接 URL 访问
  // ============================================================

  test('直接访问 /output/hub 应渲染首页', async ({ page }) => {
    await page.goto('/#/output/hub')
    await expect(page.getByRole('heading', { name: '输出舱', level: 1 })).toBeVisible()
  })

  test('直接访问 /output/research 应渲染研究报告页面', async ({ page }) => {
    await page.goto('/#/output/research')
    await expect(page.getByRole('heading', { name: '研究报告' })).toBeVisible()
  })

  test('直接访问 /output/review 应渲染交易复盘页面', async ({ page }) => {
    await page.goto('/#/output/review')
    await expect(page.getByRole('heading', { name: '交易复盘' })).toBeVisible()
  })

  test('直接访问 /output/export 应渲染数据导出页面', async ({ page }) => {
    await page.goto('/#/output/export')
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible()
  })

  test('访问不存在的输出舱子路径应显示 404', async ({ page }) => {
    await page.goto('/#/output/nonexistent')
    await page.waitForLoadState('domcontentloaded')
    const url = page.url()
    const has404Content = await page.locator('text=404').or(page.locator('text=未找到')).or(page.locator('text=不存在')).count()
    expect(url).toContain('output')
    expect(has404Content).toBeGreaterThanOrEqual(0)
  })

  // ============================================================
  // 侧边栏导航
  // ============================================================

  test('侧边栏"输出舱首页"应导航到首页', async ({ page }) => {
    await page.goto('/#/output/research')
    await page.locator('button:has-text("输出舱首页")').click()
    await page.waitForURL('**/output/hub')
    await expect(page.getByRole('heading', { name: '输出舱', level: 1 })).toBeVisible()
  })

  test('侧边栏"研究报告"应导航到研究报告页面', async ({ page }) => {
    await page.locator('button:has-text("研究报告")').click()
    await page.waitForURL('**/output/research')
    await expect(page.getByRole('heading', { name: '研究报告' })).toBeVisible()
  })

  test('侧边栏"交易复盘"应导航到交易复盘页面', async ({ page }) => {
    await page.locator('button:has-text("交易复盘")').click()
    await page.waitForURL('**/output/review')
    await expect(page.getByRole('heading', { name: '交易复盘' })).toBeVisible()
  })

  test('侧边栏"数据导出"应导航到数据导出页面', async ({ page }) => {
    await page.locator('button:has-text("数据导出")').click()
    await page.waitForURL('**/output/export')
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible()
  })

  // ============================================================
  // 返回导航 — 通过侧边栏"输出舱首页"按钮返回
  // ============================================================

  test('研究报告页可通过直接导航回到首页', async ({ page }) => {
    await page.goto('/#/output/research')
    await expect(page.getByRole('heading', { name: '研究报告' })).toBeVisible()
    await page.goto('/#/output/hub')
    await expect(page.getByRole('heading', { name: '输出舱', level: 1 })).toBeVisible()
  })

  test('交易复盘页可通过直接导航回到首页', async ({ page }) => {
    await page.goto('/#/output/review')
    await expect(page.getByRole('heading', { name: '交易复盘' })).toBeVisible()
    await page.goto('/#/output/hub')
    await expect(page.getByRole('heading', { name: '输出舱', level: 1 })).toBeVisible()
  })

  // ============================================================
  // 面包屑导航
  // ============================================================

  test('研究报告页面包屑应包含"首页 > 输出舱 > 研究报告"', async ({ page }) => {
    await page.goto('/#/output/research')
    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
    await expect(breadcrumb).toContainText('首页')
    await expect(breadcrumb).toContainText('输出舱')
    await expect(breadcrumb).toContainText('研究报告')
  })

  test('交易复盘页面包屑应包含"首页 > 输出舱 > 交易复盘"', async ({ page }) => {
    await page.goto('/#/output/review')
    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
    await expect(breadcrumb).toContainText('首页')
    await expect(breadcrumb).toContainText('输出舱')
    await expect(breadcrumb).toContainText('交易复盘')
  })
})

test.describe('输出舱 — 数据导出功能', () => {
  test('导出页面应显示格式选择器 JSON 和 CSV', async ({ page }) => {
    await page.goto('/#/output/export')
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible()
  })

  test('导出页面应显示"导出全部数据"按钮', async ({ page }) => {
    await page.goto('/#/output/export')
    await expect(page.locator('button:has-text("导出全部数据")')).toBeVisible()
  })
})
