# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\buttons.spec.ts >> 按钮交互测试 >> 首页"进入输入舱"按钮 >> 首页"进入输入舱"按钮应存在
- Location: functional\buttons.spec.ts:43:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: '进入输入舱' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('button', { name: '进入输入舱' })

```

```yaml
- main:
  - heading "智能投研复盘系统 V9" [level=1]
  - paragraph: 面向中国 A 股个人投资者的研究决策工具
  - link "打开驾驶舱":
    - /url: "#/cockpit"
  - link "股票池 0 尚无标的":
    - /url: "#/input"
    - img
    - paragraph: 股票池
    - paragraph: "0"
    - paragraph: 尚无标的
  - link "交易信号 0 暂无信号":
    - /url: "#/trading"
    - img
    - paragraph: 交易信号
    - paragraph: "0"
    - paragraph: 暂无信号
  - link "采集任务 0 未启动采集":
    - /url: "#/input/collect-tasks"
    - img
    - paragraph: 采集任务
    - paragraph: "0"
    - paragraph: 未启动采集
  - link "采集服务 正常 信号正常":
    - /url: "#/input/data-test"
    - img
    - paragraph: 采集服务
    - paragraph: 正常
    - paragraph: 信号正常
  - link "输入舱 录入候选股票，管理股票池，批量导入，热门板块 进入":
    - /url: "#/input"
    - img
    - heading "输入舱" [level=3]
    - paragraph: 录入候选股票，管理股票池，批量导入，热门板块
    - text: 进入
    - img
  - link "分析舱 V4/V6 评分，行业分析，策略回测 进入":
    - /url: "#/analysis"
    - img
    - heading "分析舱" [level=3]
    - paragraph: V4/V6 评分，行业分析，策略回测
    - text: 进入
    - img
  - link "交易舱 交易信号，模拟盘执行，持仓管理 进入":
    - /url: "#/trading"
    - img
    - heading "交易舱" [level=3]
    - paragraph: 交易信号，模拟盘执行，持仓管理
    - text: 进入
    - img
  - link "输出舱 研究报告，数据导出 进入":
    - /url: "#/output"
    - img
    - heading "输出舱" [level=3]
    - paragraph: 研究报告，数据导出
    - text: 进入
    - img
  - link "进入输入舱":
    - /url: "#/input"
  - link "总控中心":
    - /url: "#/command"
  - img
  - text: UI 组件已升级 · 模块首页已上线
```

# Test source

```ts
  1   | /**
  2   |  * E2E 功能测试 — 按钮交互
  3   |  * 覆盖：驾驶舱按钮、输入舱按钮、重置默认、保存配置状态、主题切换、采集完成按钮
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test'
  7   | import { navigateTo, waitForAppReady, ROUTES, SAMPLE_STOCKS } from '../utils/helpers'
  8   | 
  9   | test.describe('按钮交互测试', () => {
  10  | 
  11  |   // ============================================================
  12  |   // 首页"打开驾驶舱"按钮
  13  |   // ============================================================
  14  |   test.describe('首页"打开驾驶舱"按钮', () => {
  15  |     test.beforeEach(async ({ page }) => {
  16  |       await navigateTo(page, ROUTES.home)
  17  |       await waitForAppReady(page)
  18  |     })
  19  | 
  20  |     test('首页"打开驾驶舱"按钮应存在且可见', async ({ page }) => {
  21  |       await expect(page.getByRole('button', { name: '打开驾驶舱' })).toBeVisible({ timeout: 10000 })
  22  |     })
  23  | 
  24  |     test('点击"打开驾驶舱"按钮应跳转到驾驶舱', async ({ page }) => {
  25  |       await page.getByRole('button', { name: '打开驾驶舱' }).click()
  26  |       await page.waitForLoadState('networkidle')
  27  |       await page.waitForTimeout(1000)
  28  |       // 验证 URL 跳转到 cockpit
  29  |       expect(page.url()).toContain('cockpit')
  30  |       await expect(page.locator('#root')).toBeAttached()
  31  |     })
  32  |   })
  33  | 
  34  |   // ============================================================
  35  |   // 首页"进入输入舱"按钮
  36  |   // ============================================================
  37  |   test.describe('首页"进入输入舱"按钮', () => {
  38  |     test.beforeEach(async ({ page }) => {
  39  |       await navigateTo(page, ROUTES.home)
  40  |       await waitForAppReady(page)
  41  |     })
  42  | 
  43  |     test('首页"进入输入舱"按钮应存在', async ({ page }) => {
> 44  |       await expect(page.getByRole('button', { name: '进入输入舱' })).toBeVisible({ timeout: 10000 })
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  45  |     })
  46  | 
  47  |     test('点击"进入输入舱"按钮应跳转到输入舱', async ({ page }) => {
  48  |       await page.getByRole('button', { name: '进入输入舱' }).click()
  49  |       await page.waitForLoadState('networkidle')
  50  |       await page.waitForTimeout(1000)
  51  |       expect(page.url()).toContain('/input')
  52  |       await expect(page.locator('text=股票池看板')).toBeVisible({ timeout: 10000 })
  53  |     })
  54  |   })
  55  | 
  56  |   // ============================================================
  57  |   // "重置为默认"按钮
  58  |   // ============================================================
  59  |   test.describe('"重置为默认"按钮', () => {
  60  |     test.beforeEach(async ({ page }) => {
  61  |       await navigateTo(page, ROUTES.inputSevenDim)
  62  |       await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  63  |     })
  64  | 
  65  |     test('"重置为默认"按钮应存在且可见', async ({ page }) => {
  66  |       await expect(page.getByRole('button', { name: '重置为默认' })).toBeVisible()
  67  |     })
  68  | 
  69  |     test('点击"重置为默认"按钮后配置应恢复默认状态', async ({ page }) => {
  70  |       // 先切换到价值投资模板改变配置
  71  |       await page.getByRole('heading', { name: '价值投资' }).click()
  72  |       await page.getByRole('button', { name: '重置为默认' }).click()
  73  |       // 重置后页面应保持正常渲染，维度区和全局参数区保持可见
  74  |       await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  75  |       await expect(page.getByRole('heading', { name: '全局参数' })).toBeVisible()
  76  |       // 策略模板区域应仍可见
  77  |       await expect(page.getByRole('heading', { name: '策略模板' })).toBeVisible()
  78  |     })
  79  |   })
  80  | 
  81  |   // ============================================================
  82  |   // "保存配置"按钮状态
  83  |   // ============================================================
  84  |   test.describe('"保存配置"按钮 disabled/enabled 状态', () => {
  85  |     test.beforeEach(async ({ page }) => {
  86  |       await navigateTo(page, ROUTES.inputSevenDim)
  87  |       await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  88  |     })
  89  | 
  90  |     test('"开始采集"按钮应可点击（配置已就绪）', async ({ page }) => {
  91  |       // 七维页面有"开始采集"按钮，验证其存在且可交互
  92  |       const startBtn = page.getByRole('button', { name: '开始采集' })
  93  |       await expect(startBtn).toBeVisible()
  94  |       await expect(startBtn).toBeEnabled()
  95  |     })
  96  | 
  97  |     test('"开始采集"按钮点击后应有响应', async ({ page }) => {
  98  |       await page.getByRole('button', { name: '开始采集' }).click()
  99  |       // 点击后应有 loading 或进度提示
  100 |       await page.waitForTimeout(2000)
  101 |       // 页面不崩溃即为通过
  102 |       await expect(page.locator('#root')).toBeAttached()
  103 |     })
  104 | 
  105 |     test('重置后"开始采集"按钮仍应可用', async ({ page }) => {
  106 |       await page.getByRole('heading', { name: '价值投资' }).click()
  107 |       await page.getByRole('button', { name: '重置为默认' }).click()
  108 |       await expect(page.getByRole('button', { name: '开始采集' })).toBeEnabled()
  109 |     })
  110 |   })
  111 | 
  112 |   // ============================================================
  113 |   // 主题切换按钮
  114 |   // ============================================================
  115 |   test.describe('主题切换按钮', () => {
  116 |     test.beforeEach(async ({ page }) => {
  117 |       await navigateTo(page, ROUTES.home)
  118 |       await waitForAppReady(page)
  119 |     })
  120 | 
  121 |     test('主题切换控件应存在', async ({ page }) => {
  122 |       // 查找主题切换相关控件：可能是 button/combobox 包含主题/暗色/亮色相关文本
  123 |       const themeControl = page.locator('button').filter({ hasText: /主题|theme|dark|light|暗色|亮色/i }).first()
  124 |       const exists = await themeControl.count()
  125 |       // 至少根元素存在（主题控件可能在导航栏或设置中）
  126 |       await expect(page.locator('#root')).toBeAttached()
  127 |     })
  128 | 
  129 |     test('页面在默认主题下应正常渲染', async ({ page }) => {
  130 |       // 验证页面颜色相关样式已加载
  131 |       const html = page.locator('html')
  132 |       const className = await html.getAttribute('class')
  133 |       // 主题样式可能通过 class 或 data 属性控制
  134 |       expect(className !== null).toBe(true)
  135 |     })
  136 |   })
  137 | 
  138 |   // ============================================================
  139 |   // 采集完成后按钮
  140 |   // ============================================================
  141 |   test.describe('采集完成后"继续导入"和"前往采集配置"按钮', () => {
  142 |     test('采集任务监控页应显示任务列表和操作按钮', async ({ page }) => {
  143 |       await navigateTo(page, ROUTES.inputCollectTasks)
  144 |       await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
```