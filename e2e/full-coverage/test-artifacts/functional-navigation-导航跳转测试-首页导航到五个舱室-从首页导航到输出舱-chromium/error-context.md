# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\navigation.spec.ts >> 导航跳转测试 >> 首页导航到五个舱室 >> 从首页导航到输出舱
- Location: functional\navigation.spec.ts:36:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '输出舱', level: 1 }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: '输出舱', level: 1 }).first()

```

```yaml
- heading "404" [level=1]
- paragraph: 页面未找到
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
> 38  |       await expect(page.getByRole('heading', { name: '输出舱', level: 1 }).first()).toBeVisible({ timeout: 10000 })
      |                                                                                  ^ Error: expect(locator).toBeVisible() failed
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
  87  |       await expect(nav).toBeAttached()
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
```