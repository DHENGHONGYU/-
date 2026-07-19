# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cross-browser\compatibility.spec.ts >> 跨浏览器导航 >> 导航到输出舱正常
- Location: cross-browser\compatibility.spec.ts:31:5

# Error details

```
Error: expect(locator).not.toBeEmpty() failed

Locator: locator('main')
Expected: not empty
Error: strict mode violation: locator('main') resolved to 2 elements:
    1) <main class="min-w-0 flex-1 overflow-auto bg-card">…</main> aka getByRole('main').first()
    2) <main class="w-full px-6 py-6 mx-auto max-w-[1200px] space-y-6">…</main> aka getByText('首页输出舱输出舱报告导出与数据输出管理V3.0')

Call log:
  - Expect "not toBeEmpty" with timeout 10000ms
  - waiting for locator('main')

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
      - button "📊输出舱" [active] [ref=e12] [cursor=pointer]
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
      - generic [ref=e37]: 00:00:02
      - generic [ref=e39]: v1.2.0
  - generic [ref=e40]:
    - complementary [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]: 📊
        - generic [ref=e44]: 输出舱
      - generic [ref=e46]:
        - generic [ref=e47]: 输出
        - list [ref=e48]:
          - listitem [ref=e49]:
            - button "研报复盘" [ref=e50] [cursor=pointer]:
              - img [ref=e51]
              - generic [ref=e54]: 研报复盘
          - listitem [ref=e55]:
            - button "仪表盘" [ref=e56] [cursor=pointer]:
              - img [ref=e57]
              - generic [ref=e62]: 仪表盘
          - listitem [ref=e63]:
            - button "数据导出" [ref=e64] [cursor=pointer]:
              - img [ref=e65]
              - generic [ref=e69]: 数据导出
          - listitem [ref=e70]:
            - button "交易复盘" [ref=e71] [cursor=pointer]:
              - img [ref=e72]
              - generic [ref=e74]: 交易复盘
          - listitem [ref=e75]:
            - button "复盘向导" [ref=e76] [cursor=pointer]:
              - img [ref=e77]
              - generic [ref=e79]: 复盘向导
          - listitem [ref=e80]:
            - button "预测校验" [ref=e81] [cursor=pointer]:
              - img [ref=e82]
              - generic [ref=e85]: 预测校验
          - listitem [ref=e86]:
            - button "周期复盘" [ref=e87] [cursor=pointer]:
              - img [ref=e88]
              - generic [ref=e93]: 周期复盘
          - listitem [ref=e94]:
            - button "因子画板" [ref=e95] [cursor=pointer]:
              - img [ref=e96]
              - generic [ref=e99]: 因子画板
    - main [ref=e101]:
      - main [ref=e103]:
        - navigation "breadcrumb" [ref=e104]:
          - list [ref=e105]:
            - listitem [ref=e106]:
              - link "首页" [ref=e107] [cursor=pointer]:
                - /url: "#/"
            - listitem [ref=e108]:
              - link "输出舱" [disabled] [ref=e109]
        - generic [ref=e110]:
          - generic [ref=e111]:
            - heading "输出舱" [level=1] [ref=e112]
            - paragraph [ref=e113]: 报告导出与数据输出管理
          - generic [ref=e115]: V3.0 模块五
        - generic [ref=e116]:
          - heading "功能模块" [level=2] [ref=e117]
          - generic [ref=e118]:
            - generic [ref=e119]:
              - generic [ref=e120]:
                - generic [ref=e122]:
                  - img [ref=e124]
                  - heading "研究报告" [level=3] [ref=e127]
                - paragraph [ref=e128]: 生成和导出研究报告
              - link "进入" [ref=e130] [cursor=pointer]:
                - /url: "#/output/research"
                - text: 进入
                - img [ref=e131]
            - generic [ref=e133]:
              - generic [ref=e134]:
                - generic [ref=e136]:
                  - img [ref=e138]
                  - heading "交易复盘" [level=3] [ref=e140]
                - paragraph [ref=e141]: 交易记录回顾与复盘报告
              - link "进入" [ref=e143] [cursor=pointer]:
                - /url: "#/output/review"
                - text: 进入
                - img [ref=e144]
            - generic [ref=e146]:
              - generic [ref=e147]:
                - generic [ref=e149]:
                  - img [ref=e151]
                  - heading "数据导出" [level=3] [ref=e155]
                - paragraph [ref=e156]: 全量数据 JSON/CSV 导出
              - link "进入" [ref=e158] [cursor=pointer]:
                - /url: "#/output/export"
                - text: 进入
                - img [ref=e159]
            - generic [ref=e161]:
              - generic [ref=e162]:
                - generic [ref=e164]:
                  - img [ref=e166]
                  - heading "复盘向导" [level=3] [ref=e169]
                - paragraph [ref=e170]: 四步渐进式复盘并导出成品卡
              - link "进入" [ref=e172] [cursor=pointer]:
                - /url: "#/output/wizard"
                - text: 进入
                - img [ref=e173]
            - generic [ref=e175]:
              - generic [ref=e176]:
                - generic [ref=e177]:
                  - generic [ref=e178]:
                    - img [ref=e180]
                    - heading "预测校验" [level=3] [ref=e183]
                  - generic [ref=e184]: 新增
                - paragraph [ref=e185]: 因子预测记录与准确性校验
              - link "进入" [ref=e187] [cursor=pointer]:
                - /url: "#/output/prediction"
                - text: 进入
                - img [ref=e188]
            - generic [ref=e190]:
              - generic [ref=e191]:
                - generic [ref=e192]:
                  - generic [ref=e193]:
                    - img [ref=e195]
                    - heading "周期复盘" [level=3] [ref=e200]
                  - generic [ref=e201]: 新增
                - paragraph [ref=e202]: 月度周期复盘与因子权重校准
              - link "进入" [ref=e204] [cursor=pointer]:
                - /url: "#/output/retrospective"
                - text: 进入
                - img [ref=e205]
            - generic [ref=e207]:
              - generic [ref=e208]:
                - generic [ref=e209]:
                  - generic [ref=e210]:
                    - img [ref=e212]
                    - heading "因子画板" [level=3] [ref=e217]
                  - generic [ref=e218]: 新增
                - paragraph [ref=e219]: 因子监控画板与失效预警
              - link "进入" [ref=e221] [cursor=pointer]:
                - /url: "#/output/factor-dashboard"
                - text: 进入
                - img [ref=e222]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { navigateTo, waitForAppReady, ROUTES } from '../utils/helpers'
  3  | 
  4  | // 注意：多浏览器支持需要在 config 中配置 projects，此文件测试跨浏览器下的一致性
  5  | test.describe('跨浏览器核心渲染', () => {
  6  |   test('首页在 Chromium 下正常渲染', async ({ page, browserName }) => {
  7  |     test.skip(browserName !== 'chromium', '仅 Chromium 测试')
  8  |     await navigateTo(page, ROUTES.home)
  9  |     await waitForAppReady(page)
  10 |     await expect(page.locator('h1')).toContainText('智能投研')
  11 |   })
  12 | 
  13 |   test('首页在 Firefox 下正常渲染', async ({ page, browserName }) => {
  14 |     test.skip(browserName !== 'firefox', '仅 Firefox 测试')
  15 |     await navigateTo(page, ROUTES.home)
  16 |     await waitForAppReady(page)
  17 |     await expect(page.locator('h1')).toContainText('智能投研')
  18 |   })
  19 | 
  20 |   test('首页在 WebKit 下正常渲染', async ({ page, browserName }) => {
  21 |     test.skip(browserName !== 'webkit', '仅 WebKit 测试')
  22 |     await navigateTo(page, ROUTES.home)
  23 |     await waitForAppReady(page)
  24 |     await expect(page.locator('h1')).toContainText('智能投研')
  25 |   })
  26 | })
  27 | 
  28 | test.describe('跨浏览器导航', () => {
  29 |   const PAGES = ['输入舱', '分析舱', '交易舱', '输出舱', '总控舱']
  30 |   for (const pageName of PAGES) {
  31 |     test(`导航到${pageName}正常`, async ({ page }) => {
  32 |       // 舱室导航按钮只存在于 PortalShell（cabin 页面），首页没有
  33 |       await navigateTo(page, ROUTES.input)
  34 |       await waitForAppReady(page)
  35 |       const tabText = pageName.replace('舱', '')
  36 |       const tab = page.locator('header nav button', { hasText: tabText }).first()
  37 |       await tab.click()
  38 |       await page.waitForTimeout(500)
  39 |       // 验证页面有内容
  40 |       const mainContent = page.locator('main')
> 41 |       await expect(mainContent).not.toBeEmpty()
     |                                     ^ Error: expect(locator).not.toBeEmpty() failed
  42 |     })
  43 |   }
  44 | })
  45 | 
  46 | test.describe('跨浏览器表单交互', () => {
  47 |   test('七维配置模板切换在 Chromium', async ({ page, browserName }) => {
  48 |     test.skip(browserName !== 'chromium', '仅 Chromium')
  49 |     await navigateTo(page, ROUTES.inputSevenDim)
  50 |     await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  51 |     // 点击价值投资策略模板卡片
  52 |     await page.getByRole('heading', { name: '价值投资' }).click()
  53 |     // 维度区应显示已启用的维度计数
  54 |     await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  55 |   })
  56 |   
  57 |   test('七维配置模板切换在 Firefox', async ({ page, browserName }) => {
  58 |     test.skip(browserName !== 'firefox', '仅 Firefox')
  59 |     await navigateTo(page, ROUTES.inputSevenDim)
  60 |     await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  61 |     await page.getByRole('heading', { name: '价值投资' }).click()
  62 |     await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  63 |   })
  64 |   
  65 |   test('七维配置模板切换在 WebKit', async ({ page, browserName }) => {
  66 |     test.skip(browserName !== 'webkit', '仅 WebKit')
  67 |     await navigateTo(page, ROUTES.inputSevenDim)
  68 |     await expect(page.getByRole('heading', { name: '七维采集配置' })).toBeVisible({ timeout: 10000 })
  69 |     await page.getByRole('heading', { name: '价值投资' }).click()
  70 |     await expect(page.getByRole('heading', { name: '采集维度' })).toBeVisible()
  71 |   })
  72 | })
  73 | 
```