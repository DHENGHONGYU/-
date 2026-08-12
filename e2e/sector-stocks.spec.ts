/**
 * @test_id V9-TEST-E2E-SECTOR-STOCKS
 * @covers_docs [V9-DOC-FRONT-020, V9-DOC-DATA-031, V9-DOC-QA-036]
 * @acceptance_checklist docs/reports/testing/sector-stocks-ui-acceptance-checklist.md
 *
 * 板块个股清单页面 E2E 测试
 * 重点覆盖：路由参数传递（RTE 系列）+ 批量操作性能（BAT 系列）
 *
 * 运行方式:
 *   npx playwright test sector-stocks --project=chromium
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_SECTOR_CODE = 'SW-半导体'
const TEST_SECTOR_NAME = '半导体'
const TEST_SECTOR_CODE_ENCODED = encodeURIComponent(TEST_SECTOR_CODE)

function makeTestStocks(count: number, sector: string): Record<string, unknown>[] {
  const stocks: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    const code = String(600000 + i).padStart(6, '0')
    stocks.push({
      symbol: `${code}.SH`,
      name: `测试${sector}${i}`,
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
      if (name && name.startsWith('测试')) {
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
    if (!db.objectStoreNames.contains('stocks')) { db.close(); return }
    const tx = db.transaction('stocks', 'readwrite')
    const store = tx.objectStore('stocks')
    const allReq = store.getAll()
    const allRecords: Record<string, unknown>[] = await new Promise((resolve, reject) => {
      allReq.onsuccess = () => resolve(allReq.result)
      allReq.onerror = () => reject(allReq.error)
    })
    for (const record of allRecords) {
      const name = record.name as string
      if (name && name.startsWith('测试')) {
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

test.describe('板块个股清单页面 E2E', () => {
  test.beforeEach(async ({ page }) => {
    const stocks = [...makeTestStocks(10, TEST_SECTOR_NAME), ...makeTestStocks(5, '传媒')]
    await page.goto('/#/analysis')
    await seedStocks(page, stocks)
  })

  test.afterEach(async ({ page }) => {
    await cleanupStocks(page)
  })

  // ── 三、路由参数传递 ──

  test.describe('路由参数传递', () => {
    test('RTE-01: sectorCode + name 参数正确传递并渲染', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(`${TEST_SECTOR_NAME} · 板块个股清单`)).toBeVisible()
      await expect(page.getByText(`板块代码: ${TEST_SECTOR_CODE}`)).toBeVisible()
      await expect(page.locator('tbody tr')).toHaveCount(10)
    })

    test('RTE-03: 缺少 name 查询参数时降级使用 sectorCode', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}`)
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(`${TEST_SECTOR_CODE} · 板块个股清单`)).toBeVisible()
    })

    test('RTE-04: sectorCode 为空时显示未知板块且不查询', async ({ page }) => {
      await page.goto('/#/analysis/hot-sector-stocks/')
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('未知板块 · 板块个股清单')).toBeVisible()
      await expect(page.getByText('板块代码: N/A')).toBeVisible()
      await expect(page.locator('tbody tr')).toHaveCount(0)
    })

    test('RTE-05: 含特殊字符的 sectorCode 正确解码', async ({ page }) => {
      const specialCode = encodeURIComponent('半导体&芯片')
      await page.goto(`/#/analysis/hot-sector-stocks/${specialCode}?name=${encodeURIComponent('半导体&芯片')}`)
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('半导体&芯片 · 板块个股清单')).toBeVisible()
    })

    test('RTE-06: 点击返回板块列表导航到热门板块策略页', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await page.getByRole('link', { name: /返回板块列表/ }).click()
      await expect(page).toHaveURL(/\/analysis\/hot-sector$/)
    })

    test('RTE-08: 连续访问两个板块不残留前一个板块的数据', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('tbody tr')).toHaveCount(10)
      const mediaCode = encodeURIComponent('SW-传媒')
      await page.goto(`/#/analysis/hot-sector-stocks/${mediaCode}?name=${encodeURIComponent('传媒')}`)
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('tbody tr')).toHaveCount(5)
      await expect(page.locator('tbody')).not.toContainText('测试半导体')
    })
  })

  // ── 二、批量操作性能 ──

  test.describe('批量操作', () => {
    test('BAT-07: 未勾选任何股票时加入按钮 disabled', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.getByText('板块个股清单')).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('button', { name: /加入意向股票池/ })).toBeDisabled()
    })

    test('BAT-01: 勾选 3 只股票批量加入意向池', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.locator('tbody tr')).toHaveCount(10, { timeout: 10000 })
      const checkboxes = page.locator('tbody input[type="checkbox"]')
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()
      await checkboxes.nth(2).check()
      await expect(page.getByText('已选 3 / 10')).toBeVisible()
      await page.getByRole('button', { name: /加入意向股票池/ }).click()
      await expect(page.getByText(/成功 3 只/)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('已选 0 / 10')).toBeVisible()
    })

    test('BAT-09: 快速连续点击加入按钮只产生一次操作', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.locator('tbody tr')).toHaveCount(10, { timeout: 10000 })
      const checkboxes = page.locator('tbody input[type="checkbox"]')
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()
      const addBtn = page.getByRole('button', { name: /加入意向股票池/ })
      await addBtn.click({ clickCount: 3 })
      await expect(page.getByText(/成功 2 只/)).toBeVisible({ timeout: 10000 })
      expect(await page.getByText(/成功 2 只/).count()).toBe(1)
    })

    test('BAT-10: 已加入的股票再次加入提示已在池中', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.locator('tbody tr')).toHaveCount(10, { timeout: 10000 })
      const checkboxes = page.locator('tbody input[type="checkbox"]')
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()
      await page.getByRole('button', { name: /加入意向股票池/ }).click()
      await expect(page.getByText(/成功 2 只/)).toBeVisible({ timeout: 10000 })
      await page.waitForTimeout(2000)
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()
      await page.getByRole('button', { name: /加入意向股票池/ }).click()
      await expect(page.getByText(/已在池中 2 只/)).toBeVisible({ timeout: 10000 })
    })

    test('BAT-03: 勾选 10 只股票批量加入 < 3 秒', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.locator('tbody tr')).toHaveCount(10, { timeout: 10000 })
      await page.getByRole('button', { name: /全选/ }).click()
      await expect(page.getByText('已选 10 / 10')).toBeVisible()
      const start = Date.now()
      await page.getByRole('button', { name: /加入意向股票池/ }).click()
      await expect(page.getByText(/成功 10 只/)).toBeVisible({ timeout: 15000 })
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(3000)
      await expect(page.getByText('已选 0 / 10')).toBeVisible()
    })

    test('BAT-05: 勾选 30 只股票批量加入 < 8 秒', async ({ page }) => {
      const stocks30 = makeTestStocks(30, TEST_SECTOR_NAME)
      await seedStocks(page, stocks30)
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.locator('tbody tr')).toHaveCount(30, { timeout: 10000 })
      await page.getByRole('button', { name: /全选/ }).click()
      await expect(page.getByText('已选 30 / 30')).toBeVisible()
      const start = Date.now()
      await page.getByRole('button', { name: /加入意向股票池/ }).click()
      await expect(page.getByText(/成功 30 只/)).toBeVisible({ timeout: 20000 })
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(8000)
    })
  })

  // ── 一、选中状态反馈（快速冒烟） ──

  test.describe('选中状态反馈', () => {
    test('SEL-01: 勾选单行后 Badge 联动 + 按钮 enabled', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.locator('tbody tr')).toHaveCount(10, { timeout: 10000 })
      const addBtn = page.getByRole('button', { name: /加入意向股票池/ })
      await expect(addBtn).toBeDisabled()
      await page.locator('tbody input[type="checkbox"]').first().check()
      await expect(page.getByText('已选 1 / 10')).toBeVisible()
      await expect(addBtn).toBeEnabled()
    })

    test('SEL-04/05: 全选后清除恢复初始状态', async ({ page }) => {
      await page.goto(`/#/analysis/hot-sector-stocks/${TEST_SECTOR_CODE_ENCODED}?name=${encodeURIComponent(TEST_SECTOR_NAME)}`)
      await expect(page.locator('tbody tr')).toHaveCount(10, { timeout: 10000 })
      await page.getByRole('button', { name: /全选/ }).click()
      await expect(page.getByText('已选 10 / 10')).toBeVisible()
      await page.getByRole('button', { name: /清除/ }).click()
      await expect(page.getByText('已选 0 / 10')).toBeVisible()
      await expect(page.getByRole('button', { name: /加入意向股票池/ })).toBeDisabled()
    })
  })
})
