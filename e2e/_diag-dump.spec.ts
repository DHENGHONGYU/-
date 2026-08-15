import { test } from '@playwright/test'

test('diag: full capture after reload', async ({ page }) => {
  const allLogs: string[] = []
  page.on('pageerror', (e) => allLogs.push('[PAGEERROR] ' + e.message + (e.stack ? '\n' + e.stack.split('\n').slice(0, 3).join('\n') : '')))
  page.on('console', (msg) => allLogs.push('[' + msg.type() + '] ' + msg.text().slice(0, 250)))
  page.on('requestfailed', (req) => allLogs.push('[REQFAIL] ' + req.url().slice(0, 100) + ' :: ' + (req.failure()?.errorText || '')))

  await page.goto('/#/input', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  const info = await page.evaluate(() => {
    const root = document.getElementById('root')
    const skeleton = document.querySelector('[class*="keleton"], [class*="animate-pulse"]')
    return {
      rootChildren: root?.childElementCount ?? -1,
      rootHtml: root?.innerHTML.slice(0, 600) ?? 'NO #root',
      bodyText: document.body.innerText.slice(0, 400),
      hasSkeleton: !!skeleton,
      scriptTags: Array.from(document.querySelectorAll('script')).map((s) => s.src || s.textContent?.slice(0, 50) || '').slice(0, 5),
    }
  })
  // eslint-disable-next-line no-console
  console.log('=== PAGE INFO ===\n' + JSON.stringify(info, null, 2))
  // eslint-disable-next-line no-console
  console.log('=== ALL LOGS (' + allLogs.length + ') ===\n' + (allLogs.length ? allLogs.slice(0, 30).join('\n') : 'none'))
})
