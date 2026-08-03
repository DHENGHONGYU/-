/**
 * 蓝图专项验收：
 * F1. PortalShell 布局（顶栏 / 侧边栏 / 暗色主题）—— 蓝图 §7.1 / ADR-005
 * F2. IndexedDB 数据层 17 个核心 store —— 蓝图 §4.1
 * F3. 驾驶舱 Widget 引擎渲染 —— 蓝图 §7.3 / D14
 * F4. Mock 验证页 /mock-test
 * 结果写入 outputs/blueprint-audit/results/features.json
 */
import { test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { OUT_DIR } from './_audit-helpers'

interface FeatureResult {
  id: string
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail: Record<string, unknown>
}

const results: FeatureResult[] = []

/** 蓝图 §4.1 的 17 个核心 store（snake_case → 实际 camelCase 映射） */
const BLUEPRINT_STORES: Array<[string, string]> = [
  ['stocks', 'stocks'],
  ['daily_quotes', 'dailyQuotes'],
  ['v6_scores', 'v6Scores'],
  ['intelligent_scores', 'intelligentScores'],
  ['industry_scores', 'industryScores'],
  ['orders', 'orders'],
  ['watchlists', 'watchlists'],
  ['signals', 'signals'],
  ['research_logs', 'researchLogs'],
  ['rotation_scores', 'rotationScores'],
  ['sector_scores', 'sectorScores'],
  ['score_docs', 'scoreDocs'],
  ['strategy_snapshots', 'strategySnapshots'],
  ['local_docs', 'localDocs'],
  ['news', 'news'],
  ['news_stock_map', 'newsStockMap'],
  ['sentiment_cache', 'sentimentCache'],
]

test.describe.configure({ mode: 'serial' })
test.setTimeout(150_000)

test('F1 PortalShell 布局与暗色主题', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  await page.goto('/#/input', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root')
      return !!root && root.childElementCount > 0 && (root.textContent ?? '').trim().length > 0
    },
    { timeout: 60_000 },
  )
  await page.waitForTimeout(1000)

  const layout = await page.evaluate(() => {
    const aside = document.querySelector('aside')
    const header = document.querySelector('header')
    const nav = document.querySelector('nav')
    const html = document.documentElement
    const bodyBg = getComputedStyle(document.body).backgroundColor
    return {
      hasAside: !!aside,
      asideWidth: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      hasHeader: !!header,
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      hasNav: !!nav,
      darkClass: html.classList.contains('dark') || document.body.classList.contains('dark'),
      bodyBg,
      pageErrors: 0,
    }
  })
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshots', 'feature-portalshell.png') })

  const ok = layout.hasAside && layout.hasHeader && errors.length === 0
  results.push({
    id: 'F1',
    name: 'PortalShell 布局（侧边栏/顶栏/暗色）',
    status: ok ? 'pass' : 'fail',
    detail: { ...layout, pageErrors: errors },
  })
})

test('F2 IndexedDB 17 个核心数据表', async ({ page }) => {
  await page.goto('/#/input', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root')
      return !!root && root.childElementCount > 0 && (root.textContent ?? '').trim().length > 0
    },
    { timeout: 60_000 },
  )
  // 触发各舱室懒加载以尽可能初始化 DB
  for (const p of ['/#/analysis', '/#/trading', '/#/output']) {
    await page.goto(p, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined)
    await page.waitForTimeout(1500)
  }

  const dbInfo = await page.evaluate(async () => {
    const openDb = (name: string) =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open(name)
        req.onsuccess = () => {
          const names = Array.from(req.result.objectStoreNames)
          req.result.close()
          resolve(names)
        }
        req.onerror = () => resolve([])
        req.onblocked = () => resolve([])
      })
    const dbs = (await indexedDB.databases?.()) ?? []
    const out: Record<string, string[]> = {}
    for (const d of dbs) {
      if (d.name) out[d.name] = await openDb(d.name)
    }
    return out
  })

  const allStores = new Set(Object.values(dbInfo).flat())
  const found: string[] = []
  const missing: string[] = []
  for (const [blueprintName, actualName] of BLUEPRINT_STORES) {
    if (allStores.has(actualName) || allStores.has(blueprintName)) found.push(blueprintName)
    else missing.push(`${blueprintName}→${actualName}`)
  }
  results.push({
    id: 'F2',
    name: 'IndexedDB 17 个核心数据表（蓝图 §4.1）',
    status: missing.length === 0 ? 'pass' : found.length >= 12 ? 'warn' : 'fail',
    detail: {
      databases: Object.keys(dbInfo),
      totalStores: allStores.size,
      found: found.length,
      missing,
      allStores: Array.from(allStores).sort(),
    },
  })
})

test('F3 驾驶舱 Widget 引擎渲染', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  await page.goto('/#/cockpit', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const rendered = await page
    .waitForFunction(
      () => {
        const root = document.getElementById('root')
        return !!root && root.childElementCount > 0 && (root.textContent ?? '').trim().length > 0
      },
      { timeout: 60_000 },
    )
    .then(() => true)
    .catch(() => false)
  await page.waitForTimeout(1500)
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('root')
    const text = (root?.textContent ?? '').trim()
    return {
      rootChildren: root?.childElementCount ?? 0,
      textLength: text.length,
      interactiveEls: document.querySelectorAll('button, [role="button"], input, select').length,
      sections: document.querySelectorAll('section, article, [class*="widget"], [class*="Widget"]').length,
    }
  })
  await page.screenshot({ path: path.join(OUT_DIR, 'screenshots', 'feature-cockpit.png') })
  const ok = rendered && metrics.rootChildren > 0 && errors.length === 0
  results.push({
    id: 'F3',
    name: '驾驶舱 Widget 引擎渲染（蓝图 §7.3 / D14）',
    status: ok ? 'pass' : 'fail',
    detail: { ...metrics, pageErrors: errors },
  })
})

// [DEPRECATED 2026-08-04] F4 Mock 验证页 /mock-test 已从路由解耦，跳过该 e2e 用例
test.skip('F4 Mock 验证页 /mock-test', async () => {
  // 路由 /mock-test 已移除，本用例不再执行；保留结构便于未来恢复或彻底删除。
})

test.afterAll(() => {
  fs.mkdirSync(path.join(OUT_DIR, 'results'), { recursive: true })
  fs.writeFileSync(
    path.join(OUT_DIR, 'results', 'features.json'),
    JSON.stringify(results, null, 2),
    'utf-8',
  )
})
