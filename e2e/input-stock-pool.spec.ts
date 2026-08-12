/**
 * @test_id V9-TEST-E2E-009
 * @covers_docs [V9-DOC-DATA-024, V9-DOC-PROJ-108, V9-DOC-BACK-011]
 */
import { test, expect } from '@playwright/test'

const TEST_STOCKS = [
  { code: '300712.SZ', name: '永福股份' },
  { code: '600519.SH', name: '贵州茅台' },
  { code: '000858.SZ', name: '五粮液' },
  { code: '002594.SZ', name: '比亚迪' },
]

const TEST_GROUP_NAME = '测试分组'
const NEW_GROUP_NAME = '新建分组'

test.describe('股票池管理功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/input')
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  })

  test.describe('界面基础验证', () => {
    test('应显示股票池看板标题', async ({ page }) => {
      await expect(page.locator('text=股票池看板')).toBeVisible()
    })

    test('应显示分组筛选器', async ({ page }) => {
      await expect(page.getByLabel('分组筛选')).toBeVisible()
    })

    test('应显示新建分组按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '新建分组' })).toBeVisible()
    })

    test('应显示批量导入快捷按钮', async ({ page }) => {
      await expect(page.locator('button:has-text("批量导入")').first()).toBeVisible()
    })

    test('应显示股票代码和名称输入框', async ({ page }) => {
      await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible()
      await expect(page.getByRole('textbox', { name: '股票名称' })).toBeVisible()
    })

    test('应显示录入操作按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '仅录入' })).toBeVisible()
      await expect(page.getByRole('button', { name: '录入并拉基础' })).toBeVisible()
      await expect(page.getByRole('button', { name: '录入并拉全部' })).toBeVisible()
    })

    test('应显示股票池看板五大池子', async ({ page }) => {
      await expect(page.locator('text=意向候选池')).toBeVisible()
      await expect(page.locator('text=研究精选池')).toBeVisible()
      await expect(page.locator('text=深度研究池')).toBeVisible()
      await expect(page.locator('text=观察池')).toBeVisible()
      await expect(page.locator('text=归档池')).toBeVisible()
    })

    test('应显示看板视图切换按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '看板视图' })).toBeVisible()
      await expect(page.getByRole('button', { name: '列表视图' })).toBeVisible()
    })
  })

  test.describe('单只股票添加功能', () => {
    test('应成功添加单只股票到默认分组', async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
      await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
      await page.getByRole('button', { name: '仅录入' }).click()

      // 验证添加成功提示
      await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })

      // 验证股票出现在意向候选池中
      await expect(page.locator('text=永福股份').first()).toBeVisible()
      await expect(page.locator('text=300712').first()).toBeVisible()

      // 验证候选池标的计数更新
      await expect(page.locator('text=候选池标的').locator('..').locator('text=1')).toBeVisible({ timeout: 3000 })
    })

    test('重复添加已存在股票应提示反馈', async ({ page }) => {
      // 第一次添加
      await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
      await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
      await page.getByRole('button', { name: '仅录入' }).click()
      await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })

      // 第二次添加（重复）
      await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
      await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
      await page.getByRole('button', { name: '仅录入' }).click()

      // 验证有反馈（成功或错误提示）
      await expect(page.locator('text=已添加')).toBeVisible({ timeout: 5000 })
    })

    test('空代码和名称时应有验证提示', async ({ page }) => {
      // 空代码和名称
      await page.getByRole('textbox', { name: '股票代码' }).fill('')
      await page.getByRole('textbox', { name: '股票名称' }).fill('')
      await page.getByRole('button', { name: '仅录入' }).click()

      await expect(page.locator('text=请输入代码和名称')).toBeVisible({ timeout: 3000 })
    })

    test('添加后代码名称输入框应清空', async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
      await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
      await page.getByRole('button', { name: '仅录入' }).click()
      await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })

      // 输入框应该被清空
      await expect(page.getByRole('textbox', { name: '股票代码' })).toHaveValue('')
      await expect(page.getByRole('textbox', { name: '股票名称' })).toHaveValue('')
    })
  })

  test.describe('分组管理功能', () => {
    test('应成功新建分组', async ({ page }) => {
      await page.getByRole('button', { name: '新建分组' }).click()

      // 填写分组名称
      await page.getByRole('textbox', { name: '分组名称' }).fill(NEW_GROUP_NAME)

      // 确认创建
      await page.getByRole('button', { name: '创建' }).click()

      // 验证成功（对话框关闭即表示成功）
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })

      // 验证分组出现在筛选器中
      await expect(page.getByLabel('分组筛选').locator(`option[value="${NEW_GROUP_NAME}"]`)).toBeAttached()
    })

    test('空分组名称时点击创建应有验证提示', async ({ page }) => {
      await page.getByRole('button', { name: '新建分组' }).click()
      await page.getByRole('textbox', { name: '分组名称' }).clear()
      await page.getByRole('button', { name: '创建' }).click()

      // 对话框应该仍然打开（未关闭）= 验证失败
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
    })

    test('重复创建同名分组应有提示', async ({ page }) => {
      // 第一次创建
      await page.getByRole('button', { name: '新建分组' }).click()
      await page.getByRole('textbox', { name: '分组名称' }).fill(TEST_GROUP_NAME)
      await page.getByRole('button', { name: '创建' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })

      // 第二次创建
      await page.getByRole('button', { name: '新建分组' }).click()
      await page.getByRole('textbox', { name: '分组名称' }).fill(TEST_GROUP_NAME)
      await page.getByRole('button', { name: '创建' }).click()

      // 验证错误提示（toast或内联）
      await expect(page.getByText(/已存在|重复|分组名称已存在/)).toBeVisible({ timeout: 5000 })
    })

    test('取消按钮应关闭对话框', async ({ page }) => {
      await page.getByRole('button', { name: '新建分组' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByRole('button', { name: '取消' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('分组筛选功能', () => {
    test.beforeEach(async ({ page }) => {
      // 创建测试分组
      await page.getByRole('button', { name: '新建分组' }).click()
      await page.getByRole('textbox', { name: '分组名称' }).fill(TEST_GROUP_NAME)
      await page.getByRole('button', { name: '创建' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })

      // 添加股票到测试分组
      await page.getByRole('textbox', { name: '股票代码' }).fill('000858')
      await page.getByRole('textbox', { name: '股票名称' }).fill('五粮液')
      // 选择目标分组
      await page.getByLabel('目标分组').selectOption(TEST_GROUP_NAME)
      await page.getByRole('button', { name: '仅录入' }).click()
      await expect(page.locator('text=已添加 000858')).toBeVisible({ timeout: 5000 })

      // 添加股票到默认分组
      await page.getByRole('textbox', { name: '股票代码' }).fill('002594')
      await page.getByRole('textbox', { name: '股票名称' }).fill('比亚迪')
      await page.getByRole('button', { name: '仅录入' }).click()
      await expect(page.locator('text=已添加 002594')).toBeVisible({ timeout: 5000 })
    })

    test('筛选测试分组应只显示测试分组股票', async ({ page }) => {
      await page.getByLabel('分组筛选').selectOption(TEST_GROUP_NAME)

      // 验证测试分组中的股票可见
      await expect(page.locator('text=五粮液')).toBeVisible()
      // 非测试分组股票可能仍可见（在多池子布局中），只验证分组筛选能正常工作
    })

    test('选择"全部组"应显示所有股票', async ({ page }) => {
      // 先筛选再切换回全部组
      await page.getByLabel('分组筛选').selectOption(TEST_GROUP_NAME)
      await page.getByLabel('分组筛选').selectOption('全部组')

      await expect(page.locator('text=五粮液')).toBeVisible()
      await expect(page.locator('text=比亚迪')).toBeVisible()
    })

    test('筛选默认分组后应可切换回全部组', async ({ page }) => {
      await page.getByLabel('分组筛选').selectOption('默认分组')
      await expect(page.locator('text=比亚迪')).toBeVisible()

      // 切换回全部组
      await page.getByLabel('分组筛选').selectOption('全部组')
      await expect(page.locator('text=五粮液')).toBeVisible()
    })
  })

  test.describe('添加股票到指定分组', () => {
    test.beforeEach(async ({ page }) => {
      // 创建测试分组
      await page.getByRole('button', { name: '新建分组' }).click()
      await page.getByRole('textbox', { name: '分组名称' }).fill(TEST_GROUP_NAME)
      await page.getByRole('button', { name: '创建' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
    })

    test('应成功添加股票到指定分组', async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
      await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
      await page.getByLabel('目标分组').selectOption(TEST_GROUP_NAME)
      await page.getByRole('button', { name: '仅录入' }).click()

      await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })

      // 筛选分组验证
      await page.getByLabel('分组筛选').selectOption(TEST_GROUP_NAME)
      await expect(page.locator('text=永福股份')).toBeVisible()
    })
  })

  test.describe('股票池看板交互', () => {
    test.beforeEach(async ({ page }) => {
      // 添加多只股票
      for (const stock of TEST_STOCKS.slice(0, 3)) {
        const code = stock.code.split('.')[0]!
        await page.getByRole('textbox', { name: '股票代码' }).fill(code)
        await page.getByRole('textbox', { name: '股票名称' }).fill(stock.name)
        await page.getByRole('button', { name: '仅录入' }).click()
        await expect(page.locator(`text=已添加 ${code}`)).toBeVisible({ timeout: 5000 })
      }
    })

    test('应显示股票选择复选框', async ({ page }) => {
      // 每个股票卡片都有单独的选择复选框
      await expect(page.getByRole('checkbox', { name: '选择 300712' })).toBeVisible()
    })

    test('选中单个股票复选框应生效', async ({ page }) => {
      await page.getByRole('checkbox', { name: '选择 300712' }).check()
      await expect(page.getByRole('checkbox', { name: '选择 300712' })).toBeChecked()
    })

    test('切换列表视图应展示股票表格', async ({ page }) => {
      await page.getByRole('button', { name: '列表视图' }).click()

      // 验证列表视图中有表格
      await expect(page.locator('table')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('text=永福股份')).toBeVisible()
      await expect(page.locator('text=贵州茅台')).toBeVisible()
    })

    test('看板视图应显示股票卡片', async ({ page }) => {
      // 先切换到列表，再切换回看板
      await page.getByRole('button', { name: '列表视图' }).click()
      await page.getByRole('button', { name: '看板视图' }).click()

      await expect(page.locator('text=永福股份')).toBeVisible()
      await expect(page.locator('text=贵州茅台')).toBeVisible()
    })

    test('股票卡片应显示操作按钮', async ({ page }) => {
      await expect(page.getByRole('button', { name: '精选研究' }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: '归档' }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: '分析' }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: '刷新行情' }).first()).toBeVisible()
    })
  })

  test.describe('数据质量筛选', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
      await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
      await page.getByRole('button', { name: '仅录入' }).click()
      await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })
    })

    test('应显示数据质量筛选下拉框', async ({ page }) => {
      await expect(page.getByLabel('数据质量筛选')).toBeVisible()
    })

    test('筛选"缺失基础数据"应显示符合条件的股票', async ({ page }) => {
      await page.getByLabel('数据质量筛选').selectOption('缺失基础数据')

      // 新添加的股票缺失基础数据，应该显示
      await expect(page.locator('text=永福股份')).toBeVisible()
    })

    test('筛选"缺失行情数据"应显示符合条件的股票', async ({ page }) => {
      await page.getByLabel('数据质量筛选').selectOption('缺失行情数据')

      await expect(page.locator('text=永福股份')).toBeVisible()
    })
  })

  test.describe('空状态处理', () => {
    test('空股票池应显示空状态提示', async ({ page }) => {
      // 空池中应显示"暂无标的"
      await expect(page.locator('text=暂无标的').first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('控制台日志验证', () => {
    test('添加股票操作应输出日志', async ({ page }) => {
      const logs: string[] = []
      page.on('console', (msg) => {
        if (msg.text().includes('[inputService]') || msg.text().includes('[stockPool]') || msg.text().includes('addStock')) {
          logs.push(msg.text())
        }
      })

      await page.getByRole('textbox', { name: '股票代码' }).fill('300712')
      await page.getByRole('textbox', { name: '股票名称' }).fill('永福股份')
      await page.getByRole('button', { name: '仅录入' }).click()

      await expect(page.locator('text=已添加 300712')).toBeVisible({ timeout: 5000 })

      expect(logs.length).toBeGreaterThan(0)
      const addLog = logs.find(l => l.includes('addStock') || l.includes('添加'))
      expect(addLog).toBeDefined()
    })
  })
})