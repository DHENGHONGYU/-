# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance\resource-audit.spec.ts >> 资源请求审计 >> 关键 chunk 成功加载（JS/CSS）
- Location: performance\resource-audit.spec.ts:33:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
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
  2  | import { navigateTo, ROUTES } from '../utils/helpers'
  3  | 
  4  | test.describe('资源请求审计', () => {
  5  |   test('无 404 资源请求', async ({ page }) => {
  6  |     const failedRequests: string[] = []
  7  |     page.on('response', response => {
  8  |       if (response.status() === 404) {
  9  |         failedRequests.push(response.url())
  10 |       }
  11 |     })
  12 |     
  13 |     await navigateTo(page, ROUTES.home)
  14 |     await page.waitForTimeout(2000)
  15 |     
  16 |     expect(failedRequests).toHaveLength(0)
  17 |   })
  18 | 
  19 |   test('无 5xx 错误', async ({ page }) => {
  20 |     const errors: string[] = []
  21 |     page.on('response', response => {
  22 |       if (response.status() >= 500) {
  23 |         errors.push(`${response.url()} (${response.status()})`)
  24 |       }
  25 |     })
  26 |     
  27 |     await navigateTo(page, ROUTES.home)
  28 |     await page.waitForTimeout(2000)
  29 |     
  30 |     expect(errors).toHaveLength(0)
  31 |   })
  32 | 
  33 |   test('关键 chunk 成功加载（JS/CSS）', async ({ page }) => {
  34 |     let jsCount = 0
  35 |     let cssCount = 0
  36 |     page.on('response', response => {
  37 |       if (response.status() === 200) {
  38 |         const ct = response.headers()['content-type'] || ''
  39 |         if (ct.includes('javascript') || ct.includes('text/javascript')) jsCount++
  40 |         if (ct.includes('css')) cssCount++
  41 |       }
  42 |     })
  43 |     
  44 |     await navigateTo(page, ROUTES.home)
  45 |     await page.waitForTimeout(2000)
  46 |     
  47 |     expect(jsCount).toBeGreaterThan(0)
> 48 |     expect(cssCount).toBeGreaterThan(0)
     |                      ^ Error: expect(received).toBeGreaterThan(expected)
  49 |   })
  50 | })
  51 | 
```