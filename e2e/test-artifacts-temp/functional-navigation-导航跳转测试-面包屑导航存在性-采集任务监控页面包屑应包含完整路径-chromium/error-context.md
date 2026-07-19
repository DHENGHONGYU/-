# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: functional\navigation.spec.ts >> 导航跳转测试 >> 面包屑导航存在性 >> 采集任务监控页面包屑应包含完整路径
- Location: functional\navigation.spec.ts:169:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '采集任务监控' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: '采集任务监控' })

```

```yaml
- heading "404" [level=1]
- paragraph: 页面未找到
```

# Test source

```ts
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
> 171 |       await expect(page.getByRole('heading', { name: '采集任务监控' })).toBeVisible({ timeout: 10000 })
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  172 |       const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  173 |       await expect(breadcrumb).toContainText('首页')
  174 |       await expect(breadcrumb).toContainText('输入')
  175 |     })
  176 |   })
  177 | })
  178 | 
```