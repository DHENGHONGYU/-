/**
 * @test_id V9-TEST-E2E-018
 * @covers_docs [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-BACK-025]
 */
import { test, expect } from '@playwright/test'

test.describe('交易舱功能测试', () => {
  test.describe('交易舱首页', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/trading')
      await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible({ timeout: 10000 })
    })

    test('应显示交易舱标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible()
    })

    test('应显示加载观察池按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '加载观察池' })).toBeVisible()
    })

    test('应显示加载持仓按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '加载持仓' })).toBeVisible()
    })

    test('应显示扫描信号按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '扫描信号' })).toBeVisible()
    })

    test('应显示构建核心组合按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '构建核心组合' })).toBeVisible()
    })

    test('应显示观察池交易建议区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '观察池交易建议' })).toBeVisible()
    })

    test('应显示核心稀缺主题组合区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '核心稀缺主题组合' })).toBeVisible()
    })

    test('应显示刷新组合按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '刷新组合' })).toBeVisible()
    })

    test('应显示持仓订单区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '持仓订单' })).toBeVisible()
    })

    test('侧边栏应显示交易模块导航', async ({ page }) => {
      await expect(page.getByRole('button', { name: '交易舱首页' })).toBeVisible()
      await expect(page.getByRole('button', { name: '交易信号' })).toBeVisible()
      await expect(page.getByRole('button', { name: '模拟持仓' })).toBeVisible()
      await expect(page.getByRole('button', { name: '执行计划' })).toBeVisible()
      await expect(page.getByRole('button', { name: '策略快照' })).toBeVisible()
    })
  })

  test.describe('模拟持仓页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/trading/holdings')
      await expect(page.getByRole('heading', { name: '交易持仓管理', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示持仓管理标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '交易持仓管理', level: 1 })).toBeVisible()
    })

    test('应显示副标题说明', async ({ page }) => {
      await expect(page.getByText('统一管理投资组合持仓，支持策略评分对比与资产配置全局视图')).toBeVisible()
    })

    test('应显示持仓记录计数', async ({ page }) => {
      await expect(page.getByText('共 0 条持仓记录')).toBeVisible()
    })

    test('应显示开始日期筛选', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '开始日期' })).toBeVisible()
    })

    test('应显示结束日期筛选', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '结束日期' })).toBeVisible()
    })

    test('应显示交易方向下拉框', async ({ page }) => {
      const combobox = page.getByRole('combobox', { name: '交易方向' })
      await expect(combobox).toBeVisible()
      await expect(combobox.locator('option:checked')).toHaveText('全部')
    })

    test('应显示证券代码搜索框', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '证券代码或名称搜索' })).toBeVisible()
    })

    test('应显示搜索按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '搜索' })).toBeVisible()
    })

    test('应显示重置按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '重置' })).toBeVisible()
    })

    test('应显示导出 Excel 按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '导出 Excel' })).toBeVisible()
    })

    test('应显示持仓表格表头', async ({ page }) => {
      await expect(page.getByRole('columnheader', { name: '证券代码' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '证券名称' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '持仓数量' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '当前价格' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '成本价' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '浮动盈亏' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '市值占比' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '策略类型' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '操作' })).toBeVisible()
    })

    test('应显示暂无持仓数据状态', async ({ page }) => {
      await expect(page.getByText('暂无持仓数据')).toBeVisible()
      await expect(page.getByText('调整筛选条件或添加持仓后重试')).toBeVisible()
    })

    test('应显示分页控件', async ({ page }) => {
      await expect(page.getByText('共 0 条', { exact: true })).toBeVisible()
      await expect(page.getByRole('combobox', { name: '每页显示条数' })).toBeVisible()
      await expect(page.getByRole('button', { name: '跳转' })).toBeVisible()
    })
  })

  test.describe('策略快照页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/trading/strategy-snapshots')
      await expect(page.getByRole('heading', { name: '策略快照', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示策略快照标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '策略快照', level: 1 })).toBeVisible()
    })

    test('应显示副标题说明', async ({ page }) => {
      await expect(page.getByText('三策略分组快照、版本管理与变更追踪')).toBeVisible()
    })

    test('应显示当前策略和历史快照Tab', async ({ page }) => {
      await expect(page.getByRole('tab', { name: '当前策略' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '历史快照' })).toBeVisible()
    })

    test('应显示股票/评分统计信息', async ({ page }) => {
      await expect(page.locator('text=股票').first()).toBeVisible()
      await expect(page.locator('text=V6 评分').first()).toBeVisible()
      await expect(page.locator('text=轮动评分').first()).toBeVisible()
    })

    test('应显示保存当前快照按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '保存当前快照' })).toBeVisible()
    })

    test('应显示三策略分组', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '核心稀缺' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '热点动量' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '价值洼地' })).toBeVisible()
    })

    test('三策略分组应显示暂无标的', async ({ page }) => {
      await expect(page.getByText('暂无标的')).toHaveCount(3)
    })

    test('应显示面包屑导航', async ({ page }) => {
      await expect(page.getByRole('link', { name: '首页' })).toBeVisible()
      await expect(page.getByRole('link', { name: '交易舱' })).toBeVisible()
    })
  })

  test.describe('执行计划页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/trading/execution-plans')
      await expect(page.getByRole('heading', { name: '执行计划', exact: true })).toBeVisible({ timeout: 10000 })
    })

    test('应显示执行计划标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '执行计划', exact: true })).toBeVisible()
    })

    test('应显示刷新按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    })

    test('应显示统计卡片', async ({ page }) => {
      await expect(page.getByText('活跃', { exact: true })).toBeVisible()
      await expect(page.getByText('待确认', { exact: true })).toBeVisible()
      await expect(page.getByText('今日执行', { exact: true })).toBeVisible()
    })

    test('应显示状态筛选Tab', async ({ page }) => {
      await expect(page.getByRole('tab', { name: '全部 (0)' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '活跃 (0)' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '已完成 (0)' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '已取消 (0)' })).toBeVisible()
      await expect(page.getByRole('tab', { name: '已复盘 (0)' })).toBeVisible()
    })

    test('应显示暂无执行计划状态', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '暂无执行计划' })).toBeVisible()
      await expect(page.getByText('扫描信号后将自动生成')).toBeVisible()
    })
  })

  test.describe('交易信号页面（404）', () => {
    test('交易信号页面应返回404', async ({ page }) => {
      await page.goto('/#/trading/signals')
      await expect(page.getByRole('heading', { name: '404' })).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('页面未找到')).toBeVisible()
    })
  })
})