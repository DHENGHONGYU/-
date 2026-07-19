# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cross-browser\compatibility.spec.ts >> 跨浏览器导航 >> 导航到分析舱正常
- Location: cross-browser\compatibility.spec.ts:31:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('nav button').filter({ hasText: '分析' }).first()

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "智能投研复盘系统 V9" [level=1] [ref=e6]
      - paragraph [ref=e7]: 面向中国 A 股个人投资者的研究决策工具
    - link "打开驾驶舱" [ref=e9] [cursor=pointer]:
      - /url: "#/cockpit"
  - generic [ref=e10]:
    - link "股票池 0 尚无标的" [ref=e11] [cursor=pointer]:
      - /url: "#/input"
      - img [ref=e13]
      - generic [ref=e17]:
        - paragraph [ref=e18]: 股票池
        - paragraph [ref=e19]: "0"
        - paragraph [ref=e20]: 尚无标的
    - link "交易信号 0 暂无信号" [ref=e21] [cursor=pointer]:
      - /url: "#/trading"
      - img [ref=e23]
      - generic [ref=e25]:
        - paragraph [ref=e26]: 交易信号
        - paragraph [ref=e27]: "0"
        - paragraph [ref=e28]: 暂无信号
    - link "采集任务 0 未启动采集" [ref=e29] [cursor=pointer]:
      - /url: "#/input/collect-tasks"
      - img [ref=e31]
      - generic [ref=e33]:
        - paragraph [ref=e34]: 采集任务
        - paragraph [ref=e35]: "0"
        - paragraph [ref=e36]: 未启动采集
    - link "采集服务 正常 信号正常" [ref=e37] [cursor=pointer]:
      - /url: "#/input/data-test"
      - img [ref=e39]
      - generic [ref=e43]:
        - paragraph [ref=e44]: 采集服务
        - paragraph [ref=e45]: 正常
        - paragraph [ref=e46]: 信号正常
  - generic [ref=e47]:
    - link "输入舱 录入候选股票，管理股票池，批量导入，热门板块 进入" [ref=e48] [cursor=pointer]:
      - /url: "#/input"
      - img [ref=e50]
      - generic [ref=e54]:
        - heading "输入舱" [level=3] [ref=e55]
        - paragraph [ref=e56]: 录入候选股票，管理股票池，批量导入，热门板块
      - generic [ref=e57]:
        - text: 进入
        - img [ref=e58]
    - link "分析舱 V4/V6 评分，行业分析，策略回测 进入" [ref=e60] [cursor=pointer]:
      - /url: "#/analysis"
      - img [ref=e62]
      - generic [ref=e64]:
        - heading "分析舱" [level=3] [ref=e65]
        - paragraph [ref=e66]: V4/V6 评分，行业分析，策略回测
      - generic [ref=e67]:
        - text: 进入
        - img [ref=e68]
    - link "交易舱 交易信号，模拟盘执行，持仓管理 进入" [ref=e70] [cursor=pointer]:
      - /url: "#/trading"
      - img [ref=e72]
      - generic [ref=e75]:
        - heading "交易舱" [level=3] [ref=e76]
        - paragraph [ref=e77]: 交易信号，模拟盘执行，持仓管理
      - generic [ref=e78]:
        - text: 进入
        - img [ref=e79]
    - link "输出舱 研究报告，数据导出 进入" [ref=e81] [cursor=pointer]:
      - /url: "#/output"
      - img [ref=e83]
      - generic [ref=e86]:
        - heading "输出舱" [level=3] [ref=e87]
        - paragraph [ref=e88]: 研究报告，数据导出
      - generic [ref=e89]:
        - text: 进入
        - img [ref=e90]
  - generic [ref=e92]:
    - link "进入输入舱" [ref=e93] [cursor=pointer]:
      - /url: "#/input"
    - link "总控中心" [ref=e94] [cursor=pointer]:
      - /url: "#/command"
  - generic [ref=e96]:
    - img [ref=e97]
    - text: UI 组件已升级 · 模块首页已上线
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
  32 |       await navigateTo(page, ROUTES.home)
  33 |       await waitForAppReady(page)
  34 |       // 点击对应的舱室 tab
  35 |       const tabText = pageName.replace('舱', '')
  36 |       const tab = page.locator('nav button', { hasText: tabText }).first()
> 37 |       await tab.click()
     |                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
  38 |       await page.waitForTimeout(500)
  39 |       // 验证页面有内容
  40 |       const mainContent = page.locator('main')
  41 |       await expect(mainContent).not.toBeEmpty()
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