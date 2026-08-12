/**
 * @test_id V9-TEST-STRESS-SECTOR-STOCKS-30
 * @covers_docs [V9-DOC-QA-036]
 * @acceptance_checklist docs/reports/testing/sector-stocks-ui-acceptance-checklist.md
 *
 * 板块个股清单页面 · 30 只股票批量加入意向池 · 本地压力测试
 *
 * 验收清单性能阈值:
 *   BAT-05: 30 只股票批量加入 < 8 秒
 *   BAT-06: 加入过程中 UI 不卡顿（长任务 < 200ms）
 *
 * 运行方式:
 *   npx playwright test sector-stocks-stress --project=chromium --reporter=list
 *
 * 输出:
 *   outputs/stress-test/sector-stocks-stress-{timestamp}.json — 详细计时报告
 */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// ============================================================
// 配置
// ============================================================

const STOCK_COUNT = 30
const PERFORMANCE_THRESHOLD_MS = 8000 // 验收清单 BAT-05: < 8 秒
const TEST_SECTOR = '半导体'
const TEST_SECTOR_CODE = 'SW-半导体'
const OUTPUT_DIR = join(process.cwd(), 'outputs', 'stress-test')

// ============================================================
// 工具函数
// ============================================================

function makeStocks(count: number, sector: string): Record<string, unknown>[] {
  const stocks: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    const code = String(600000 + i).padStart(6, '0')
    stocks.push({
      symbol: `${code}.SH`,
      name: `压测${sector}${i}`,
      sector,
      industryCode: `SW-${sector}`,
      price: Math.round((10 + Math.random() * 90) * 100) / 100,
      pe: Math.round((5 + Math.random() * 45) * 10) / 10,
      pb: Math.round((0.5 + Math.random() * 4.5) * 100) / 100,
      roe: Math.round((5 + Math.random() * 25) * 100) / 100,
      marketCap: Math.round((50 + Math.random() * 950) * 1e8),
      researchStatus: 'pending',
      source: 'manual',
      dataVersion: 1,
    })
  }
  return stocks
}

async function seedStocks(page: Page, stocks: Record<string, unknown>[]): Promise<void> {
  await page.evaluate(async (data) => {
    const dbReq = indexedDB.open('V6ProDB', 32)
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      dbReq.onsuccess = () => resolve(dbReq.result)
      dbReq.onerror = () => reject(dbReq.error)
      dbReq.onupgradeneeded = () => {
        const db = dbReq.result
        if (!db.objectStoreNames.contains('stocks')) {
          db.createObjectStore('stocks', { keyPath: 'symbol' })
        }
      }
    })
    const tx = db.transaction('stocks', 'readwrite')
    const store = tx.objectStore('stocks')
    const allReq = store.getAll()
    const allRecords: Record<string, unknown>[] = await new Promise((resolve, reject) => {
      allReq.onsuccess = () => resolve(allReq.result)
      allReq.onerror = () => reject(allReq.error)
    })
    for (const record of allRecords) {
      const name = record.name as string
      if (name && name.startsWith('压测')) {
        store.delete(record.symbol as string)
      }
    }
    for (const stock of data) {
      store.put(stock)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  }, stocks)
}

async function cleanupStocks(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const dbReq = indexedDB.open('V6ProDB')
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      dbReq.onsuccess = () => resolve(dbReq.result)
      dbReq.onerror = () => reject(dbReq.error)
    })
    if (!db.objectStoreNames.contains('stocks')) {
      db.close()
      return
    }
    const tx = db.transaction('stocks', 'readwrite')
    const store = tx.objectStore('stocks')
    const allReq = store.getAll()
    const allRecords: Record<string, unknown>[] = await new Promise((resolve, reject) => {
      allReq.onsuccess = () => resolve(allReq.result)
      allReq.onerror = () => reject(allReq.error)
    })
    for (const record of allRecords) {
      const name = record.name as string
      if (name && name.startsWith('压测')) {
        store.delete(record.symbol as string)
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
}

// ============================================================
// 计时结果类型
// ============================================================

interface TimingResult {
  stockCount: number
  thresholdMs: number
  pageLoadMs: number
  selectAllMs: number
  batchAddMs: number
  totalMs: number
  longTaskCount: number
  longTaskMaxMs: number
  passed: boolean
  reason: string
  metrics: {
    jsHeapUsedMB: number
    jsHeapTotalMB: number
    domNodeCount: number
    layoutDurationMs: number
    scriptDurationMs: number
    taskDurationMs: number
  }
  timestamp: string
}

// ============================================================
// 压力测试
// ============================================================

test.describe('板块个股清单 · 30 只批量加入压力测试', () => {
  test.describe.configure({ timeout: 60000 })

  test(`BAT-05: ${STOCK_COUNT} 只股票批量加入意向池 < ${PERFORMANCE_THRESHOLD_MS / 1000} 秒`, async ({ page }) => {
    const sectorCodeEncoded = encodeURIComponent(TEST_SECTOR_CODE)
    const sectorNameEncoded = encodeURIComponent(TEST_SECTOR)

    // ── 1. 注入 30 只测试股票 ──
    const stocks = makeStocks(STOCK_COUNT, TEST_SECTOR)
    await page.goto('/#/analysis')
    await seedStocks(page, stocks)

    // ── 2. 开启 CDP 性能监控 ──
    const client = await page.context().newCDPSession(page)
    await client.send('Performance.enable')
    await client.send('Runtime.enable')

    // 注入 Performance Observer 监控长任务
    await page.evaluate(() => {
      (window as unknown as { __longTasks: number[] }).__longTasks = []
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as unknown as { __longTasks: number[] }).__longTasks.push(entry.duration)
        }
      })
      obs.observe({ entryTypes: ['longtask'] })
    })

    // ── 3. 导航到板块个股清单页 ──
    const navStart = Date.now()
    await page.goto(
      `/#/analysis/hot-sector-stocks/${sectorCodeEncoded}?name=${sectorNameEncoded}`,
    )
    await expect(page.locator('tbody tr')).toHaveCount(STOCK_COUNT, { timeout: 15000 })
    const pageLoadMs = Date.now() - navStart

    // ── 4. 全选 ──
    const selectStart = Date.now()
    await page.getByRole('button', { name: /全选/ }).click()
    await expect(page.getByText(`已选 ${STOCK_COUNT} / ${STOCK_COUNT}`)).toBeVisible()
    const selectAllMs = Date.now() - selectStart

    // ── 5. 批量加入意向池（核心计时） ──
    const addBtn = page.getByRole('button', { name: /加入意向股票池/ })
    const batchStart = Date.now()
    await addBtn.click()

    // 等待按钮变为 loading 状态
    await expect(page.getByRole('button', { name: /加入中/ })).toBeVisible({ timeout: 2000 })
    const loadingStateMs = Date.now() - batchStart

    // 等待 Toast 出现（操作完成标志）
    await expect(page.getByText(new RegExp(`成功 ${STOCK_COUNT} 只`))).toBeVisible({
      timeout: 30000,
    })
    const batchAddMs = Date.now() - batchStart

    // 等待勾选清空
    await expect(page.getByText(`已选 0 / ${STOCK_COUNT}`)).toBeVisible({ timeout: 5000 })
    const totalMs = Date.now() - navStart

    // ── 6. 收集性能指标 ──
    const longTasks = await page.evaluate(() => {
      return (window as unknown as { __longTasks: number[] }).__longTasks
    })

    const cdpMetrics = await client.send('Performance.getMetrics')
    const getMetric = (name: string): number => {
      const m = cdpMetrics.metrics.find((m) => m.name === name)
      return m ? m.value : 0
    }

    const memInfo = await page.evaluate(() => {
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
      }
      return {
        jsHeapUsed: perf.memory?.usedJSHeapSize ?? 0,
        jsHeapTotal: perf.memory?.totalJSHeapSize ?? 0,
        domNodes: document.getElementsByTagName('*').length,
      }
    })

    // ── 7. 判定结果 ──
    const longTaskCount = longTasks.length
    const longTaskMaxMs = longTasks.length > 0 ? Math.max(...longTasks) : 0
    const passed = batchAddMs < PERFORMANCE_THRESHOLD_MS
    const reason = !passed
      ? `批量加入耗时 ${batchAddMs}ms 超过阈值 ${PERFORMANCE_THRESHOLD_MS}ms`
      : longTaskMaxMs > 200
        ? `存在 ${longTaskCount} 个长任务，最长 ${longTaskMaxMs.toFixed(0)}ms（UI 可能卡顿）`
        : '通过'

    const result: TimingResult = {
      stockCount: STOCK_COUNT,
      thresholdMs: PERFORMANCE_THRESHOLD_MS,
      pageLoadMs,
      selectAllMs,
      batchAddMs,
      totalMs,
      longTaskCount,
      longTaskMaxMs: Math.round(longTaskMaxMs),
      passed,
      reason,
      metrics: {
        jsHeapUsedMB: Math.round((memInfo.jsHeapUsed / 1024 / 1024) * 100) / 100,
        jsHeapTotalMB: Math.round((memInfo.jsHeapTotal / 1024 / 1024) * 100) / 100,
        domNodeCount: memInfo.domNodes,
        layoutDurationMs: Math.round(getMetric('LayoutDuration') * 1000),
        scriptDurationMs: Math.round(getMetric('ScriptDuration') * 1000),
        taskDurationMs: Math.round(getMetric('TaskDuration') * 1000),
      },
      timestamp: new Date().toISOString(),
    }

    // ── 8. 输出报告 ──
    mkdirSync(OUTPUT_DIR, { recursive: true })
    const reportPath = join(OUTPUT_DIR, `sector-stocks-stress-${Date.now()}.json`)
    writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf-8')

    // 控制台输出汇总表
    console.log('\n================ 30 只批量加入压力测试报告 ================')
    console.log(`测试时间:     ${result.timestamp}`)
    console.log(`股票数量:     ${result.stockCount} 只`)
    console.log(`性能阈值:     ${result.thresholdMs}ms (${result.thresholdMs / 1000}s)`)
    console.log('--------------------------------------------------------')
    console.log('各阶段计时:')
    console.log(`  页面加载:     ${result.pageLoadMs}ms`)
    console.log(`  全选操作:     ${result.selectAllMs}ms`)
    console.log(`  Loading 态:   ${loadingStateMs}ms（按钮 -> 加入中...）`)
    console.log(`  批量加入:     ${result.batchAddMs}ms（点击 -> Toast 出现）`)
    console.log(`  总耗时:       ${result.totalMs}ms`)
    console.log('--------------------------------------------------------')
    console.log('UI 响应监控:')
    console.log(`  长任务数:     ${result.longTaskCount} 个`)
    console.log(`  最长长任务:   ${result.longTaskMaxMs}ms`)
    console.log('--------------------------------------------------------')
    console.log('浏览器性能指标:')
    console.log(`  JS 堆已用:    ${result.metrics.jsHeapUsedMB} MB`)
    console.log(`  JS 堆总量:    ${result.metrics.jsHeapTotalMB} MB`)
    console.log(`  DOM 节点数:   ${result.metrics.domNodeCount}`)
    console.log(`  Layout 耗时:  ${result.metrics.layoutDurationMs}ms`)
    console.log(`  Script 耗时:  ${result.metrics.scriptDurationMs}ms`)
    console.log(`  Task 总耗时:  ${result.metrics.taskDurationMs}ms`)
    console.log('--------------------------------------------------------')
    console.log(`判定:          ${result.passed ? '✅ 通过' : '❌ 失败'}`)
    console.log(`原因:          ${result.reason}`)
    console.log(`报告文件:      ${reportPath}`)
    console.log('========================================================\n')

    // ── 9. 断言 ──
    expect(batchAddMs, `批量加入 ${STOCK_COUNT} 只耗时 ${batchAddMs}ms，应 < ${PERFORMANCE_THRESHOLD_MS}ms`).toBeLessThan(
      PERFORMANCE_THRESHOLD_MS,
    )
    expect(
      longTaskMaxMs,
      `存在长任务 ${longTaskMaxMs.toFixed(0)}ms，应 < 200ms`,
    ).toBeLessThan(200)

    await cleanupStocks(page)
  })

  test('BAT-06: 加入过程中按钮持续 disabled 防重复点击', async ({ page }) => {
    const sectorCodeEncoded = encodeURIComponent(TEST_SECTOR_CODE)
    const sectorNameEncoded = encodeURIComponent(TEST_SECTOR)
    const stocks = makeStocks(STOCK_COUNT, TEST_SECTOR)
    await page.goto('/#/analysis')
    await seedStocks(page, stocks)

    await page.goto(
      `/#/analysis/hot-sector-stocks/${sectorCodeEncoded}?name=${sectorNameEncoded}`,
    )
    await expect(page.locator('tbody tr')).toHaveCount(STOCK_COUNT, { timeout: 15000 })

    await page.getByRole('button', { name: /全选/ }).click()
    await expect(page.getByText(`已选 ${STOCK_COUNT} / ${STOCK_COUNT}`)).toBeVisible()

    const addBtn = page.getByRole('button', { name: /加入意向股票池/ })
    await addBtn.click()

    const loadingBtn = page.getByRole('button', { name: /加入中/ })
    await expect(loadingBtn).toBeVisible({ timeout: 2000 })
    await expect(loadingBtn).toBeDisabled()

    await expect(page.getByText(new RegExp(`成功 ${STOCK_COUNT} 只`))).toBeVisible({
      timeout: 30000,
    })

    await cleanupStocks(page)
  })
})
