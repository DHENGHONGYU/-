import { test, expect } from '@playwright/test'

test.describe('分析舱扩展功能测试', () => {
  test.describe('策略回测页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis/backtest')
      await expect(page.getByRole('heading', { name: '策略回测', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示策略回测标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '策略回测', level: 1 })).toBeVisible()
    })

    test('应显示回测配置区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '回测配置' })).toBeVisible()
    })

    test('应显示策略类型下拉框', async ({ page }) => {
      const combobox = page.getByRole('combobox').first()
      await expect(combobox).toBeVisible()
      await expect(combobox).toHaveValue('hot_sector')
    })

    test('应显示开始日期输入框', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '开始日期' })).toBeVisible()
    })

    test('应显示结束日期输入框', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '结束日期' })).toBeVisible()
    })

    test('应显示初始资金输入框', async ({ page }) => {
      const spinbutton = page.getByRole('spinbutton', { name: '初始资金（元）' })
      await expect(spinbutton).toBeVisible()
      await expect(spinbutton).toHaveValue('1000000')
    })

    test('应显示手续费和滑点提示', async ({ page }) => {
      await expect(page.getByText('手续费率: 0.03%')).toBeVisible()
      await expect(page.getByText('滑点: 0.1%')).toBeVisible()
      await expect(page.getByText('单股最大仓位: 20%')).toBeVisible()
    })

    test('应显示开始回测按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '开始回测' })).toBeVisible()
    })

    test('无结果时清除结果按钮应禁用', async ({ page }) => {
      await expect(page.getByRole('button', { name: '清除结果' })).toBeDisabled()
    })

    test('应显示初始引导提示', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '开始策略回测' })).toBeVisible()
      await expect(page.getByText('选择策略类型和日期范围，点击"开始回测"按钮验证策略绩效')).toBeVisible()
    })
  })

  test.describe('评分文档页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis/score-docs')
      await expect(page.getByRole('heading', { name: '评分文档版本库', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示评分文档版本库标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '评分文档版本库', level: 1 })).toBeVisible()
    })

    test('应显示副标题说明', async ({ page }) => {
      await expect(page.getByText('查看与管理 V6 评分文档版本')).toBeVisible()
    })

    test('应显示股票代码下拉框', async ({ page }) => {
      const combobox = page.getByRole('combobox', { name: '股票代码' })
      await expect(combobox).toBeVisible()
      await expect(combobox.locator('option').first()).toHaveText('请选择股票代码')
    })

    test('未选择股票时刷新按钮应禁用', async ({ page }) => {
      await expect(page.getByRole('button', { name: '刷新' })).toBeDisabled()
    })

    test('未选择股票时导出按钮应禁用', async ({ page }) => {
      await expect(page.getByRole('button', { name: '导出全部 Markdown' })).toBeDisabled()
    })

    test('应显示请选择股票代码提示', async ({ page }) => {
      await expect(page.getByRole('paragraph').filter({ hasText: '请选择股票代码' })).toBeVisible()
    })

    test('应显示面包屑导航', async ({ page }) => {
      await expect(page.getByRole('link', { name: '首页' })).toBeVisible()
      await expect(page.getByRole('link', { name: '分析舱' })).toBeVisible()
    })
  })

  test.describe('智能资讯页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis/news')
      await expect(page.getByRole('heading', { name: '智能资讯', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示智能资讯标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '智能资讯', level: 1 })).toBeVisible()
    })

    test('应显示副标题说明', async ({ page }) => {
      await expect(page.getByText('资讯抓取、情感分析与关联个股')).toBeVisible()
    })

    test('应显示生成模拟资讯按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '生成模拟资讯' })).toBeVisible()
    })

    test('应显示刷新按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    })

    test('应显示关键词搜索输入框', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '关键词' })).toBeVisible()
    })

    test('应显示分类输入框', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '分类' })).toBeVisible()
    })

    test('应显示情感筛选下拉框', async ({ page }) => {
      const combobox = page.getByRole('combobox', { name: '情感' })
      await expect(combobox).toBeVisible()
      await expect(combobox.locator('option:checked')).toHaveText('全部')
    })

    test('应显示来源输入框', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '来源' })).toBeVisible()
    })

    test('应显示重置按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '重置' })).toBeVisible()
    })

    test('应显示暂无资讯初始状态', async ({ page }) => {
      await expect(page.getByText('暂无资讯，点击生成模拟资讯')).toBeVisible()
    })
  })

  test.describe('行业分析页面（404）', () => {
    test('行业分析页面应返回404', async ({ page }) => {
      await page.goto('/#/analysis/industry')
      await expect(page.getByRole('heading', { name: '404' })).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('页面未找到')).toBeVisible()
    })
  })
})