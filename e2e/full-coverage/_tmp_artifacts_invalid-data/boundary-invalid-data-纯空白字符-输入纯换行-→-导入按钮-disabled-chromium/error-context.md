# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boundary\invalid-data.spec.ts >> 纯空白字符 >> 输入纯换行 → 导入按钮 disabled
- Location: boundary\invalid-data.spec.ts:57:3

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
  22  |     // 特殊字符应被正常解析为无效行
  23  |     await expect(page.locator('text=共 0 条')).toBeVisible({ timeout: 5000 })
  24  |   })
  25  | 
  26  |   test('导入特殊字符后确认按钮 disabled', async ({ page }) => {
  27  |     await page.locator('textarea').fill(INVALID_INPUTS[0]!)
  28  |     await page.waitForTimeout(500)
  29  |     const confirmBtn = page.getByRole('button', { name: '确认导入' })
  30  |     const count = await confirmBtn.count()
  31  |     if (count > 0) {
  32  |       await expect(confirmBtn).toBeDisabled()
  33  |     }
  34  |   })
  35  | })
  36  | 
  37  | test.describe('纯空白字符', () => {
  38  | 
  39  |   test.beforeEach(async ({ page }) => {
  40  |     await navigateTo(page, ROUTES.input)
  41  |     await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  42  |     await page.locator('main button:has-text("批量导入")').click()
  43  |   })
  44  | 
  45  |   test('输入纯空格 → 导入按钮 disabled', async ({ page }) => {
  46  |     await page.locator('textarea').fill(INVALID_INPUTS[1]!)
  47  |     await page.waitForTimeout(500)
  48  |     // 解析结果应为 0
  49  |     await expect(page.locator('text=共 0 条')).toBeVisible({ timeout: 5000 })
  50  |     const confirmBtn = page.getByRole('button', { name: '确认导入' })
  51  |     const count = await confirmBtn.count()
  52  |     if (count > 0) {
  53  |       await expect(confirmBtn).toBeDisabled()
  54  |     }
  55  |   })
  56  | 
  57  |   test('输入纯换行 → 导入按钮 disabled', async ({ page }) => {
  58  |     await page.locator('textarea').fill(INVALID_INPUTS[2]!)
  59  |     await page.waitForTimeout(500)
> 60  |     await expect(page.locator('text=共 0 条')).toBeVisible({ timeout: 5000 })
      |                                              ^ Error: expect(locator).toBeVisible() failed
  61  |     const confirmBtn = page.getByRole('button', { name: '确认导入' })
  62  |     const count = await confirmBtn.count()
  63  |     if (count > 0) {
  64  |       await expect(confirmBtn).toBeDisabled()
  65  |     }
  66  |   })
  67  | })
  68  | 
  69  | test.describe('XSS payload', () => {
  70  | 
  71  |   test.beforeEach(async ({ page }) => {
  72  |     await navigateTo(page, ROUTES.input)
  73  |     await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  74  |     await page.locator('main button:has-text("批量导入")').click()
  75  |   })
  76  | 
  77  |   test('输入 XSS payload → 无弹窗/不渲染为 HTML', async ({ page }) => {
  78  |     // 先注册 dialog 监听，确保能捕获到任何可能的弹窗
  79  |     const dialogs: string[] = []
  80  |     page.on('dialog', async dialog => {
  81  |       dialogs.push(dialog.message())
  82  |       await dialog.dismiss()
  83  |     })
  84  | 
  85  |     await page.locator('textarea').fill(INVALID_INPUTS[3]!)
  86  |     await page.waitForTimeout(500)
  87  | 
  88  |     // 页面不应崩溃
  89  |     await expect(page.locator('#root')).toBeAttached()
  90  | 
  91  |     // XSS 文本应被解析为无效行（共 0 条），而非渲染为 HTML
  92  |     await expect(page.locator('text=共 0 条')).toBeVisible({ timeout: 5000 })
  93  | 
  94  |     // 不应触发 dialog
  95  |     expect(dialogs.length).toBe(0)
  96  |   })
  97  | })
  98  | 
  99  | test.describe('负数标的数量', () => {
  100 | 
  101 |   test.beforeEach(async ({ page }) => {
  102 |     await navigateTo(page, ROUTES.inputSevenDim)
  103 |     await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  104 |   })
  105 | 
  106 |   test('导入负数标的数量 → 不超过下限', async ({ page }) => {
  107 |     await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
  108 |     const stockCountInput = page.locator('input[type="number"]').first()
  109 |     const count = await stockCountInput.count()
  110 |     if (count > 0) {
  111 |       await stockCountInput.fill('-100')
  112 |       await page.waitForTimeout(300)
  113 |       const value = await stockCountInput.inputValue()
  114 |       // 负数应被限制为最小值（如 0 或 1）
  115 |       expect(Number(value)).toBeGreaterThanOrEqual(0)
  116 |     }
  117 |   })
  118 | })
  119 | 
```