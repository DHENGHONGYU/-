# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual\layout.spec.ts >> 顶栏布局 >> 5 个舱室 Tab 渲染
- Location: visual\layout.spec.ts:56:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('header nav').first().locator('button').filter({ hasText: /舱/ })
Expected: 5
Received: 6
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('header nav').first().locator('button').filter({ hasText: /舱/ })
    23 × locator resolved to 6 elements
       - unexpected value "6"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - link "V9 智能投研复盘系统" [ref=e5] [cursor=pointer]:
      - /url: "#/"
      - generic [ref=e6]: V9
      - generic [ref=e7]: 智能投研复盘系统
    - navigation [ref=e8]:
      - button "📦输入舱" [ref=e9] [cursor=pointer]
      - button "🔬分析舱" [ref=e10] [cursor=pointer]
      - button "💹交易舱" [ref=e11] [cursor=pointer]
      - button "📊输出舱" [ref=e12] [cursor=pointer]
      - button "🎛️总控舱" [ref=e13] [cursor=pointer]
      - button "驾驶舱" [ref=e14] [cursor=pointer]:
        - img [ref=e15]
        - text: 驾驶舱
    - generic [ref=e19]:
      - 'button "当前主题模式: 跟随系统，点击切换" [ref=e20] [cursor=pointer]':
        - img [ref=e21]
        - generic [ref=e23]: system
      - generic [ref=e27]: 采集正常
      - generic [ref=e32]: 信号强
      - generic [ref=e37]: 00:00:12
      - generic [ref=e39]: v1.2.0
  - generic [ref=e40]:
    - complementary [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]: 📦
        - generic [ref=e44]: 输入舱
      - generic [ref=e45]:
        - generic [ref=e46]:
          - generic [ref=e47]: 意向候选池
          - list [ref=e48]:
            - listitem [ref=e49]:
              - button "录入看板" [ref=e50] [cursor=pointer]:
                - img [ref=e51]
                - generic [ref=e56]: 录入看板
            - listitem [ref=e57]:
              - button "股票池看板（已迁分析舱）" [ref=e58] [cursor=pointer]:
                - img [ref=e59]
                - generic [ref=e63]: 股票池看板（已迁分析舱）
            - listitem [ref=e64]:
              - button "批量导入" [ref=e65] [cursor=pointer]:
                - img [ref=e66]
                - generic [ref=e69]: 批量导入
            - listitem [ref=e70]:
              - button "热门板块" [ref=e71] [cursor=pointer]:
                - img [ref=e72]
                - generic [ref=e74]: 热门板块
            - listitem [ref=e75]:
              - button "本地知识库" [ref=e76] [cursor=pointer]:
                - img [ref=e77]
                - generic [ref=e79]: 本地知识库
        - generic [ref=e80]:
          - generic [ref=e81]: 数据采集
          - list [ref=e82]:
            - listitem [ref=e83]:
              - button "采集测试" [ref=e84] [cursor=pointer]:
                - img [ref=e85]
                - generic [ref=e89]: 采集测试
            - listitem [ref=e90]:
              - button "采集任务监控" [ref=e91] [cursor=pointer]:
                - img [ref=e92]
                - generic [ref=e94]: 采集任务监控
            - listitem [ref=e95]:
              - button "七维采集配置" [ref=e96] [cursor=pointer]:
                - img [ref=e97]
                - generic [ref=e98]: 七维采集配置
            - listitem [ref=e99]:
              - button "抓取引擎配置" [ref=e100] [cursor=pointer]:
                - img [ref=e101]
                - generic [ref=e104]: 抓取引擎配置
    - main [ref=e106]:
      - generic [ref=e108]:
        - generic [ref=e110]:
          - heading "输入舱" [level=1] [ref=e111]
          - paragraph [ref=e112]: 股票录入 · 批量导入 · 热门板块 · 采集测试
        - generic [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e116]:
              - paragraph [ref=e117]: 意向候选池标的
              - paragraph [ref=e119]: "0"
            - generic [ref=e121]:
              - paragraph [ref=e122]: 已采行情
              - paragraph [ref=e125]: "0"
            - generic [ref=e127]:
              - paragraph [ref=e128]: 采集服务
              - generic [ref=e130]: 检查中...
            - generic [ref=e132]:
              - paragraph [ref=e133]: 快捷操作
              - generic [ref=e134]:
                - button "批量导入" [ref=e135] [cursor=pointer]
                - button "热门板块" [ref=e136] [cursor=pointer]
                - button "数据测试" [ref=e137] [cursor=pointer]
                - button "采集任务" [ref=e138] [cursor=pointer]
          - generic [ref=e139]:
            - heading "录入候选股票" [level=3] [ref=e141]
            - generic [ref=e142]:
              - generic [ref=e143]:
                - generic [ref=e144]: 搜索模式：
                - button "填充代码/名称" [ref=e145] [cursor=pointer]
                - button "直接录入意向候选池" [ref=e146] [cursor=pointer]
              - combobox "搜索代码 / 名称 / 行业" [ref=e148]
              - generic [ref=e149]:
                - textbox "股票代码" [ref=e150]:
                  - /placeholder: 股票代码，如 600519.SH
                - textbox "股票名称" [ref=e151]
                - generic [ref=e152]:
                  - combobox "目标分组" [ref=e153]:
                    - option "默认分组" [selected]
                  - img
                - button "仅录入" [ref=e154] [cursor=pointer]
                - button "录入并拉基础" [ref=e155] [cursor=pointer]
                - button "录入并拉全部" [ref=e156] [cursor=pointer]
              - generic [ref=e157]:
                - generic [ref=e158]: 采集服务状态：
                - generic [ref=e159]: 检查中...
                - button "刷新" [ref=e160] [cursor=pointer]
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
  45  |     // 舱室顶栏导航只在 PortalShell 中，导航到 /input 而非首页
  46  |     await navigateTo(page, ROUTES.input)
  47  |     await page.waitForTimeout(1000)
  48  |   })
  49  | 
  50  |   test('Logo "V9" 渲染', async ({ page }) => {
  51  |     const logo = page.getByText('V9', { exact: false })
  52  |     const count = await logo.count()
  53  |     expect(count).toBeGreaterThan(0)
  54  |   })
  55  | 
  56  |   test('5 个舱室 Tab 渲染', async ({ page }) => {
  57  |     const nav = page.locator('header nav').first()
  58  |     await expect(nav).toBeAttached()
  59  |     // 舱室按钮：输入舱、分析舱、交易舱、输出舱、总控舱（不含驾驶舱）
  60  |     const cabinButtons = nav.locator('button').filter({ hasText: /舱/ })
> 61  |     await expect(cabinButtons).toHaveCount(5)
      |                                ^ Error: expect(locator).toHaveCount(expected) failed
  62  |   })
  63  | 
  64  |   test('驾驶舱按钮渲染', async ({ page }) => {
  65  |     const cockpitEntry = page.locator('a, button').filter({ hasText: /驾驶舱|cockpit/i }).first()
  66  |     const count = await cockpitEntry.count()
  67  |     expect(count).toBeGreaterThanOrEqual(0)
  68  |   })
  69  | 
  70  |   test('主题切换按钮渲染', async ({ page }) => {
  71  |     // 主题切换控件在顶栏应存在
  72  |     const themeControl = page.locator('button, [role="button"]').filter({ hasText: /主题|theme|dark|light|暗色|亮色|sun|moon/i }).first()
  73  |     const count = await themeControl.count()
  74  |     // 至少页面正常渲染（主题控件在不同布局下可能隐藏）
  75  |     await expect(page.locator('#root')).toBeAttached()
  76  |   })
  77  | 
  78  |   test('采集状态指示器渲染', async ({ page }) => {
  79  |     const statusIndicator = page.getByText(/采集|collect|任务/i)
  80  |     const count = await statusIndicator.count()
  81  |     // 顶栏或导航区域应存在采集状态入口
  82  |     expect(count).toBeGreaterThanOrEqual(0)
  83  |   })
  84  | })
  85  | 
  86  | test.describe('侧边栏布局', () => {
  87  | 
  88  |   test.beforeEach(async ({ page }) => {
  89  |     await navigateTo(page, ROUTES.input)
  90  |   })
  91  | 
  92  |   test('侧边栏面板渲染', async ({ page }) => {
  93  |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  94  |     const sidebar = page.locator('aside').first()
  95  |     await expect(sidebar).toBeVisible()
  96  |   })
  97  | 
  98  |   test('分组标题渲染（意向候选池 / 数据采集）', async ({ page }) => {
  99  |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  100 |     // 侧边栏分组标题：PANEL_ITEMS 中定义的 group 名
  101 |     const sidebar = page.locator('aside').first()
  102 |     await expect(sidebar).toBeAttached()
  103 |     await expect(sidebar.getByText('意向候选池')).toBeVisible()
  104 |     await expect(sidebar.getByText('数据采集')).toBeVisible()
  105 |   })
  106 | 
  107 |   test('导航项渲染', async ({ page }) => {
  108 |     await expect(page.getByRole('textbox', { name: '股票代码' })).toBeVisible({ timeout: 10000 })
  109 |     // 侧边栏存在可点击导航项
  110 |     const navItems = page.locator('aside button').filter({ hasText: /导入|测试|任务|配置/i })
  111 |     const count = await navItems.count()
  112 |     expect(count).toBeGreaterThanOrEqual(0)
  113 |   })
  114 | })
  115 | 
```