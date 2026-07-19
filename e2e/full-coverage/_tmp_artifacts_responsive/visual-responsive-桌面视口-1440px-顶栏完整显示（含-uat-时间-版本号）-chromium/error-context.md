# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual\responsive.spec.ts >> 桌面视口 (1440px) >> 顶栏完整显示（含 uat 时间/版本号）
- Location: visual\responsive.spec.ts:74:3

# Error details

```
Error: expect(locator).toBeAttached() failed

Locator: locator('nav').first()
Expected: attached
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeAttached" with timeout 10000ms
  - waiting for locator('nav').first()

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
  2   |  * E2E 视觉测试 — 响应式适配
  3   |  * 覆盖：移动端 (375px) / 平板 (768px) / 桌面 (1440px) 在不同视口下的布局切换
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test'
  7   | import { navigateTo, ROUTES } from '../utils/helpers'
  8   | 
  9   | test.describe('移动端视口 (375px)', () => {
  10  |   test.use({ viewport: { width: 375, height: 812 } })
  11  | 
  12  |   test.beforeEach(async ({ page }) => {
  13  |     await navigateTo(page, ROUTES.home)
  14  |   })
  15  | 
  16  |   test('移动端底部导航栏显示', async ({ page }) => {
  17  |     // 底部导航栏在移动端应可见（通常固定在底部）
  18  |     const bottomNav = page.locator('nav').last()
  19  |     await expect(bottomNav).toBeAttached()
  20  |   })
  21  | 
  22  |   test('汉堡菜单按钮可见', async ({ page }) => {
  23  |     // 移动端应显示汉堡菜单按钮（hamburger/menu icon）
  24  |     const hamburger = page.locator('button[aria-label*="menu" i], button[aria-label*="导航" i], button[aria-label*="菜单" i]').first()
  25  |     const count = await hamburger.count()
  26  |     // 移动端应有菜单展开入口
  27  |     expect(count).toBeGreaterThanOrEqual(0)
  28  |     // 页面根元素正确渲染
  29  |     await expect(page.locator('#root')).toBeAttached()
  30  |   })
  31  | 
  32  |   test('点击汉堡菜单打开抽屉', async ({ page }) => {
  33  |     // 尝试点击菜单按钮
  34  |     const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="导航" i], button[aria-label*="菜单" i], [class*="hamburger"], [class*="menu-btn"]').first()
  35  |     const menuExists = (await menuBtn.count()) > 0
  36  |     if (menuExists) {
  37  |       await menuBtn.click()
  38  |       await page.waitForTimeout(500)
  39  |       // 抽屉打开后应有内容渲染
  40  |       await expect(page.locator('#root')).toBeAttached()
  41  |     }
  42  |   })
  43  | })
  44  | 
  45  | test.describe('平板视口 (768px)', () => {
  46  |   test.use({ viewport: { width: 768, height: 1024 } })
  47  | 
  48  |   test.beforeEach(async ({ page }) => {
  49  |     await navigateTo(page, ROUTES.input)
  50  |   })
  51  | 
  52  |   test('侧边栏可见', async ({ page }) => {
  53  |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  54  |     // 平板视口应展示侧边栏导航
  55  |     const sidebar = page.locator('aside').first()
  56  |     await expect(sidebar).toBeVisible()
  57  |   })
  58  | 
  59  |   test('底部导航不显示', async ({ page }) => {
  60  |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  61  |     // 平板上底部移动导航不应显示（md:hidden 类在 >=768px 时隐藏）
  62  |     const bottomNav = page.locator('nav.fixed.bottom-0')
  63  |     await expect(bottomNav).not.toBeVisible()
  64  |   })
  65  | })
  66  | 
  67  | test.describe('桌面视口 (1440px)', () => {
  68  |   test.use({ viewport: { width: 1440, height: 900 } })
  69  | 
  70  |   test.beforeEach(async ({ page }) => {
  71  |     await navigateTo(page, ROUTES.home)
  72  |   })
  73  | 
  74  |   test('顶栏完整显示（含 uat 时间/版本号）', async ({ page }) => {
  75  |     // 桌面视口下顶栏应包含完整信息
  76  |     const nav = page.locator('nav').first()
> 77  |     await expect(nav).toBeAttached()
      |                       ^ Error: expect(locator).toBeAttached() failed
  78  |     // 验证关键元素在桌面端完整可见
  79  |     await expect(nav.getByText('输入')).toBeAttached()
  80  |     await expect(nav.getByText('输出')).toBeAttached()
  81  |     await expect(nav.getByText('总控')).toBeAttached()
  82  |     // 版本号或构建信息（uat 相关文本）
  83  |     const versionInfo = page.getByText(/uat|v9|version/i)
  84  |     const count = await versionInfo.count()
  85  |     expect(count).toBeGreaterThanOrEqual(0)
  86  |   })
  87  | 
  88  |   test('侧边栏宽 240px', async ({ page }) => {
  89  |     await navigateTo(page, ROUTES.input)
  90  |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  91  | 
  92  |     // 检查侧边栏宽度
  93  |     const sidebar = page.locator('aside, [class*="sidebar"], [class*="w-60"]').first()
  94  |     const count = await sidebar.count()
  95  |     if (count > 0) {
  96  |       const box = await sidebar.boundingBox()
  97  |       if (box) {
  98  |         // 侧边栏宽度应在合理范围内（约 240px，允许 ±20px 误差）
  99  |         expect(box.width).toBeGreaterThanOrEqual(220)
  100 |         expect(box.width).toBeLessThanOrEqual(260)
  101 |       }
  102 |     }
  103 |   })
  104 | })
  105 | 
```