# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance\load-timing.spec.ts >> 导航性能 >> 舱室切换 < 3s
- Location: performance\load-timing.spec.ts:49:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('nav button').filter({ hasText: '输入' }).first()

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
  2  | import { navigateTo, waitForAppReady, ROUTES, getPerformanceMetrics } from '../utils/helpers'
  3  | 
  4  | test.describe('首页性能', () => {
  5  |   test('首页 DOMContentLoaded < 3s', async ({ page }) => {
  6  |     await navigateTo(page, ROUTES.home)
  7  |     await waitForAppReady(page)
  8  |     const metrics = await getPerformanceMetrics(page)
  9  |     expect(metrics.domContentLoaded).toBeLessThan(3000)
  10 |   })
  11 | 
  12 |   test('首页首屏渲染 < 5s', async ({ page }) => {
  13 |     await navigateTo(page, ROUTES.home)
  14 |     await waitForAppReady(page)
  15 |     const metrics = await getPerformanceMetrics(page)
  16 |     const loadTime = metrics.loadComplete < 100 ? metrics.domContentLoaded : metrics.loadComplete
  17 |     expect(loadTime).toBeLessThan(5000)
  18 |   })
  19 | 
  20 |   test('首页资源请求数 < 100', async ({ page }) => {
  21 |     await navigateTo(page, ROUTES.home)
  22 |     await waitForAppReady(page)
  23 |     const metrics = await getPerformanceMetrics(page)
  24 |     expect(metrics.resourceCount).toBeLessThan(200)
  25 |   })
  26 | })
  27 | 
  28 | test.describe('核心页面加载性能', () => {
  29 |   const PAGES = [
  30 |     { route: ROUTES.input, name: '输入舱' },
  31 |     { route: ROUTES.analysis, name: '分析舱' },
  32 |     { route: ROUTES.trading, name: '交易舱' },
  33 |     { route: ROUTES.output, name: '输出舱' },
  34 |     { route: ROUTES.command, name: '总控舱' },
  35 |   ]
  36 | 
  37 |   for (const { route, name } of PAGES) {
  38 |     test(`${name}加载时间 < 5s`, async ({ page }) => {
  39 |       await navigateTo(page, route)
  40 |       await waitForAppReady(page)
  41 |       const metrics = await getPerformanceMetrics(page)
  42 |       const loadTime = metrics.loadComplete < 100 ? metrics.domContentLoaded : metrics.loadComplete
  43 |       expect(loadTime).toBeLessThan(5000)
  44 |     })
  45 |   }
  46 | })
  47 | 
  48 | test.describe('导航性能', () => {
  49 |   test('舱室切换 < 3s', async ({ page }) => {
  50 |     await navigateTo(page, ROUTES.home)
  51 |     await waitForAppReady(page)
  52 |     
  53 |     const start = Date.now()
  54 |     const tab = page.locator('nav button', { hasText: '输入' }).first()
> 55 |     await tab.click()
     |               ^ Error: locator.click: Test timeout of 30000ms exceeded.
  56 |     await page.waitForTimeout(300)
  57 |     const duration = Date.now() - start
  58 |     
  59 |     expect(duration).toBeLessThan(3000)
  60 |   })
  61 | 
  62 |   test('侧边栏面板跳转 < 1s', async ({ page }) => {
  63 |     await navigateTo(page, ROUTES.input)
  64 |     await waitForAppReady(page)
  65 |     
  66 |     const start = Date.now()
  67 |     // 点击侧边栏"批量导入"
  68 |     const bulkImport = page.locator('aside button', { hasText: '批量导入' }).first()
  69 |     await bulkImport.click()
  70 |     await page.waitForTimeout(300)
  71 |     const duration = Date.now() - start
  72 |     
  73 |     expect(duration).toBeLessThan(1000)
  74 |   })
  75 | })
  76 | 
```