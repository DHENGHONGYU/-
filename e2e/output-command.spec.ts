/**
 * @test_id V9-TEST-E2E-012
 * @covers_docs []
 */
import { test, expect } from '@playwright/test'

test.describe('输出舱功能测试', () => {
  test.describe('输出舱首页', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/output')
      await expect(page.getByRole('heading', { name: '输出舱', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示输出舱标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '输出舱', level: 1 })).toBeVisible()
    })

    test('应显示副标题说明', async ({ page }) => {
      await expect(page.getByText('报告导出与数据输出管理')).toBeVisible()
    })

    test('应显示功能模块标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '功能模块', level: 2 })).toBeVisible()
    })

    test('应显示研究报告卡片', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '研究报告' })).toBeVisible()
      await expect(page.getByText('生成和导出研究报告')).toBeVisible()
    })

    test('应显示交易复盘卡片', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '交易复盘' })).toBeVisible()
      await expect(page.getByText('交易记录回顾与复盘报告')).toBeVisible()
    })

    test('应显示数据导出卡片', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible()
      await expect(page.getByText('全量数据 JSON/CSV 导出')).toBeVisible()
    })

    test('应显示七个进入链接（与 OutputHubPage 7 卡片一致）', async ({ page }) => {
      // 真相源：src/pages/output/OutputHubPage.tsx OUTPUT_MODULES 数组（7 项，每项 1 个"进入"链接）
      const links = page.getByRole('link', { name: '进入' })
      await expect(links).toHaveCount(7)
    })

    test('侧边栏应显示输出模块导航（8 个按钮，与 sidebarConfig.ts 一致）', async ({ page }) => {
      // 真相源：src/config/sidebarConfig.ts output 分组（8 个按钮）
      // 注意：侧边栏无"输出舱首页"按钮，按钮文本为"研报复盘"而非"研究报告"
      await expect(page.getByRole('button', { name: '研报复盘' })).toBeVisible()
      await expect(page.getByRole('button', { name: '仪表盘' })).toBeVisible()
      await expect(page.getByRole('button', { name: '数据导出' })).toBeVisible()
      await expect(page.getByRole('button', { name: '交易复盘' })).toBeVisible()
      await expect(page.getByRole('button', { name: '复盘向导' })).toBeVisible()
      await expect(page.getByRole('button', { name: '预测校验' })).toBeVisible()
      await expect(page.getByRole('button', { name: '周期复盘' })).toBeVisible()
      await expect(page.getByRole('button', { name: '因子画板' })).toBeVisible()
    })
  })

  test.describe('研究报告页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/output/research')
      await expect(page.getByRole('heading', { name: '研究报告', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示研究报告标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '研究报告', level: 1 })).toBeVisible()
    })

    test('应显示副标题说明', async ({ page }) => {
      await expect(page.getByText('基于评分文档生成个股研究报告')).toBeVisible()
    })

    test('应显示返回按钮', async ({ page }) => {
      await expect(page.getByRole('link', { name: '返回' })).toBeVisible()
    })

    test('应显示选择股票下拉框', async ({ page }) => {
      const combobox = page.getByRole('combobox')
      await expect(combobox).toBeVisible()
      await expect(combobox.locator('option').first()).toHaveText('请选择股票')
    })

    test('未选择股票时生成报告按钮应禁用', async ({ page }) => {
      await expect(page.getByRole('button', { name: '生成报告' })).toBeDisabled()
    })
  })
})

test.describe('命令舱功能测试', () => {
  test.describe('总控舱首页', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/command')
      await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示总控舱标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible()
    })

    test('应显示副标题说明', async ({ page }) => {
      await expect(page.getByText('系统监控 · 配置管理')).toBeVisible()
    })

    test('应显示系统监控区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '总控舱 · 系统监控' })).toBeVisible()
    })

    test('应显示刷新统计按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '刷新统计' })).toBeVisible()
    })

    test('应显示重置数据按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '重置数据' })).toBeVisible()
    })

    test('应显示V6迁移按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'V6 迁移' })).toBeVisible()
    })

    test('应显示统计卡片', async ({ page }) => {
      await expect(page.getByText('stocks', { exact: true })).toBeVisible()
      await expect(page.getByText('orders', { exact: true })).toBeVisible()
      await expect(page.getByText('scores', { exact: true })).toBeVisible()
    })

    test('应显示智能体任务队列区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '智能体任务队列' })).toBeVisible()
    })

    test('应显示系统日志流区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '系统日志流' })).toBeVisible()
    })

    test('侧边栏应显示总控导航', async ({ page }) => {
      await expect(page.getByRole('button', { name: '总控舱首页' })).toBeVisible()
      await expect(page.getByRole('button', { name: '系统监控' })).toBeVisible()
      await expect(page.getByRole('button', { name: '配置管理' })).toBeVisible()
    })

    test('侧边栏应显示智能体导航', async ({ page }) => {
      await expect(page.getByRole('button', { name: '智能体总控台' })).toBeVisible()
      await expect(page.getByRole('button', { name: '智能体注册表' })).toBeVisible()
      await expect(page.getByRole('button', { name: '任务触发' })).toBeVisible()
      await expect(page.getByRole('button', { name: '任务列表' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'LLM 管理' })).toBeVisible()
    })

    test('侧边栏应显示MCP服务导航', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'MCP Server 管理' })).toBeVisible()
    })
  })

  test.describe('系统监控页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/command/monitor')
      await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示总控舱标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible()
    })

    test('应显示系统监控区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '总控舱 · 系统监控' })).toBeVisible()
    })
  })

  test.describe('配置管理页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/command/config')
      await expect(page.getByRole('heading', { name: '配置管理', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示配置管理标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '配置管理', level: 1 })).toBeVisible()
    })
  })

  test.describe('智能体总控台页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/command/agents')
      await expect(page.getByRole('heading', { name: '智能体总控台', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示智能体总控台标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '智能体总控台', level: 1 })).toBeVisible()
    })

    test('应显示统计卡片', async ({ page }) => {
      await expect(page.getByText('已注册智能体')).toBeVisible()
      await expect(page.getByText('运行中任务')).toBeVisible()
      await expect(page.getByText('已完成任务')).toBeVisible()
      await expect(page.getByText('失败任务')).toBeVisible()
    })

    test('应显示功能导航区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '功能导航', level: 2 })).toBeVisible()
    })
  })

  test.describe('MCP Server 管理页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/command/mcp-servers')
      await expect(page.getByRole('heading', { name: 'MCP Server 管理', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示MCP Server管理标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'MCP Server 管理', level: 1 })).toBeVisible()
    })
  })
})