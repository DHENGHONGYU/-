# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\data-flow.spec.ts >> 数据流测试 >> 股票导入 → 意向池更新 >> 输入多只股票后意向池应正确计数
- Location: functional\data-flow.spec.ts:34:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=平安银行')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=平安银行')

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
  - text: 采集正常 信号强 00:00:11 v1.2.0
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
  - paragraph: 意向候选池标的
  - paragraph: "3"
  - text: ↑ 0% 覆盖
  - paragraph: 已采行情
  - paragraph: "0"
  - text: ↓ 3 待采
  - img: "0"
  - paragraph: 采集服务
  - text: 检查中...
  - paragraph: 快捷操作
  - button "批量导入"
  - button "热门板块"
  - button "数据测试"
  - button "采集任务"
  - heading "录入候选股票" [level=3]
  - text: 搜索模式：
  - button "填充代码/名称"
  - button "直接录入意向候选池"
  - combobox "搜索代码 / 名称 / 行业"
  - textbox "股票代码":
    - /placeholder: 股票代码，如 600519.SH
  - textbox "股票名称"
  - combobox "目标分组":
    - option "默认分组" [selected]
  - img
  - button "仅录入"
  - button "录入并拉基础"
  - button "录入并拉全部"
  - text: 采集服务状态： 检查中...
  - button "刷新"
  - paragraph: 已添加 000858
```

# Test source

```ts
  1   | /**
  2   |  * E2E 功能测试 — 数据流
  3   |  * 覆盖：股票导入→意向池更新、首页状态卡片、采集监控KPI、跨舱室数据一致性
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test'
  7   | import { navigateTo, waitForAppReady, ROUTES, SAMPLE_STOCKS } from '../utils/helpers'
  8   | 
  9   | test.describe('数据流测试', () => {
  10  | 
  11  |   // ============================================================
  12  |   // 股票导入 → 意向池更新
  13  |   // ============================================================
  14  |   test.describe('股票导入 → 意向池更新', () => {
  15  |     test.beforeEach(async ({ page }) => {
  16  |       await navigateTo(page, ROUTES.input)
  17  |       await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  18  |     })
  19  | 
  20  |     test('输入 000001 平安银行后应出现在意向候选池中', async ({ page }) => {
  21  |       // 输入股票
  22  |       await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
  23  |       await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
  24  |       await page.getByRole('button', { name: '仅录入' }).click()
  25  | 
  26  |       // 验证成功提示
  27  |       await expect(page.locator('text=已添加 000001')).toBeVisible({ timeout: 5000 })
  28  | 
  29  |       // 验证股票出现在意向候选池中
  30  |       await expect(page.locator('text=平安银行').first()).toBeVisible()
  31  |       await expect(page.locator('text=000001').first()).toBeVisible()
  32  |     })
  33  | 
  34  |     test('输入多只股票后意向池应正确计数', async ({ page }) => {
  35  |       const stocks = SAMPLE_STOCKS.slice(0, 3)
  36  | 
  37  |       for (const stock of stocks) {
  38  |         await page.getByRole('textbox', { name: '股票代码' }).fill(stock.code)
  39  |         await page.getByRole('textbox', { name: '股票名称' }).fill(stock.name)
  40  |         await page.getByRole('button', { name: '仅录入' }).click()
  41  |         await expect(page.locator(`text=已添加 ${stock.code}`)).toBeVisible({ timeout: 5000 })
  42  |       }
  43  | 
  44  |       // 验证所有股票均可见
> 45  |       await expect(page.locator('text=平安银行')).toBeVisible()
      |                                               ^ Error: expect(locator).toBeVisible() failed
  46  |       await expect(page.locator('text=贵州茅台')).toBeVisible()
  47  |       await expect(page.locator('text=五粮液')).toBeVisible()
  48  |     })
  49  | 
  50  |     test('重复添加同一股票应有反馈', async ({ page }) => {
  51  |       // 第一次添加
  52  |       await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
  53  |       await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
  54  |       await page.getByRole('button', { name: '仅录入' }).click()
  55  |       await expect(page.locator('text=已添加 000001')).toBeVisible({ timeout: 5000 })
  56  | 
  57  |       // 第二次添加（重复）
  58  |       await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
  59  |       await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
  60  |       await page.getByRole('button', { name: '仅录入' }).click()
  61  | 
  62  |       // 应有反馈信息
  63  |       await expect(page.locator('text=已添加')).toBeVisible({ timeout: 5000 })
  64  |     })
  65  |   })
  66  | 
  67  |   // ============================================================
  68  |   // 首页状态卡片显示
  69  |   // ============================================================
  70  |   test.describe('首页状态卡片显示', () => {
  71  |     test('首页应显示数据统计区域', async ({ page }) => {
  72  |       await navigateTo(page, ROUTES.home)
  73  |       await waitForAppReady(page)
  74  | 
  75  |       // 首页应展示系统数据统计卡片
  76  |       // 可能的统计维度：股票池计数、信号数、评分、持仓等
  77  |       await expect(page.locator('#root')).toBeAttached()
  78  | 
  79  |       // 检查是否有统计类文本（如 stocks、orders、scores）
  80  |       const hasStats = await page.getByText(/stock|order|score|信号|持仓|评分/i).first().count()
  81  |       // 首页应至少展示一个统计类卡片
  82  |       expect(hasStats).toBeGreaterThanOrEqual(0)
  83  |     })
  84  | 
  85  |     test('导入股票后首页状态应更新', async ({ page }) => {
  86  |       // 先在输入舱导入一只股票
  87  |       await navigateTo(page, ROUTES.input)
  88  |       await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  89  | 
  90  |       await page.getByRole('textbox', { name: '股票代码' }).fill('000001')
  91  |       await page.getByRole('textbox', { name: '股票名称' }).fill('平安银行')
  92  |       await page.getByRole('button', { name: '仅录入' }).click()
  93  |       await expect(page.locator('text=已添加 000001')).toBeVisible({ timeout: 5000 })
  94  | 
  95  |       // 回到首页
  96  |       await navigateTo(page, ROUTES.home)
  97  |       await waitForAppReady(page)
  98  | 
  99  |       // 首页应正常渲染
  100 |       await expect(page.locator('#root')).toBeAttached()
  101 |       // 首页可能有更新后的统计显示
  102 |     })
  103 | 
  104 |     test('首页应显示核心功能入口卡片', async ({ page }) => {
  105 |       await navigateTo(page, ROUTES.home)
  106 |       await waitForAppReady(page)
  107 | 
  108 |       // 首页应有核心入口（如驾驶舱、输入舱入口按钮）
  109 |       const hasEntrance = await page.locator('button:has-text("驾驶舱"), button:has-text("输入舱"), a:has-text("驾驶舱"), a:has-text("输入舱")').first().count()
  110 |       expect(hasEntrance).toBeGreaterThanOrEqual(0)
  111 |     })
  112 |   })
  113 | 
  114 |   // ============================================================
  115 |   // 采集监控页 KPI 卡片渲染
  116 |   // ============================================================
  117 |   test.describe('采集监控页 KPI 卡片渲染', () => {
  118 |     test.beforeEach(async ({ page }) => {
  119 |       await navigateTo(page, ROUTES.inputCollectTasks)
  120 |       await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
  121 |     })
  122 | 
  123 |     test('应显示四个 KPI 统计卡片', async ({ page }) => {
  124 |       // 任务总数卡片
  125 |       await expect(page.getByText('任务总数')).toBeVisible()
  126 |       // 采集中卡片（使用 .first() 解决 strict mode）
  127 |       await expect(page.getByText('采集中').first()).toBeVisible()
  128 |       // 已完成卡片
  129 |       await expect(page.getByText('已完成').first()).toBeVisible()
  130 |       // 失败卡片
  131 |       await expect(page.getByText('失败').first()).toBeVisible()
  132 |     })
  133 | 
  134 |     test('KPI 卡片数值应为数字格式', async ({ page }) => {
  135 |       // 查找卡片中的数值（格式应为数字）
  136 |       const taskTotal = page.locator('text=任务总数').locator('..')
  137 |       await expect(taskTotal).toBeVisible()
  138 |     })
  139 | 
  140 |     test('应显示任务列表表格', async ({ page }) => {
  141 |       await expect(page.locator('table')).toBeVisible()
  142 |       await expect(page.getByRole('columnheader', { name: '任务ID' })).toBeVisible()
  143 |       await expect(page.getByRole('columnheader', { name: '维度' })).toBeVisible()
  144 |       await expect(page.getByRole('columnheader', { name: '状态' })).toBeVisible()
  145 |       await expect(page.getByRole('columnheader', { name: '进度' })).toBeVisible()
```