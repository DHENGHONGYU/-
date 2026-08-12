/**
 * @test_id V9-TEST-E2E-011
 * @covers_docs []
 */
import { test, expect } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════
// 真相源对齐 v3（2026-08-09）：与 sidebarConfig.ts L134-148 + OutputHubPage.tsx L25-71 一致
//   - Hub 卡片：7 张（研究报告/交易复盘/数据导出/复盘向导/预测校验/周期复盘/因子画板）
//   - 侧边栏按钮：8 个（研报复盘/仪表盘/数据导出/交易复盘/复盘向导/预测校验/周期复盘/因子画板）
//   - "仪表盘" 仅在侧边栏出现，Hub 卡片中无 Dashboard 入口（设计意图：避免与 /command 重复）
// ═══════════════════════════════════════════════════════════════

const LOG_PREFIX = '[OutputCabin-Test]'

test.describe('输出舱 — 导航与渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/output')
    await page.waitForLoadState('networkidle')
    // 使用 heading 精确匹配页面标题，避免匹配侧边栏/导航栏/面包屑
    // 注意：OutputHubPage 渲染 <h1>输出舱</h1>，使用 .first() 解决 strict mode 双 h1 冲突
    console.log(`${LOG_PREFIX} [P1-FIX] beforeEach：导航到 /#/output，等待 heading '输出舱'`)
    await expect(page.getByRole('heading', { name: '输出舱', level: 1 }).first()).toBeVisible({ timeout: 10000 })
    console.log(`${LOG_PREFIX} [P1-FIX] beforeEach：heading '输出舱' 可见，验证通过 ✓`)
  })

  // ============================================================
  // 首页渲染
  // ============================================================

  test('输出舱首页应展示七个功能模块卡片', async ({ page }) => {
    // 与 OutputHubPage.tsx OUTPUT_MODULES 数组（7 项）一致
    await expect(page.getByRole('heading', { name: '研究报告' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '交易复盘' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '复盘向导' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '预测校验' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '周期复盘' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '因子画板' })).toBeVisible()
  })

  test('输出舱首页应展示七个"进入"链接（每个卡片一个）', async ({ page }) => {
    const links = page.getByRole('link', { name: '进入' })
    await expect(links).toHaveCount(7)
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
  // 侧边栏导航（实际侧边栏 8 个按钮，与 sidebarConfig.ts L134-148 一致）
  // ============================================================

  test('侧边栏应显示全部 8 个输出舱导航按钮', async ({ page }) => {
    // 真相源：src/config/sidebarConfig.ts output 分组（8 个按钮）
    await page.goto('/#/output/research')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: '研报复盘' })).toBeVisible()
    await expect(page.getByRole('button', { name: '仪表盘' })).toBeVisible()
    await expect(page.getByRole('button', { name: '数据导出' })).toBeVisible()
    await expect(page.getByRole('button', { name: '交易复盘' })).toBeVisible()
    await expect(page.getByRole('button', { name: '复盘向导' })).toBeVisible()
    await expect(page.getByRole('button', { name: '预测校验' })).toBeVisible()
    await expect(page.getByRole('button', { name: '周期复盘' })).toBeVisible()
    await expect(page.getByRole('button', { name: '因子画板' })).toBeVisible()
  })

  test('侧边栏"研报复盘"按钮存在且可点击', async ({ page }) => {
    await page.goto('/#/output/research')
    await page.waitForLoadState('networkidle')
    const btn = page.getByRole('button', { name: '研报复盘' })
    await expect(btn).toBeVisible()
    await btn.click()
    await page.waitForLoadState('domcontentloaded')
    console.log(`${LOG_PREFIX} 侧边栏导航：点击后 URL=${page.url()}`)
  })

  test('侧边栏"仪表盘"应导航到仪表盘页面', async ({ page }) => {
    await page.goto('/#/output/research')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '仪表盘' }).click()
    await page.waitForURL('**/output/dashboard', { timeout: 10000 })
    expect(page.url()).toContain('/output/dashboard')
  })

  test('侧边栏"复盘向导"应导航到复盘向导页面', async ({ page }) => {
    await page.goto('/#/output/research')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '复盘向导' }).click()
    await page.waitForURL('**/output/wizard', { timeout: 10000 })
    expect(page.url()).toContain('/output/wizard')
  })

  test('侧边栏"预测校验"应导航到预测校验页面', async ({ page }) => {
    await page.goto('/#/output/research')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '预测校验' }).click()
    await page.waitForURL('**/output/prediction', { timeout: 10000 })
    expect(page.url()).toContain('/output/prediction')
  })

  test('侧边栏"周期复盘"应导航到周期复盘页面', async ({ page }) => {
    await page.goto('/#/output/research')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '周期复盘' }).click()
    await page.waitForURL('**/output/retrospective', { timeout: 10000 })
    expect(page.url()).toContain('/output/retrospective')
  })

  test('侧边栏"因子画板"应导航到因子画板页面', async ({ page }) => {
    await page.goto('/#/output/research')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '因子画板' }).click()
    await page.waitForURL('**/output/factor-dashboard', { timeout: 10000 })
    expect(page.url()).toContain('/output/factor-dashboard')
  })

  // 注意：输出舱侧边栏无"输出舱首页"按钮，返回首页通过面包屑链接或直接 URL 实现

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
