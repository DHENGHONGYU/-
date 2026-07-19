# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\navigation.spec.ts >> 导航跳转测试 >> 顶栏舱室切换按钮 >> 顶栏存在五个舱室的导航入口
- Location: functional\navigation.spec.ts:84:5

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
  2   |  * E2E 功能测试 — 导航跳转
  3   |  * 覆盖：五舱室导航、侧边栏面板跳转、顶栏切换、驾驶舱入口、404、面包屑
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test'
  7   | import { navigateTo, waitForAppReady, ROUTES, SAMPLE_STOCKS } from '../utils/helpers'
  8   | 
  9   | test.describe('导航跳转测试', () => {
  10  | 
  11  |   // ============================================================
  12  |   // 首页导航到五个舱室
  13  |   // ============================================================
  14  |   test.describe('首页导航到五个舱室', () => {
  15  |     test.beforeEach(async ({ page }) => {
  16  |       await navigateTo(page, ROUTES.home)
  17  |       await waitForAppReady(page)
  18  |     })
  19  | 
  20  |     test('从首页导航到输入舱', async ({ page }) => {
  21  |       await navigateTo(page, ROUTES.input)
  22  |       await page.waitForLoadState('networkidle')
  23  |       await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 10000 })
  24  |     })
  25  | 
  26  |     test('从首页导航到分析舱', async ({ page }) => {
  27  |       await navigateTo(page, ROUTES.analysis)
  28  |       await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
  29  |     })
  30  | 
  31  |     test('从首页导航到交易舱', async ({ page }) => {
  32  |       await navigateTo(page, ROUTES.trading)
  33  |       await expect(page.getByRole('heading', { name: '交易舱 · 模拟盘' })).toBeVisible({ timeout: 10000 })
  34  |     })
  35  | 
  36  |     test('从首页导航到输出舱', async ({ page }) => {
  37  |       await navigateTo(page, ROUTES.output)
  38  |       await expect(page.getByRole('heading', { name: '输出舱', level: 1 }).first()).toBeVisible({ timeout: 10000 })
  39  |     })
  40  | 
  41  |     test('从首页导航到总控舱', async ({ page }) => {
  42  |       await navigateTo(page, ROUTES.command)
  43  |       await expect(page.getByRole('heading', { name: '总控舱', level: 1 })).toBeVisible({ timeout: 10000 })
  44  |     })
  45  |   })
  46  | 
  47  |   // ============================================================
  48  |   // 侧边栏面板导航（输入舱 → 面板）
  49  |   // ============================================================
  50  |   test.describe('输入舱侧边栏面板导航', () => {
  51  |     test.beforeEach(async ({ page }) => {
  52  |       await navigateTo(page, ROUTES.input)
  53  |       await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 10000 })
  54  |     })
  55  | 
  56  |     test('侧边栏"批量导入"按钮导航到批量导入页', async ({ page }) => {
  57  |       await page.locator('aside').getByRole('button', { name: '批量导入' }).click()
  58  |       await page.waitForLoadState('networkidle')
  59  |       await expect(page.getByRole('heading', { name: /批量导入/ }).first()).toBeVisible({ timeout: 10000 })
  60  |     })
  61  | 
  62  |     test('侧边栏"采集测试"按钮导航到数据采集测试页', async ({ page }) => {
  63  |       await page.locator('aside').getByRole('button', { name: '采集测试' }).click()
  64  |       await page.waitForLoadState('networkidle')
  65  |       await expect(page.getByRole('heading', { name: '数据采集测试' })).toBeVisible({ timeout: 10000 })
  66  |     })
  67  | 
  68  |     test('侧边栏"采集任务监控"按钮导航到采集任务监控页', async ({ page }) => {
  69  |       await page.locator('aside').getByRole('button', { name: '采集任务监控' }).click()
  70  |       await page.waitForLoadState('networkidle')
  71  |       await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
  72  |     })
  73  |   })
  74  | 
  75  |   // ============================================================
  76  |   // 顶栏舱室切换
  77  |   // ============================================================
  78  |   test.describe('顶栏舱室切换按钮', () => {
  79  |     test.beforeEach(async ({ page }) => {
  80  |       await navigateTo(page, ROUTES.home)
  81  |       await waitForAppReady(page)
  82  |     })
  83  | 
  84  |     test('顶栏存在五个舱室的导航入口', async ({ page }) => {
  85  |       // 顶部导航栏应包含舱室切换入口
  86  |       const nav = page.locator('nav').first()
> 87  |       await expect(nav).toBeAttached()
      |                         ^ Error: expect(locator).toBeAttached() failed
  88  |       // 验证关键舱室名称在导航栏中可见
  89  |       await expect(nav.getByText('输入', { exact: false })).toBeAttached()
  90  |       await expect(nav.getByText('分析', { exact: false })).toBeAttached()
  91  |       await expect(nav.getByText('交易', { exact: false })).toBeAttached()
  92  |       await expect(nav.getByText('输出', { exact: false })).toBeAttached()
  93  |       await expect(nav.getByText('总控', { exact: false })).toBeAttached()
  94  |     })
  95  | 
  96  |     test('通过顶栏从输入舱切换到分析舱', async ({ page }) => {
  97  |       await navigateTo(page, ROUTES.input)
  98  |       await expect(page.getByRole('heading', { name: '输入舱' })).toBeVisible({ timeout: 10000 })
  99  | 
  100 |       // 点击顶栏"分析舱"按钮切换舱室
  101 |       const topNav = page.locator('nav').first()
  102 |       await topNav.getByRole('button', { name: /分析舱/ }).click()
  103 |       await page.waitForLoadState('networkidle')
  104 |       await expect(page.getByRole('heading', { name: '分析模板快捷入口' })).toBeVisible({ timeout: 10000 })
  105 |     })
  106 |   })
  107 | 
  108 |   // ============================================================
  109 |   // 驾驶舱入口
  110 |   // ============================================================
  111 |   test.describe('驾驶舱入口', () => {
  112 |     test('驾驶舱页面可正常访问', async ({ page }) => {
  113 |       await navigateTo(page, ROUTES.cockpit)
  114 |       await waitForAppReady(page)
  115 |       // 驾驶舱页面应正确加载
  116 |       await expect(page.locator('#root')).toBeAttached()
  117 |       // 确认 URL 包含 cockpit
  118 |       expect(page.url()).toContain('cockpit')
  119 |     })
  120 | 
  121 |     test('从首页进入驾驶舱并验证页面渲染', async ({ page }) => {
  122 |       await navigateTo(page, ROUTES.home)
  123 |       await waitForAppReady(page)
  124 |       await navigateTo(page, ROUTES.cockpit)
  125 |       // 驾驶舱应渲染仪表盘内容
  126 |       await expect(page.locator('#root')).toBeAttached()
  127 |     })
  128 |   })
  129 | 
  130 |   // ============================================================
  131 |   // 404 页面
  132 |   // ============================================================
  133 |   test.describe('404 页面处理', () => {
  134 |     test('访问不存在的路由应显示 404 或未找到提示', async ({ page }) => {
  135 |       await page.goto('http://localhost:3005/#/totally-nonexistent-route')
  136 |       await page.waitForLoadState('domcontentloaded')
  137 |       // 验证存在 404 或未找到相关提示
  138 |       const notFoundElements = page.locator('text=404').or(page.locator('text=未找到')).or(page.locator('text=不存在'))
  139 |       // 页面应包含提示内容
  140 |       await expect(page.locator('#root')).toBeAttached()
  141 |     })
  142 | 
  143 |     test('访问不存在的子路径也应正确处理', async ({ page }) => {
  144 |       await page.goto('http://localhost:3005/#/input/fake-sub-page')
  145 |       await page.waitForLoadState('domcontentloaded')
  146 |       await expect(page.locator('#root')).toBeAttached()
  147 |     })
  148 |   })
  149 | 
  150 |   // ============================================================
  151 |   // 面包屑导航
  152 |   // ============================================================
  153 |   test.describe('面包屑导航存在性', () => {
  154 |     test('输出舱页面应存在面包屑导航', async ({ page }) => {
  155 |       await navigateTo(page, ROUTES.output)
  156 |       await expect(page.getByRole('heading', { name: '输出舱' }).first()).toBeVisible({ timeout: 10000 })
  157 |       const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  158 |       await expect(breadcrumb).toBeVisible({ timeout: 5000 })
  159 |     })
  160 | 
  161 |     test('输出舱页面包屑应包含"首页 > 输出舱"', async ({ page }) => {
  162 |       await navigateTo(page, ROUTES.output)
  163 |       await expect(page.getByRole('heading', { name: '输出舱' }).first()).toBeVisible({ timeout: 10000 })
  164 |       const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  165 |       await expect(breadcrumb).toContainText('首页')
  166 |       await expect(breadcrumb).toContainText('输出舱')
  167 |     })
  168 | 
  169 |     test('采集任务监控页面包屑应包含完整路径', async ({ page }) => {
  170 |       await navigateTo(page, ROUTES.inputCollectTasks)
  171 |       await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
  172 |       const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  173 |       await expect(breadcrumb).toContainText('首页')
  174 |       await expect(breadcrumb).toContainText('输入')
  175 |     })
  176 |   })
  177 | })
  178 | 
```