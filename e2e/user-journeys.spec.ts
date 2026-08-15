/**
 * @test_id V9-TEST-E2E-019
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-DATA-055, V9-DOC-BACK-027]
 * 用户旅程端到端测试 — 覆盖V9核心价值链路
 * J1: 新用户首次使用 — 录入股票 → 查看评分 → 返回首页
 * J2: 周末选股研究 — 热门板块 → 价值洼地 → 加入候选池
 * J3: 交易模拟盘闭环 — 加载持仓 → 查看组合 → 策略快照
 * J4: 五舱导航连通性验证
 */
import { test, expect } from '@playwright/test'

// 用户旅程测试涉及多页面跳转，设置更长超时
test.setTimeout(60000)

// ─── 辅助方法 ───────────────────────────────────────────
async function waitForAppReady(page: import('@playwright/test').Page) {
  // 使用domcontentloaded而非networkidle，避免SPA长连接导致永远等待
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(800)
}

// ─── J1：新用户首次使用 ──────────────────────────────────
test.describe('用户旅程 J1：新用户首次使用（核心评分链路）', () => {
  const TEST_STOCK_CODE = '600519.SH'
  const TEST_STOCK_NAME = '贵州茅台'

  test.describe('步骤 1：输入舱页面访问', () => {
    test('输入舱页面应展示五舱导航与录入表单', async ({ page }) => {
      test.slow() // 首个测试需等待Vite编译完成
      await page.goto('/#/input', { waitUntil: 'domcontentloaded', timeout: 120000 })
      await waitForAppReady(page)

      // 验证五舱导航按钮可见（使用正则匹配，emoji可能在ARIA name中被处理）
      await expect(page.getByRole('button', { name: /输入舱/ }).first()).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('button', { name: /分析舱/ }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /交易舱/ }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /输出舱/ }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: /总控舱/ }).first()).toBeVisible()

      // 验证输入舱标题
      await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible()
    })
  })

  test.describe('步骤 2：输入舱 - 录入单只股票', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/input', { waitUntil: 'domcontentloaded' })
      await waitForAppReady(page)
      await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 15000 })
    })

    test('应能录入一只股票到意向候选池', async ({ page }) => {
      // 确保在"单次录入"Tab
      const singleTab = page.getByRole('tab', { name: '单次录入' })
      if (await singleTab.isVisible()) {
        await singleTab.click()
      }

      // 填写股票代码
      const codeInput = page.getByRole('textbox', { name: '股票代码' })
      await expect(codeInput).toBeVisible()
      await codeInput.fill(TEST_STOCK_CODE)

      // 填写股票名称
      const nameInput = page.getByRole('textbox', { name: '股票名称' })
      await expect(nameInput).toBeVisible()
      await nameInput.fill(TEST_STOCK_NAME)

      // 点击"仅录入"按钮
      const addButton = page.getByRole('button', { name: '仅录入' })
      await expect(addButton).toBeVisible()
      await addButton.click()

      // 等待状态更新
      await page.waitForTimeout(1000)

      // 验证候选池标题
      await expect(page.getByRole('heading', { name: '意向候选池' })).toBeVisible()

      // 验证录入的股票出现在列表中（使用cell角色精确定位，避免strict mode冲突）
      const codeCell = page.getByRole('cell', { name: TEST_STOCK_CODE, exact: true })
      const nameCell = page.getByRole('cell', { name: TEST_STOCK_NAME, exact: true })
      await expect(codeCell.or(nameCell).first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('步骤 3：分析舱 - 查看个股评分', () => {
    test.beforeEach(async ({ page }) => {
      // 先录入一只股票
      await page.goto('/#/input')
      await waitForAppReady(page)
      const codeInput = page.getByRole('textbox', { name: '股票代码' })
      await codeInput.fill(TEST_STOCK_CODE)
      const nameInput = page.getByRole('textbox', { name: '股票名称' })
      await nameInput.fill(TEST_STOCK_NAME)
      await page.getByRole('button', { name: '仅录入' }).click()
      await page.waitForTimeout(1000)
    })

    test('从输入舱跳转到分析舱应能看到标的', async ({ page }) => {
      // 点击导航栏的分析舱
      await page.getByRole('button', { name: /分析舱/ }).first().click()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(800)

      // 验证分析舱页面（h2 标题）
      await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('heading', { name: '分析舱 · V6 九维评分' })).toBeVisible()

      // 点击"加载意向候选池"按钮（原"加载标的"已拆分为"加载全部标的"/"加载意向候选池"）
      const loadButton = page.getByRole('button', { name: '加载意向候选池' })
      await expect(loadButton).toBeVisible()
      await loadButton.click()
      await page.waitForTimeout(1500)

      // 验证标的加载成功（使用first()避免strict mode冲突）
      const stockCodeText = page.getByText(TEST_STOCK_CODE).first()
      await expect(stockCodeText).toBeVisible({ timeout: 10000 })
    })

    test('直接访问个股评分页面应正确渲染', async ({ page }) => {
      // 路由 /analysis/stock-score/:symbol 不存在，个股评分带代码路由为 /analysis/intelligent-score/:symbol
      await page.goto(`/#/analysis/intelligent-score/${TEST_STOCK_CODE}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(800)

      // 页面应能正常加载（不出现白屏或404）
      const heading = page.getByRole('heading', { name: /评分|分析/i }).first()
      await expect(heading).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('步骤 4：从分析舱返回', () => {
    test('点击Logo应返回驾驶舱/首页', async ({ page }) => {
      await page.goto('/#/analysis')
      await waitForAppReady(page)

      // 点击顶部Logo链接
      const logoLink = page.getByRole('link', { name: 'V9 智能投研复盘系统' })
      await expect(logoLink).toBeVisible()
      await logoLink.click()
      await page.waitForLoadState('networkidle')

      // 验证回到首页/驾驶舱
      expect(page.url()).toMatch(/\/#\/$|\/#\/dashboard|\/#\/cockpit|\/#\/\?/)
    })
  })
})

// ─── J2：周末选股研究 ────────────────────────────────────
test.describe('用户旅程 J2：周末选股研究（板块筛选）', () => {
  test.describe('步骤 1：热门板块页面', () => {
    test('热门板块页面应正确渲染并可交互', async ({ page }) => {
      // /input/hot-sectors 已整合至录入看板（fallback 到 /input），热门板块独立页在分析舱
      await page.goto('/#/analysis/hot-sector')
      await waitForAppReady(page)

      // 页面可能处于 loading/empty/error/正常 四种状态（取决于后端数据），
      // E2E 环境无后端数据时显示 empty 或 loading，均为正确渲染。
      // 验证页面不白屏：body 有可见文本（热门板块相关或状态提示）
      await expect(page.locator('body')).not.toBeEmpty({ timeout: 15000 })
      await expect(page.getByText(/板块|评分|数据|刷新|计算|输入舱|分析舱/).first()).toBeVisible({ timeout: 10000 })

      // 验证分析舱侧边栏导航（热门板块按钮在分析舱侧边栏）
      const hotSectorsNav = page.getByRole('button', { name: '热门板块' })
      await expect(hotSectorsNav.first()).toBeVisible()
    })
  })

  test.describe('步骤 2：价值洼地筛选', () => {
    test('分析舱价值洼地入口应可访问', async ({ page }) => {
      await page.goto('/#/analysis')
      await waitForAppReady(page)

      // 点击侧边栏的"价值洼地"
      const valueBtn = page.getByRole('button', { name: '价值洼地' })
      await expect(valueBtn).toBeVisible()
      await valueBtn.click()
      await page.waitForLoadState('networkidle')

      // 验证页面变化（URL包含value）
      expect(page.url()).toContain('value')
    })
  })
})

// ─── J3：交易模拟盘闭环 ──────────────────────────────────
test.describe('用户旅程 J3：交易模拟盘闭环', () => {
  test.describe('步骤 1：交易舱首页', () => {
    test('交易舱首页应展示核心功能入口', async ({ page }) => {
      await page.goto('/#/trading')
      await waitForAppReady(page)

      // 验证交易舱标题
      await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible({ timeout: 10000 })

      // 验证核心操作按钮
      await expect(page.getByRole('button', { name: '加载观察池' })).toBeVisible()
      await expect(page.getByRole('button', { name: '加载持仓' })).toBeVisible()
      await expect(page.getByRole('button', { name: '扫描信号' })).toBeVisible()
      await expect(page.getByRole('button', { name: '构建核心组合' })).toBeVisible()

      // 验证核心区域
      await expect(page.getByRole('heading', { name: '观察池交易建议' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '核心稀缺主题组合' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '持仓订单' })).toBeVisible()
    })
  })

  test.describe('步骤 2：持仓管理页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/trading')
      await waitForAppReady(page)
    })

    test('侧边栏导航到投资组合页面', async ({ page }) => {
      // 侧边栏"持仓管理"已重命名为"投资组合"（路径 /trading/portfolio）
      const portfolioBtn = page.getByRole('button', { name: '投资组合' })
      await expect(portfolioBtn).toBeVisible()
      await portfolioBtn.click()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(800)

      // 验证URL变化
      expect(page.url()).toContain('portfolio')

      // 验证页面标题
      const heading = page.getByRole('heading', { name: /投资组合|portfolio/i }).first()
      await expect(heading).toBeVisible({ timeout: 10000 })
    })

    test('点击加载持仓按钮应触发数据加载', async ({ page }) => {
      // 点击首页的"加载持仓"按钮
      const loadHoldingsBtn = page.getByRole('button', { name: '加载持仓' })
      await expect(loadHoldingsBtn).toBeVisible()

      // 点击后验证页面不报错
      await loadHoldingsBtn.click()
      await page.waitForTimeout(1000)

      // 按钮点击后页面仍正常显示
      await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible()
    })
  })

  test.describe('步骤 3：策略快照页面', () => {
    test('策略快照页面应展示三策略分组', async ({ page }) => {
      await page.goto('/#/trading/strategy-snapshots')
      await waitForAppReady(page)

      // 验证策略快照标题
      const heading = page.getByRole('heading', { name: /策略快照/i }).first()
      await expect(heading).toBeVisible({ timeout: 10000 })

      // 验证三策略分组
      await expect(page.getByRole('heading', { name: '核心稀缺' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '热点动量' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '价值洼地' })).toBeVisible()

      // 验证保存快照按钮
      await expect(page.getByRole('button', { name: '保存当前快照' })).toBeVisible()
    })
  })

  test.describe('步骤 4：执行计划页面', () => {
    test('执行计划页面应展示状态筛选Tab', async ({ page }) => {
      await page.goto('/#/trading/execution-plans')
      await waitForAppReady(page)

      // 验证执行计划标题
      const heading = page.getByRole('heading', { name: '执行计划', exact: true })
      await expect(heading).toBeVisible({ timeout: 10000 })

      // 验证状态筛选Tab
      await expect(page.getByRole('tab', { name: /全部/ })).toBeVisible()
      await expect(page.getByRole('tab', { name: /活跃/ })).toBeVisible()
      await expect(page.getByRole('tab', { name: /已完成/ })).toBeVisible()
    })
  })
})

// ─── J4：五舱导航连通性 ──────────────────────────────────
test.describe('用户旅程 J4：五舱导航连通性验证', () => {
  test('五舱之间应能通过顶部导航自由切换', async ({ page }) => {
    // 从输入舱开始（首页加载可能有重定向延迟）
    await page.goto('/#/input')
    await waitForAppReady(page)
    await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 15000 })

    const cabins = [
      { name: /分析舱/, route: 'analysis' },
      { name: /交易舱/, route: 'trading' },
      { name: /输出舱/, route: 'output' },
      { name: /总控舱/, route: 'command' },
      { name: /输入舱/, route: 'input' },
    ]

    for (const cabin of cabins) {
      await page.getByRole('button', { name: cabin.name }).first().click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain(cabin.route)
    }
  })
})
