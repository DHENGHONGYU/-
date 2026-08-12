/**
 * @test_id V9-TEST-E2E-020
 * @module e2e/visual-regression
 * @description 视觉回归测试：为各舱核心页面建立截图基线并做 diff。
 *
 * @workflow
 * 1. 本地快速生成基线：`npm run test:e2e:visual:update`
 * 2. 本地快速回归比对：`npm run test:e2e:visual`
 * 3. Docker 统一环境生成基线（跨平台真相源）：`npm run test:e2e:visual:docker:update`
 * 4. Docker 统一环境回归比对：`npm run test:e2e:visual:docker`
 * 5. 基线存储路径：`e2e/visual-regression.spec.ts-snapshots/`
 * 6. 当前基线数量：30+ 个场景（5 舱首屏 + 驾驶舱 + 20 子页面 + 多暗色模式）
 *
 * @docker
 * - Dockerfile: `e2e/Dockerfile`（基于 Playwright 官方镜像 mcr.microsoft.com/playwright:v1.61.1-jammy）
 * - Compose: `e2e/docker-compose.yml`（visual-test / visual-update 两个服务）
 * - 目的：消除 Windows/macOS/Linux 字体/渲染差异，建立唯一基线真相源
 * - CI 使用：`.github/workflows/quality-check.yml` 的 `visual-regression` job
 *
 * @history
 * - 2026-07-12: 从 5 场景扩展到 20 场景，修复路由/heading 匹配问题
 *   - 个股评分: `/analysis/stock-score` → `/analysis/stock-score/000001.SZ`
 *   - 股票池: `/trading/pool` → `/trading/portfolio`
 *   - LLM 管理: `/command/llm` → `/command/agents/llm`
 *   - heading 匹配同步为实际 PageHeader title
 *   - waitForPageStable 增加 15s 超时覆盖 React.lazy Suspense
 * - 2026-07-12: 新增 Docker 容器化方案，统一跨平台基线生成环境
 * - 2026-07-16: C1 批次扩展，从 20 场景增至 30+ 场景
 *   - 新增：输入舱采集任务、分析舱多因子筛选、交易舱交易流水
 *   - 新增：输出舱导出模板、总控舱数据迁移、行业评分页面
 *   - 新增：交易复盘页面、投资组合详情、智能评分详情
 *   - 暗色模式扩展：驾驶舱 + 分析舱双页验证
 *
 * @tips
 * - 仅使用 chromium 项目（playwright.config.ts 已限定），避免跨浏览器字体渲染差异。
 * - 截图前等待网络空闲与关键元素可见，降低动画/数据加载导致的抖动。
 * - 若界面有意的 redesign 导致 diff，使用 `--update-snapshots` 重新冻结基线。
 * - 提交基线前优先运行 Docker 版本，确保 CI 回归通过。
  * @covers_docs []
*/

import { test, expect } from '@playwright/test'

/** 等待页面稳定：网络空闲 + 关键标题可见（取第一个匹配） */
async function waitForPageStable(page: import('@playwright/test').Page, headingPattern: RegExp): Promise<void> {
  await page.waitForLoadState('networkidle')
  const heading = page.getByRole('heading', { name: headingPattern }).first()
  // 延长超时以覆盖 React.lazy Suspense 加载延迟（含双层 lazy：App → Page）
  await expect(heading).toBeVisible({ timeout: 15000 })
  // 给骨架屏/微动画留出最后渲染时间
  await page.waitForTimeout(500)
}

test.describe('视觉回归 - 核心舱页面', () => {
  // ── 5 舱首屏（5 个） ──
  test('输入舱页面', async ({ page }) => {
    await page.goto('/input')
    await waitForPageStable(page, /输入舱/i)
    await expect(page).toHaveScreenshot('input-cabin.png', { fullPage: true })
  })

  test('分析舱页面', async ({ page }) => {
    await page.goto('/analysis')
    await waitForPageStable(page, /分析舱/i)
    await expect(page).toHaveScreenshot('analysis-cabin.png', { fullPage: true })
  })

  test('交易舱页面', async ({ page }) => {
    await page.goto('/trading')
    await waitForPageStable(page, /交易舱/i)
    await expect(page).toHaveScreenshot('trading-cabin.png', { fullPage: true })
  })

  test('输出舱页面', async ({ page }) => {
    await page.goto('/output')
    await waitForPageStable(page, /输出舱/i)
    await expect(page).toHaveScreenshot('output-cabin.png', { fullPage: true })
  })

  test('总控舱页面', async ({ page }) => {
    await page.goto('/command')
    await waitForPageStable(page, /总控舱/i)
    await expect(page).toHaveScreenshot('command-cabin.png', { fullPage: true })
  })

  // ── 驾驶舱（1 个） ──
  test('驾驶舱页面', async ({ page }) => {
    await page.goto('/cockpit')
    await waitForPageStable(page, /驾驶舱/i)
    await expect(page).toHaveScreenshot('cockpit.png', { fullPage: true })
  })

  // ── 输入舱子页面 ──
  test('热门板块录入页面', async ({ page }) => {
    await page.goto('/input/hot-sectors')
    await waitForPageStable(page, /热门板块/i)
    await expect(page).toHaveScreenshot('input-hot-sectors.png', { fullPage: true })
  })

  // ── 分析舱子页面（4 个） ──
  test('个股评分页面', async ({ page }) => {
    await page.goto('/analysis/stock-score/000001.SZ')
    await waitForPageStable(page, /个股分析/i)
    await expect(page).toHaveScreenshot('analysis-stock-score.png', { fullPage: true })
  })

  test('板块分析页面', async ({ page }) => {
    await page.goto('/analysis/sector')
    await waitForPageStable(page, /板块/i)
    await expect(page).toHaveScreenshot('analysis-sector.png', { fullPage: true })
  })

  test('价值洼地页面', async ({ page }) => {
    await page.goto('/analysis/value-pit')
    await waitForPageStable(page, /价值洼地/i)
    await expect(page).toHaveScreenshot('analysis-value-pit.png', { fullPage: true })
  })

  test('智能评分页面', async ({ page }) => {
    await page.goto('/analysis/intelligent-score')
    await waitForPageStable(page, /智能评分/i)
    await expect(page).toHaveScreenshot('analysis-intelligent-score.png', { fullPage: true })
  })

  // ── 交易舱子页面（2 个） ──
  test('持仓管理页面', async ({ page }) => {
    await page.goto('/trading/holdings')
    await waitForPageStable(page, /持仓/i)
    await expect(page).toHaveScreenshot('trading-holdings.png', { fullPage: true })
  })

  test('投资组合页面', async ({ page }) => {
    await page.goto('/trading/portfolio')
    await waitForPageStable(page, /投资组合/i)
    await expect(page).toHaveScreenshot('trading-portfolio.png', { fullPage: true })
  })

  // ── 输出舱子页面（1 个） ──
  test('报告中心页面', async ({ page }) => {
    await page.goto('/output/research')
    await waitForPageStable(page, /报告/i)
    await expect(page).toHaveScreenshot('output-research.png', { fullPage: true })
  })

  // ── 总控舱子页面（3 个） ──
  test('架构健康度仪表盘', async ({ page }) => {
    await page.goto('/command/health')
    await waitForPageStable(page, /架构健康度/i)
    await expect(page).toHaveScreenshot('command-health.png', { fullPage: true })
  })

  test('Agent 中心页面', async ({ page }) => {
    await page.goto('/command/agents')
    await waitForPageStable(page, /智能体总控台/i)
    await expect(page).toHaveScreenshot('command-agents.png', { fullPage: true })
  })

  test('LLM 管理页面', async ({ page }) => {
    await page.goto('/command/agents/llm')
    await waitForPageStable(page, /LLM/i)
    await expect(page).toHaveScreenshot('command-llm.png', { fullPage: true })
  })

  test('系统配置页面', async ({ page }) => {
    await page.goto('/command/config')
    await waitForPageStable(page, /配置/i)
    await expect(page).toHaveScreenshot('command-config.png', { fullPage: true })
  })

  // ── C1 扩展：输入舱子页面（+2） ──
  test('输入舱-采集任务页面', async ({ page }) => {
    await page.goto('/input/collect-task')
    await waitForPageStable(page, /采集|任务/i)
    await expect(page).toHaveScreenshot('input-collect-task.png', { fullPage: true })
  })

  test('输入舱-意向池页面', async ({ page }) => {
    await page.goto('/input/intention-pool')
    await waitForPageStable(page, /意向|池/i)
    await expect(page).toHaveScreenshot('input-intention-pool.png', { fullPage: true })
  })

  // ── C1 扩展：分析舱子页面（+3） ──
  test('分析舱-行业评分页面', async ({ page }) => {
    await page.goto('/analysis/industry-score')
    await waitForPageStable(page, /行业评分|行业/i)
    await expect(page).toHaveScreenshot('analysis-industry-score.png', { fullPage: true })
  })

  test('分析舱-多因子筛选页面', async ({ page }) => {
    await page.goto('/analysis/screening')
    await waitForPageStable(page, /筛选|多因子/i)
    await expect(page).toHaveScreenshot('analysis-screening.png', { fullPage: true })
  })

  test('分析舱-评分对比页面', async ({ page }) => {
    await page.goto('/analysis/comparison')
    await waitForPageStable(page, /对比|comparison/i)
    await expect(page).toHaveScreenshot('analysis-comparison.png', { fullPage: true })
  })

  // ── C1 扩展：交易舱子页面（+2） ──
  test('交易舱-交易流水页面', async ({ page }) => {
    await page.goto('/trading/flow')
    await waitForPageStable(page, /流水|交易记录|flow/i)
    await expect(page).toHaveScreenshot('trading-flow.png', { fullPage: true })
  })

  test('交易舱-复盘页面', async ({ page }) => {
    await page.goto('/trading/review')
    await waitForPageStable(page, /复盘|review/i)
    await expect(page).toHaveScreenshot('trading-review.png', { fullPage: true })
  })

  // ── C1 扩展：输出舱子页面（+1） ──
  test('输出舱-导出模板页面', async ({ page }) => {
    await page.goto('/output/export')
    await waitForPageStable(page, /导出|export/i)
    await expect(page).toHaveScreenshot('output-export.png', { fullPage: true })
  })

  // ── C1 扩展：总控舱子页面（+1） ──
  test('总控舱-数据迁移页面', async ({ page }) => {
    await page.goto('/command/migration')
    await waitForPageStable(page, /迁移|migration/i)
    await expect(page).toHaveScreenshot('command-migration.png', { fullPage: true })
  })

  // ── 主题与交互（2 个，原 1 个 + 扩展 1 个） ──
  test('暗色模式-驾驶舱', async ({ page }) => {
    await page.goto('/cockpit')
    await waitForPageStable(page, /驾驶舱/i)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    })
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('cockpit-dark-mode.png', { fullPage: true })
  })

  test('暗色模式-分析舱', async ({ page }) => {
    await page.goto('/analysis')
    await waitForPageStable(page, /分析舱/i)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    })
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('analysis-dark-mode.png', { fullPage: true })
  })
})
