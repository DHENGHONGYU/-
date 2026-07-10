import { test, expect } from '@playwright/test'

// ═══════════════════════════════════════════════════════════════
// P1 修复日志：采集任务监控路由从 /input/collection-test (404) 改为 /input/collect-tasks
//            统计卡片改用 getByText 替代 locator('text=...')
// ═══════════════════════════════════════════════════════════════

const LOG_PREFIX = '[DataCollection-Test]'

test.describe('数据采集功能测试', () => {
  test.describe('采集测试页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/input/data-test')
      await expect(page.getByRole('heading', { name: '数据采集测试' })).toBeVisible({ timeout: 10000 })
    })

    test('应显示数据采集测试标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '数据采集测试' })).toBeVisible()
    })

    test('应显示采集服务状态与检查连接按钮', async ({ page }) => {
      await expect(page.locator('text=采集服务状态：')).toBeVisible()
      await expect(page.getByRole('button', { name: '检查连接' })).toBeVisible()
    })

    test('应显示单接口测试区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '单接口测试' })).toBeVisible()
      await expect(page.getByRole('textbox', { name: '股票代码，如 600519.SH' })).toBeVisible()
      await expect(page.getByRole('button', { name: '测试基础接口' })).toBeVisible()
      await expect(page.getByRole('button', { name: '测试 K线接口' })).toBeVisible()
    })

    test('应显示批量采集测试区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '批量采集测试（含进度）' })).toBeVisible()
      await expect(page.getByPlaceholder(/每行一个股票代码/)).toBeVisible()
      await expect(page.getByRole('button', { name: '开始批量采集测试' })).toBeVisible()
    })

    test('检查连接按钮应可点击', async ({ page }) => {
      await page.getByRole('button', { name: '检查连接' }).click()
      await page.waitForTimeout(2000)
      await expect(page.locator('text=采集服务状态：')).toBeVisible()
    })

    test('单接口测试应可输入股票代码', async ({ page }) => {
      const input = page.getByRole('textbox', { name: '股票代码，如 600519.SH' })
      await input.fill('600519')
      await expect(input).toHaveValue('600519')
    })

    test('测试基础接口按钮应可点击', async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码，如 600519.SH' }).fill('600519')
      await page.getByRole('button', { name: '测试基础接口' }).click()
      await page.waitForTimeout(3000)
    })

    test('测试K线接口按钮应可点击', async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码，如 600519.SH' }).fill('600519')
      await page.getByRole('button', { name: '测试 K线接口' }).click()
      await page.waitForTimeout(3000)
    })

    test('批量采集测试输入框应可输入', async ({ page }) => {
      const textarea = page.getByPlaceholder(/每行一个股票代码/)
      await textarea.fill('600519,贵州茅台\n000001,平安银行')
      await expect(textarea).toHaveValue('600519,贵州茅台\n000001,平安银行')
    })

    test('空输入时批量采集按钮应禁用，有输入时启用', async ({ page }) => {
      const batchButton = page.getByRole('button', { name: '开始批量采集测试' })
      // 空输入时按钮禁用
      await expect(batchButton).toBeDisabled()
      // 输入内容后按钮启用
      await page.getByPlaceholder(/每行一个股票代码/).fill('600519,贵州茅台')
      await expect(batchButton).toBeEnabled()
    })
  })

  test.describe('采集任务监控页面', () => {
    test.beforeEach(async ({ page }) => {
      console.log(`${LOG_PREFIX} [P1-FIX] 采集任务监控：导航到 /#/input/collect-tasks（修复前为 /input/collection-test -> 404）`)
      await page.goto('/#/input/collect-tasks')
      await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
      console.log(`${LOG_PREFIX} [P1-FIX] 采集任务监控：页面加载成功 ✓`)
    })

    test('应显示采集任务监控标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible()
    })

    test('应显示统计卡片', async ({ page }) => {
      // 统计卡片使用 paragraph 元素展示标签和数值
      // 注意：'采集中'/'已完成'/'失败' 同时出现在卡片标签和表格 badge 中，使用 .first() 解决 strict mode
      console.log(`${LOG_PREFIX} [P1-FIX] 统计卡片：验证 任务总数/采集中/已完成/失败 四个卡片（.first() 解决 strict mode 多元素匹配）`)
      await expect(page.getByText('任务总数')).toBeVisible()
      await expect(page.getByText('采集中').first()).toBeVisible()
      await expect(page.getByText('已完成').first()).toBeVisible()
      await expect(page.getByText('失败').first()).toBeVisible()
      console.log(`${LOG_PREFIX} [P1-FIX] 统计卡片：四个卡片全部验证通过 ✓`)
    })

    test('应显示Tab切换', async ({ page }) => {
      await expect(page.getByRole('tab', { name: '任务列表' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '评分卡片' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '采集日志' })).toBeVisible()
    })

    test('任务列表应展示任务表格', async ({ page }) => {
      await expect(page.locator('table')).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '任务ID' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '维度' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '进度' })).toBeVisible()
    })

    test('应显示Mock任务数据', async ({ page }) => {
      await expect(page.locator('text=TASK-20260701-001')).toBeVisible()
      await expect(page.locator('text=TASK-20260701-002')).toBeVisible()
    })

    test('评分卡片Tab应可切换', async ({ page }) => {
      await page.getByRole('tab', { name: '评分卡片' }).click()
      await expect(page.locator('text=评分卡片')).toBeVisible()
    })

    test('采集日志Tab应可切换', async ({ page }) => {
      await page.getByRole('tab', { name: '采集日志' }).click()
      await expect(page.getByRole('tab', { name: '采集日志', selected: true })).toBeVisible()
    })

    test('任务详情按钮应可点击', async ({ page }) => {
      await page.getByRole('button', { name: '详情' }).first().click()
      await page.waitForTimeout(1000)
      // 详情弹窗或详情面板应出现
    })

    test('失败任务应显示重试按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
    })

    test('刷新按钮应存在', async ({ page }) => {
      await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    })
  })

  test.describe('七维采集配置页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/input/seven-dim')
      await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
    })

    test('应显示七维采集配置标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible()
    })

    test('应显示策略模板区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '策略模板' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '价值投资' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '成长投资' })).toBeVisible()
    })

    test('应显示采集维度区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
      await expect(page.locator('text=已启用')).toBeVisible()
    })

    test('应显示八个采集维度', async ({ page }) => {
      await expect(page.locator('text=01 · 基本信息')).toBeVisible()
      await expect(page.locator('text=02 · K线数据')).toBeVisible()
      await expect(page.locator('text=03 · 筹码分布')).toBeVisible()
      await expect(page.locator('text=04 · 重大事项')).toBeVisible()
      await expect(page.locator('text=05 · 热点新闻')).toBeVisible()
      await expect(page.locator('text=06 · 行业竞品')).toBeVisible()
      await expect(page.locator('text=07 · 关联指数')).toBeVisible()
      await expect(page.locator('text=08 · 研报中心')).toBeVisible()
    })

    test('应显示全局参数区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
    })

    test('应显示额度预估区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '额度预估' })).toBeVisible()
      await expect(page.locator('text=月调用总量')).toBeVisible()
      await expect(page.locator('text=日调用上限')).toBeVisible()
    })

    test('应显示开始采集和重置按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '开始采集' })).toBeVisible()
      await expect(page.getByRole('button', { name: '重置为默认' })).toBeVisible()
    })
  })

  test.describe('抓取引擎配置页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/input/fetcher-config')
      await expect(page.getByRole('heading', { name: '抓取引擎配置' })).toBeVisible({ timeout: 10000 })
    })

    test('应显示抓取引擎配置标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '抓取引擎配置' })).toBeVisible()
    })

    test('应显示统计卡片', async ({ page }) => {
      await expect(page.locator('text=数据源数量')).toBeVisible()
      await expect(page.locator('text=在线数据源')).toBeVisible()
      await expect(page.locator('text=启用维度')).toBeVisible()
      await expect(page.locator('text=日调用上限')).toBeVisible()
    })

    test('应显示数据源列表表格', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '数据源列表' })).toBeVisible()
      await expect(page.locator('table')).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '数据源' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '类型' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '地址' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
    })

    test('应显示五个数据源', async ({ page }) => {
      await expect(page.getByRole('cell', { name: '腾讯财经' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '新浪财经' })).toBeVisible()
      await expect(page.getByRole('cell', { name: '网易财经' })).toBeVisible()
      await expect(page.getByRole('cell', { name: 'AKShare' })).toBeVisible()
      await expect(page.getByRole('cell', { name: 'Mock 数据源' })).toBeVisible()
    })

    test('应显示连通性测试区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '连通性测试', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '开始测试' })).toBeVisible()
    })

    test('应显示维度采集配置', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '维度采集配置' })).toBeVisible()
      await expect(page.locator('text=01·基本信息')).toBeVisible()
      await expect(page.locator('text=02·K线数据')).toBeVisible()
    })

    test('应显示采集日志区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '采集日志' })).toBeVisible()
      await expect(page.locator('text=AKShare 服务连接成功')).toBeVisible()
    })

    test('应显示全局参数', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
      await expect(page.locator('text=最大标的数')).toBeVisible()
      await expect(page.locator('text=批量大小')).toBeVisible()
      await expect(page.locator('text=每分钟限流')).toBeVisible()
    })
  })
})