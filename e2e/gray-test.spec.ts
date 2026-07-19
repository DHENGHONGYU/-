/**
 * 灰度测试 E2E 脚本（用于 CloudStudio 部署后验证）
 * 
 * 用法：启动本地 dev server 或部署到 CloudStudio 后，
 * 设置 DEPLOY_URL 环境变量指向部署地址运行此脚本。
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.DEPLOY_URL || 'http://localhost:3005'

// ── 阶段 1: 构建产物验证 ──

test.describe('灰度测试 — 构建产物完整性', () => {
  test('index.html 可访问', async ({ page }) => {
    const res = await page.goto(BASE)
    expect(res?.status()).toBe(200)
  })

  test('CSS 文件成功加载', async ({ page }) => {
    let cssLoaded = false
    page.on('response', r => {
      if (r.headers()['content-type']?.includes('css')) cssLoaded = true
    })
    await page.goto(BASE)
    await page.waitForTimeout(2000)
    expect(cssLoaded).toBeTruthy()
  })

  test('JS 主 chunk 成功加载', async ({ page }) => {
    let jsLoaded = false
    page.on('response', r => {
      const ct = r.headers()['content-type'] || ''
      if (ct.includes('javascript') && r.status() === 200) jsLoaded = true
    })
    await page.goto(BASE)
    await page.waitForTimeout(2000)
    expect(jsLoaded).toBeTruthy()
  })

  test('无 404 资源请求', async ({ page }) => {
    const notFound: string[] = []
    page.on('response', r => { if (r.status() === 404) notFound.push(r.url()) })
    await page.goto(BASE)
    await page.waitForTimeout(2000)
    expect(notFound).toHaveLength(0)
  })
})

// ── 阶段 2: 核心页面冒烟 ──

test.describe('灰度测试 — 核心页面冒烟', () => {
  const PAGES = [
    { path: '', name: '首页', heading: '智能投研' },
    { path: '#/input', name: '输入舱', heading: '输入舱' },
    { path: '#/analysis', name: '分析舱', heading: '分析舱' },
    { path: '#/trading', name: '交易舱', heading: '交易舱' },
    { path: '#/output', name: '输出舱', heading: '输出舱' },
    { path: '#/command', name: '总控舱', heading: '总控' },
    { path: '#/cockpit', name: '驾驶舱', heading: '' },
  ]

  for (const { path, name, heading } of PAGES) {
    test(`${name}页面可访问`, async ({ page }) => {
      await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForSelector('#root', { timeout: 15000 })
      if (heading) {
        await expect(page.locator('body')).toContainText(heading, { timeout: 10000 })
      }
    })
  }
})

// ── 阶段 3: 数据流链路 ──

test.describe('灰度测试 — 数据流链路', () => {
  test('导航到七维配置页成功', async ({ page }) => {
    await page.goto(`${BASE}/#/input/seven-dim`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#root', { timeout: 15000 })
    await expect(page.locator('body')).toContainText('策略模板', { timeout: 10000 })
  })

  test('导航到采集任务监控成功', async ({ page }) => {
    await page.goto(`${BASE}/#/input/collect-tasks`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#root', { timeout: 15000 })
    await expect(page.locator('body')).toContainText('采集', { timeout: 10000 })
  })
})

// ── 阶段 4: 边界与安全 ──

test.describe('灰度测试 — 边界与安全', () => {
  test('不存在的页面显示 404', async ({ page }) => {
    await page.goto(`${BASE}/#/nonexistent-xyz`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    const text = await page.locator('body').innerText()
    expect(text).toMatch(/页面未找到|404|V9/)
  })

  test('快速连续导航不崩溃', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.goto(`${BASE}/#/input`, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await page.goto(`${BASE}/#/analysis`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    }
    await expect(page.locator('#root')).toBeAttached()
  })
})

// ── 阶段 5: 性能阈值 ──

test.describe('灰度测试 — 性能阈值', () => {
  test('首页首屏渲染 < 5s', async ({ page }) => {
    const start = Date.now()
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000)
  })

  test('驾驶舱页面加载 < 8s', async ({ page }) => {
    const start = Date.now()
    await page.goto(`${BASE}/#/cockpit`, { waitUntil: 'networkidle', timeout: 30000 })
    const duration = Date.now() - start
    expect(duration).toBeLessThan(8000)
  })
})
