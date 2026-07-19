# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boundary\invalid-data.spec.ts >> 纯空白字符 >> 输入纯换行 → 导入按钮 disabled
- Location: boundary\invalid-data.spec.ts:58:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=共 0 条')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=共 0 条')

```

```yaml
- banner:
  - link "V9 智能投研复盘系统":
    - /url: "#/"
  - navigation:
    - button "📦输入舱"
    - button "🔬分析舱"
    - button "💹交易舱"
    - button "📊输出舱"
    - button "🎛️总控舱"
    - button "驾驶舱":
      - img
      - text: 驾驶舱
  - 'button "当前主题模式: 跟随系统，点击切换"':
    - img
    - text: system
  - text: 采集正常 信号强 00:00:06 v1.2.0
- complementary:
  - text: 📦 输入舱 意向候选池
  - list:
    - listitem:
      - button "录入看板":
        - img
        - text: 录入看板
    - listitem:
      - button "股票池看板（已迁分析舱）":
        - img
        - text: 股票池看板（已迁分析舱）
    - listitem:
      - button "批量导入":
        - img
        - text: 批量导入
    - listitem:
      - button "热门板块":
        - img
        - text: 热门板块
    - listitem:
      - button "本地知识库":
        - img
        - text: 本地知识库
  - text: 数据采集
  - list:
    - listitem:
      - button "采集测试":
        - img
        - text: 采集测试
    - listitem:
      - button "采集任务监控":
        - img
        - text: 采集任务监控
    - listitem:
      - button "七维采集配置":
        - img
        - text: 七维采集配置
    - listitem:
      - button "抓取引擎配置":
        - img
        - text: 抓取引擎配置
- main:
  - heading "输入舱" [level=1]
  - paragraph: 股票录入 · 批量导入 · 热门板块 · 采集测试
  - text: 1 上传/粘贴 → 2 预览确认 → 3 导入
  - heading "批量导入候选股票" [level=3]
  - button "下载模板"
  - button "粘贴文本"
  - button "上传文件"
  - paragraph: 支持 CSV 文本，格式：代码,名称 或 代码.交易所,名称（如 600519.SH,贵州茅台）
  - textbox "600519.SH,贵州茅台 000001.SZ,平安银行 300750.SZ,宁德时代":
    - /placeholder: "600519.SH,贵州茅台\n000001.SZ,平安银行\n300750.SZ,宁德时代"
  - text: 目标分组：
  - combobox "批量导入目标分组":
    - option "默认分组" [selected]
  - img
  - button "确认导入" [disabled]
```

# Test source

```ts
  1   | /**
  2   |  * E2E 边界测试 — 非法数据
  3   |  * 覆盖：特殊字符、纯空白、XSS payload、负数标的数量
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test'
  7   | import { navigateTo, ROUTES, INVALID_INPUTS } from '../utils/helpers'
  8   | 
  9   | test.describe('特殊字符导入', () => {
  10  | 
  11  |   test.beforeEach(async ({ page }) => {
  12  |     await navigateTo(page, ROUTES.input)
  13  |     await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  14  |     await page.locator('main button:has-text("批量导入")').click()
  15  |   })
  16  | 
  17  |   test('导入特殊字符 !@#$% → 无崩溃', async ({ page }) => {
  18  |     await page.locator('textarea').fill(INVALID_INPUTS[0]!)
  19  |     await page.waitForTimeout(500)
  20  |     // 页面应保持正常渲染，不崩溃
  21  |     await expect(page.locator('#root')).toBeAttached()
  22  |     // 特殊字符应被正常解析为无效行，页面不崩溃即为通过
  23  |   })
  24  | 
  25  |   test('导入特殊字符后确认按钮 disabled', async ({ page }) => {
  26  |     await page.locator('textarea').fill(INVALID_INPUTS[0]!)
  27  |     await page.waitForTimeout(500)
  28  |     const confirmBtn = page.getByRole('button', { name: '确认导入' })
  29  |     const count = await confirmBtn.count()
  30  |     if (count > 0) {
  31  |       await expect(confirmBtn).toBeDisabled()
  32  |     }
  33  |   })
  34  | })
  35  | 
  36  | test.describe('纯空白字符', () => {
  37  | 
  38  |   test.beforeEach(async ({ page }) => {
  39  |     await navigateTo(page, ROUTES.input)
  40  |     await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  41  |     await page.locator('main button:has-text("批量导入")').click()
  42  |   })
  43  | 
  44  |   test('输入纯空格 → 导入按钮 disabled', async ({ page }) => {
  45  |     await page.locator('textarea').fill(INVALID_INPUTS[1]!)
  46  |     await page.waitForTimeout(500)
  47  |     // 解析结果应为空
  48  |     const confirmBtn = page.getByRole('button', { name: '确认导入' })
  49  |     const count = await confirmBtn.count()
  50  |     if (count > 0) {
  51  |       await expect(confirmBtn).toBeDisabled()
  52  |     } else {
  53  |       // 无有效数据时确认按钮可能不存在
  54  |       await expect(page.locator('#root')).toBeAttached()
  55  |     }
  56  |   })
  57  | 
  58  |   test('输入纯换行 → 导入按钮 disabled', async ({ page }) => {
  59  |     await page.locator('textarea').fill(INVALID_INPUTS[2]!)
  60  |     await page.waitForTimeout(500)
> 61  |     await expect(page.locator('text=共 0 条')).toBeVisible({ timeout: 5000 })
      |                                              ^ Error: expect(locator).toBeVisible() failed
  62  |     const confirmBtn = page.getByRole('button', { name: '确认导入' })
  63  |     const count = await confirmBtn.count()
  64  |     if (count > 0) {
  65  |       await expect(confirmBtn).toBeDisabled()
  66  |     }
  67  |   })
  68  | })
  69  | 
  70  | test.describe('XSS payload', () => {
  71  | 
  72  |   test.beforeEach(async ({ page }) => {
  73  |     await navigateTo(page, ROUTES.input)
  74  |     await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  75  |     await page.locator('main button:has-text("批量导入")').click()
  76  |   })
  77  | 
  78  |   test('输入 XSS payload → 无弹窗/不渲染为 HTML', async ({ page }) => {
  79  |     // 先注册 dialog 监听，确保能捕获到任何可能的弹窗
  80  |     const dialogs: string[] = []
  81  |     page.on('dialog', async dialog => {
  82  |       dialogs.push(dialog.message())
  83  |       await dialog.dismiss()
  84  |     })
  85  | 
  86  |     await page.locator('textarea').fill(INVALID_INPUTS[3]!)
  87  |     await page.waitForTimeout(500)
  88  | 
  89  |     // 页面不应崩溃
  90  |     await expect(page.locator('#root')).toBeAttached()
  91  | 
  92  |     // XSS 文本应被解析而非渲染为 HTML，页面正常即通过
  93  |     // 不应触发 dialog
  94  |     expect(dialogs.length).toBe(0)
  95  |   })
  96  | })
  97  | 
  98  | test.describe('负数标的数量', () => {
  99  | 
  100 |   test.beforeEach(async ({ page }) => {
  101 |     await navigateTo(page, ROUTES.inputSevenDim)
  102 |     await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  103 |   })
  104 | 
  105 |   test('导入负数标的数量 → 不超过下限', async ({ page }) => {
  106 |     await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
  107 |     const stockCountInput = page.locator('input[type="number"]').first()
  108 |     const count = await stockCountInput.count()
  109 |     if (count > 0) {
  110 |       await stockCountInput.fill('-100')
  111 |       await page.waitForTimeout(300)
  112 |       const value = await stockCountInput.inputValue()
  113 |       // 负数应被限制为最小值（如 0 或 1）
  114 |       expect(Number(value)).toBeGreaterThanOrEqual(0)
  115 |     }
  116 |   })
  117 | })
  118 | 
```