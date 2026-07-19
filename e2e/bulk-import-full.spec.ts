/**
 * @test_id V9-TEST-E2E-005
 * @covers_docs []
 */
import { test, expect } from '@playwright/test'

const STOCK_DATA = [
  { code: '300712.SZ', name: '永福股份' },
  { code: '300670.SZ', name: '大烨智能' },
  { code: '300128.SZ', name: '锦富技术' },
  { code: '300518.SZ', name: '新迅达' },
  { code: '300252.SZ', name: '金信诺' },
  { code: '300778.SZ', name: '新城市' },
  { code: '300227.SZ', name: '光韵达' },
  { code: '300926.SZ', name: '博俊科技' },
  { code: '301002.SZ', name: '崧盛股份' },
  { code: '300519.SZ', name: '新光药业' },
  { code: '688093.SH', name: '世华科技' },
  { code: '688252.SH', name: '天德钰' },
  { code: '688065.SH', name: '凯赛生物' },
  { code: '688805.SH', name: '健信超导' },
  { code: '688306.SH', name: '均普智能' },
  { code: '688179.SH', name: '阿拉丁' },
  { code: '688615.SH', name: '合合信息' },
  { code: '688371.SH', name: '菲沃泰' },
  { code: '688778.SH', name: '厦钨新能' },
  { code: '688334.SH', name: '西高院' },
]

const TEST_GROUP_NAME = '批量导入测试组'

test.describe('批量导入完整流程测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/input')
    await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  })

  test.describe('入口与界面验证', () => {
    test('应展示批量导入按钮', async ({ page }) => {
      await expect(page.locator('main button:has-text("批量导入")')).toBeVisible()
    })

    test('批量导入面板应包含输入模式切换', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      await expect(page.locator('button:has-text("粘贴文本")')).toBeVisible()
      await expect(page.locator('button:has-text("上传文件")')).toBeVisible()
    })

    test('应包含目标分组选择', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      await expect(page.getByLabel('批量导入目标分组')).toBeVisible()
    })

    test('应包含下载模板按钮', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      await expect(page.locator('button:has-text("下载模板")')).toBeVisible()
    })
  })

  test.describe('文本粘贴导入', () => {
    test('应正确解析带交易所后缀的格式', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = STOCK_DATA.map(s => `${s.code},${s.name}`).join('\n')
      await page.locator('textarea').fill(importText)

      await expect(page.locator('text=共 20 条')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=有效 20')).toBeVisible()
      await expect(page.locator('text=重复 0')).toBeVisible()
      await expect(page.locator('text=无效 0')).toBeVisible()
    })

    test('应正确解析纯代码格式（无交易所后缀）', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = STOCK_DATA.map(s => `${s.code.split('.')[0]},${s.name}`).join('\n')
      await page.locator('textarea').fill(importText)

      await expect(page.locator('text=共 20 条')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=有效 20')).toBeVisible()
    })

    test('预览表格应正确显示标准化代码', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = STOCK_DATA.slice(0, 3).map(s => `${s.code},${s.name}`).join('\n')
      await page.locator('textarea').fill(importText)

      await expect(page.locator('tbody tr')).toHaveCount(3)
      await expect(page.locator('tbody td:has-text("300712")').first()).toBeVisible()
      await expect(page.locator('tbody td:has-text("永福股份")').first()).toBeVisible()
    })
  })

  test.describe('文件上传导入', () => {
    test('应支持 CSV 文件上传', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      await page.locator('button:has-text("上传文件")').click()

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'stock_import_template.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          '序号,股票代码,股票简称\n' +
          STOCK_DATA.slice(0, 5).map((s, i) => `${i + 1},${s.code},${s.name}`).join('\n')
        ),
      })

      await expect(page.locator('text=共 5 条')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=有效 5')).toBeVisible()
    })
  })

  test.describe('导入执行与验证', () => {
    test('应成功导入有效股票到股票池', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = STOCK_DATA.slice(0, 5).map(s => `${s.code},${s.name}`).join('\n')
      await page.locator('textarea').fill(importText)

      await page.locator('button:has-text("确认导入")').click()

      await expect(page.locator('text=批量导入完成')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('text=成功 5 条')).toBeVisible()
    })

    test('导入进度条应正确显示', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = STOCK_DATA.map(s => `${s.code},${s.name}`).join('\n')
      await page.locator('textarea').fill(importText)

      await page.locator('button:has-text("确认导入")').click()

      await expect(page.locator('text=导入进度').first()).toBeVisible({ timeout: 5000 })

      await expect(page.locator('text=批量导入完成')).toBeVisible({ timeout: 15000 })
    })
  })

  test.describe('重复检测与错误处理', () => {
    test('重复导入同一股票应被标记为重复', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = `${STOCK_DATA[0].code},${STOCK_DATA[0].name}\n${STOCK_DATA[0].code},${STOCK_DATA[0].name}`
      await page.locator('textarea').fill(importText)

      await expect(page.locator('text=共 2 条')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=重复 1')).toBeVisible()
    })

    test('已存在于股票池的股票应被标记为重复', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = `${STOCK_DATA[0].code},${STOCK_DATA[0].name}`
      await page.locator('textarea').fill(importText)
      await page.locator('button:has-text("确认导入")').click()
      await expect(page.locator('text=批量导入完成')).toBeVisible({ timeout: 10000 })

      await page.locator('button:has-text("清空")').click()
      await page.locator('textarea').fill(importText)

      await expect(page.locator('text=重复 1')).toBeVisible({ timeout: 5000 })
    })

    test('无效格式应被标记为无效', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = `无效代码,测试股票\n123,短代码\nabc123,字母代码`
      await page.locator('textarea').fill(importText)

      await expect(page.locator('text=共 3 条')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=无效 3')).toBeVisible()
    })
  })

  test.describe('边界情况测试', () => {
    test('空输入时确认导入按钮应禁用', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      
      const confirmButton = page.locator('button:has-text("确认导入")')
      await expect(confirmButton).toBeDisabled()
    })

    test('仅空格输入时确认导入按钮应禁用', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()
      await page.locator('textarea').fill('   \n\n  ')
      
      const confirmButton = page.locator('button:has-text("确认导入")')
      await expect(confirmButton).toBeDisabled()
    })

    test('混合有效与无效数据应正确分类', async ({ page }) => {
      await page.locator('main button:has-text("批量导入")').click()

      const importText = `${STOCK_DATA[0].code},${STOCK_DATA[0].name}\n无效代码,测试\n${STOCK_DATA[1].code},${STOCK_DATA[1].name}`
      await page.locator('textarea').fill(importText)

      await expect(page.locator('text=共 3 条')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=有效 2')).toBeVisible()
      await expect(page.locator('text=无效 1')).toBeVisible()
    })
  })

  test.describe('控制台日志验证', () => {
    test('导入过程应输出关键日志', async ({ page }) => {
      const logs: string[] = []
      page.on('console', (msg) => {
        if (msg.text().includes('[batchImport]') || msg.text().includes('[inputService]')) {
          logs.push(msg.text())
        }
      })

      await page.locator('main button:has-text("批量导入")').click()
      await page.locator('textarea').fill(`${STOCK_DATA[0].code},${STOCK_DATA[0].name}`)
      await page.locator('button:has-text("确认导入")').click()

      await expect(page.locator('text=批量导入完成')).toBeVisible({ timeout: 10000 })

      expect(logs.length).toBeGreaterThan(0)

      const parseLog = logs.find(l => l.includes('解析'))
      expect(parseLog).toBeDefined()

      const importLog = logs.find(l => l.includes('导入进度') || l.includes('导入完成'))
      expect(importLog).toBeDefined()
    })
  })
})
