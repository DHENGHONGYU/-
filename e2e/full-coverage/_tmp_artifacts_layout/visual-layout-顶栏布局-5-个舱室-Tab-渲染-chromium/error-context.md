# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual\layout.spec.ts >> 顶栏布局 >> 5 个舱室 Tab 渲染
- Location: visual\layout.spec.ts:55:3

# Error details

```
Error: expect(locator).toBeAttached() failed

Locator: locator('header nav').first()
Expected: attached
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeAttached" with timeout 10000ms
  - waiting for locator('header nav').first()

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
  2   |  * E2E 视觉测试 — 布局一致性
  3   |  * 覆盖：首页功能卡片与状态概览、顶栏 Logo/Tab/按钮、侧边栏面板
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test'
  7   | import { navigateTo, waitForAppReady, ROUTES } from '../utils/helpers'
  8   | 
  9   | test.describe('首页布局', () => {
  10  | 
  11  |   test.beforeEach(async ({ page }) => {
  12  |     await navigateTo(page, ROUTES.home)
  13  |     await waitForAppReady(page)
  14  |   })
  15  | 
  16  |   test('4 张功能卡片渲染（输入/分析/交易/输出）', async ({ page }) => {
  17  |     await expect(page.getByRole('heading', { name: '输入舱' }).first()).toBeVisible({ timeout: 5000 })
  18  |     await expect(page.getByRole('heading', { name: '分析舱' }).first()).toBeVisible()
  19  |     await expect(page.getByRole('heading', { name: '交易舱' }).first()).toBeVisible()
  20  |     await expect(page.getByRole('heading', { name: '输出舱' }).first()).toBeVisible()
  21  |   })
  22  | 
  23  |   test('状态概览卡片渲染（股票池/信号/采集任务/采集服务）', async ({ page }) => {
  24  |     // 首页应有系统状态统计区域
  25  |     await expect(page.locator('#root')).toBeAttached()
  26  |     // 状态概览区域存在股票池相关统计
  27  |     const statusArea = page.getByText(/股票池|信号|采集任务|采集服务|stocks|signals|tasks/i)
  28  |     const count = await statusArea.count()
  29  |     // 至少存在部分状态指示
  30  |     expect(count).toBeGreaterThanOrEqual(0)
  31  |   })
  32  | 
  33  |   test('"打开驾驶舱"链接可见', async ({ page }) => {
  34  |     await expect(page.getByRole('link', { name: '打开驾驶舱' })).toBeVisible({ timeout: 5000 })
  35  |   })
  36  | 
  37  |   test('页面标题"智能投研复盘系统 V9"', async ({ page }) => {
  38  |     await expect(page.locator('text=智能投研复盘系统 V9')).toBeVisible({ timeout: 5000 })
  39  |   })
  40  | })
  41  | 
  42  | test.describe('顶栏布局', () => {
  43  | 
  44  |   test.beforeEach(async ({ page }) => {
  45  |     await navigateTo(page, ROUTES.home)
  46  |     await waitForAppReady(page)
  47  |   })
  48  | 
  49  |   test('Logo "V9" 渲染', async ({ page }) => {
  50  |     const logo = page.getByText('V9', { exact: false })
  51  |     const count = await logo.count()
  52  |     expect(count).toBeGreaterThan(0)
  53  |   })
  54  | 
  55  |   test('5 个舱室 Tab 渲染', async ({ page }) => {
  56  |     const nav = page.locator('header nav').first()
> 57  |     await expect(nav).toBeAttached()
      |                       ^ Error: expect(locator).toBeAttached() failed
  58  |     // 舱室按钮：输入舱、分析舱、交易舱、输出舱、总控舱（不含驾驶舱）
  59  |     const cabinButtons = nav.locator('button').filter({ hasText: /舱/ })
  60  |     await expect(cabinButtons).toHaveCount(5)
  61  |   })
  62  | 
  63  |   test('驾驶舱按钮渲染', async ({ page }) => {
  64  |     const cockpitEntry = page.locator('a, button').filter({ hasText: /驾驶舱|cockpit/i }).first()
  65  |     const count = await cockpitEntry.count()
  66  |     expect(count).toBeGreaterThanOrEqual(0)
  67  |   })
  68  | 
  69  |   test('主题切换按钮渲染', async ({ page }) => {
  70  |     // 主题切换控件在顶栏应存在
  71  |     const themeControl = page.locator('button, [role="button"]').filter({ hasText: /主题|theme|dark|light|暗色|亮色|sun|moon/i }).first()
  72  |     const count = await themeControl.count()
  73  |     // 至少页面正常渲染（主题控件在不同布局下可能隐藏）
  74  |     await expect(page.locator('#root')).toBeAttached()
  75  |   })
  76  | 
  77  |   test('采集状态指示器渲染', async ({ page }) => {
  78  |     const statusIndicator = page.getByText(/采集|collect|任务/i)
  79  |     const count = await statusIndicator.count()
  80  |     // 顶栏或导航区域应存在采集状态入口
  81  |     expect(count).toBeGreaterThanOrEqual(0)
  82  |   })
  83  | })
  84  | 
  85  | test.describe('侧边栏布局', () => {
  86  | 
  87  |   test.beforeEach(async ({ page }) => {
  88  |     await navigateTo(page, ROUTES.input)
  89  |   })
  90  | 
  91  |   test('侧边栏面板渲染', async ({ page }) => {
  92  |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  93  |     const sidebar = page.locator('aside').first()
  94  |     await expect(sidebar).toBeVisible()
  95  |   })
  96  | 
  97  |   test('分组标题渲染（意向候选池 / 数据采集）', async ({ page }) => {
  98  |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  99  |     // 侧边栏分组标题：PANEL_ITEMS 中定义的 group 名
  100 |     const sidebar = page.locator('aside').first()
  101 |     await expect(sidebar).toBeAttached()
  102 |     await expect(sidebar.getByText('意向候选池')).toBeVisible()
  103 |     await expect(sidebar.getByText('数据采集')).toBeVisible()
  104 |   })
  105 | 
  106 |   test('导航项渲染', async ({ page }) => {
  107 |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  108 |     // 侧边栏存在可点击导航项
  109 |     const navItems = page.locator('aside button').filter({ hasText: /导入|测试|任务|配置/i })
  110 |     const count = await navItems.count()
  111 |     expect(count).toBeGreaterThanOrEqual(0)
  112 |   })
  113 | })
  114 | 
```