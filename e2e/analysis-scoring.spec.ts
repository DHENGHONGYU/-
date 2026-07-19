import { test, expect } from '@playwright/test'

test.describe('分析舱功能测试', () => {
  test.describe('分析舱首页', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis')
      await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
    })

    test('应显示分析模板快捷入口标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible()
    })

    test('应显示三个快捷入口卡片', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '快速个股评分' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '行业对比分析' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '策略回测向导' })).toBeVisible()
    })

    test('应显示分析舱 · V6 九维评分区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '分析舱 · V6 九维评分' })).toBeVisible()
    })

    test('应显示加载标的按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '加载标的' })).toBeVisible()
    })

    test('侧边栏应显示分析模块导航', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'V4 行业评分' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'V6 个股评分' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'V6 智能评分' })).toBeVisible()
      await expect(page.getByRole('button', { name: '行业分析' })).toBeVisible()
      await expect(page.getByRole('button', { name: '策略回测' })).toBeVisible()
      await expect(page.getByRole('button', { name: '评分文档' })).toBeVisible()
      await expect(page.getByRole('button', { name: '智能资讯' })).toBeVisible()
    })
  })

  test.describe('V6 个股智能评分页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis/intelligent-score')
      await expect(page.getByRole('heading', { name: 'V6 个股智能评分' })).toBeVisible({ timeout: 10000 })
    })

    test('应显示V6智能评分标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'V6 个股智能评分' })).toBeVisible()
      await expect(page.getByText('多源资料综合评估')).toBeVisible()
    })

    test('应显示尚未评分状态', async ({ page }) => {
      await expect(page.locator('text=尚未评分')).toBeVisible()
      await expect(page.locator('text=建议每周至少运行两次大模型评分')).toBeVisible()
    })

    test('应显示立即评分按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '立即评分' })).toBeVisible()
    })

    test('应显示选择标的下拉框', async ({ page }) => {
      await expect(page.getByRole('combobox', { name: '选择标的股票' })).toBeVisible()
    })

    test('应显示手动输入股票代码输入框', async ({ page }) => {
      const input = page.getByRole('textbox', { name: '手动输入股票代码' })
      await expect(input).toBeVisible()
      await expect(input).toHaveAttribute('placeholder', '或直接输入代码，如 600519.SH')
    })

    test('应显示大模型配置展开按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '展开' })).toBeVisible()
    })

    test('应显示补充资料上传按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '补充资料上传' })).toBeVisible()
    })

    test('应显示分析报告文本输入框', async ({ page }) => {
      const textarea = page.getByRole('textbox', { name: '分析报告文本' })
      await expect(textarea).toBeVisible()
      await expect(textarea).toHaveAttribute('placeholder', '在此粘贴行业分析报告、研报摘要、关键事件等文本...')
    })

    test('应显示开始智能评分按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '开始智能评分' })).toBeVisible()
    })

    test('应显示评分进度区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '评分进度' })).toBeVisible()
    })

    test('评分进度应显示七个步骤', async ({ page }) => {
      await expect(page.locator('text=读取基础数据')).toBeVisible()
      await expect(page.locator('text=V6 引擎计算')).toBeVisible()
      await expect(page.locator('text=解析补充文件')).toBeVisible()
      await expect(page.locator('text=整理行业报告')).toBeVisible()
      await expect(page.locator('text=大模型分析')).toBeVisible()
      await expect(page.locator('text=解析评分')).toBeVisible()
      await expect(page.locator('text=保存结果')).toBeVisible()
    })
  })

  test.describe('V4 行业评分页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis/industry-score')
      await expect(page.getByRole('heading', { name: 'V4 行业评分 · 第四次工业革命稀缺核心资源' })).toBeVisible({ timeout: 10000 })
    })

    test('应显示V4行业评分标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'V4 行业评分 · 第四次工业革命稀缺核心资源' })).toBeVisible()
    })

    test('应显示尚未评分状态', async ({ page }) => {
      await expect(page.locator('text=尚未评分')).toBeVisible()
    })

    test('应显示行业赛道下拉框', async ({ page }) => {
      const combobox = page.getByRole('combobox', { name: '选择行业赛道' })
      await expect(combobox).toBeVisible()
      // 验证包含行业选项
      await expect(combobox.locator('option')).toHaveCount(15)
    })

    test('应显示赛道快捷标签按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'AI推理芯片' })).toBeVisible()
      await expect(page.getByRole('button', { name: '大模型应用' })).toBeVisible()
      await expect(page.getByRole('button', { name: '智能驾驶' })).toBeVisible()
      await expect(page.getByRole('button', { name: '人形机器人' })).toBeVisible()
    })

    test('应显示大模型配置展开按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '展开' })).toBeVisible()
    })

    test('应显示LLM未配置提示', async ({ page }) => {
      await expect(page.locator('text=LLM 未配置，无法开始评分')).toBeVisible()
    })

    test('运行行业智能评分按钮应禁用', async ({ page }) => {
      await expect(page.getByRole('button', { name: '运行行业智能评分' })).toBeDisabled()
    })

    test('应显示补充资料上传按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '补充资料上传' })).toBeVisible()
    })

    test('应显示行业分析报告文本输入框', async ({ page }) => {
      const textarea = page.getByRole('textbox', { name: '行业分析报告文本' })
      await expect(textarea).toBeVisible()
    })

    test('应显示评分进度区域', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '评分进度' })).toBeVisible()
      await expect(page.locator('text=读取行业 SKILL 数据')).toBeVisible()
      await expect(page.locator('text=大模型分析')).toBeVisible()
      await expect(page.locator('text=保存结果')).toBeVisible()
    })
  })

  test.describe('V6 个股评分页面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/#/analysis/stock-score')
      await expect(page.getByRole('heading', { name: '个股分析', level: 1 })).toBeVisible({ timeout: 10000 })
    })

    test('应显示个股分析标题', async ({ page }) => {
      await expect(page.getByRole('heading', { name: '个股分析', level: 1 })).toBeVisible()
    })

    test('应显示请指定股票代码提示', async ({ page }) => {
      await expect(page.getByText('请指定股票代码')).toBeVisible()
    })
  })
})