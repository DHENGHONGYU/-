import { test, expect } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    errors.push('PAGE_ERROR: ' + err.message)
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'e2e-debug-homepage.png', fullPage: true })
  
  const title = await page.title()
  console.log('Page title:', title)
  console.log('Errors:', JSON.stringify(errors.slice(0, 5)))
  
  // Try to find any text on the page
  const bodyText = await page.locator('body').innerText()
  console.log('Body text (first 500 chars):', bodyText.substring(0, 500))
  
  expect(errors.filter(e => !e.includes('ResizeObserver')).length, 'No critical errors').toBe(0)
})