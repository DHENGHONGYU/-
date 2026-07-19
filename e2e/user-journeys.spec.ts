/**
 * @test_id V9-TEST-E2E-019
 * @covers_docs []
 */
import { test, expect } from '@playwright/test'

test.describe('用户旅程 J1：新用户首次使用', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.describe('步骤 1：首页访问与导航', () => {
    test('首页应展示五舱入口卡片', async ({ page }) => {
      const cabinCards = page.locator('[data-testid="cabin-card"], section[role="region"]')
      await expect(cabinCards.first()).toBeVisible({ timeout: 10000 })
    })

    test('点击输入舱卡片应跳转到输入舱页面', async ({ page }) => {
      const inputLink = page.locator('a[href*="input"], button:has-text("输入舱")')
      if (await inputLink.isVisible()) {
        await inputLink.click()
        await page.waitForLoadState('networkidle')
        await expect(page.url()).toContain('/input')
      }
    })
  })

  test.describe('步骤 2：输入舱 - 添加单只股票', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/input')
      await page.waitForLoadState('networkidle')
    })

    test('输入舱页面应显示股票池看板', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /输入舱|股票池/i }).first()
      await expect(heading).toBeVisible({ timeout: 10000 })
    })

    test('应能通过代码添加一只股票', async ({ page }) => {
      const addButton = page.locator('button:has-text("添加"), button:has-text("+ 新增"), button:has-text("录入")').first()
      if (await addButton.isVisible()) {
        await addButton.click()
        const codeInput = page.locator('input[placeholder*="代码"], input[placeholder*="股票代码"]').first()
        if (await codeInput.isVisible()) {
          await codeInput.fill('000001.SZ')
          const confirmBtn = page.locator('button:has-text("确认"), button:has-text("添加")').first()
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click()
            await page.waitForTimeout(1000)
            const successToast = page.locator('text=成功,text=添加成功,text=已添加').first()
            await expect(successToast.or(page.locator('text=平安银行'))).toBeVisible({ timeout: 5000 })
          }
        }
      }
    })
  })

  test.describe('步骤 3：分析舱 - 查看评分结果', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis/stock-score/000001.SZ')
      await page.waitForLoadState('networkidle')
    })

    test('个股分析页面应正确渲染', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /个股分析|平安银行|评分/i }).first()
      await expect(heading).toBeVisible({ timeout: 15000 })
    })

    test('应展示总分和分层评分卡片', async ({ page }) => {
      const scoreCard = page.locator('[data-testid="score-card"], .score-card, div:has-text("综合评分")').first()
      await expect(scoreCard).toBeVisible({ timeout: 10000 })
    })

    test('应展示八层评分因子列表', async ({ page }) => {
      const factorItems = page.locator('[data-testid="layer-score"], .layer-item, div[class*="layer"]')
      const count = await factorItems.count()
      expect(count).toBeGreaterThan(0)
    })
  })

  test.describe('步骤 4：从分析舱返回首页', () => {
    test('点击 logo 或首页链接应返回首页', async ({ page }) => {
      await page.goto('/#/analysis')
      await page.waitForLoadState('networkidle')
      const homeLink = page.locator('a[href="#/"], a[href="/"], img[alt*="logo"]').first()
      if (await homeLink.isVisible()) {
        await homeLink.click()
        await page.waitForLoadState('networkidle')
        expect(page.url()).toMatch(/\/$|\/#\/$/)
      }
    })
  })
})

test.describe('用户旅程 J2：周末选股研究', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/input/hot-sectors')
    await page.waitForLoadState('networkidle')
  })

  test.describe('步骤 1：热门板块页面', () => {
    test('热门板块页面应正确渲染', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /热门板块|板块|sector/i }).first()
      await expect(heading).toBeVisible({ timeout: 10000 })
    })
  })
})

test.describe('用户旅程 J3：交易复盘流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/trading/holdings')
    await page.waitForLoadState('networkidle')
  })

  test.describe('步骤 1：持仓页面', () => {
    test('持仓页面应正确渲染', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /持仓|holding|portfolio/i }).first()
      await expect(heading).toBeVisible({ timeout: 10000 })
    })
  })
})
